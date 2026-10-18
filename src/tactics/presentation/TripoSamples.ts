import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CellType, TacticalContent } from "../domain/model";
import { anatomyHeight } from "./Anatomy";

export const ART_PREVIEW = import.meta.env.VITE_ART_PREVIEW === "tripo";
export const SAMPLE_RADII = { macrophage: 1.9, neutrophil: 1.6 };
type SampleKind = "macrophage" | "neutrophil" | "alveolar-septum";
export interface SampleCell {
  root: THREE.Group;
  update(phase: number, live: boolean, infected: boolean): void;
  dispose(): void;
}
const disposeTree = (root: THREE.Object3D) => {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(m);
      for (const value of Object.values(m))
        if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  for (const t of textures) {
    t.dispose();
    const source = t.source.data;
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap)
      source.close();
  }
};

/** One decode per asset per scene, geometry/textures shared by every cell instance.
 * Originals remain alive until a valid replacement is ready; late loads are disposed.
 * No generation APIs, keys, or rule mutations exist in this module.
 */
export class TripoSamples {
  private templates = new Map<SampleKind, THREE.Group>();
  private stopped = false;
  private requests = new Set<AbortController>();
  constructor() {
    for (const kind of ["macrophage", "neutrophil", "alveolar-septum"] as const)
      void this.load(kind);
  }
  get readyCount() {
    return this.templates.size;
  }
  private async load(kind: SampleKind) {
    const controller = new AbortController();
    this.requests.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20000);
    let root: THREE.Group | undefined;
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}assets/tripo/${kind}.glb`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("Asset unavailable");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 3 * 1024 * 1024)
        throw new Error("Asset exceeds size budget");
      root = (await new GLTFLoader().parseAsync(bytes, "")).scene;
      let faces = 0,
        meshes = 0;
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        faces +=
          (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
        meshes++;
      });
      if (!meshes || meshes > 3 || faces > 6500)
        throw new Error("Asset exceeds geometry budget");
      if (this.stopped) disposeTree(root);
      else this.templates.set(kind, root);
    } catch {
      if (root) disposeTree(root);
      if (!this.stopped)
        console.warn(`Tripo ${kind}: original model retained.`);
    } finally {
      clearTimeout(timeout);
      this.requests.delete(controller);
    }
  }
  cell(kind: CellType): SampleCell | undefined {
    if (kind !== "macrophage" && kind !== "neutrophil") return;
    const template = this.templates.get(kind);
    if (!template) return;
    const root = template.clone(true);
    root.name = `tripo-${kind}`;
    const materials: THREE.MeshStandardMaterial[] = [];
    const membranes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = Array.isArray(o.material) ? o.material : [o.material];
      const clones = source.map((m) => {
        const material = (m as THREE.MeshStandardMaterial).clone();
        material.transparent = true;
        material.opacity = 0.58;
        material.depthWrite = false;
        material.side = THREE.FrontSide;
        material.roughness = 0.37;
        material.normalScale.setScalar(0.18);
        material.color.setHex(kind === "neutrophil" ? 0xffe2ec : 0xe3cefa);
        material.metalness = 0;
        materials.push(material);
        return material;
      });
      o.material = Array.isArray(o.material) ? clones : clones[0];
      o.castShadow = true;
      membranes.push(o);
    });
    return {
      root,
      update(phase, live, infected) {
        root.scale.set(
          1 + (live ? Math.sin(phase * 1.6) * 0.025 : 0),
          1 + (live ? Math.cos(phase * 1.7) * 0.025 : 0),
          1,
        );
        for (const m of membranes)
          if (m.morphTargetInfluences?.length)
            m.morphTargetInfluences[0] = live
              ? 0.5 + Math.sin(phase * 1.2) * 0.45
              : 0.5;
        for (const m of materials) {
          m.emissive.setHex(infected ? 0x6b4110 : 0x120c26);
          m.emissiveIntensity = infected ? 0.22 : 0.04;
        }
      },
      dispose() {
        for (const m of materials) m.dispose();
        root.removeFromParent();
      },
    };
  }
  tissue(content: TacticalContent): THREE.Group | undefined {
    const template = this.templates.get("alveolar-septum");
    if (!template) return;
    const root = new THREE.Group();
    root.name = "tripo-alveolar-septa";
    const placements: number[] = [];
    // First review sample: one alveolar entrance; keep the other fields as reference.
    for (const field of content.fields.slice(0, 1)) {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const open =
          content.fields.some((other) => {
            if (other.id === field.id) return false;
            const axis = Math.atan2(
              other.center.z - field.center.z,
              other.center.x - field.center.x,
            );
            return (
              Math.abs(Math.atan2(Math.sin(a - axis), Math.cos(a - axis))) <
              0.45
            );
          }) ||
          (field.id === "c" && Math.abs(a - Math.PI / 2) < 0.45);
        if (open) continue;
        placements.push(a);
      }
    }
    template.updateMatrixWorld(true);
    template.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      // Fit each reusable tile to the existing surface, then batch once. No
      // per-frame deformation, floating ends, or change to navigable geometry.
      const pieces = placements.map((a) => {
        const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          const p = fitSeptumPoint(
            content,
            a,
            position.getX(i),
            position.getY(i),
            position.getZ(i),
          );
          position.setXYZ(i, p.x, p.y, p.z);
        }
        geometry.computeVertexNormals();
        return geometry;
      });
      const geometry = mergeGeometries(pieces);
      for (const piece of pieces) piece.dispose();
      if (geometry) {
        const material = o.material as THREE.MeshStandardMaterial;
        material.normalScale.setScalar(0.25);
        const wall = new THREE.Mesh(geometry, material);
        wall.receiveShadow = true;
        root.add(wall);
      }
    });
    return root;
  }
  dispose() {
    this.stopped = true;
    for (const request of this.requests) request.abort();
    for (const template of this.templates.values()) disposeTree(template);
    this.templates.clear();
  }
}

export function fitSeptumPoint(
  content: TacticalContent,
  angle: number,
  along: number,
  up: number,
  depth: number,
) {
  const field = content.fields[0];
  const a = angle + along / (field.radius + 0.85);
  const radius =
    field.radius +
    0.85 +
    0.55 * Math.sin(a * 3 + field.center.x * 0.08) +
    0.3 * Math.cos(a * 5 + 0.4) +
    depth;
  const x = field.center.x + Math.cos(a) * radius;
  const z = field.center.z + Math.sin(a) * radius;
  return { x, y: anatomyHeight(x, z, content) + Math.max(0.025, up * 0.55), z };
}
