import { describe, it, expect } from "vitest";
import { tacticalScenarios } from "../../src/tactics/content/m1";
import {
  createTactical,
  stepTactical,
  commandTactical,
  loadOf,
  copy,
} from "../../src/tactics/engine/simulation";
import { TacticalController } from "../../src/tactics/application/controller";
import { parseTactical } from "../../src/tactics/persistence/save";
import { validHostTarget } from "../../src/tactics/engine/immunity";
import type {
  TacticalContent,
  TacticalState,
  CellType,
} from "../../src/tactics/domain/model";
function run(id: string, seed = 1) {
  const c = tacticalScenarios[id];
  let s = createTactical(c, seed);
  const plan: Partial<Record<string, [number, CellType, string][]>> = {
    m1: [[0, "neutrophil", "a"]],
    m2: [
      [0, "th1", "a"],
      [100, "macrophage", "b"],
      [260, "neutrophil", "c"],
    ],
    m3: [
      [0, "th1", "a"],
      [180, "macrophage", "a"],
    ],
    m4: [
      [0, "cytotoxicT", "b"],
      [160, "pdc", "a"],
      [300, "helperT", "c"],
      [450, "bcell", "c"],
    ],
    m5: [
      [0, "neutrophil", "b"],
      [150, "th17", "a"],
      [300, "neutrophil", "c"],
    ],
    m6: [
      [0, "cytotoxicT", "b"],
      [150, "pdc", "a"],
    ],
  };
  for (let i = 0; i < c.limit && !s.result; i++) {
    for (const [tick, kind, region] of plan[id] ?? [])
      if (tick === i)
        s = commandTactical(s, { type: "recruit", kind, region }, c).state;
    if (i % 50 === 0 && s.support > 0 && s.energy > 0) {
      const p = s.colonies.find((p) => (p.complementUntil ?? 0) <= s.tick);
      if (p) s = commandTactical(s, { type: "mark", target: p.id }, c).state;
    }
    s = stepTactical(s, c);
  }
  return s;
}
describe("six distinct playable campaigns", () => {
  for (const id of Object.keys(tacticalScenarios))
    it(`${id}: a complete legal strategy, validated save and exact resume`, () => {
      const c = tacticalScenarios[id],
        s = run(id);
      expect(s.result?.type).toBe(id === "m6" ? "limited" : "victory");
      const ctrl = new TacticalController(c);
      ctrl.save.state = createTactical(c);
      ctrl.save.state = s;
      expect(parseTactical(JSON.stringify(ctrl.save), c).state).toEqual(s);
    });
  it("same fixed steps with save/resume produce identical state in every campaign", () => {
    for (const c of Object.values(tacticalScenarios)) {
      let a = createTactical(c, 7);
      for (let i = 0; i < 100; i++) a = stepTactical(a, c);
      const ctrl = new TacticalController(c);
      ctrl.save.state = createTactical(c);
      ctrl.save.state = a;
      let b = parseTactical(JSON.stringify(ctrl.save), c).state;
      for (let i = 0; i < 100; i++) {
        a = stepTactical(a, c);
        b = stepTactical(b, c);
      }
      expect(b).toEqual(a);
    }
  });
  it("viral latency and eclipse cannot be killed by NK or CD8; wrong antigen is rejected", () => {
    const c = tacticalScenarios.m6,
      s = createTactical(c),
      h = s.hosts.find((h) => h.infection?.phase === "latent")!;
    const cd8 = s.cells.find((u) => u.kind === "cytotoxicT")!;
    cd8.activation = "effector";
    cd8.antigen = c.pathogen.antigen;
    expect(validHostTarget(cd8, h, c)).toBe(false);
    h.infection!.phase = "productive";
    h.antigen = c.pathogen.antigen!;
    expect(validHostTarget(cd8, h, c)).toBe(true);
    cd8.antigen = "other";
    expect(validHostTarget(cd8, h, c)).toBe(false);
  });
  it("antibody and complement require extracellular targets and spend once before animation", () => {
    for (const c of Object.values(tacticalScenarios)) {
      let s = createTactical(c);
      s.immunity.antibodies = 3;
      const p = s.colonies[0];
      s = commandTactical(s, { type: "antibody", target: p.id }, c).state;
      expect(s.immunity.antibodies).toBe(2);
      expect(s.events.at(-1)?.opsonin).toBe("antibody");
      expect(s.events.at(-1)?.from).toBeTruthy();
      expect(
        commandTactical(s, { type: "antibody", target: p.id }, c).error,
      ).toBeTruthy();
      expect(
        commandTactical(s, { type: "antibody", target: s.hosts[0].id }, c)
          .error,
      ).toBeTruthy();
      s = commandTactical(s, { type: "mark", target: p.id }, c).state;
      expect(s.energy).toBe(4);
      expect(s.immunity.antibodies).toBe(2);
    }
  });
  it("M3 controls living infection instead of requiring eradication; HIV never receives stars", () => {
    expect(
      createTactical(tacticalScenarios.m3).internal.some(
        (p) => p.stage === "persistent" && p.load === 6,
      ),
    ).toBe(true);
    const tb = run("m3");
    expect(tb.internal.reduce((n, p) => n + p.load, 0)).toBeGreaterThan(0);
    expect(tb.campaign!.stable).toBeGreaterThanOrEqual(100);
    const hiv = run("m6");
    expect(hiv.result!.stars).toBe(0);
    const ctrl = new TacticalController(tacticalScenarios.m6);
    ctrl.save.state = hiv;
    expect(ctrl.save.revealed).toEqual([]);
    ctrl.acknowledgeResult();
    expect(ctrl.save.revealed).toEqual(["m6"]);
  });
});

