import { describe, it, expect } from "vitest";
import { content, validateContent } from "../../src/content/game";
import {
  clone,
  createBattle,
  occupancy,
  resolveCommand,
  resolveEndTurn,
  validateCommand,
} from "../../src/engine/battle";
import { dispatch, newSession, undo } from "../../src/application/session";
import { pack, parseSave, defaultProgress } from "../../src/persistence/save";
import { entries, sources } from "../../src/content/encyclopedia";
import type { BattleState, Command } from "../../src/domain/model";
const run = (b: BattleState, cmd: Command) => {
  const r = resolveCommand(b, cmd, content);
  expect(r.error).toBeUndefined();
  return r.state;
};
function strategy(seed: number, style: "recruit" | "mobile" = "recruit") {
  let b = createBattle("m1", seed, content);
  const commands: Command[] = [];
  const apply = (cmd: Command) => {
    if (validateCommand(b, cmd, content)) return false;
    b = run(b, cmd);
    commands.push(cmd);
    return true;
  };
  while (!b.outcome && b.turn <= 12) {
    // Two distinct resource plans: extra local phagocytes, or move existing defenders.
    if (style === "recruit" && b.turn === 1)
      apply({ type: "recruit", kind: "neutrophil", region: "c" });
    for (const p of [...b.populations].sort((a, z) => z.load - a.load))
      if (
        p.load > 0 &&
        !p.opsonin &&
        b.units.some((u) => u.region === p.region) &&
        b.opsonins > 0
      )
        apply({ type: "opsonize", targetId: p.id });
    for (const u of [...b.units]) {
      const here = b.populations.filter(
        (p) => p.region === u.region && p.load > 0,
      );
      if (!here.length) {
        const other = [...b.populations]
          .filter(
            (p) =>
              p.load > 0 &&
              content.scenarios.m1.regions
                .find((r) => r.id === u.region)!
                .neighbors.includes(p.region),
          )
          .sort((a, z) => z.load - a.load)[0];
        if (other) apply({ type: "move", unitId: u.id, region: other.region });
      }
    }
    for (const p of b.populations)
      if (p.load > 0 && !p.opsonin && b.opsonins > 0)
        apply({ type: "opsonize", targetId: p.id });
    apply({ type: "endTurn" });
  }
  return { b, commands };
}
describe("M1 rules and boundaries", () => {
  it("validates all content references and encyclopedia sources", () => {
    expect(validateContent(content)).toEqual([]);
    for (const e of entries)
      for (const id of e.sources) expect(sources[id]).toBeDefined();
    for (const cell of Object.values(content.cells))
      expect(entries.some((e) => e.id === cell.encyclopedia)).toBe(true);
  });
  it("invalid commands preserve the exact input state and never charge AP", () => {
    const b = createBattle("m1", 1, content);
    const saved = clone(b);
    for (const cmd of [
      { type: "move", unitId: "u1", region: "a" },
      { type: "engulf", unitId: "u1", targetId: "p2" },
      { type: "recruit", kind: "dendritic", region: "a" },
      { type: "opsonize", targetId: "missing" },
    ] as Command[]) {
      const r = resolveCommand(b, cmd, content);
      expect(r.error).toBeTruthy();
      expect(r.state).toBe(b);
      expect(r.frames).toEqual([]);
    }
    expect(b).toEqual(saved);
  });
  it("opsonization marks, never kills; active action consumes the automatic opportunity", () => {
    let b = createBattle("m1", 1, content);
    const load = b.populations[0].load;
    b = run(b, { type: "opsonize", targetId: "p1" });
    expect(b.populations[0].load).toBe(load);
    expect(b.ap).toBe(3);
    b = run(b, { type: "engulf", unitId: "u1", targetId: "p1" });
    expect(b.ap).toBe(1);
    expect(b.populations[0].load).toBe(load - 5);
    const end = resolveEndTurn(b, content);
    expect(
      end.frames.filter(
        (f) => f.event.type === "PathogenEngulfed" && f.event.source === "u1",
      ),
    ).toHaveLength(0);
  });
  it("reservations prevent overbooking; arrival is after the cells phase", () => {
    let b = createBattle("m1", 1, content);
    b = run(b, { type: "recruit", kind: "neutrophil", region: "a" });
    b = run(b, { type: "recruit", kind: "neutrophil", region: "a" });
    expect(occupancy(b, "a")).toBe(3);
    b.ap = 4;
    expect(
      validateCommand(
        b,
        { type: "recruit", kind: "neutrophil", region: "a" },
        content,
      ),
    ).toContain("容量");
    const r = resolveEndTurn(b, content);
    expect(r.state.recruits).toHaveLength(0);
    expect(r.state.units.filter((u) => u.region === "a")).toHaveLength(3);
    const arrivals = r.frames.filter((f) => f.event.type === "UnitArrived");
    expect(arrivals).toHaveLength(2);
    expect(
      r.frames.filter(
        (f) =>
          f.event.type === "PathogenEngulfed" &&
          arrivals.some((a) => a.event.source === f.event.source),
      ),
    ).toHaveLength(0);
  });
  it("two-turn recruitment waits and movement does not consume the major action", () => {
    let b = createBattle("m1", 2, content);
    b = run(b, { type: "recruit", kind: "macrophage", region: "c" });
    b = run(b, { type: "move", unitId: "u1", region: "c" });
    expect(b.units[0].used).toBe(false);
    b = resolveEndTurn(b, content).state;
    expect(b.recruits[0].remaining).toBe(1);
    expect(b.units[0].region).toBe("c");
  });
  it("order, expiry, stable events and defeat precedence", () => {
    let b = createBattle("m1", 1, content);
    b = run(b, { type: "opsonize", targetId: "p2" });
    const r = resolveEndTurn(b, content);
    const phases = r.frames.map((f) => f.event.phase);
    expect(phases.indexOf("cells")).toBeLessThan(phases.indexOf("pathogens"));
    expect(phases.indexOf("pathogens")).toBeLessThan(phases.indexOf("tissue"));
    expect(r.state.populations.find((p) => p.id === "p2")?.opsonin).toBe(2);
    b = createBattle("m1", 1, content);
    b.populations = [];
    b.regions.a = 0;
    expect(resolveEndTurn(b, content).state.outcome?.type).toBe("defeat");
  });
  it("seed and command replay are exact; multiple plans win all three variants", () => {
    for (const seed of [1, 2, 3])
      for (const style of ["recruit", "mobile"] as const) {
        const { b, commands } = strategy(seed, style);
        expect(
          b.outcome?.type,
          `seed ${seed}, ${style}: ${JSON.stringify(b.outcome)}`,
        ).toBe("victory");
        let replay = createBattle("m1", seed, content);
        for (const cmd of commands) replay = run(replay, cmd);
        expect(replay).toEqual(b);
      }
  });
  it("star thresholds include all regions, and no stars on defeat", () => {
    for (const [health, stars] of [
      [85, 3],
      [84, 2],
      [60, 2],
      [59, 1],
    ]) {
      const b = createBattle("m1", 1, content);
      b.populations = [];
      b.regions = { a: health, b: health, c: health };
      expect(resolveEndTurn(b, content).state.outcome?.stars).toBe(stars);
    }
    const b = createBattle("m1", 1, content);
    b.regions.a = 0;
    expect(resolveEndTurn(b, content).state.outcome?.stars).toBe(0);
  });
  it("a new scenario uses only data; intracellular survival keeps load and prevents false clearance", () => {
    const c = clone(content);
    c.pathogens.sample = {
      ...c.pathogens.pneumococcus,
      id: "sample",
      name: "胞內存活契約樣本",
      survivesEngulfment: true,
      replication: 0,
      intracellularGrowth: 1,
    };
    c.scenarios.sample = {
      ...c.scenarios.m1,
      id: "sample",
      pathogen: "sample",
      initialLoads: [1, 0, 0],
      variants: [],
    };
    let b = createBattle("sample", 1, c);
    const r = resolveCommand(
      b,
      { type: "engulf", unitId: "u1", targetId: "p1" },
      c,
    );
    expect(r.frames.some((f) => f.event.type === "IntracellularSurvival")).toBe(
      true,
    );
    expect(r.frames.some((f) => f.event.type === "PathogenCleared")).toBe(
      false,
    );
    expect(
      r.state.populations
        .filter((p) => p.compartment === "phagosome")
        .reduce((a, p) => a + p.load, 0),
    ).toBe(1);
    b = resolveEndTurn(r.state, c).state;
    expect(b.outcome).toBeUndefined();
    expect(b.populations.find((p) => p.hostId === "u1")?.load).toBe(2);
  });
  it("100 varied legal sequences keep AP, loads and capacities in bounds", () => {
    for (let seed = 1; seed <= 100; seed++) {
      let b = createBattle("m1", seed, content);
      for (let turn = 0; turn < 12 && !b.outcome; turn++) {
        const p = b.populations.find((p) => p.load > 0 && !p.opsonin);
        if (p) {
          const cmd: Command = { type: "opsonize", targetId: p.id };
          if (!validateCommand(b, cmd, content)) b = run(b, cmd);
        }
        const cmd: Command = {
          type: "recruit",
          kind: seed % 2 ? "neutrophil" : "macrophage",
          region: ["a", "b", "c"][seed % 3],
        };
        if (!validateCommand(b, cmd, content)) b = run(b, cmd);
        b = resolveEndTurn(b, content).state;
        expect(b.ap).toBeGreaterThanOrEqual(0);
        for (const p of b.populations) expect(p.load).toBeGreaterThanOrEqual(0);
        for (const r of content.scenarios.m1.regions)
          expect(occupancy(b, r.id)).toBeLessThanOrEqual(r.capacity);
      }
    }
  });
});
describe("save and undo", () => {
  it("roundtrips current-turn commands and restores undo after loading", () => {
    let se = newSession("m1", 2, content);
    se = dispatch(se, { type: "opsonize", targetId: "p1" }, content).session;
    se = dispatch(
      se,
      { type: "recruit", kind: "neutrophil", region: "c" },
      content,
    ).session;
    const parsed = parseSave(
      JSON.stringify(pack(se, defaultProgress())),
      content,
    );
    expect(parsed.session).toEqual(se);
    expect(undo(parsed.session!, content)).toEqual(undo(se, content));
    const reset = undo(undo(parsed.session!, content), content);
    expect(reset.state).toEqual(newSession("m1", 2, content).state);
  });
  it("rejects oversized, corrupt, incompatible and impossible saves before any write", () => {
    const data = pack(newSession("m1", 1, content), defaultProgress());
    for (const bad of [
      "x",
      " ".repeat(2_000_001),
      JSON.stringify({ ...data, schemaVersion: 99 }),
    ])
      expect(() => parseSave(bad, content)).toThrow();
    const impossible = clone(data);
    impossible.session!.state.units[0].region = "missing";
    expect(() => parseSave(JSON.stringify(impossible), content)).toThrow();
    const mismatch = clone(data);
    mismatch.session!.state.ap = 3;
    expect(() => parseSave(JSON.stringify(mismatch), content)).toThrow();
  });
  it("undo recomputes the same RNG and history, and cannot undo committed turns", () => {
    let se = newSession("m1", 1, content);
    se = dispatch(
      se,
      { type: "recruit", kind: "neutrophil", region: "c" },
      content,
    ).session;
    const before = clone(se);
    se = dispatch(
      se,
      { type: "move", unitId: "u1", region: "b" },
      content,
    ).session;
    expect(undo(se, content)).toEqual(before);
    se = dispatch(se, { type: "endTurn" }, content).session;
    expect(undo(se, content)).toBe(se);
    expect(
      parseSave(JSON.stringify(pack(se, defaultProgress())), content).session,
    ).toEqual(se);
  });
});
