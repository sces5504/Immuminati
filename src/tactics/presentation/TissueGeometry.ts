import * as THREE from "three";
import type { HostCell, TacticalContent } from "../domain/model";
import { tissueCellCatalog } from "../content/anatomy";
import { anatomyHeight } from "./Anatomy";

/** Host-cell models share the same authoritative identities in every scenario. */
export function makeTissueActor(host: HostCell, content: TacticalContent) {
  const root = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: tissueCellCatalog[host.kind].color,
    transparent: true,
    opacity: 0.78,
    roughness: 0.42,
    clearcoat: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  let geometry: THREE.BufferGeometry;
  const base = host.wall
    ? 0
    : anatomyHeight(host.position.x, host.position.z, content) + 0.1;
  if (host.wall) {
    const field = content.fields.find((f) => f.id === host.region)!;
    const { angle, radius, arc } = host.wall;
    const positions: number[] = [],
      indices: number[] = [];
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 13; col++) {
        const a = angle + (col / 12 - 0.5) * arc,
          r = radius + (row / 3 - 0.5) * 1.35;
        const x = field.center.x + Math.cos(a) * r,
          z = field.center.z + Math.sin(a) * r;
        positions.push(
          x - host.position.x,
          anatomyHeight(x, z, content) + 0.06,
          z - host.position.z,
        );
      }
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 12; col++) {
        const a = row * 13 + col;
        indices.push(a, a + 13, a + 1, a + 1, a + 13, a + 14);
      }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
  } else geometry = new THREE.SphereGeometry(1, 20, 12);
  const shell = new THREE.Mesh(geometry, mat);
  shell.name = "membrane";
  if (!host.wall) {
    shell.scale.set(
      host.kind === "endothelial" ? 1.45 : 1.65,
      host.kind === "endothelial" ? 0.16 : 0.65,
      0.95,
    );
    shell.position.y = base + 0.4;
  }
  root.add(shell);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 25),
    new THREE.LineBasicMaterial({
      color: 0xb888a1,
      transparent: true,
      opacity: 0.75,
    }),
  );
  outline.name = "junction";
  outline.position.copy(shell.position);
  outline.scale.copy(shell.scale);
  root.add(outline);
  const y = host.wall
    ? anatomyHeight(host.position.x, host.position.z, content) + 0.11
    : base + 0.52;
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 10),
    new THREE.MeshStandardMaterial({ color: 0x997b9f, roughness: 0.4 }),
  );
  nucleus.name = "nucleus";
  nucleus.position.set(-0.1, y, 0);
  nucleus.scale.set(
    host.kind === "alveolarI" ? 0.42 : 0.48,
    host.kind === "alveolarI" ? 0.09 : 0.23,
    0.32,
  );
  root.add(nucleus);
  if (host.kind === "alveolarII") {
    const gold = new THREE.MeshStandardMaterial({
      color: 0xddc3a4,
      roughness: 0.5,
    });
    for (let i = 0; i < 5; i++) {
      const organelle = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 6),
        gold,
      );
      organelle.position.set(
        Math.cos(i * 2.4) * 0.55,
        y + 0.04,
        Math.sin(i * 2.4) * 0.4,
      );
      root.add(organelle);
    }
  }
  const infection = new THREE.Group();
  infection.name = "infection";
  const pathogenMat = new THREE.MeshStandardMaterial({
    color: 0xb76488,
    emissive: 0x48162f,
    emissiveIntensity: 0.2,
  });
  for (let i = 0; i < 6; i++) {
    const particle = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 0),
      pathogenMat,
    );
    particle.position.set(
      0.4 + Math.cos(i * 2.4) * 0.35,
      y + 0.08,
      Math.sin(i * 2.4) * 0.45,
    );
    infection.add(particle);
  }
  root.add(infection);
  const selection = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.02, 40),
    new THREE.MeshBasicMaterial({
      color: 0xb7f3ef,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  selection.name = "selection";
  selection.rotation.x = -Math.PI / 2;
  selection.position.y = y + 0.1;
  selection.scale.set(1.3, 0.85, 1);
  root.add(selection);
  const fragments = new THREE.Group();
  fragments.name = "fragments";
  const fragmentMat = new THREE.MeshStandardMaterial({ color: 0xa77a98 });
  for (let i = 0; i < 6; i++) {
    const fragment = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      fragmentMat,
    );
    fragment.position.set(Math.cos(i) * 0.9, y, Math.sin(i) * 0.75);
    fragments.add(fragment);
  }
  root.add(fragments);
  root.position.set(host.position.x, 0, host.position.z);
  return root;
}
export function updateTissueActor(
  root: THREE.Group,
  host: HostCell,
  tick: number,
  selected: boolean,
  inspect: boolean,
) {
  const dying = host.apoptoticAt > 0,
    p = dying ? Math.min(1, (tick - host.apoptoticAt) / 12) : 0;
  const shell = root.getObjectByName("membrane") as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshPhysicalMaterial
  >;
  shell.material.opacity = (inspect ? 0.22 : 0.78) - p * 0.15;
  shell.material.color.setHex(tissueCellCatalog[host.kind].color);
  shell.material.color.lerp(
    new THREE.Color(0xa4738f),
    (1 - host.health / 100) * 0.65,
  );
  root.getObjectByName("infection")!.visible = host.load > 0;
  root.getObjectByName("selection")!.visible = selected;
  root.getObjectByName("fragments")!.visible = p > 0.3;
  shell.visible = p < 1;
  root.getObjectByName("nucleus")!.visible = p < 1;
  if (!host.wall)
    shell.scale.set(
      (host.kind === "endothelial" ? 1.45 : 1.65) * (1 - p * 0.55),
      (host.kind === "endothelial" ? 0.16 : 0.65) * (1 - p * 0.6),
      0.95 * (1 - p * 0.55),
    );
}
export function disposeTissueActor(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