describe("mechanism failures and protection", () => {
  it("long hyphae require granules, rather than whole-filament phagocytosis", () => {
    const c = tacticalScenarios.m5;
    let s = createTactical(c);
    const p = s.colonies.find((p) => p.form === "hypha")!;
    s.cells = s.cells.filter((u) => u.kind === "macrophage");
    s.cells[0].position = { ...p.position };
    s.cells[0].region = p.region;
    const n = p.load;
    s = stepTactical(s, c);
    expect(s.colonies.find((x) => x.id === p.id)!.load).toBe(n);
    expect(s.internal).toHaveLength(0);
    s.cells[0].kind = "neutrophil";
    s.cells[0].readyAt = 0;
    s = stepTactical(s, c);
    expect(s.events.some((e) => e.type === "degranulate")).toBe(true);
    expect(s.internal).toHaveLength(0);
  });
  it("Th17 and ILC3 change epithelial defense; IL-10 does not heal", () => {
    const c = tacticalScenarios.m5;
    let s = createTactical(c);
    s.cells = s.cells.filter((u) => u.kind === "ilc3");
    s.cells[0].position = { ...c.fields[0].center };
    s.health.a = 70;
    for (let i = 0; i < 30; i++) s = stepTactical(s, c);
    expect(s.immunity.signals.a.il17).toBeGreaterThan(0);
    expect(s.campaign!.barrier.a).toBeGreaterThan(30);
    expect(s.health.a).toBeLessThanOrEqual(70);
  });
  it("IFN-I lowers new infection, and virions never reproduce extracellularly", () => {
    const c = tacticalScenarios.m4;
    let a = createTactical(c);
    a.cells = [];
    a.tick = 14;
    const b = copy(a);
    for (const f of c.fields) b.immunity.signals[f.id].ifni = 100;
    a = stepTactical(a, c);
    const protectedState = stepTactical(b, c);
    expect(protectedState.hosts.filter((h) => h.infection).length).toBeLessThan(
      a.hosts.filter((h) => h.infection).length,
    );
    expect(a.events.some((e) => e.type === "grow")).toBe(false);
  });
  it("M3 cannot win without Th1 activation, and no defense causes real tissue defeat", () => {
    const c = tacticalScenarios.m3;
    let s = createTactical(c);
    s.cells = s.cells.filter((u) => u.kind === "macrophage");
    for (let i = 0; i < c.limit; i++) s = stepTactical(s, c);
    expect(s.result?.type).toBe("defeat");
    const bacterial = tacticalScenarios.m2;
    let empty = createTactical(bacterial);
    empty.cells = [];
    for (let i = 0; i < bacterial.limit; i++)
      empty = stepTactical(empty, bacterial);
    expect(empty.result?.type).toBe("defeat");
  });
  it("B collaboration aborts if the cognate helper moves away during contact", () => {
    const c = tacticalScenarios.m1;
    let s = createTactical(c);
    s.cells = [];
    s.colonies = [];
    s.wave = 0;
    const pos = c.lymphExit!;
    s.immunity.node = {
      stage: "primed",
      antigen: "pneumococcus:protein",
      until: 0,
    };
    s.cells.push({
      id: `u${s.serial++}`,
      kind: "helperT",
      region: "c",
      position: { ...pos },
      path: [],
      order: { type: "guard", point: { ...pos } },
      activation: "effector",
      antigen: "pneumococcus:protein",
      readyAt: 0,
    });
    s.cells.push({
      id: `u${s.serial++}`,
      kind: "bcell",
      region: "c",
      position: { ...pos },
      path: [],
      order: { type: "guard", point: { ...pos } },
      readyAt: 0,
    });
    s = stepTactical(s, c);
    expect(s.cells[1].partner).toBe(s.cells[0].id);
    expect(s.cells[1].activation).toBeUndefined();
    s = commandTactical(
      s,
      { type: "move", cell: s.cells[0].id, point: { x: 10, z: -6 } },
      c,
    ).state;
    for (let i = 0; i < 30; i++) s = stepTactical(s, c);
    expect(s.cells[1].kind).toBe("bcell");
    expect(s.cells[1].partner).toBeUndefined();
  });
});

