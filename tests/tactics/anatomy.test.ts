import { describe, it, expect } from "vitest";
import {
  createTactical,
  stepTactical,
  loadOf,
  copy,
  commandTactical,
} from "../../src/tactics/engine/simulation";
import { TacticalController } from "../../src/tactics/application/controller";
import { parseTactical } from "../../src/tactics/persistence/save";
import { m1 } from "../../src/tactics/content/m1";
import {
  createPractice,
  practiceContent,
} from "../../src/tactics/content/practice";
import { validHostTarget } from "../../src/tactics/engine/immunity";

describe("consistent host anatomy and explicit pathogen compartments", () => {
  it("every tissue profile has healthy epithelium and vascular cells independent of infection", () => {
    for (const tissue of ["lung", "oral", "intestinal"] as const) {
      const content = { ...m1, tissue };
      const s = createTactical(content);
      expect(s.hosts.length).toBeGreaterThan(20);
      for (const field of content.fields)
        expect(
          s.hosts.some(
            (h) => h.region === field.id && h.layer === "epithelium",
          ),
        ).toBe(true);
      expect(s.hosts.some((h) => h.kind === "endothelial")).toBe(true);
      expect(
        s.hosts.every((h) => h.load === 0 && !h.infection && h.health === 100),
      ).toBe(true);
      expect(loadOf(s)).toBe(26);
      if (tissue === "lung")
        expect(new Set(s.hosts.map((h) => h.kind))).toEqual(
          new Set(["alveolarI", "alveolarII", "endothelial"]),
        );
    }
  });
  it("healthy host cells are never valid NK/CD8 targets", () => {
    const s = createPractice();
    const effectors = s.cells.filter((u) =>
      ["nk", "cytotoxicT"].includes(u.kind),
    );
    for (const h of s.hosts.filter((h) => !h.load))
      for (const u of effectors) {
        expect(validHostTarget(u, h, practiceContent)).toBe(false);
        expect(
          commandTactical(
            s,
            { type: "attack", cell: u.id, target: h.id },
            practiceContent,
          ).error,
        ).toBeTruthy();
      }
  });
  it("ingestion transfers live load into a host-bound phagosome without killing it or charging twice", () => {
    let s = createTactical(m1);
    s.cells = [s.cells[0]];
    s.colonies = [s.colonies[0]];
    s.cells[0].position = { ...s.colonies[0].position };
    s.colonies[0].load = 1;
    s.wave = 2;
    const energy = s.energy;
    s = stepTactical(s, m1);
    expect(s.colonies).toHaveLength(0);
    expect(s.internal).toHaveLength(1);
    expect(s.internal[0]).toMatchObject({
      host: "u1",
      compartment: "phagosome",
      stage: "processing",
      load: 1,
      clearAt: 16,
    });
    expect(loadOf(s)).toBe(1);
    expect(s.result).toBeUndefined();
    expect(s.energy).toBe(energy);
    s = stepTactical(s, m1);
    expect(s.internal[0].load).toBe(1);
    while (s.tick < 16) s = stepTactical(s, m1);
    expect(loadOf(s)).toBe(0);
    expect(s.internal).toHaveLength(0);
    expect(s.result?.type).toBe("victory");
    expect(
      s.events.filter((e) => e.message.includes("吞噬體完成殺菌")),
    ).toHaveLength(1);
    expect(s.hosts.every((h) => !h.infection)).toBe(true);
  });
  it("opsonization cannot target intracellular cargo and persistent phagosomes do not auto-clear", () => {
    const c = copy(m1);
    c.pathogen.survives = true;
    let s = createTactical(c);
    s.cells = [s.cells[0]];
    s.cells[0].position = { ...s.colonies[0].position };
    s = stepTactical(s, c);
    const cargo = copy(s.internal[0]);
    s.colonies = [];
    s.cells[0].readyAt = 1000;
    expect(
      commandTactical(s, { type: "mark", target: cargo.id }, c).error,
    ).toBeTruthy();
    for (let i = 0; i < 20; i++) s = stepTactical(s, c);
    expect(s.internal[0]).toEqual(cargo);
    expect(cargo.stage).toBe("persistent");
  });
  it("tissue cell damage mirrors region health, without multiplying damage by visible cell count", () => {
    const s = createTactical(m1);
    s.health.a = 61;
    s.cells = [];
    s.colonies = [];
    const next = stepTactical(s, m1);
    expect(next.health.a).toBe(61);
    expect(
      next.hosts.filter((h) => h.region === "a").every((h) => h.health === 61),
    ).toBe(true);
  });
  it("practice preserves normal anatomy and adds separately identified cytosolic teaching specimens", () => {
    const s = createPractice();
    expect(s.hosts.length).toBe(
      createTactical(practiceContent).hosts.length + 4,
    );
    expect(
      s.hosts
        .filter((h) => h.load > 0)
        .every(
          (h) =>
            h.infection?.compartment === "cytosol" &&
            h.infection.pathogen === "teaching-virus",
        ),
    ).toBe(true);
  });
  it("2.2 migration preserves state and undo, adds healthy anatomy without inventing past infections", () => {
    const ctrl = new TacticalController(m1);
    ctrl.command({ type: "mark", target: ctrl.save.state.colonies[0].id });
    const raw: any = ctrl.snapshot();
    raw.rules = "2.2";
    raw.content = "m1-tactics.3";
    for (const state of [raw.state, ...raw.undo]) state.hosts = [];
    const next = parseTactical(JSON.stringify(raw), m1);
    expect(next.rules).toBe("3.0");
    expect(next.state.tick).toBe(raw.state.tick);
    expect(next.state.energy).toBe(4);
    expect(next.undo[0].energy).toBe(5);
    expect(next.state.cells).toEqual(raw.state.cells);
    expect(next.state.events).toEqual(raw.state.events);
    expect(
      next.state.hosts.every((h) => h.antigen === "self" && !h.infection),
    ).toBe(true);
    expect(next.undo[0].hosts.length).toBe(next.state.hosts.length);
  });
  it("save round trips processing cargo and rejects incomplete compartments and invented M1 viral infection", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state.cells[0].position = {
      ...ctrl.save.state.colonies[0].position,
    };
    ctrl.pause(false);
    ctrl.step();
    const raw = ctrl.snapshot();
    expect(parseTactical(JSON.stringify(raw), m1)).toEqual(raw);
    const corrupt: any = copy(raw);
    delete corrupt.state.internal[0].compartment;
    expect(() => parseTactical(JSON.stringify(corrupt), m1)).toThrow("不完整");
    const infected = copy(raw);
    infected.state.hosts[0].load = 1;
    infected.state.hosts[0].infection = {
      pathogen: "teaching-virus",
      compartment: "cytosol",
    };
    expect(() => parseTactical(JSON.stringify(infected), m1)).toThrow(
      "沒有病毒感染宿主",
    );
  });
  it("processing, cell identities and results survive a save reload with identical fixed steps", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state.cells[0].position = {
      ...ctrl.save.state.colonies[0].position,
    };
    ctrl.pause(false);
    ctrl.step();
    let a = copy(ctrl.save.state),
      b = parseTactical(JSON.stringify(ctrl.snapshot()), m1).state;
    for (let i = 0; i < 40; i++) {
      a = stepTactical(a, m1);
      b = stepTactical(b, m1);
    }
    expect(b).toEqual(a);
  });
});
