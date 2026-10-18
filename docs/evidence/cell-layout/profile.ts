import { layoutCells } from "../../../src/tactics/presentation/cellLayout";
import { m1 } from "../../../src/tactics/content/m1";
import type { Cell } from "../../../src/tactics/domain/model";
import { writeFileSync } from "node:fs";
const results = [];
for (const count of [20, 100, 500, 2500]) {
  const cells: Cell[] = Array.from({ length: count }, (_, i) => ({
    id: `u${i}`,
    kind: "macrophage",
    region: "a",
    position: { x: -10, z: -7 },
    order: { type: "guard", point: { x: -10, z: -7 } },
    path: [],
    readyAt: 0,
  }));
  let prior = layoutCells(cells, m1);
  const samples = [];
  for (let repeat = 0; repeat < 20; repeat++) {
    const start = performance.now();
    prior = layoutCells(cells, m1, prior);
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  results.push({
    count,
    medianMs: +samples[10].toFixed(3),
    p95Ms: +samples[18].toFixed(3),
  });
}
const data = {
  scenario:
    "All cells at one point; standalone layout on cloud CPU, not browser FPS",
  repeats: 20,
  results,
};
writeFileSync(
  new URL("./performance.json", import.meta.url),
  JSON.stringify(data, null, 2),
);
console.log(JSON.stringify(data));