describe("campaign robustness", () => {
  it("three outbreak seeds are playable, with distinct M3 and M6 goals", () => {
    for (const seed of [2, 3])
      for (const id of Object.keys(tacticalScenarios))
        expect(run(id, seed).result?.type, `${id} seed ${seed}`).toBe(
          id === "m6" ? "limited" : "victory",
        );
  });
  it("remaining disease scenarios have actual failure conditions", () => {
    for (const id of ["m4", "m5"]) {
      const c = tacticalScenarios[id];
      let s = createTactical(c);
      s.cells = [];
      for (let i = 0; i < c.limit; i++) s = stepTactical(s, c);
      expect(s.result?.type).toBe("defeat");
    }
  });
  it("HIV defense changes support duration without a latent wipe or normal victory", () => {
    const c = tacticalScenarios.m6;
    let s = createTactical(c);
    s.cells = [];
    for (let i = 0; i < c.limit; i++) s = stepTactical(s, c);
    const defended = run("m6");
    expect(defended.result!.seconds).toBeGreaterThan(s.result!.seconds);
    expect(
      defended.hosts.some((h) => h.infection?.phase === "latent" && h.load > 0),
    ).toBe(true);
  });
  it("a forged early limited ending and campaign victory record are rejected", () => {
    const c = tacticalScenarios.m6,
      ctrl = new TacticalController(c);
    ctrl.save.state = createTactical(c);
    const raw = ctrl.snapshot();
    raw.state.result = {
      type: "limited",
      stars: 0,
      seconds: 0,
      preservation: 100,
      reason: "fake",
    };
    expect(() => parseTactical(JSON.stringify(raw), c)).toThrow("條件");
    delete raw.state.result;
    raw.records.m6 = {
      type: "victory",
      stars: 3,
      seconds: 10,
      preservation: 100,
      reason: "fake",
    };
    expect(() => parseTactical(JSON.stringify(raw), c)).toThrow("紀錄");
  });
});
