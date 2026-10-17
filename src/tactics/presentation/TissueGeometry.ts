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
  } else if (host.kind === "enterocyte") {
    const shape = new THREE.Shape();
    const w = 0.7,
      h = 0.52,
      r = 0.14;
    shape.moveTo(-w + r, -h);
    shape.lineTo(w - r, -h);
    shape.quadraticCurveTo(w, -h, w, -h + r);
    shape.lineTo(w, h - r);
    shape.quadraticCurveTo(w, h, w - r, h);
    shape.lineTo(-w + r, h);
    shape.quadraticCurveTo(-w, h, -w, h - r);
    shape.lineTo(-w, -h + r);
    shape.quadraticCurveTo(-w, -h, -w + r, -h);
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 1.7,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    });
    geometry.rotateX(-Math.PI / 2);
  } else if (host.kind === "goblet") {
    geometry = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.2, 0),
        new THREE.Vector2(0.28, 0.3),
        new THREE.Vector2(0.5, 0.8),
        new THREE.Vector2(0.65, 1.45),
        new THREE.Vector2(0.62, 1.7),
      ],
      24,
    );
  } else if (host.kind === "mucosal") {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = Math.cos(a) * 1.85,
        z = Math.sin(a) * 1.85;
      if (!i) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    }
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.07,
      bevelThickness: 0.04,
    });
    geometry.rotateX(-Math.PI / 2);
  } else {
    geometry = new THREE.SphereGeometry(1, 32, 20);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i),
        a = Math.atan2(pos.getZ(i), pos.getX(i));
      const r =
        host.kind === "stromal"
          ? 1 + 0.25 * Math.pow(Math.cos(a * 3), 8) * (1 - y * y)
          : 1 + 0.02 * Math.sin(a * 7 + y * 4);
      pos.setXYZ(i, pos.getX(i) * r, y, pos.getZ(i) * r);
    }
    geometry.computeVertexNormals();
  }
  const shell = new THREE.Mesh(geometry, mat);
  shell.name = "membrane";
  const epithelialBox = ["enterocyte", "goblet", "mucosal"].includes(host.kind);
  if (!host.wall) {
    shell.scale.set(
      host.kind === "endothelial" ? 1.45 : 1.65,
      host.kind === "endothelial"
        ? 0.16
        : host.kind === "enterocyte"
          ? 1.5
          : host.kind === "mucosal"
            ? 0.23
            : 0.65,
      0.95,
    );
    shell.position.y = base + (epithelialBox ? 0 : 0.4);
    if (epithelialBox) shell.scale.set(1, 1, 1);
  }
  root.add(shell);
  if (host.kind === "enterocyte") {
    const bm = new THREE.MeshStandardMaterial({
      color: 0xf1d6bb,
      roughness: 0.7,
    });
    const brush = new THREE.InstancedMesh(
        new THREE.CapsuleGeometry(0.025, 0.18, 2, 4),
        bm,
        18,
      ),
      d = new THREE.Object3D();
    for (let i = 0; i < 18; i++) {
      d.position.set(
        ((i % 6) - 2.5) * 0.19,
        base + 1.83,
        (Math.floor(i / 6) - 1) * 0.25,
      );
      d.updateMatrix();
      brush.setMatrixAt(i, d.matrix);
    }
    root.add(brush);
  }
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
    : base +
      (host.kind === "enterocyte" || host.kind === "goblet"
        ? 0.8
        : host.kind === "mucosal"
          ? 0.14
          : 0.52);
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
      -0.1 + Math.cos(i * 2.4) * 0.22,
      y + 0.08,
      Math.sin(i * 2.4) * 0.22,
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
  const infection = root.getObjectByName("infection")!;
  infection.visible = host.load > 0;
  infection.children.forEach((o, i) => {
    const m = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    m.material.color.setHex(
      host.infection?.phase === "latent" ? 0x8e839c : 0xb76488,
    );
    m.scale.set(
      host.infection?.phase === "latent" ? 0.45 : 1,
      host.infection?.phase === "latent" ? 1.6 : 1,
      0.7,
    );
    if (host.infection?.phase === "latent") m.rotation.z = i * 0.7;
  });
  root.getObjectByName("selection")!.visible = selected;
  root.getObjectByName("fragments")!.visible = p > 0.3;
  shell.visible = p < 1;
  root.getObjectByName("nucleus")!.visible = p < 1;
  if (!host.wall)
    shell.scale.set(
      (host.kind === "endothelial" ? 1.45 : 1.65) * (1 - p * 0.55),
      (host.kind === "endothelial"
        ? 0.16
        : host.kind === "enterocyte"
          ? 1.5
          : host.kind === "mucosal"
            ? 0.23
            : 0.65) *
        (1 - p * 0.6),
      0.95 * (1 - p * 0.55),
    );
  if (!host.wall && ["enterocyte", "goblet", "mucosal"].includes(host.kind))
    shell.scale.setScalar(1 - p * 0.5);
}
export function disposeTissueActor(root: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) o.dispose();
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
}
