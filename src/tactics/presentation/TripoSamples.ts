import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CellType, TacticalContent, HostCell } from "../domain/model";
import { anatomyHeight } from "./Anatomy";
import {
  immuneArt,
  hostArt,
  tissueArt,
  pathogenArt,
  scenarioArt,
} from "./artCatalog";
import { pathogenGeometry } from "./MolecularModels";
import { cellCatalog } from "../content/cells";
import { tissueCellCatalog } from "../content/anatomy";
export { SAMPLE_RADII } from "./artCatalog";

export const ART_PREVIEW = import.meta.env.VITE_ART_PREVIEW === "tripo";
type SampleKind = string;
export interface SampleCell {
  root: THREE.Group;
  update(phase: number, live: boolean, infected: boolean): void;
  opacity?(value: number): void;
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
  private attempted = new Set<string>();
  private geometryCache = new Map<string, THREE.BufferGeometry>();
  constructor(content?: TacticalContent) {
    for (const kind of content
      ? scenarioArt(content)
      : ["macrophage", "neutrophil", "alveolar-septum"])
      this.request(kind);
  }
  private request(kind: string) {
    if (!this.stopped && !this.attempted.has(kind)) {
      this.attempted.add(kind);
      void this.load(kind);
    }
  }
  get readyKinds() {
    return [...this.templates.keys()].sort();
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
  private clone(
    asset: string,
    color: number,
    opacity = 0.58,
  ): SampleCell | undefined {
    this.request(asset);
    const template = this.templates.get(asset);
    if (!template) return;
    const root = template.clone(true);
    root.name = `tripo-${asset}`;
    const materials: THREE.MeshStandardMaterial[] = [];
    const membranes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const source = Array.isArray(o.material) ? o.material : [o.material];
      const clones = source.map((m) => {
        const material = (m as THREE.MeshStandardMaterial).clone();
        material.transparent = true;
        material.opacity = opacity;
        material.depthWrite = false;
        material.side = THREE.FrontSide;
        material.roughness = 0.4;
        material.normalScale.setScalar(0.18);
        material.color.setHex(color).lerp(new THREE.Color(0xffffff), 0.65);
        material.metalness = 0;
        materials.push(material);
        return material;
      });
      o.material = Array.isArray(o.material) ? clones : clones[0];
      o.castShadow = true;
      o.onAfterRender = () => {
        root.userData.rendered = true;
      };
      membranes.push(o);
    });
    return {
      root,
      opacity(value) {
        for (const material of materials) material.opacity = value;
      },
      update(phase, live, infected) {
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
  cell(kind: CellType): SampleCell | undefined {
    const instance = this.clone(immuneArt[kind], cellCatalog[kind].color);
    if (!instance) return;
    const root = instance.root;
    // Family members share a membrane, but keep distinct receptor silhouettes,
    // existing nuclei, ER and effector granules. These are visual abstractions.
    if (
      !["macrophage", "neutrophil", "dendritic", "pdc", "plasma"].includes(kind)
    ) {
      let geometry = this.geometryCache.get(`receptors-${kind}`);
      if (!geometry) {
        const count =
          kind === "bcell"
            ? 10
            : kind === "tfh"
              ? 7
              : kind === "treg"
                ? 5
                : kind === "ilc3"
                  ? 8
                  : 4;
        const pieces: THREE.BufferGeometry[] = [];
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          const stalk = new THREE.CapsuleGeometry(
            0.035,
            kind === "bcell" ? 0.26 : 0.16,
            2,
            5,
          );
          stalk.rotateZ(-0.55);
          stalk.rotateY(-a);
          stalk.translate(Math.cos(a) * 1.24, 1.4, Math.sin(a) * 1.24);
          pieces.push(stalk);
          if (kind === "bcell" || kind === "cytotoxicT") {
            const arm = stalk.clone();
            arm.rotateY(0.16);
            pieces.push(arm);
          }
          if (kind === "tfh" || kind === "treg") {
            const head = new THREE.TorusGeometry(0.085, 0.028, 4, 7);
            head.rotateY(-a);
            head.translate(Math.cos(a) * 1.37, 1.58, Math.sin(a) * 1.37);
            pieces.push(head);
          }
        }
        geometry = mergeGeometries(pieces)!;
        pieces.forEach((g) => g.dispose());
        this.geometryCache.set(`receptors-${kind}`, geometry);
      }
      const material = new THREE.MeshStandardMaterial({
        color: cellCatalog[kind].color,
        roughness: 0.4,
      });
      const receptors = new THREE.Mesh(geometry, material);
      root.add(receptors);
      const dispose = instance.dispose;
      instance.dispose = () => {
        material.dispose();
        dispose();
      };
    }
    return instance;
  }
  host(host: HostCell, content: TacticalContent): SampleCell | undefined {
    const instance = this.clone(
      hostArt[host.kind],
      tissueCellCatalog[host.kind].color,
      0.65,
    );
    if (!instance) return;
    const root = instance.root;
    const unique: THREE.BufferGeometry[] = [];
    if (host.wall) {
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const geometry = hostMembraneGeometry(host, content);
        o.geometry = geometry;
        o.matrixAutoUpdate = true;
        o.position.set(0, 0, 0);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 1, 1);
        o.updateMatrix();
        unique.push(geometry);
      });
    } else {
      const scale =
        host.kind === "alveolarII"
          ? [0.64, 2.1, 0.7]
          : host.kind === "endothelial"
            ? [0.9, 0.48, 0.65]
            : host.kind === "stromal"
              ? [0.9, 0.35, 0.85]
              : host.kind === "cd4host"
                ? [0.9, 0.6, 0.8]
                : [1, 1, 1];
      root.scale.set(...(scale as [number, number, number]));
      root.position.y =
        anatomyHeight(host.position.x, host.position.z, content) + 0.08;
    }
    const dispose = instance.dispose;
    instance.dispose = () => {
      unique.forEach((g) => g.dispose());
      dispose();
    };
    return instance;
  }
  pathogen(shape: string, hypha: boolean) {
    // Hyphae keep their independent branched, growing shape and yeast wall material.
    const asset =
      pathogenArt[shape as keyof typeof pathogenArt] ?? "diplococcus";
    this.request(asset);
    const template = this.templates.get(asset);
    if (!template) return;
    const key = `pathogen-${shape}-${hypha}`;
    let geometry = this.geometryCache.get(key);
    let material: THREE.MeshStandardMaterial | undefined;
    template.updateMatrixWorld(true);
    template.traverse((o) => {
      if (o instanceof THREE.Mesh)
        material = o.material as THREE.MeshStandardMaterial;
    });
    if (!geometry) {
      const pieces: THREE.BufferGeometry[] = [];
      template.traverse((o) => {
        if (o instanceof THREE.Mesh)
          pieces.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
      });
      geometry = mergeGeometries(pieces)!;
      pieces.forEach((g) => g.dispose());
      geometry.center();
      if (shape === "rod" || shape === "acidfast")
        geometry.rotateX(Math.PI / 2);
      if (shape === "acidfast") {
        // M. tuberculosis has no flagella: retain the wax-wall palette, rebuild
        // a slender smooth rod instead of inheriting Salmonella flagella.
        geometry.dispose();
        geometry = new THREE.CapsuleGeometry(0.45, 2.5, 5, 10);
        geometry.rotateX(Math.PI / 2);
      }
      if (shape === "retrovirus") {
        // Sparse trimeric Env clusters distinguish HIV from influenza's denser coat.
        geometry.dispose();
        const pieces: THREE.BufferGeometry[] = [
          new THREE.SphereGeometry(0.72, 12, 8),
        ];
        for (let i = 0; i < 8; i++) {
          const y = 1 - (2 * (i + 0.5)) / 8,
            a = i * 2.39996,
            r = Math.sqrt(1 - y * y);
          const normal = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
          const q = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            normal,
          );
          const stalk = new THREE.CylinderGeometry(0.045, 0.035, 0.22, 5);
          stalk.applyQuaternion(q);
          stalk.translate(
            ...(normal.clone().multiplyScalar(0.77).toArray() as [
              number,
              number,
              number,
            ]),
          );
          pieces.push(stalk);
          for (let j = 0; j < 3; j++) {
            const tip = new THREE.SphereGeometry(0.075, 5, 3);
            const point = new THREE.Vector3(
              Math.cos((j * Math.PI * 2) / 3) * 0.065,
              0.93,
              Math.sin((j * Math.PI * 2) / 3) * 0.065,
            ).applyQuaternion(q);
            tip.translate(point.x, point.y, point.z);
            pieces.push(tip);
          }
        }
        geometry = mergeGeometries(pieces)!;
        pieces.forEach((g) => g.dispose());
      }
      if (hypha) {
        geometry.dispose();
        geometry = pathogenGeometry("fungus", true);
      }
      this.geometryCache.set(key, geometry);
    }
    return {
      geometry,
      map: material?.map ?? null,
      normalMap: material?.normalMap ?? null,
    };
  }
  tissue(content: TacticalContent): THREE.Group | undefined {
    const asset = tissueArt[content.tissue];
    const template = this.templates.get(asset);
    if (!template) return;
    const root = new THREE.Group();
    root.name = `tripo-${asset}`;
    const placements: { x: number; z: number; a: number; field?: number }[] =
      [];
    if (content.tissue === "lung") {
      content.fields.forEach((field, fieldIndex) => {
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
          if (!open) placements.push({ x: 0, z: 0, a, field: fieldIndex });
        }
      });
    } else if (content.tissue === "intestinal") {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        placements.push({ x: Math.cos(a) * 20, z: Math.sin(a) * 18, a });
      }
    } else {
      // Detail stays at the surface or periphery; no solid scenery blocks units.
      for (let row = -3; row <= 3; row++)
        for (
          let col = content.tissue === "oral" ? -4 : -3;
          col <= (content.tissue === "oral" ? 4 : 3);
          col++
        ) {
          const oral = content.tissue === "oral";
          const x =
            col * (oral ? 4.7 : 5) + (oral ? 0 : Math.sin(row * 7 + col) * 0.7);
          const z =
            row * (oral ? 4.4 : 4.4) +
            (oral ? 0 : Math.cos(col * 3 + row) * 0.6);
          placements.push({
            x,
            z,
            a: oral ? (row % 2) * Math.PI : (col + row) * 0.57,
          });
        }
    }
    template.updateMatrixWorld(true);
    template.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const pieces = placements.map((p) => {
        const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          if (content.tissue === "lung") {
            const q = fitSeptumPoint(
              content,
              p.a,
              position.getX(i),
              position.getY(i),
              position.getZ(i),
              p.field,
            );
            position.setXYZ(i, q.x, q.y, q.z);
          } else {
            const x =
              p.x +
              position.getX(i) * Math.cos(p.a) -
              position.getZ(i) * Math.sin(p.a);
            const z =
              p.z +
              position.getX(i) * Math.sin(p.a) +
              position.getZ(i) * Math.cos(p.a);
            position.setXYZ(
              i,
              x,
              anatomyHeight(x, z, content) +
                Math.max(
                  0.025,
                  position.getY(i) *
                    (content.tissue === "lymphoid"
                      ? 0.6
                      : content.tissue === "oral"
                        ? 0.22
                        : 1),
                ),
              z,
            );
          }
        }
        geometry.computeVertexNormals();
        return geometry;
      });
      const geometry = mergeGeometries(pieces);
      pieces.forEach((g) => g.dispose());
      if (geometry) {
        const material = o.material as THREE.MeshStandardMaterial;
        material.normalScale.setScalar(0.2);
        material.roughness = 0.6;
        if (content.tissue === "oral") material.color.setHex(0xe2b2c0);
        if (content.tissue === "lymphoid") {
          material.color.setHex(0xe1b9c8);
          material.normalMap = null;
        }
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        root.add(mesh);
      }
    });
    return root;
  }
  dispose() {
    this.stopped = true;
    for (const request of this.requests) request.abort();
    for (const template of this.templates.values()) disposeTree(template);
    this.templates.clear();
    for (const geometry of this.geometryCache.values()) geometry.dispose();
    this.geometryCache.clear();
  }
}

