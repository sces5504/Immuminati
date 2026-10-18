import { createServer } from "vite";
import { writeFile, mkdir } from "node:fs/promises";
const vite = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: "custom",
});
try {
  const { tacticalScenarios } = await vite.ssrLoadModule(
    "/src/tactics/content/m1.ts",
  );
  const { deploymentKits } = await vite.ssrLoadModule(
    "/src/tactics/content/deployment.ts",
  );
  const {
    createTactical,
    createDeployment,
    commandTactical,
    stepTactical,
    loadOf,
  } = await vite.ssrLoadModule("/src/tactics/engine/simulation.ts");
  const choices = {
    m1: ["dendritic", "c"],
    m2: ["dendritic", "a"],
    m3: ["macrophage", "b"],
    m4: ["cytotoxicT", "b"],
    m5: ["th17", "a"],
    m6: ["cytotoxicT", "b"],
  };
  const plans = {
    m1: [[0, "neutrophil", "a"]],
    m2: [
      [0, "neutrophil", "b"],
      [100, "macrophage", "b"],
      [260, "neutrophil", "c"],
    ],
    m3: [
      [0, "th1", "a"],
      [180, "macrophage", "a"],
    ],
    m4: [
      [0, "macrophage", "a"],
      [160, "pdc", "a"],
      [300, "helperT", "c"],
      [450, "bcell", "c"],
    ],
    m5: [
      [0, "neutrophil", "b"],
      [150, "neutrophil", "a"],
      [300, "neutrophil", "c"],
    ],
    m6: [
      [0, "pdc", "a"],
      [150, "pdc", "a"],
    ],
  };
  const results = [];
  for (const c of Object.values(tacticalScenarios))
    for (const mode of ["legacy-observe", "kit-observe", "selected-defense"]) {
      let s =
        mode === "legacy-observe" ? createTactical(c) : createDeployment(c);
      const commands = [];
      const issue = (cmd) => {
        const r = commandTactical(s, cmd, c);
        commands.push({
          tick: s.tick,
          cmd,
          accepted: !r.error,
          error: r.error,
        });
        s = r.state;
      };
      if (s.preparation) {
        issue({ type: "deploy-kit", kit: deploymentKits[c.id][0].id });
        if (mode === "selected-defense")
          issue({
            type: "deploy",
            kind: choices[c.id][0],
            region: choices[c.id][1],
          });
        issue({ type: "begin" });
      }
      while (!s.result && s.tick < c.limit) {
        if (mode === "selected-defense") {
          for (const [tick, kind, region] of plans[c.id])
            if (tick === s.tick) issue({ type: "recruit", kind, region });
          if (s.tick % 50 === 0 && s.support && s.energy) {
            const p = s.colonies.find(
              (p) => (p.complementUntil ?? 0) <= s.tick,
            );
            if (p) issue({ type: "mark", target: p.id });
          }
        }
        s = stepTactical(s, c);
      }
      const row = {
        case: c.id,
        mode,
        result: s.result,
        burden: loadOf(s),
        commands,
      };
      results.push(row);
      console.log(c.id, mode, JSON.stringify(s.result), "burden", row.burden);
      if (
        mode === "selected-defense" &&
        s.result?.type !== (c.id === "m6" ? "limited" : "victory")
      )
        process.exitCode = 1;
    }
  const out = process.env.EVIDENCE_DIR ?? "docs/evidence/deployment-v31/";
  await mkdir(out, { recursive: true });
  await writeFile(
    out + "/policies.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        note: "Pure-engine legal commands, not browser playthroughs. The legacy-observe factory uses historical preselected teams; new games never use that factory directly.",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await vite.close();
}
