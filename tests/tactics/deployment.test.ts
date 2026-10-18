import { describe, it, expect } from "vitest";
import { tacticalScenarios, m1 } from "../../src/tactics/content/m1";
import {
  deploymentKits,
  DEPLOYMENT_BUDGET,
} from "../../src/tactics/content/deployment";
import { TacticalController } from "../../src/tactics/application/controller";
import {
  createDeployment,
  createTactical,
  stepTactical,
  commandTactical,
} from "../../src/tactics/engine/simulation";
import { parseTactical } from "../../src/tactics/persistence/save";
import type { TacticalCommand, CellType } from "../../src/tactics/domain/model";

describe("player-owned opening deployment", () => {
  it("no untouched new case can advance or win; only M3 retains its infected host", () => {
    for (const c of Object.values(tacticalScenarios)) {
      const ctrl = new TacticalController(c);
      const before = ctrl.snapshot();
      expect(before.state.cells.length).toBe(c.id === "m3" ? 1 : 0);
      ctrl.pause(false);
      for (let i = 0; i < c.limit + 1; i++) ctrl.step();
      expect(ctrl.snapshot()).toEqual(before);
      expect(stepTactical(before.state, c)).toEqual(before.state);
      expect(ctrl.command({ type: "begin" })).toContain("至少一個");
      expect(parseTactical(JSON.stringify(ctrl.snapshot()), c)).toEqual(
        ctrl.snapshot(),
      );
    }
  });
  it("every knowledge kit is affordable and preserves infections, unactivated cells and independent combat resources", () => {
    for (const c of Object.values(tacticalScenarios))
      for (const kit of deploymentKits[c.id]) {
        const ctrl = new TacticalController(c),
          original = ctrl.snapshot();
        expect(
          ctrl.command({ type: "deploy-kit", kit: kit.id }),
        ).toBeUndefined();
        expect(ctrl.save.state.preparation!.remaining).toBe(
          DEPLOYMENT_BUDGET -
            kit.units.reduce((n, u) => n + c.cells[u.kind].cost, 0),
        );
        expect(ctrl.save.state.internal).toEqual(original.state.internal);
        expect(ctrl.save.state.hosts).toEqual(original.state.hosts);
        expect(ctrl.save.state.energy).toBe(5);
        expect(ctrl.save.state.support).toBe(6);
        expect(
          ctrl.save.state.cells.every((u) => !u.activation && !u.antigen),
        ).toBe(true);
        expect(ctrl.save.state.immunity.antibodies).toBe(0);
        expect(parseTactical(JSON.stringify(ctrl.snapshot()), c)).toEqual(
          ctrl.snapshot(),
        );
        expect(ctrl.command({ type: "begin" })).toBeUndefined();
        expect(ctrl.save.undo).toEqual([]);
        ctrl.pause(false);
        ctrl.step();
        expect(ctrl.save.state.tick).toBe(1);
      }
  });
  it("withdrawal refunds exactly once, cannot erase infected hosts, and preparation undo is atomic", () => {
    const ctrl = new TacticalController(tacticalScenarios.m3),
      before = ctrl.snapshot();
    expect(
      ctrl.command({ type: "withdraw", cell: before.state.cells[0].id }),
    ).toContain("感染");
    ctrl.command({ type: "deploy", kind: "th1", region: "a" });
    const selected = ctrl.snapshot();
    expect(
      ctrl.command({ type: "withdraw", cell: selected.state.cells.at(-1)!.id }),
    ).toBeUndefined();
    expect(ctrl.save.state.preparation!.remaining).toBe(DEPLOYMENT_BUDGET);
    const refund = ctrl.snapshot();
    expect(
      ctrl.command({ type: "withdraw", cell: selected.state.cells.at(-1)!.id }),
    ).toContain("不存在");
    expect(ctrl.snapshot()).toEqual(refund);
    ctrl.undo();
    expect(ctrl.save.state).toEqual(selected.state);
    ctrl.undo();
    expect(ctrl.save.state).toEqual(before.state);
  });
  it("rejects out-of-budget, differentiation-only, unknown-region and in-combat deployment commands", () => {
    const ctrl = new TacticalController(m1);
    for (let i = 0; i < 3; i++)
      expect(
        ctrl.command({ type: "deploy", kind: "macrophage", region: "a" }),
      ).toBeUndefined();
    for (const cmd of [
      { type: "deploy", kind: "nk", region: "a" },
      { type: "deploy", kind: "plasma", region: "a" },
      { type: "deploy", kind: "nk", region: "x" },
      { type: "recruit", kind: "nk", region: "a" },
    ] as TacticalCommand[])
      expect(ctrl.command(cmd)).toBeTruthy();
    ctrl.command({ type: "begin" });
    expect(ctrl.command({ type: "deploy", kind: "nk", region: "a" })).toContain(
      "部署已確認",
    );
  });
  it("migrates 3.0 active state and undo without discarding the existing team or adding deployment", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1, 2);
    ctrl.command({ type: "autoseek", enabled: false });
    const raw = { ...ctrl.snapshot(), rules: "3.0", content: "campaign.1" };
    const migrated = parseTactical(JSON.stringify(raw), m1);
    expect(migrated.state).toEqual(raw.state);
    expect(migrated.undo).toEqual(raw.undo);
    expect(migrated.state.preparation).toBeUndefined();
    expect(migrated.state.immunity.autoSeek).toBe(false);
    expect(migrated.rules).toBe("3.1");
  });
  it("rejects forged preparation budget, running phase and undo frames", () => {
    const ctrl = new TacticalController(m1);
    ctrl.command({ type: "deploy", kind: "macrophage", region: "a" });
    for (const corrupt of [
      () => {
        const raw = ctrl.snapshot();
        raw.state.preparation!.remaining++;
        return raw;
      },
      () => {
        const raw = ctrl.snapshot();
        raw.paused = false;
        return raw;
      },
      () => {
        const raw = ctrl.snapshot();
        raw.undo[0].tick = 1;
        return raw;
      },
    ])
      expect(() => parseTactical(JSON.stringify(corrupt()), m1)).toThrow();
  });
});

