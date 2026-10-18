import type { Cell, TacticalContent, Vec } from "../domain/model";
import { walkable } from "../engine/simulation";

const BUCKET = 6;
const BUCKET_LIMIT = 8;
const OFFSETS: Vec[] = [{ x: 0, z: 0 }];
for (const radius of [3.6, 5.4])
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    OFFSETS.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
  }
const bodyRadius = (kind: Cell["kind"]) =>
  kind === "dendritic" || kind === "pdc" ? 2.25 : 1.55;

/** Bounded visual packing, NOT authority: no combat, navigation or save mutations.
 * At most 26 candidates × 9 buckets × 8 neighbours per cell. Full buckets are
 * treated as occupied, so dense crowds cannot turn this into an O(n²) scan.
 */
export function layoutCells(
  cells: readonly Cell[],
  content: TacticalContent,
  previous: ReadonlyMap<string, Vec> = new Map(),
  radii?: Partial<Record<Cell["kind"], number>>,
): Map<string, Vec> {
  const result = new Map<string, Vec>();
  const buckets = new Map<string, { point: Vec; radius: number }[]>();
  for (const cell of cells) {
    const radius = radii?.[cell.kind] ?? bodyRadius(cell.kind);
    const old = previous.get(cell.id);
    const candidates = [OFFSETS[0]];
    if (old) {
      const offset = { x: old.x - cell.position.x, z: old.z - cell.position.z };
      if (Math.hypot(offset.x, offset.z) <= 5.4) candidates.push(offset);
    }
    candidates.push(...OFFSETS.slice(1));
    let placed = { ...cell.position };
    for (const offset of candidates) {
      const point = {
        x: cell.position.x + offset.x,
        z: cell.position.z + offset.z,
      };
      const bx = Math.floor(point.x / BUCKET),
        bz = Math.floor(point.z / BUCKET);
      let blocked = false;
      for (let x = bx - 1; x <= bx + 1 && !blocked; x++)
        for (let z = bz - 1; z <= bz + 1 && !blocked; z++) {
          const bucket = buckets.get(`${x},${z}`);
          blocked =
            !!bucket &&
            (bucket.length >= BUCKET_LIMIT ||
              bucket.some(
                (other) =>
                  (other.point.x - point.x) ** 2 +
                    (other.point.z - point.z) ** 2 <
                  (other.radius + radius) ** 2,
              ));
        }
      if (!blocked) {
        // Only project free candidates; dense crowds need no terrain searches.
        // The exact authority position remains a valid fallback at portals.
        if (offset.x || offset.z) {
          const valid = walkable(point, content);
          if (Math.hypot(valid.x - point.x, valid.z - point.z) > 0.01) continue;
        }
        placed = point;
        break;
      }
    }
    result.set(cell.id, placed);
    const key = `${Math.floor(placed.x / BUCKET)},${Math.floor(placed.z / BUCKET)}`;
    const bucket = buckets.get(key) ?? [];
    if (bucket.length < BUCKET_LIMIT) bucket.push({ point: placed, radius });
    buckets.set(key, bucket);
  }
  return result;
}
