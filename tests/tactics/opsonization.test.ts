import { describe, it, expect } from "vitest";
import { TacticalController } from "../../src/tactics/application/controller";
import { m1 } from "../../src/tactics/content/m1";
import {
  commandTactical,
  createTactical,
  stepTactical,
  copy,
} from "../../src/tactics/engine/simulation";
import { coatings } from "../../src/tactics/engine/opsonization";
import { parseTactical } from "../../src/tactics/persistence/save";
import {
  buildAnatomy,
  anatomyHeight,
} from "../../src/tactics/presentation/Anatomy";
import * as THREE from "three";
describe("distinct complement and antibody support", () => {
  it("new games seek automatically; migrations retain an explicit off choice and legacy Ig identity", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    expect(ctrl.save.state.immunity.autoSeek).toBe(true);
    const raw = JSON.parse(JSON.stringify(ctrl.snapshot()));
    raw.rules = "2.3";
    raw.content = "m1-tactics.4";
    delete raw.settings.labels;
    raw.state.immunity.autoSeek = false;
    const p = raw.state.colonies[0];
    delete p.complementUntil;
    delete p.antibodyUntil;
    p.markedUntil = 30;
    p.opsonin = "antibody";
    const saved = parseTactical(JSON.stringify(raw), m1);
    expect(saved.state.immunity.autoSeek).toBe(false);
    expect(saved.settings.labels).toBe(false);
    expect(coatings(saved.state.colonies[0], 0)).toMatchObject({
      complement: false,
      antibody: true,
    });
  });
  it("validation never spends antibodies; invalid, intracellular and duplicate targets cannot charge", () => {
    let s = createTactical(m1);
    const id = s.colonies[0].id;
    expect(commandTactical(s, { type: "antibody", target: id }, m1).state).toBe(
      s,
    );
    s.immunity.antibodies = 2;
    const before = copy(s);
    expect(
      commandTactical(s, { type: "antibody", target: "i999" }, m1).state,
    ).toBe(s);
    expect(s).toEqual(before);
    const next = commandTactical(s, { type: "antibody", target: id }, m1).state;
    expect(next.immunity.antibodies).toBe(1);
    expect(next.energy).toBe(s.energy);
    expect(next.support).toBe(s.support);
    expect(next.colonies[0].load).toBe(s.colonies[0].load);
    expect(
      commandTactical(next, { type: "antibody", target: id }, m1).state,
    ).toBe(next);
    expect(s).toEqual(before);
  });
  it("C3b and Ig coexist, expire independently and yield one uptake bonus", () => {
    let s = createTactical(m1);
    s.immunity.antibodies = 1;
    s = commandTactical(
      s,
      { type: "mark", target: s.colonies[0].id },
      m1,
    ).state;
    const one = copy(s);
    s = commandTactical(
      s,
      { type: "antibody", target: s.colonies[0].id },
      m1,
    ).state;
    expect(coatings(s.colonies[0], 0)).toMatchObject({
      complement: true,
      antibody: true,
    });
    expect(coatings(s.colonies[0], 31)).toMatchObject({
      complement: true,
      antibody: false,
    });
    for (const state of [one, s]) {
      state.cells = [state.cells[0]];
      state.cells[0].position = { ...state.colonies[0].position };
    }
    expect(stepTactical(s, m1).colonies[0].load).toBe(
      stepTactical(one, m1).colonies[0].load,
    );
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    ctrl.save.state = s;
    expect(
      parseTactical(JSON.stringify(ctrl.snapshot()), m1).state.colonies,
    ).toEqual(s.colonies);
    const corrupt = ctrl.snapshot();
    corrupt.state.colonies[0].markedUntil++;
    expect(() => parseTactical(JSON.stringify(corrupt), m1)).toThrow(
      "時間資料",
    );
  });
  it("planned antibody placement undoes pool, coating and event once", () => {
    const ctrl = new TacticalController(m1);
    ctrl.save.state = createTactical(m1);
    ctrl.save.state.immunity.antibodies = 2;
    const before = ctrl.snapshot();
    ctrl.command({ type: "antibody", target: before.state.colonies[0].id });
    ctrl.undo();
    expect(ctrl.snapshot()).toEqual(before);
  });
  it("damage overlays conform to terrain and the vascular centerline remains above it", () => {
    const anatomy = buildAnatomy(m1, new THREE.Texture());
    try {
      for (const mesh of anatomy.regions.values()) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          expect(
            p.getY(i) -
              anatomyHeight(
                p.getX(i) + mesh.position.x,
                p.getZ(i) + mesh.position.z,
                m1,
              ),
          ).toBeCloseTo(0.035, 4);
      }
      const vessel = anatomy.root.getObjectByName(
        "vascular-wall",
      ) as THREE.Mesh<THREE.TubeGeometry>;
      expect(vessel).toBeDefined();
      const curve = vessel.geometry.parameters.path;
      for (const p of curve.getPoints(500))
        expect(p.y - anatomyHeight(p.x, p.z, m1)).toBeGreaterThan(0.79);
      expect(
        anatomy.root.children.some(
          (o) =>
            o instanceof THREE.Mesh &&
            o.geometry instanceof THREE.PlaneGeometry &&
            o.geometry.parameters.width === 24,
        ),
      ).toBe(false);
    } finally {
      anatomy.geometries.forEach((g) => g.dispose());
      anatomy.materials.forEach((m) => m.dispose());
    }
  });
});
