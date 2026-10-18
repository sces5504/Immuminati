import { describe, expect, it } from "vitest";
import { layoutCells } from "../../src/tactics/presentation/cellLayout";
import { m1 } from "../../src/tactics/content/m1";
import {
  copy,
  createTactical,
  distance,
  walkable,
} from "../../src/tactics/engine/simulation";
import type { Cell, Vec } from "../../src/tactics/domain/model";

const cell = (
  id: string,
  point: Vec = m1.fields[0].center,
  kind: Cell["kind"] = "macrophage",
): Cell => ({
  id,
  kind,
  region: "a",
  position: { ...point },
  order: { type: "guard", point: { ...point } },
  path: [],
  readyAt: 0,
});
describe("bounded presentation-only immune cell spacing", () => {
  it("allows replacement models to reserve their own visual envelope", () => {
    const layout = layoutCells([cell("one"), cell("two")], m1, undefined, {
      macrophage: 1.9,
    });
    expect(
      distance(layout.get("one")!, layout.get("two")!),
    ).toBeGreaterThanOrEqual(3.8);
  });
  it("leaves isolated cells at the commanded position", () => {
    const units = [cell("one"), cell("two", m1.fields[1].center)];
    const layout = layoutCells(units, m1);
    for (const u of units) expect(layout.get(u.id)).toEqual(u.position);
  });
  it("separates coincident cells when space is available, including larger dendritic cells", () => {
    for (const kind of ["macrophage", "dendritic"] as const) {
      const units = [cell("one", undefined, kind), cell("two")];
      const layout = layoutCells(units, m1);
      expect(
        distance(layout.get("one")!, layout.get("two")!),
      ).toBeGreaterThanOrEqual(kind === "dendritic" ? 3.8 : 3.1);
    }
  });
  it("packs several units locally without changing their orders or authority state", () => {
    const state = createTactical(m1, 70);
    state.cells = Array.from({ length: 7 }, (_, i) => cell(`unit-${i}`));
    const before = copy(state);
    const layout = layoutCells(state.cells, m1);
    const positions = [...layout.values()];
    for (let i = 0; i < positions.length; i++)
      for (let j = i + 1; j < positions.length; j++)
        expect(distance(positions[i], positions[j])).toBeGreaterThanOrEqual(
          3.1,
        );
    expect(state).toEqual(before);
  });
  it("is deterministic and stable while paused; removes departed units", () => {
    const units = [cell("one"), cell("two"), cell("three")];
    const first = layoutCells(units, m1);
    expect(layoutCells(units, m1, first)).toEqual(first);
    expect(layoutCells(copy(units), m1)).toEqual(first);
    const next = layoutCells(units.slice(1), m1, first);
    expect(next.has("one")).toBe(false);
  });
  it("keeps offsets on navigable tissue at the field edge", () => {
    const edge = { x: -16.7, z: -7 };
    const layout = layoutCells([cell("one", edge), cell("two", edge)], m1);
    for (const point of layout.values()) {
      expect(distance(point, walkable(point, m1))).toBeLessThan(0.01);
      expect(distance(point, edge)).toBeLessThanOrEqual(5.40001);
    }
    expect(
      distance(layout.get("one")!, layout.get("two")!),
    ).toBeGreaterThanOrEqual(3.1);
  });
  it("retains every unit with bounded offsets in an extremely crowded area", () => {
    const units = Array.from({ length: 2500 }, (_, i) => cell(`unit-${i}`));
    const layout = layoutCells(units, m1);
    expect(layout.size).toBe(units.length);
    for (const u of units) {
      const point = layout.get(u.id)!;
      expect(Number.isFinite(point.x) && Number.isFinite(point.z)).toBe(true);
      expect(distance(point, u.position)).toBeLessThanOrEqual(5.40001);
    }
  });
  it("does not reuse a distant previous position after a manual move", () => {
    const unit = cell("one", m1.fields[1].center);
    expect(
      layoutCells([unit], m1, new Map([[unit.id, m1.fields[0].center]])).get(
        unit.id,
      ),
    ).toEqual(unit.position);
  });
});
