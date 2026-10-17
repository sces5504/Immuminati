import { describe, expect, it } from "vitest";
import { m1 } from "../../src/tactics/content/m1";
import {
  createPractice,
  practiceContent,
} from "../../src/tactics/content/practice";
import { TacticalController } from "../../src/tactics/application/controller";
import {
  commandTactical,
  copy,
  createTactical,
  distance,
  stepTactical,
  validateTactical,
} from "../../src/tactics/engine/simulation";
import { parseTactical } from "../../src/tactics/persistence/save";
import type {
  CellType,
  TacticalContent,
  TacticalState,
} from "../../src/tactics/domain/model";
const step = (s: TacticalState, n: number, c: TacticalContent = m1) => {
  for (let i = 0; i < n; i++) s = stepTactical(s, c);
  return s;
};
function add(s: TacticalState, kind: CellType, point = m1.portal) {
  const cell = {
    ...copy(s.cells[0]),
    id: `u${s.serial++}`,
    kind,
    position: { ...point },
    region: "c",
    order: { type: "guard" as const, point: { ...point } },
    path: [],
    readyAt: 0,
  };
  s.cells.push(cell);
  return cell;
}
describe("immune roles and causal prerequisites", () => {
  it("supports every recruitment role through shared data, with plasma arising by differentiation", () => {
    for (const kind of [
      "macrophage",
      "neutrophil",
      "dendritic",
      "helperT",
      "cytotoxicT",
      "bcell",
      "nk",
      "treg",
    ] as CellType[]) {
      const s = createTactical(m1);
      s.energy = 8;
      const r = commandTactical(s, { type: "recruit", kind, region: "a" }, m1);
      expect(r.error).toBeUndefined();
      expect(r.state.arrivals[0].kind).toBe(kind);
      expect(r.state.energy).toBe(8 - m1.cells[kind].cost);
    }
    expect(
      validateTactical(
        createTactical(m1),
        { type: "recruit", kind: "plasma", region: "a" },
        m1,
      ),
    ).toBeTruthy();
  });
  it("autoseek crosses regions toward nearest colony; explicit movement has priority", () => {
    let s = createTactical(m1);
    s.cells = [s.cells[0]];
    s.cells[0].position = { x: 0, z: 12 };
    s.cells[0].region = "a";
    const before = copy(s);
    s = commandTactical(s, { type: "autoseek", enabled: true }, m1).state;
    s = step(s, 1);
    expect(distance(s.cells[0].position, s.colonies[2].position)).toBeLessThan(
      distance(before.cells[0].position, s.colonies[2].position),
    );
    expect(s.energy).toBe(before.energy);
    s = commandTactical(
      s,
      { type: "move", cell: s.cells[0].id, point: { x: -10, z: -7 } },
      m1,
    ).state;
    const previous = { ...s.cells[0].position };
    s = step(s, 1);
    expect(distance(s.cells[0].position, { x: -10, z: -7 })).toBeLessThan(
      distance(previous, { x: -10, z: -7 }),
    );
    expect(s.cells[0].order.type).toBe("move");
  });
  it("recognition raises signals without damaging bacteria; CXCL8 changes a requested arrival", () => {
    let s = createTactical(m1);
    s.cells[0].readyAt = 1000;
    const load = s.colonies[0].load;
    s = step(s, 15);
    expect(s.colonies[0].load).toBe(load);
    expect(s.events.some((e) => e.type === "recognize")).toBe(true);
    expect(s.immunity.signals.a.cxcl8).toBeGreaterThanOrEqual(20);
    const r = commandTactical(
      s,
      { type: "recruit", kind: "neutrophil", region: "a" },
      m1,
    );
    expect(r.state.arrivals[0].at - s.tick).toBe(m1.cells.neutrophil.delay - 5);
  });
  it("DC capture, migration and MHC-II presentation precede a protein-antigen antibody response", () => {
    let s = createTactical(m1);
    s.cells = s.cells.filter((u) => u.kind === "dendritic");
    s.cells[0].position = { ...s.colonies[2].position };
    add(s, "helperT");
    add(s, "bcell");
    s = step(s, 1);
    expect(s.cells[0].antigen).toBe("pneumococcus:protein");
    expect(s.immunity.node.stage).toBe("migrating");
    expect(s.immunity.antibodies).toBe(0);
    s = step(s, 230);
    expect(s.immunity.node.stage).toBe("primed");
    expect(
      s.cells.some((u) => u.kind === "helperT" && u.activation === "effector"),
    ).toBe(true);
    expect(s.cells.some((u) => u.kind === "plasma")).toBe(true);
    expect(s.events.some((e) => e.type === "antibody")).toBe(true);
    expect(
      s.events.some((e) => e.type === "mark" && e.message.includes("新生")),
    ).toBe(true);
    expect(s.cells[0].antigen).toBeTruthy();
    expect(
      s.events.filter((e) => e.type === "engulf" && e.actor === s.cells[0].id),
    ).toHaveLength(1);
  });
  it("B cells cannot differentiate without antigen presentation and local activated T help", () => {
    let s = createTactical(m1);
    add(s, "bcell");
    s = step(s, 100);
    expect(s.cells.some((u) => u.kind === "plasma")).toBe(false);
    s.immunity.node = {
      stage: "primed",
      antigen: "pneumococcus:protein",
      until: 0,
    };
    s = step(s, 60);
    expect(s.cells.some((u) => u.kind === "plasma")).toBe(false);
    const helper = add(s, "helperT", { x: -10, z: -7 });
    helper.activation = "effector";
    helper.antigen = "wrong";
    s = step(s, 60);
    expect(s.cells.some((u) => u.kind === "plasma")).toBe(false);
  });
  it("MHC-II never grants CD8 activation, and non-phagocytes reject extracellular attack orders", () => {
    const s = createTactical(m1);
    s.immunity.node = {
      stage: "primed",
      antigen: "pneumococcus:protein",
      until: 0,
    };
    for (const kind of [
      "helperT",
      "cytotoxicT",
      "bcell",
      "nk",
      "treg",
    ] as CellType[]) {
      const cell = add(s, kind);
      expect(
        validateTactical(
          s,
          { type: "attack", cell: cell.id, target: s.colonies[0].id },
          m1,
        ),
      ).toContain("不吞噬");
    }
    const after = step(s, 100);
    expect(
      after.cells.find((u) => u.kind === "cytotoxicT")?.activation,
    ).not.toBe("effector");
  });
  it("NK and activated antigen-specific CD8 induce apoptosis only in eligible hosts", () => {
    let s = createPractice();
    s = step(s, 100, practiceContent);
    expect(s.hosts[0].load).toBe(0);
    expect(s.hosts[0].apoptoticAt).toBeGreaterThan(0);
    expect(s.hosts[1].load).toBe(0);
    expect(s.hosts[1].apoptoticAt).toBeGreaterThan(0);
    expect(s.hosts[2].load).toBe(2);
    expect(s.hosts[2].apoptoticAt).toBe(0);
    expect(s.hosts[3].apoptoticAt).toBe(0);
    expect(s.events.filter((e) => e.type === "cytotoxic")).toHaveLength(2);
  });
  it("Treg limits inflammation but cannot heal, and IFN-gamma enhances macrophage intracellular clearance", () => {
    let s = createTactical(m1);
    s.cells = [];
    add(s, "treg", m1.fields[0].center);
    s.immunity.signals.a = {
      cxcl8: 50,
      il12: 40,
      ifng: 50,
      il10: 0,
      inflammation: 90,
    };
    s.health.a = 80;
    s = step(s, 5);
    expect(s.immunity.signals.a.inflammation).toBeLessThan(89);
    expect(s.immunity.signals.a.ifng).toBeLessThan(45);
    expect(s.health.a).toBe(80);
    const sterile = copy(s);
    sterile.colonies = [];
    const withoutTreg = copy(sterile);
    withoutTreg.cells = [];
    const protectedTissue = step(sterile, 5),
      unrestrained = step(withoutTreg, 5);
    expect(protectedTissue.health.a).toBeGreaterThan(unrestrained.health.a);
    expect(protectedTissue.health.a).toBeLessThanOrEqual(80);
    s = createTactical(m1);
    s.cells = [s.cells[0]];
    s.cells[0].position = { ...m1.fields[0].center };
    s.internal = [
      {
        id: `i${s.serial++}`,
        host: s.cells[0].id,
        load: 3,
        pathogen: m1.pathogen.id,
      },
    ];
    s.colonies = [];
    s.tick = 14;
    const untreated = step(s, 1);
    expect(untreated.internal[0].load).toBe(3);
    s.immunity.signals.a.ifng = 80;
    const treated = step(s, 1);
    expect(treated.internal[0].load).toBe(2);
  });
  it("migrates actual pre-2.2 state and undo frames, rejects incomplete new-format state", () => {
    const ctrl = new TacticalController(m1);
    ctrl.command({ type: "mark", target: ctrl.save.state.colonies[0].id });
    const raw: any = ctrl.snapshot();
    raw.rules = "2.1";
    raw.content = "m1-tactics.2";
    for (const s of [raw.state, ...raw.undo]) {
      delete s.immunity;
      delete s.hosts;
    }
    const migrated = parseTactical(JSON.stringify(raw), m1);
    expect(migrated.rules).toBe("2.2");
    expect(migrated.state.immunity.autoSeek).toBe(false);
    expect(migrated.state.energy).toBe(4);
    expect(migrated.undo[0].energy).toBe(5);
    const corrupt: any = ctrl.snapshot();
    delete corrupt.state.immunity;
    expect(() => parseTactical(JSON.stringify(corrupt), m1)).toThrow("不完整");
  });
  it("supports a slower adaptive-support strategy without discarding the innate opening", () => {
    for (const seed of [1, 2, 3]) {
      let s = createTactical(m1, seed);
      for (const cmd of [
        { type: "autoseek", enabled: true },
        { type: "recruit", kind: "helperT", region: "c" },
        { type: "recruit", kind: "bcell", region: "c" },
      ] as const)
        s = commandTactical(s, cmd, m1).state;
      s = step(s, 900);
      expect(s.cells.some((u) => u.kind === "plasma")).toBe(true);
      expect(s.result?.type, `seed ${seed}`).toBe("victory");
    }
  });
  it("new biology is independent of scheduling and can be resumed exactly", () => {
    const run = (batch: number, resume: boolean) => {
      let s = createPractice();
      for (let i = 0; i < 120; i += batch) {
        for (let j = 0; j < batch; j++) s = stepTactical(s, practiceContent);
        if (resume && i === 60) {
          const ctrl = new TacticalController(practiceContent);
          ctrl.save.state = s;
          s = parseTactical(JSON.stringify(ctrl.save), practiceContent).state;
        }
      }
      return s;
    };
    expect(run(1, false)).toEqual(run(2, false));
    expect(run(1, false)).toEqual(run(1, true));
  });
});