describe("newly configured six-case defenses", () => {
  const additions: Record<string, [CellType, string]> = {
    m1: ["dendritic", "c"],
    m2: ["dendritic", "a"],
    m3: ["macrophage", "b"],
    m4: ["cytotoxicT", "b"],
    m5: ["th17", "a"],
    m6: ["cytotoxicT", "b"],
  };
  const plans: Record<string, [number, CellType, string][]> = {
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
  for (const c of Object.values(tacticalScenarios))
    it(`${c.id}: selected kit, custom addition and legal support reach the scenario-specific outcome`, () => {
      const ctrl = new TacticalController(c);
      expect(
        ctrl.command({ type: "deploy-kit", kit: deploymentKits[c.id][0].id }),
      ).toBeUndefined();
      expect(
        ctrl.command({
          type: "deploy",
          kind: additions[c.id][0],
          region: additions[c.id][1],
        }),
      ).toBeUndefined();
      expect(ctrl.command({ type: "begin" })).toBeUndefined();
      let s = ctrl.save.state;
      while (!s.result && s.tick < c.limit) {
        for (const [tick, kind, region] of plans[c.id])
          if (tick === s.tick)
            s = commandTactical(s, { type: "recruit", kind, region }, c).state;
        if (s.tick % 50 === 0 && s.support > 0 && s.energy > 0) {
          const p = s.colonies.find((p) => (p.complementUntil ?? 0) <= s.tick);
          if (p)
            s = commandTactical(s, { type: "mark", target: p.id }, c).state;
        }
        if (s.tick === 150) {
          ctrl.save.state = s;
          expect(
            parseTactical(JSON.stringify(ctrl.snapshot()), c).state,
          ).toEqual(s);
        }
        s = stepTactical(s, c);
      }
      expect(s.result?.type).toBe(c.id === "m6" ? "limited" : "victory");
      ctrl.save.state = s;
      expect(parseTactical(JSON.stringify(ctrl.snapshot()), c).state).toEqual(
        s,
      );
      if (c.id === "m3") expect(s.internal.some((i) => i.load > 0)).toBe(true);
      if (c.id === "m6") {
        expect(s.result!.stars).toBe(0);
        expect(s.hosts.some((h) => h.infection?.phase === "latent")).toBe(true);
      }
    });
});