export function fitSeptumPoint(
  content: TacticalContent,
  angle: number,
  along: number,
  up: number,
  depth: number,
  fieldIndex = 0,
) {
  const field = content.fields[fieldIndex];
  const a = angle - along / (field.radius + 0.85);
  const radius =
    field.radius +
    0.85 +
    0.55 * Math.sin(a * 3 + field.center.x * 0.08) +
    0.3 * Math.cos(a * 5 + 0.4) +
    depth;
  const x = field.center.x + Math.cos(a) * radius;
  const z = field.center.z + Math.sin(a) * radius;
  return { x, y: anatomyHeight(x, z, content) + Math.max(0.025, up * 0.28), z };
}

/** Thin squamous membrane needs evenly spaced vertices: a decimated imported
 * sheet bridges the steep septum and leaves floating shards. Keep the generated
 * material on a dedicated smooth, replaceable anatomical surface instead.
 */
export function hostMembraneGeometry(host: HostCell, content: TacticalContent) {
  const wall = host.wall!;
  const field = content.fields.find((f) => f.id === host.region)!;
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const columns = 16,
    rows = 6;
  for (let row = 0; row <= rows; row++)
    for (let col = 0; col <= columns; col++) {
      const u = (col / columns) * 2 - 1,
        v = (row / rows) * 2 - 1;
      const a = wall.angle - u * wall.arc * 0.485;
      const radius =
        wall.radius + v * 0.66 * (0.86 + 0.14 * Math.cos((u * Math.PI) / 2));
      const x = field.center.x + Math.cos(a) * radius,
        z = field.center.z + Math.sin(a) * radius;
      const bump =
        host.kind === "alveolarII"
          ? 0.24 * Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v)
          : 0.025 * Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
      positions.push(
        x - host.position.x,
        anatomyHeight(x, z, content) + 0.045 + bump,
        z - host.position.z,
      );
      uv.push(col / columns, row / rows);
    }
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const a = row * (columns + 1) + col;
      indices.push(
        a,
        a + columns + 1,
        a + 1,
        a + 1,
        a + columns + 1,
        a + columns + 2,
      );
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
