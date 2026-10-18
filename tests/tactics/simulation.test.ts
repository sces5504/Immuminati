import { describe, it, expect } from "vitest";
import { m1 } from "../../src/tactics/content/m1";
import {
  commandTactical,
  copy,
  createTactical,
  distance,
  loadOf,
  occupied,
  stepTactical,
  validateTactical,
  walkable,
} from "../../src/tactics/engine/simulation";
import { TacticalController } from "../../src/tactics/application/controller";
import { parseTactical } from "../../src/tactics/persistence/save";
import type {
  TacticalCommand,
  TacticalState,
} from "../../src/tactics/domain/model";
const send = (s: TacticalState, cmd: TacticalCommand) => {
  const r = commandTactical(s, cmd, m1);
  expect(r.error).toBeUndefined();
  return r.state;
};
function defend(seed: number, plan: "reinforce" | "dispatch") {
  let s = createTactical(m1, seed);
  const transcript: TacticalCommand[] = [];
  const issue = (cmd: TacticalCommand) => {
    if (validateTactical(s, cmd, m1)) return false;
    s = send(s, cmd);
    transcript.push(copy(cmd));
    return true;
  };
  while (!s.result && s.tick <= m1.limit) {
    for (const p of [...s.colonies].sort((a, b) => b.load - a.load))
      if (
        p.markedUntil <= s.tick &&
        p.load >= 5 &&
        s.energy > 0 &&
        s.support > 0
      )
        issue({ type: "mark", target: p.id });
    if (s.tick === 0) {
      if (plan === "reinforce")
        issue({ type: "recruit", kind: "neutrophil", region: "c" });
      else {
        const mac = s.cells.find((u) => u.kind === "macrophage")!;
        issue({
          type: "attack",
          cell: mac.id,
          target: s.colonies.find((p) => p.region === "c")!.id,
        });
      }
    }
    for (const u of s.cells.filter((u) => u.kind !== "dendritic")) {
      const local = s.colonies.filter(
        (p) => p.region === u.region && p.load > 0,
      );
      if (!local.length && s.colonies.length) {
        const target = [...s.colonies]
          .sort(
            (a, b) =>
              distance(u.position, a.position) -
              distance(u.position, b.position),
          )
          .find(
            (p) =>
              !validateTactical(
                s,
                { type: "attack", cell: u.id, target: p.id },
                m1,
              ),
          );
        if (target) issue({ type: "attack", cell: u.id, target: target.id });
      }
    }
    if (loadOf(s) === 0 && s.wave < m1.waves.length - 1)
      issue({ type: "advance" });
    s = stepTactical(s, m1);
  }
  return { s, transcript };
}
describe("spatial fixed-step tactics", () => {
  it("rejects illegal support and targets without mutation", () => {
    const s = createTactical(m1);
    const frozen = copy(s);
    for (const cmd of [
      { type: "mark", target: "missing" },
      { type: "attack", cell: "missing", target: "p4" },
      { type: "move", cell: "u1", point: { x: 100, z: 0 } },
      { type: "recruit", kind: "plasma", region: "a" },
    ] as TacticalCommand[]) {
      const r = commandTactical(s, cmd, m1);
      expect(r.error).toBeTruthy();
      expect(r.state).toBe(s);
    }
    expect(s).toEqual(frozen);
  });
  it("marking does not kill and cannot charge twice", () => {
    const s = createTactical(m1);
    const p = s.colonies[0];
    const r = commandTactical(s, { type: "mark", target: p.id }, m1);
    expect(r.state.colonies[0].load).toBe(p.load);
    expect(r.state.energy).toBe(4);
    expect(r.state.support).toBe(5);
    const again = commandTactical(r.state, { type: "mark", target: p.id }, m1);
    expect(again.error).toBeTruthy();
    expect(again.state).toBe(r.state);
  });
  it("movement and contact are rules; remote units cannot swallow immediately", () => {
    let s = createTactical(m1);
    const cell = s.cells[0],
      target = s.colonies.find((p) => p.region === "b")!;
    s = send(s, { type: "attack", cell: cell.id, target: target.id });
    const original = { ...s.cells[0].position };
    const after = stepTactical(s, m1);
    expect(distance(original, after.cells[0].position)).toBeGreaterThan(0);
    expect(
      after.events.some((e) => e.type === "engulf" && e.actor === cell.id),
    ).toBe(false);
    expect(after.cells[0].path.length).toBeGreaterThan(1);
  });
  it("cooldown is committed once regardless of visualization", () => {
    let s = createTactical(m1);
    s.cells[0].position = { ...s.colonies[0].position };
    s = send(s, { type: "mark", target: s.colonies[0].id });
    s = stepTactical(s, m1);
    const n = s.colonies[0].load;
    expect(
      s.events.filter((e) => e.type === "engulf" && e.actor === "u1"),
    ).toHaveLength(1);
    for (let i = 0; i < m1.cells.macrophage.cooldown - 1; i++)
      s = stepTactical(s, m1);
    expect(s.colonies[0].load).toBe(n);
  });
  it("recruitment retains its cost and arrives through the portal after waiting", () => {
    let s = createTactical(m1);
    s = send(s, { type: "recruit", kind: "neutrophil", region: "c" });
    expect(occupied(s, "c")).toBe(2);
    for (let i = 0; i < 24; i++) s = stepTactical(s, m1);
    expect(s.cells).toHaveLength(3);
    s = stepTactical(s, m1);
    expect(s.cells).toHaveLength(4);
    expect(s.arrivals).toHaveLength(0);
    expect(s.cells[3].position).toEqual(m1.portal);
    expect(s.cells[3].path.length).toBeGreaterThan(0);
  });
  it("allows crowded-region movement, attacks, recruitment, arrival and saves beyond old limits", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    const s = ctrl.save.state;
    // This fixture measures manual crowded deployment, not autonomous redistribution.
    s.immunity.autoSeek = false;
    for (let i = 0; i < 27; i++)
      s.cells.push({
        ...copy(s.cells[0]),
        id: `u${s.serial++}`,
        region: "b",
        position: { ...m1.fields[1].center },
      });
    s.energy = 8;
    expect(
      ctrl.command({ type: "move", cell: "u1", point: m1.fields[1].center }),
    ).toBeUndefined();
    expect(
      ctrl.command({ type: "attack", cell: "u1", target: s.colonies[1].id }),
    ).toBeUndefined();
    expect(
      ctrl.command({ type: "recruit", kind: "neutrophil", region: "b" }),
    ).toBeUndefined();
    expect(ctrl.save.state.energy).toBe(5);
    expect(occupied(ctrl.save.state, "b")).toBe(30);
    expect(parseTactical(JSON.stringify(ctrl.snapshot()), m1)).toEqual(
      ctrl.snapshot(),
    );
    ctrl.pause(false);
    for (let i = 0; i < m1.cells.neutrophil.delay; i++) ctrl.step();
    expect(ctrl.save.state.arrivals).toHaveLength(0);
    expect(ctrl.save.state.cells).toHaveLength(31);
    expect(occupied(ctrl.save.state, "b")).toBe(30);
    expect(parseTactical(JSON.stringify(ctrl.snapshot()), m1)).toEqual(
      ctrl.snapshot(),
    );
    ctrl.save.state.energy = 0;
    const before = ctrl.snapshot();
    expect(
      ctrl.command({ type: "recruit", kind: "neutrophil", region: "b" }),
    ).toContain("資源");
    expect(ctrl.snapshot()).toEqual(before);
  });
  it("cannot win while future waves or intracellular sources remain", () => {
    let s = createTactical(m1);
    s.colonies = [];
    s = stepTactical(s, m1);
    expect(s.result).toBeUndefined();
    const c = copy(m1);
    c.pathogen.survives = true;
    c.waves = [c.waves[0]];
    s = createTactical(c);
    s.cells[0].position = { ...s.colonies[0].position };
    s = stepTactical(s, c);
    expect(s.internal[0].load).toBeGreaterThan(0);
    expect(s.events.find((e) => e.type === "engulf")?.survives).toBe(true);
    s.colonies = [];
    s = stepTactical(s, c);
    expect(s.result).toBeUndefined();
  });
  it("defeat takes precedence over simultaneous clearance and star bounds are explicit", () => {
    let s = createTactical(m1);
    s.colonies = [];
    s.wave = 2;
    s.health.a = 0;
    s = stepTactical(s, m1);
    expect(s.result?.type).toBe("defeat");
    expect(s.result?.stars).toBe(0);
    for (const [hp, stars] of [
      [85, 3],
      [84, 2],
      [60, 2],
      [59, 1],
    ]) {
      s = createTactical(m1);
      s.wave = 2;
      s.colonies = [];
      s.health = { a: hp, b: hp, c: hp };
      expect(stepTactical(s, m1).result?.stars).toBe(stars);
    }
  });
  it("three variants support recruitment and redeployment strategies", () => {
    for (const seed of [1, 2, 3])
      for (const plan of ["reinforce", "dispatch"] as const) {
        const { s } = defend(seed, plan);
        expect(
          s.result?.type,
          `${seed}/${plan}: ${JSON.stringify(s.result)}`,
        ).toBe("victory");
        expect(s.result?.seconds).toBeLessThan(180);
      }
  });
  it("same seed and inputs reproduce all state and events", () => {
    const a = defend(2, "reinforce").s,
      b = defend(2, "reinforce").s;
    expect(a).toEqual(b);
  });
  it("existing mechanics accept another content ID, wave count and star thresholds", () => {
    const c = copy(m1);
    c.id = "content-only-fixture";
    c.waves = [c.waves[0]];
    c.stars = [95, 90];
    const ctrl = new TacticalController(c);
    ctrl.save.state = createTactical(c);
    expect(ctrl.save.state.scenario).toBe(c.id);
    expect(
      parseTactical(JSON.stringify(ctrl.snapshot()), c).state.scenario,
    ).toBe(c.id);
    ctrl.save.state.colonies = [];
    ctrl.save.state.health = { a: 94, b: 94, c: 94 };
    ctrl.pause(false);
    ctrl.step();
    expect(ctrl.save.state.result?.type).toBe("victory");
    expect(ctrl.save.state.result?.stars).toBe(2);
    expect(ctrl.save.state.result?.reason).toContain("1 波");
    expect(parseTactical(JSON.stringify(ctrl.snapshot()), c).state).toEqual(
      ctrl.save.state,
    );
  });
  it("bounded scenarios retain valid positions, loads, IDs and energy invariants", () => {
    for (let seed = 1; seed <= 15; seed++) {
      let s = createTactical(m1, seed);
      for (let i = 0; i < 400 && !s.result; i++) {
        if (i % 50 === 0) {
          const p = s.colonies.find((p) => p.markedUntil <= s.tick);
          if (p && !validateTactical(s, { type: "mark", target: p.id }, m1))
            s = send(s, { type: "mark", target: p.id });
        }
        s = stepTactical(s, m1);
        expect(s.energy).toBeGreaterThanOrEqual(0);
        expect(s.energy).toBeLessThanOrEqual(m1.energyMax);
        expect(new Set(s.cells.map((u) => u.id)).size).toBe(s.cells.length);
        for (const u of s.cells) {
          expect(
            Number.isFinite(u.position.x) && Number.isFinite(u.position.z),
          ).toBe(true);
          expect(m1.fields.some((f) => f.id === u.region)).toBe(true);
        }
        for (const p of s.colonies) expect(p.load).toBeGreaterThan(0);
      }
    }
  });
  it("off-terrain orders are projected into navigable tissue", () => {
    const p = walkable({ x: -29, z: -29 }, m1);
    expect(Math.abs(p.x)).toBeLessThan(20);
    expect(Math.abs(p.z)).toBeLessThan(20);
  });
});
describe("pause, save and rendering independence", () => {
  it("pause stops authority; planned orders undo resources, positions and event IDs", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    const before = ctrl.snapshot();
    ctrl.step();
    expect(ctrl.snapshot()).toEqual(before);
    ctrl.command({ type: "mark", target: ctrl.save.state.colonies[0].id });
    expect(ctrl.save.state.energy).toBe(4);
    ctrl.undo();
    expect(ctrl.save.state).toEqual(before.state);
    ctrl.pause(false);
    ctrl.step();
    expect(ctrl.save.state.tick).toBe(1);
    expect(ctrl.save.undo).toHaveLength(0);
  });
  it("roundtrips pause plans; invalid data is rejected without overwriting", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    ctrl.command({ type: "mark", target: ctrl.save.state.colonies[0].id });
    const parsed = parseTactical(JSON.stringify(ctrl.snapshot()), m1);
    expect(parsed).toEqual(ctrl.snapshot());
    const restored = new TacticalController(m1, parsed);
    restored.pause(true);
    restored.undo();
    expect(restored.save.state.energy).toBe(5);
    for (const bad of [
      "{bad",
      " ".repeat(2000001),
      JSON.stringify({ ...parsed, schema: 1 }),
    ])
      expect(() => parseTactical(bad, m1)).toThrow();
    const corrupt = copy(parsed);
    corrupt.state.cells[0].position.x = Infinity;
    expect(() => parseTactical(JSON.stringify(corrupt), m1)).toThrow();
  });
  it("upgrades legacy rule labels without changing saved combat or pause plans", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    ctrl.command({ type: "mark", target: ctrl.save.state.colonies[0].id });
    const legacy = {
      ...ctrl.snapshot(),
      rules: "2.0",
      content: "m1-tactics.1",
    };
    const restored = parseTactical(JSON.stringify(legacy), m1);
    expect(restored).toEqual(ctrl.snapshot());
    const mismatch = { ...legacy, content: "m1-tactics.2" };
    expect(() => parseTactical(JSON.stringify(mismatch), m1)).toThrow("版本");
  });
  it("completed final-wave saves roundtrip with bounded planning history", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    ctrl.save.state = defend(1, "reinforce").s;
    expect(ctrl.save.state.wave).toBe(2);
    expect(parseTactical(JSON.stringify(ctrl.snapshot()), m1).state).toEqual(
      ctrl.save.state,
    );
    ctrl.restart(1);
    for (let i = 0; i < 30; i++)
      ctrl.command({
        type: "move",
        cell: "u1",
        point: { x: -10 + (i % 3), z: -7 },
      });
    expect(ctrl.save.undo.length).toBeLessThanOrEqual(10);
    expect(parseTactical(JSON.stringify(ctrl.snapshot()), m1)).toEqual(
      ctrl.snapshot(),
    );
  });
  it("normal, accelerated scheduling and reduced visuals consume identical fixed steps", () => {
    const run = (batch: number, reduced: boolean) => {
      const ctrl = new TacticalController(m1);
      ctrl.save.state = createTactical(m1);
      ctrl.save.settings.reduced = reduced;
      ctrl.command({ type: "mark", target: ctrl.save.state.colonies[0].id });
      ctrl.pause(false);
      for (let i = 0; i < 200; i += batch)
        for (let j = 0; j < batch; j++) ctrl.step();
      return ctrl.save.state;
    };
    expect(run(1, false)).toEqual(run(2, false));
    expect(run(1, false)).toEqual(run(1, true));
  });
});
