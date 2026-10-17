import { describe, it, expect } from "vitest";
import { M1, ANTIGEN } from "../../src/rts/content/m1";
import {
  createState,
  step,
  spawn,
  makeUnit,
  commit,
  sample,
} from "../../src/rts/engine/simulation";
import { Session } from "../../src/rts/application/session";
import { decode } from "../../src/rts/persistence/save";
import type { State, Command, Scenario } from "../../src/rts/domain/types";
const run = (s: State, n: number, c = M1, commands: Command[] = []) => {
  for (let i = 0; i < n && !s.result; i++)
    step(
      s,
      commands.filter((x) => x.step === s.step + 1),
      c,
    );
  return s;
};
function strategy(type: "innate" | "adaptive" | "intense", seed = 5504) {
  const s = createState(seed);
  let id = 1;
  for (let i = 0; i < M1.timeLimit && !s.result; i++) {
    const commands: Command[] = [];
    const add = (x: Omit<Command, "id" | "step">) =>
      commands.push({ ...x, id: `c${id++}`, step: s.step + 1 });
    if (type === "innate" && i % 100 === 0)
      add({
        type: "move",
        unit: s.units.find((u) => u.kind === "dendritic")!.id,
        point: { x: 60, y: 60 },
      });
    if (i === 0) {
      add({ type: "recruit", point: { x: 650, y: 300 } });
      if (type !== "innate") add({ type: "support" });
      if (type === "intense") add({ type: "policy", policy: "intense" });
    }
    if (i % 100 === 0 && s.resources > 40) {
      if (type === "innate") {
        const b = s.pathogens.find(
          (b) => b.compartment === "external" && b.opsonin === "none",
        );
        if (b) add({ type: "opsonize", target: b.id });
      }
      if (s.resources > 55 && s.supply >= 1)
        add({ type: "recruit", point: { x: 650, y: 300 } });
    }
    step(s, commands);
  }
  return s;
}
describe("RTS v2 M1", () => {
  it("pathogen replication splits spatial groups and dead hosts release viable cargo", () => {
    const s = createState();
    s.units = [];
    run(s, 200, { ...M1, sourceSteps: [], tissueDamage: 0 });
    expect(s.events.some((e) => e.type === "split")).toBe(true);
    expect(s.pathogens.length).toBeGreaterThan(2);
    const t = createState();
    t.pathogens = [];
    t.units = [makeUnit(t, "neutrophil", { x: 500, y: 300 })];
    const u = t.units[0],
      b = spawn(t, u, 4, true);
    b.compartment = "internal";
    b.host = u.id;
    u.cargo = b.id;
    u.target = b.id;
    u.action = "survive";
    u.life = 1;
    step(t, [], { ...M1, sourceSteps: [] });
    expect(b.compartment).toBe("external");
    expect(b.host).toBeUndefined();
    expect(t.events.some((e) => e.type === "release")).toBe(true);
  });
  it("every saved action checkpoint roundtrips and continuation matches uninterrupted simulation", () => {
    const g = new Session();
    g.enqueue({ type: "recruit", point: { x: 650, y: 300 } });
    g.paused = false;
    for (let i = 0; i < 550; i++) {
      g.tick();
      if (i % 10 === 0) {
        const restored = new Session(decode(JSON.stringify(g.snapshot())));
        restored.paused = false;
        const original = new Session(structuredClone(g.snapshot()));
        original.paused = false;
        restored.tick();
        original.tick();
        expect(restored.state).toEqual(original.state);
      }
    }
  });
  it("content validation rejects unstable diffusion and impossible source timelines", () => {
    expect(() => createState(1, { ...M1, signalDiffusion: 0.5 })).toThrow();
    expect(() => createState(1, { ...M1, sourceClose: 100 })).toThrow();
  });
  it("autonomous cells contact, signal, capture, migrate and clear without clicks", () => {
    const s = run(createState(), 1200);
    expect(s.events.some((e) => e.type === "contact")).toBe(true);
    expect(s.events.some((e) => e.type === "clear")).toBe(true);
    expect(s.events.some((e) => e.type === "signal")).toBe(true);
    expect(s.node.phase).not.toBe("antigen");
    expect(s.endothelial).toBeGreaterThan(0);
  });
  it("two legal strategies win; adaptive response reaches tissue and has correct target", () => {
    for (const type of ["innate", "adaptive"] as const) {
      const s = strategy(type);
      console.log(
        type,
        JSON.stringify({
          result: s.result,
          tissue: s.tissue,
          node: s.node,
          damage: s.damage,
          stats: s.stats,
          step: s.step,
        }),
      );
      expect(s.result?.outcome).toBe("won");
      if (type === "innate") expect(s.node.phase).toBe("antigen");
      if (type === "adaptive") {
        expect(s.node.phase).toBe("active");
        expect(s.events.some((e) => e.type === "antibody")).toBe(true);
        expect(s.node.antigen).toBe(ANTIGEN);
      }
    }
  });
  it("inflammation policy changes damage and suppressed response delays endothelial activation", () => {
    const a = strategy("adaptive"),
      b = strategy("intense");
    expect(b.damage.inflammation).toBeGreaterThan(a.damage.inflammation);
    const low = createState(),
      normal = createState();
    low.policy = "restrained";
    run(low, 100);
    run(normal, 100);
    expect(low.endothelial).toBeLessThan(normal.endothelial);
  });
  it("commands reject invalid targets and duplicate IDs never charge twice", () => {
    const s = createState();
    const cmd: Command = {
      id: "c1",
      step: 1,
      type: "recruit",
      point: { x: 500, y: 300 },
    };
    commit(s, cmd);
    const r = s.resources;
    commit(s, cmd);
    expect(s.resources).toBe(r);
    expect(s.recruits).toHaveLength(1);
    commit(s, {
      id: "c3",
      step: 1,
      type: "move",
      unit: s.units[0].id,
      point: { x: 500, y: 600 },
    });
    expect(s.units[0].order).toBeUndefined();
    commit(s, { id: "c2", step: 1, type: "opsonize", target: "missing" });
    expect(s.resources).toBe(r);
    expect(s.events.some((e) => e.type === "rejected")).toBe(true);
  });
  it("planning reserves supply/resources, cancels and freezes clocks", () => {
    const g = new Session();
    for (let i = 0; i < 3; i++)
      expect(
        g.enqueue({ type: "recruit", point: { x: 600, y: 300 } }),
      ).toBeUndefined();
    expect(g.enqueue({ type: "recruit", point: { x: 600, y: 300 } })).toBe(
      "反應資源不足",
    );
    const before = structuredClone(g.state);
    g.tick();
    expect(g.state).toEqual(before);
    g.cancel(g.plans[0].id);
    g.paused = false;
    g.tick();
    expect(g.state.resources).toBeCloseTo(55 - 30 + 0.13);
    expect(g.state.recruits).toHaveLength(2);
  });
  it("recruitment waits for real endothelial condition and arrives from vessel", () => {
    const s = createState();
    s.units = [];
    s.pathogens = [];
    commit(s, {
      id: "c1",
      step: 1,
      type: "recruit",
      point: { x: 700, y: 300 },
    });
    run(s, 100);
    expect(s.recruits[0].phase).toBe("waiting");
    s.endothelial = 40;
    run(s, 51);
    expect(s.stats.recruited).toBe(1);
    expect(s.units[0].x).toBeLessThan(300);
    expect(s.units[0].y).toBeGreaterThan(400);
  });
  it("30 groups in one focus can enter and act; no old 3/7 capacity rule", () => {
    const s = createState();
    s.units = [];
    s.pathogens = [];
    for (let i = 0; i < 30; i++) {
      const u = makeUnit(s, "neutrophil", { x: 600, y: 300 });
      s.units.push(u);
      const b = spawn(s, { x: 610, y: 305 }, 4);
      b.opsonin = "complement";
    }
    run(s, 70);
    expect(s.units).toHaveLength(30);
    expect(s.stats.cleared).toBeGreaterThan(60);
    expect(s.events.filter((e) => e.type === "rejected")).toHaveLength(0);
  });
  it("opsonization is not damage and capsule decreases ingestion; survival blocks victory", () => {
    const s = createState();
    const b = s.pathogens[0],
      load = b.load;
    commit(s, { id: "c1", step: 1, type: "opsonize", target: b.id });
    expect(b.load).toBe(load);
    const t = createState();
    t.pathogens = [];
    t.units = t.units.slice(0, 1);
    t.units[0].x = 450;
    t.units[0].y = 300;
    const p = spawn(t, { x: 480, y: 300 }, 4, true);
    p.opsonin = "complement";
    run(t, 650, { ...M1, sourceSteps: [] });
    expect(t.pathogens[0]?.compartment).toBe("internal");
    expect(t.units[0].action).toBe("survive");
    expect(t.result).toBeUndefined();
    expect(t.events.some((e) => e.type === "survival")).toBe(true);
  });
  it("signal field diffuses/decays and gradient affects chemotaxis without damage", () => {
    const a = createState(),
      b = createState();
    for (const s of [a, b]) {
      s.units = [makeUnit(s, "neutrophil", { x: 400, y: 300 })];
      s.pathogens = [];
      s.field.fill(0);
    }
    a.field[7 * 25 + 12] = 8;
    b.field[7 * 25 + 7] = 8;
    run(a, 25, { ...M1, sourceSteps: [] });
    run(b, 25, { ...M1, sourceSteps: [] });
    expect(a.units[0].x).toBeGreaterThan(b.units[0].x);
    expect(a.damage.pathogen).toBe(0);
    expect(a.field.reduce((n, v) => n + v, 0)).toBeLessThan(8);
    expect(sample(a, { x: 500, y: 300 })).toBeGreaterThan(0);
  });
  it("node stages have delays, antigen conditions and specificity", () => {
    const s = createState();
    commit(s, { id: "c1", step: 1, type: "dispatch", unit: s.units[2].id });
    expect(s.node.phase).toBe("antigen");
    run(s, 300);
    const events = s.events.filter((e) => e.type === "node");
    for (let i = 1; i < events.length; i++)
      expect(events[i].step - events[i - 1].step).toBeGreaterThan(20);
    expect(s.node.phase).not.toBe("active");
  });
  it("future sources prevent early victory and failure takes tie priority", () => {
    const s = createState();
    s.pathogens = [];
    run(s, 3);
    expect(s.result).toBeUndefined();
    const t = createState();
    t.step = 549;
    t.tissue = 0;
    t.pathogens = [];
    step(t);
    expect(t.result?.outcome).toBe("lost");
  });
  it("all speed/motion sessions produce identical state/events at equal step count", () => {
    const output = [];
    for (const speed of [1, 2, 4] as const)
      for (const motion of ["normal", "skip", "reduced"] as const) {
        const g = new Session();
        g.settings = { speed, motion, signals: motion === "reduced" };
        g.enqueue({ type: "recruit", point: { x: 660, y: 310 } });
        g.paused = false;
        for (let i = 0; i < 600; i++) g.tick();
        output.push(g.state);
      }
    for (const s of output) expect(s).toEqual(output[0]);
  });
  it("save restores signals/AI/node/plans/RNG without replay and rejects corrupt imports", () => {
    const g = new Session();
    g.paused = false;
    for (let i = 0; i < 310; i++) g.tick();
    g.paused = true;
    g.enqueue({ type: "recruit", point: { x: 600, y: 300 } });
    const raw = JSON.stringify(g.snapshot()),
      saved = decode(raw),
      resumed = new Session(saved);
    expect(resumed.paused).toBe(true);
    expect(resumed.snapshot()).toEqual(JSON.parse(raw));
    const bad = JSON.parse(raw);
    bad.state.field[0] = -1;
    expect(() => decode(JSON.stringify(bad))).toThrow();
    bad.state.field[0] = 0;
    bad.state.pathogens[0].compartment = "internal";
    expect(() => decode(JSON.stringify(bad))).toThrow();
    expect(() => decode(raw.replace("rts-m1-1", "legacy"))).toThrow();
  });
  it("different content configuration changes scenario without M1 engine branch", () => {
    const c: Scenario = {
      ...M1,
      id: "test",
      signalStrength: 0,
      foci: [{ x: 440, y: 300 }],
      sourceSteps: [],
      sourceClose: 100,
    };
    const s = createState(123, c);
    run(s, 300, c);
    expect(s.scenarioId).toBe("test");
    expect(s.field.every((v) => v === 0)).toBe(true);
    expect(s.events.some((e) => e.type === "contact")).toBe(true);
  });
});
