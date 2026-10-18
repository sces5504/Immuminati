import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  TripoSamples,
  fitSeptumPoint,
} from "../../src/tactics/presentation/TripoSamples";
import {
  immuneArt,
  hostArt,
  tissueArt,
  pathogenArt,
  scenarioArt,
} from "../../src/tactics/presentation/artCatalog";
import { cellCatalog } from "../../src/tactics/content/cells";
import { tissueCellCatalog } from "../../src/tactics/content/anatomy";
import { tacticalScenarios } from "../../src/tactics/content/m1";
import { m1 } from "../../src/tactics/content/m1";
import { anatomyHeight } from "../../src/tactics/presentation/Anatomy";

function readAsset(name: string) {
  const bytes = readFileSync(
    new URL(`../../public/assets/tripo/${name}.glb`, import.meta.url),
  );
  expect(bytes.readUInt32LE(0)).toBe(0x46546c67);
  const json = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  const binary = bytes.subarray(28 + bytes.readUInt32LE(12));
  return { bytes, json, binary };
}
describe("Tripo sample budgets and safe fallback", () => {
  it("conforms the static tissue tiles to the actual terrain, including ends and outer edges", () => {
    for (let angle = 0; angle < Math.PI * 2; angle += 0.25)
      for (const along of [-2.1, 0, 2.1])
        for (const depth of [-0.575, 0.575]) {
          const point = fitSeptumPoint(m1, angle, along, 0.08, depth);
          expect(
            point.y - anatomyHeight(point.x, point.z, m1),
          ).toBeGreaterThanOrEqual(0.025 - 1e-10);
          expect(Object.values(point).every(Number.isFinite)).toBe(true);
        }
  });
  it("preserves surface winding while fitting every alveolar field", () => {
    for (let field = 0; field < m1.fields.length; field++)
      for (let angle = 0; angle < Math.PI * 2; angle += 0.4) {
        const a = fitSeptumPoint(m1, angle, 0, 0.3, 0, field);
        const b = fitSeptumPoint(m1, angle, 0.01, 0.3, 0, field);
        const c = fitSeptumPoint(m1, angle, 0, 0.3, 0.01, field);
        expect(
          (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z),
        ).toBeGreaterThan(0);
      }
  });
  it("keeps all three game assets within the agreed web budget with no external dependencies", () => {
    let total = 0;
    for (const name of ["macrophage", "neutrophil", "alveolar-septum"]) {
      const { bytes, json, binary } = readAsset(name);
      total += bytes.length;
      expect(json.meshes.length).toBe(1);
      expect(json.materials.length).toBe(1);
      expect(json.extensionsRequired ?? []).toEqual([]);
      expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      let triangles = 0;
      for (const primitive of json.meshes[0].primitives) {
        expect(primitive.mode ?? 4).toBe(4);
        triangles += json.accessors[primitive.indices].count / 3;
      }
      expect(triangles).toBeLessThanOrEqual(
        name === "alveolar-septum" ? 3000 : 4000,
      );
      for (const image of json.images) {
        expect(image.uri).toBeUndefined();
        expect(image.mimeType).toBe("image/png");
        const view = json.bufferViews[image.bufferView];
        const png = binary.subarray(view.byteOffset ?? 0);
        expect(png.readUInt32BE(16)).toBeLessThanOrEqual(512);
        expect(png.readUInt32BE(20)).toBeLessThanOrEqual(512);
      }
    }
    expect(total).toBeLessThan(2 * 1024 * 1024);
  });
  it("provides independent membrane morph animation and game-aligned origins", () => {
    for (const name of ["macrophage", "neutrophil"]) {
      const { json } = readAsset(name);
      const primitive = json.meshes[0].primitives[0];
      expect(primitive.targets.length).toBe(1);
      expect(json.accessors[primitive.targets[0].POSITION].count).toBe(
        json.accessors[primitive.attributes.POSITION].count,
      );
      // Blender Z-up exports through a node transform; verify the local membrane envelope.
      const bounds = json.accessors[primitive.attributes.POSITION];
      expect(bounds.max[0] - bounds.min[0]).toBeLessThanOrEqual(3.61);
      expect(bounds.max.every(Number.isFinite)).toBe(true);
    }
  });
  it("records exactly three successful paid requests totalling 60 credits, without keys", () => {
    const text = readFileSync(
      new URL("../../docs/art/tripo-samples/tasks.json", import.meta.url),
      "utf8",
    );
    const tasks = JSON.parse(text);
    expect(tasks).toHaveLength(3);
    expect(new Set(tasks.map((t: { task_id: string }) => t.task_id)).size).toBe(
      3,
    );
    expect(tasks.every((t: { status: string }) => t.status === "success")).toBe(
      true,
    );
    expect(
      tasks.reduce(
        (n: number, t: { credits_consumed: number }) => n + t.credits_consumed,
        0,
      ),
    ).toBe(60);
    expect(text).not.toMatch(/tsk_|authorization|api_key/i);
  });
  it("covers every immune, host, pathogen and organ slot with a budgeted replaceable asset", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../../public/assets/tripo/manifest.json", import.meta.url),
        "utf8",
      ),
    );
    const names = new Set(
      manifest.assets.map((a: { asset: string }) => a.asset),
    );
    expect(Object.keys(immuneArt).sort()).toEqual(
      Object.keys(cellCatalog).sort(),
    );
    expect(Object.keys(hostArt).sort()).toEqual(
      Object.keys(tissueCellCatalog).sort(),
    );
    for (const name of [
      ...Object.values(immuneArt),
      ...Object.values(hostArt),
      ...Object.values(tissueArt),
      ...Object.values(pathogenArt),
    ])
      expect(names.has(name)).toBe(true);
    for (const asset of manifest.assets) {
      const { bytes, json } = readAsset(asset.asset);
      expect(bytes.length).toBeLessThan(800000);
      expect(json.meshes).toHaveLength(1);
      expect(json.materials).toHaveLength(1);
      expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
      const primitive = json.meshes[0].primitives[0];
      expect(json.accessors[primitive.indices].count / 3).toBeLessThanOrEqual(
        asset.asset === "macrophage" || asset.asset === "neutrophil"
          ? 4000
          : 3200,
      );
      expect(primitive.targets?.length ?? 0).toBe(asset.morphTargets);
    }
    for (const content of Object.values(tacticalScenarios)) {
      expect(scenarioArt(content).length).toBeLessThan(9);
      for (const asset of scenarioArt(content))
        expect(names.has(asset)).toBe(true);
    }
  });
  it("records sixteen accepted new jobs within the 320-credit ceiling, without automatic paid retries", () => {
    const text = readFileSync(
      new URL("../../docs/art/tripo-expansion/tasks.json", import.meta.url),
      "utf8",
    );
    const tasks = JSON.parse(text);
    expect(tasks).toHaveLength(16);
    expect(new Set(tasks.map((t: { task_id: string }) => t.task_id)).size).toBe(
      16,
    );
    expect(tasks.every((t: { status: string }) => t.status === "success")).toBe(
      true,
    );
    expect(
      tasks.reduce(
        (n: number, t: { credits_consumed: number }) => n + t.credits_consumed,
        0,
      ),
    ).toBe(320);
    expect(text).not.toMatch(/tsk_|authorization|api_key|https:\/\//i);
  });
  it("retains originals when asset fetching fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const bank = new TripoSamples();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bank.readyCount).toBe(0);
    expect(bank.cell("macrophage")).toBeUndefined();
    expect(bank.cell("nk")).toBeUndefined();
    bank.dispose();
    vi.unstubAllGlobals();
    warn.mockRestore();
  });
  it("cancels outstanding requests on scene teardown", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            signals.push(options.signal);
            options.signal.addEventListener("abort", () =>
              reject(new Error("cancelled")),
            );
          }),
      ),
    );
    const bank = new TripoSamples();
    bank.dispose();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signals).toHaveLength(3);
    expect(signals.every((s) => s.aborted)).toBe(true);
    vi.unstubAllGlobals();
  });
});
