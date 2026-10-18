import { describe, it, expect, vi } from "vitest";
import { tacticalScenarios } from "../../src/tactics/content/m1";
import {
  createTactical,
  stepTactical,
  copy,
  commandTactical,
} from "../../src/tactics/engine/simulation";
import {
  intracellularStep,
  campaignStep,
} from "../../src/tactics/engine/infection";
import { syncTissueHealth } from "../../src/tactics/content/anatomy";
import { TacticalController } from "../../src/tactics/application/controller";
import {
  parseTactical,
  writeTactical,
  TACTICS_KEY,
} from "../../src/tactics/persistence/save";
import { intracellularStatus } from "../../src/tactics/application/infectionStatus";

function focus(id = "m3") {
  const c = tacticalScenarios[id],
    s = createTactical(c);
  s.cells = s.cells.filter((u) => u.kind === "macrophage").slice(0, 1);
  s.colonies = [];
  const u = s.cells[0];
  s.internal = [
    {
      id: `i${s.serial++}`,
      host: u.id,
      pathogen: c.pathogen.id,
      load: 6,
      stage: "persistent",
      compartment: "phagosome",
      clearAt: 0,
    },
  ];
  u.replicateAt = c.lifecycle!.intracellular!.every;
  return { s, c, u };
}
describe("intracellular lifecycle regressions", () => {
  it("repeated identical attack orders preserve an in-progress inter-region route", () => {
    const c = tacticalScenarios.m1;
    let s = createTactical(c);
    s.cells = s.cells.filter((u) => u.kind === "macrophage");
    const u = s.cells[0],
      target = s.colonies.find((p) => p.region === "b")!;
    const before = Math.hypot(
      u.position.x - target.position.x,
      u.position.z - target.position.z,
    );
    for (let i = 0; i < 35; i++) {
      s = commandTactical(
        s,
        { type: "attack", cell: u.id, target: target.id },
        c,
      ).state;
      s = stepTactical(s, c);
    }
    const after = s.cells[0];
    expect(
      Math.hypot(
        after.position.x - target.position.x,
        after.position.z - target.position.z,
      ),
    ).toBeLessThan(before - 7);
  });
  for (const id of ["m2", "m3"]) {
    it(`${id}: viable bacteria actually multiply inside an untreated macrophage`, () => {
      let { s, c, u } = focus(id);
      const original = copy(s);
      for (let i = 0; i < c.lifecycle!.intracellular!.every; i++)
        s = stepTactical(s, c);
      expect(s.internal.reduce((n, p) => n + p.load, 0)).toBeGreaterThan(6);
      expect(
        s.events.some(
          (e) =>
            e.type === "grow" &&
            e.actor === u.id &&
            e.message.includes("囊泡內增殖"),
        ),
      ).toBe(true);
      expect(original.internal[0].load).toBe(6);
      expect(intracellularStatus(s.cells[0], s, c)?.text).toContain("秒後增殖");
    });
    it(`${id}: a population split across phagosomes has the same replication and rupture outcome`, () => {
      const { s: a, c, u } = focus(id),
        b = copy(a);
      b.internal = [
        { ...b.internal[0], load: 2 },
        { ...b.internal[0], id: `i${b.serial++}`, load: 4 },
      ];
      a.tick = b.tick = u.replicateAt!;
      intracellularStep(a, c);
      intracellularStep(b, c);
      expect(a.internal.reduce((n, p) => n + p.load, 0)).toBe(
        b.internal.reduce((n, p) => n + p.load, 0),
      );
      expect(a.colonies.map((p) => p.load)).toEqual(
        b.colonies.map((p) => p.load),
      );
    });
    it(`${id}: overloaded host rupture transfers all live cargo without deleting or duplicating it`, () => {
      const { s, c, u } = focus(id);
      const total = c.lifecycle!.intracellular!.ruptureAt;
      s.internal[0].load = total;
      s.tick = u.replicateAt!;
      intracellularStep(s, c);
      expect(s.cells).toHaveLength(0);
      expect(s.internal).toHaveLength(0);
      expect(s.colonies.reduce((n, p) => n + p.load, 0)).toBe(
        total + Math.ceil(total * c.lifecycle!.intracellular!.fraction),
      );
      expect(s.health[u.region]).toBe(95);
      expect(s.events.some((e) => e.type === "release")).toBe(true);
    });
  }
  it("TB: IFN-γ alone is not a guaranteed sterilizing mechanism; cognate local Th1 support limits replication", () => {
    const { s: a, c, u } = focus(),
      b = copy(a);
    a.immunity.signals[u.region].ifng = b.immunity.signals[u.region].ifng = 100;
    b.cells.push({
      ...copy(u),
      id: `u${b.serial++}`,
      kind: "th1",
      activation: "effector",
      antigen: "tuberculosis:protein",
    });
    a.tick = b.tick = u.replicateAt!;
    intracellularStep(a, c);
    intracellularStep(b, c);
    expect(a.internal[0].load).toBeGreaterThan(6);
    expect(b.internal[0].load).toBe(6);
    expect(intracellularStatus(b.cells[0], b, c)?.controlled).toBe(true);
    b.cells[1].antigen = "unrelated";
    expect(intracellularStatus(b.cells[0], b, c)?.controlled).toBe(false);
  });
  it("a move order cannot teleport intracellular injury to the destination field", () => {
    const { s, c, u } = focus();
    s.tick = c.damageEvery - 1;
    let moved = commandTactical(
      s,
      { type: "move", cell: u.id, point: c.fields[1].center },
      c,
    ).state;
    moved = stepTactical(moved, c);
    expect(moved.health.a).toBeLessThan(100);
    expect(moved.health.b).toBe(100);
    expect(moved.cells[0].region).toBe("a");
  });
  it("opsonins cannot reach or consume intracellular cargo", () => {
    const { s, c } = focus();
    s.immunity.antibodies = 2;
    for (const type of ["mark", "antibody"] as const) {
      const r = commandTactical(s, { type, target: s.internal[0].id }, c);
      expect(r.error).toBeTruthy();
      expect(r.state).toEqual(s);
    }
  });
});
describe("viral source integrity", () => {
  it("DC travels to distant infected tissue without a second chase undoing its movement", () => {
    const c = tacticalScenarios.m6;
    let s = createTactical(c);
    s.cells = s.cells.filter((u) => u.kind === "dendritic");
    const id = s.cells[0].id;
    for (let i = 0; i < 300; i++) s = stepTactical(s, c);
    expect(s.cells.find((u) => u.id === id)!.antigen).toBe(c.pathogen.antigen);
    expect(s.immunity.node.stage).not.toBe("idle");
  });
  it("flu: a productive host releases virions, then dies and stops producing, at a tissue cost", () => {
    const c = tacticalScenarios.m4;
    let s = createTactical(c);
    s.cells = [];
    s.colonies = [];
    const h = s.hosts.find((h) => h.layer === "epithelium")!;
    h.load = 1;
    h.infection = {
      pathogen: c.pathogen.id,
      compartment: "nucleus",
      phase: "productive",
      since: 0,
      cycles: 0,
    };
    h.antigen = c.pathogen.antigen!;
    for (
      let i = 1;
      i <= c.lifecycle!.virus!.every * c.lifecycle!.virus!.lifespan;
      i++
    ) {
      s.tick = i;
      campaignStep(s, c);
      s.colonies = [];
    }
    const dead = s.hosts.find((x) => x.id === h.id)!;
    expect(dead.load).toBe(0);
    expect(dead.apoptoticAt).toBeGreaterThan(0);
    expect(s.health[h.region]).toBeLessThan(100);
    s.events = [];
    s.tick += 100;
    campaignStep(s, c);
    expect(s.events.filter((e) => e.type === "release")).toHaveLength(0);
  });
  it("the first HIV reservoir can reactivate, exposes the right antigen and ceases to be invisible", () => {
    const c = tacticalScenarios.m6,
      s = createTactical(c),
      h = s.hosts.find((h) => h.infection?.phase === "latent")!;
    const n = Number(h.id.slice(1));
    s.tick = 520 - ((n * 7) % 520);
    if (s.tick <= 300) s.tick += 520;
    campaignStep(s, c);
    expect(h.infection?.phase).toBe("productive");
    expect(h.stressed).toBe(true);
    expect(h.antigen).toBe(c.pathogen.antigen);
  });
  it("DC can obtain viral antigen from tissue after extracellular particles have disappeared", () => {
    const c = tacticalScenarios.m4;
    let s = createTactical(c);
    s.colonies = [];
    s.cells = s.cells.filter((u) => u.kind === "dendritic");
    const dc = s.cells[0],
      h = s.hosts.find((h) => h.layer === "epithelium")!;
    h.load = 1;
    h.infection = {
      pathogen: c.pathogen.id,
      compartment: "nucleus",
      phase: "productive",
      since: 0,
      cycles: 0,
    };
    dc.position = { ...h.position };
    dc.region = h.region;
    s = stepTactical(s, c);
    expect(s.cells[0].antigen).toBe(c.pathogen.antigen);
    expect(s.hosts.find((x) => x.id === h.id)!.load).toBe(1);
  });
  it("destroyed tissue is never a newly infected target", () => {
    const c = tacticalScenarios.m4,
      s = createTactical(c);
    s.cells = [];
    s.tick = 15;
    s.health.a = 0;
    for (const h of s.hosts.filter((h) => h.region === "a")) h.health = 0;
    campaignStep(s, c);
    expect(s.hosts.filter((h) => h.region === "a" && h.infection)).toHaveLength(
      0,
    );
  });
});
describe("HIV survival, persistence and migration", () => {
  it("latent CD4 infection retains more functional support than productive infection", () => {
    const c = tacticalScenarios.m6,
      a = createTactical(c),
      b = copy(a);
    for (const h of a.hosts.filter((h) => h.infection))
      h.infection!.phase = "latent";
    for (const h of b.hosts.filter((h) => h.infection))
      h.infection!.phase = "productive";
    a.tick = b.tick = 1;
    campaignStep(a, c);
    campaignStep(b, c);
    expect(a.campaign!.cd4).toBeGreaterThan(b.campaign!.cd4);
  });
  it("a lost field stops every infected host there instead of preserving invisible viral factories", () => {
    const c = tacticalScenarios.m6;
    let s = createTactical(c);
    s.health.a = 0;
    s = stepTactical(s, c);
    expect(
      s.hosts
        .filter((h) => h.region === "a")
        .every((h) => h.load === 0 && h.apoptoticAt > 0),
    ).toBe(true);
    expect(s.result).toBeUndefined();
  });
  it("new saves cannot silently omit productive-cycle state", () => {
    const c = tacticalScenarios.m6,
      ctrl = new TacticalController(c);
    ctrl.save.state = createTactical(c);
    const raw: any = ctrl.snapshot();
    delete raw.state.hosts.find((h: any) => h.infection).infection.cycles;
    expect(() => parseTactical(JSON.stringify(raw), c)).toThrow("週期");
  });
  it("old time limit, low CD4 and loss of one field do not end the scenario", () => {
    const c = tacticalScenarios.m6;
    let s = createTactical(c);
    s.tick = c.limit + 10;
    s.health.a = 0;
    s.campaign!.cd4 = 0;
    s.campaign!.impairment = 100;
    s = stepTactical(s, c);
    expect(s.campaign!.cd4).toBe(0);
    expect(s.result).toBeUndefined();
    const ctrl = new TacticalController(c);
    ctrl.save.state = s;
    expect(parseTactical(JSON.stringify(ctrl.save), c).state).toEqual(s);
    s.health.b = 0;
    s.health.c = 0;
    s = stepTactical(s, c);
    expect(s.result).toMatchObject({
      type: "limited",
      stars: 0,
      preservation: 0,
    });
  });
  it("no infection or CD4 loss means no hidden inevitable impairment timer", () => {
    const c = tacticalScenarios.m6,
      s = createTactical(c);
    s.colonies = [];
    for (const h of s.hosts) {
      h.load = 0;
      delete h.infection;
    }
    for (let tick = 1; tick < 200; tick++) {
      s.tick = tick;
      campaignStep(s, c);
    }
    expect(s.campaign!.impairment).toBe(0);
    expect(s.health).toEqual({ a: 100, b: 100, c: 100 });
  });
  it("3.1 active state and undo gain future clocks without retroactive growth; original text is backed up", () => {
    const { s, c } = focus(),
      ctrl = new TacticalController(c);
    ctrl.save.state = s;
    ctrl.command({ type: "autoseek", enabled: false });
    const old: any = ctrl.snapshot();
    old.rules = "3.1";
    old.content = "campaign.2";
    old.paused = false;
    for (const x of [old.state, ...old.undo])
      for (const u of x.cells) delete u.replicateAt;
    const text = JSON.stringify(old),
      next = parseTactical(text, c);
    expect(next.paused).toBe(true);
    expect(next.state.internal).toEqual(s.internal);
    expect(next.state.immunity.autoSeek).toBe(false);
    for (const x of [next.state, ...next.undo])
      expect(x.cells[0].replicateAt).toBe(
        x.tick + c.lifecycle!.intracellular!.every,
      );
    const store = new Map([
      [TACTICS_KEY, text],
      ["immuminati:tactics:pre-3.1", "older"],
    ]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
    try {
      writeTactical(next);
      expect(store.get("immuminati:tactics:pre-3.2")).toBe(text);
      expect(store.get("immuminati:tactics:pre-3.1")).toBe("older");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("old HIV timed results resume paused with original health instead of fabricating tissue destruction", () => {
    const c = tacticalScenarios.m6,
      ctrl = new TacticalController(c),
      s = createTactical(c);
    s.tick = c.limit;
    syncTissueHealth(s);
    s.result = {
      type: "limited",
      preservation: 100,
      stars: 0,
      seconds: s.tick * 0.2,
      reason: "old time limit",
    };
    ctrl.save.state = s;
    const old: any = ctrl.snapshot();
    old.rules = "3.1";
    old.content = "campaign.2";
    const next = parseTactical(JSON.stringify(old), c);
    expect(next.state.result).toBeUndefined();
    expect(next.paused).toBe(true);
    expect(next.state.health).toEqual(s.health);
  });
  it("same fixed steps, including replication clocks, resume exactly regardless of playback settings", () => {
    const { s, c } = focus();
    let a = s;
    for (let i = 0; i < 35; i++) a = stepTactical(a, c);
    const ctrl = new TacticalController(c);
    ctrl.save.state = a;
    ctrl.save.settings.speed = 2;
    ctrl.save.settings.reduced = true;
    let b = parseTactical(JSON.stringify(ctrl.save), c).state;
    for (let i = 0; i < 80; i++) {
      a = stepTactical(a, c);
      b = stepTactical(b, c);
    }
    expect(b).toEqual(a);
  });
});
