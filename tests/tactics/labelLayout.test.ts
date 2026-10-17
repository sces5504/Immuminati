import { describe, it, expect } from "vitest";
import {
  overlap,
  placeFieldLabel,
  type LabelBox,
} from "../../src/tactics/presentation/labelLayout";
describe("field controls remain reachable around UI and models", () => {
  it("avoids the portrait log button and reinforcement queue instead of raising a label underneath them", () => {
    const projected = { x: 304, y: 178, w: 78, h: 44 };
    const obstacles = [
      { x: 285, y: 125, w: 128, h: 155 },
      { x: 292, y: 188, w: 130, h: 36 },
      { x: 304, y: 220, w: 44, h: 44 },
    ];
    const placed = placeFieldLabel(projected, { w: 360, h: 475 }, obstacles);
    expect(obstacles.some((b) => overlap(placed, b))).toBe(false);
    expect(placed.x).toBeGreaterThanOrEqual(44);
    expect(placed.x).toBeLessThanOrEqual(316);
  });
  it("keeps all three labels visible and separate when the projection is beyond the viewport", () => {
    const obstacles: LabelBox[] = [
      { x: 180, y: 22, w: 360, h: 44 },
      { x: 80, y: 98, w: 160, h: 100 },
      { x: 296, y: 98, w: 128, h: 100 },
    ];
    for (const p of [
      { x: -90, y: -80 },
      { x: 450, y: 180 },
      { x: 160, y: 700 },
    ]) {
      const label = placeFieldLabel(
        { ...p, w: 78, h: 44 },
        { w: 360, h: 475 },
        obstacles,
      );
      expect(obstacles.some((b) => overlap(label, b))).toBe(false);
      expect(label.y).toBeGreaterThanOrEqual(27);
      expect(label.y).toBeLessThanOrEqual(448);
      obstacles.push(label);
    }
  });
  it("leaves a clear projection untouched and terminates for fully covered viewports", () => {
    const p = { x: 200, y: 200, w: 80, h: 44 };
    expect(placeFieldLabel(p, { w: 360, h: 475 }, [])).toEqual(p);
    const result = placeFieldLabel(p, { w: 360, h: 475 }, [
      { x: 180, y: 237.5, w: 360, h: 475 },
    ]);
    expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
  });
});
