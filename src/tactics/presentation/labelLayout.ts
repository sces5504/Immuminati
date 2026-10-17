export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export function overlap(a: LabelBox, b: LabelBox, gap = 4) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap
  );
}
/** Nearest unobstructed label position; moves only the presentation, never a unit or camera. */
export function placeFieldLabel(
  projected: LabelBox,
  bounds: { w: number; h: number },
  obstacles: LabelBox[],
) {
  const clamp = (p: LabelBox): LabelBox => ({
    ...p,
    x: Math.max(p.w / 2 + 5, Math.min(bounds.w - p.w / 2 - 5, p.x)),
    y: Math.max(p.h / 2 + 5, Math.min(bounds.h - p.h / 2 - 5, p.y)),
  });
  const distance = (p: LabelBox) =>
    (p.x - projected.x) ** 2 + (p.y - projected.y) ** 2;
  const queue = [clamp(projected)],
    seen = new Set<string>();
  let fallback = queue[0],
    fewest = Infinity;
  for (let attempt = 0; queue.length && attempt < 256; attempt++) {
    queue.sort((a, b) => distance(a) - distance(b));
    const p = queue.shift()!;
    const key = `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    if (seen.has(key)) {
      attempt--;
      continue;
    }
    seen.add(key);
    const hits = obstacles.filter((b) => overlap(p, b));
    if (!hits.length) return p;
    if (hits.length < fewest) {
      fewest = hits.length;
      fallback = p;
    }
    const b = hits[0],
      dx = (p.w + b.w) / 2 + 5,
      dy = (p.h + b.h) / 2 + 5;
    for (const next of [
      { ...p, x: b.x - dx },
      { ...p, x: b.x + dx },
      { ...p, y: b.y - dy },
      { ...p, y: b.y + dy },
    ]) {
      const c = clamp(next),
        k = `${c.x.toFixed(1)},${c.y.toFixed(1)}`;
      if (!seen.has(k)) queue.push(c);
    }
  }
  return fallback;
}
