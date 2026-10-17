import * as THREE from "three";
import type { TacticalContent } from "../domain/model";
import { tissueProfiles } from "../content/tissues";
export const tissueFloor = (x: number, z: number) =>
  0.14 * Math.sin(x * 0.35) * Math.cos(z * 0.28) +
  0.08 * Math.sin(z * 0.8 + x * 0.2);
const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
/** Smooth alveolar septa merge into a shared surface. Open necks follow actual navigation corridors. */
const adjacentSacs = [
  [-28, -16, 6, 6],
  [-19, -24, 6.8, 5.7],
  [-5, -24, 6.4, 5],
  [9, -24, 7, 5.8],
  [23, -20, 6.5, 6],
  [29, -7, 5.8, 7],
  [28, 8, 6, 6],
  [20, 20, 6, 5],
  [7, 25, 6, 5],
  [-7, 25, 6, 5],
  [-21, 19, 6, 6],
  [-28, 5, 6, 6],
];
export function anatomyHeight(x: number, z: number, c: TacticalContent) {
  let h = tissueFloor(x, z) - 0.22;
  if (c.tissue === "oral")
    return h + 0.08 * Math.sin(x * 2.4) * Math.cos(z * 2.1);
  if (c.tissue === "lymphoid") {
    for (const f of c.fields)
      h +=
        0.32 *
        Math.exp(
          -Math.pow(Math.hypot(x - f.center.x, z - f.center.z) / f.radius, 4),
        );
    return h;
  }
  if (c.tissue !== "lung") return h;
  let septaPower = 0;
  for (const f of c.fields) {
    const dx = x - f.center.x,
      dz = z - f.center.z,
      a = Math.atan2(dz, dx);
    const r =
      f.radius +
      0.85 +
      0.55 * Math.sin(a * 3 + f.center.x * 0.08) +
      0.3 * Math.cos(a * 5 + 0.4);
    let opening = 1;
    for (const other of c.fields.filter((o) => o.id !== f.id)) {
      const axis = Math.atan2(
        other.center.z - f.center.z,
        other.center.x - f.center.x,
      );
      opening *= Math.min(1, Math.abs(angleDifference(a, axis)) / 0.42);
    }
    // The front opening represents the communicating alveolar duct / vascular access.
    if (f.id === "c")
      opening *= Math.min(1, Math.abs(angleDifference(a, Math.PI / 2)) / 0.4);
    septaPower += Math.pow(
      Math.exp(-Math.pow((Math.hypot(dx, dz) - r) / 1.05, 2)) *
        2.05 *
        Math.pow(opening, 1.4),
      2,
    );
  }
  h += Math.sqrt(septaPower);
  // Adjacent air sacs surround the three tactical fields; they share septal tissue,
  // instead of presenting the battlefield as three unrelated circular platforms.
  for (const [cx, cz, rx, rz] of adjacentSacs) {
    const dx = (x - cx) / rx,
      dz = (z - cz) / rz,
      a = Math.atan2(dz, dx);
    const d = Math.hypot(dx, dz),
      r = 1 + 0.055 * Math.sin(a * 3 + cx);
    const edge = Math.exp(-Math.pow((d - r) / 0.12, 2));
    h += edge * 1.15;
    h -= Math.exp(-Math.pow(d / 0.8, 4)) * 0.45;
  }
  return h;
}
export function buildAnatomy(c: TacticalContent, texture: THREE.Texture) {
  const profile = tissueProfiles[c.tissue],
    root = new THREE.Group();
  const materials: THREE.Material[] = [],
    geometries: THREE.BufferGeometry[] = [];
  const own = (g: THREE.BufferGeometry, m: THREE.Material) => {
    geometries.push(g);
    if (!materials.includes(m)) materials.push(m);
    const mesh = new THREE.Mesh(g, m);
    root.add(mesh);
    mesh.receiveShadow = true;
    return mesh;
  };
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    bumpMap: texture,
    bumpScale: 0.04,
    roughness: 0.55,
    vertexColors: true,
  });
  const geo = new THREE.PlaneGeometry(84, 76, 220, 196);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position,
    colors = new Float32Array(pos.count * 3),
    tint = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      h = anatomyHeight(x, z, c);
    pos.setY(i, h);
    const inField = Math.min(
      ...c.fields.map(
        (f) => Math.hypot(x - f.center.x, z - f.center.z) / f.radius,
      ),
    );
    const blend = THREE.MathUtils.smoothstep(inField, 0.8, 1.15);
    tint.setHex(profile.floor).lerp(new THREE.Color(profile.wall), blend);
    tint.lerp(new THREE.Color(0xe6b8c1), Math.min(0.75, Math.max(0, h) * 0.3));
    // Tint the existing continuous surface; a flat overlay would intersect the septa.
    const stripBlend =
      (1 -
        THREE.MathUtils.smoothstep(Math.abs(z - c.portal.z - 0.25), 1.4, 2.1)) *
      (1 - THREE.MathUtils.smoothstep(Math.abs(x), 11, 12));
    tint.lerp(new THREE.Color(0xb7a0ba), stripBlend * 0.65);
    tint.multiplyScalar(0.97 + 0.025 * Math.sin(x * 1.9) * Math.sin(z * 1.4));
    colors.set([tint.r, tint.g, tint.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  own(geo, mat);
  const vesselMat = new THREE.MeshStandardMaterial({
    color: 0xad748b,
    roughness: 0.42,
  });
  const endothelium = new THREE.MeshStandardMaterial({
    color: 0xe7b3c4,
    roughness: 0.5,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  const nuclei = new THREE.MeshStandardMaterial({
    color: 0x986f95,
    roughness: 0.42,
  });
  function tube(
    points: THREE.Vector3[],
    radius: number,
    m: THREE.Material,
    closed = false,
  ) {
    return own(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points, closed),
        Math.max(24, points.length * 3),
        radius,
        6,
        closed,
      ),
      m,
    );
  }
  const regions = new Map<string, THREE.Mesh>();
  for (const f of c.fields) {
    const fg = new THREE.RingGeometry(0, f.radius - 1, 64, 12);
    fg.rotateX(-Math.PI / 2);
    const surface = fg.attributes.position;
    for (let i = 0; i < surface.count; i++)
      surface.setY(
        i,
        anatomyHeight(
          surface.getX(i) + f.center.x,
          surface.getZ(i) + f.center.z,
          c,
        ) + 0.035,
      );
    fg.computeVertexNormals();
    const fm = new THREE.MeshStandardMaterial({
      color: profile.floor,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      roughness: 0.6,
    });
    const fmsh = own(fg, fm);
    fmsh.position.set(f.center.x, 0, f.center.z);
    regions.set(f.id, fmsh);
    if (c.tissue === "lung") {
      // Capillaries follow both faces of each alveolar septum, rather than unrelated decorative rings.
      for (const side of [-1, 1]) {
        const pts = [];
        for (let j = 0; j < 30; j++) {
          const a = (j / 30) * Math.PI * 2,
            r =
              f.radius +
              0.8 +
              side * 0.28 +
              0.55 * Math.sin(a * 3 + f.center.x * 0.08) +
              0.3 * Math.cos(a * 5 + 0.4);
          const x = f.center.x + Math.cos(a) * r,
            z = f.center.z + Math.sin(a) * r;
          pts.push(new THREE.Vector3(x, anatomyHeight(x, z, c) - 0.015, z));
        }
        tube(pts, 0.04, vesselMat, true);
      }
    }
  }
  // Thin continuous squamous epithelial junctions, conforming to the air-facing surface.
  const junction = new THREE.MeshStandardMaterial({
    color: 0xe0adb9,
    roughness: 0.72,
    transparent: true,
    opacity: 0.45,
  });
  if (c.tissue !== "intestinal" && c.tissue !== "lymphoid") {
    const edge = c.tissue === "oral" ? 2.5 : 3.1;
    const vertices: THREE.Vector3[] = [];
    for (let row = -7; row <= 7; row++)
      for (let col = -7; col <= 7; col++) {
        const cx = col * edge * 1.5,
          cz = (row * 2 + (col % 2)) * edge * 0.866;
        for (let j = 0; j < 3; j++) {
          const a = ((j - 1) * Math.PI) / 3,
            b = (j * Math.PI) / 3;
          const x1 = cx + edge * Math.cos(a),
            z1 = cz + edge * Math.sin(a),
            x2 = cx + edge * Math.cos(b),
            z2 = cz + edge * Math.sin(b);
          vertices.push(
            new THREE.Vector3(x1, anatomyHeight(x1, z1, c) + 0.025, z1),
            new THREE.Vector3(x2, anatomyHeight(x2, z2, c) + 0.025, z2),
          );
        }
      }
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(vertices),
      new THREE.LineBasicMaterial({
        color: 0xf5d5db,
        transparent: true,
        opacity: 0.12,
      }),
    );
    root.add(lines);
    geometries.push(lines.geometry);
    materials.push(lines.material, junction);
  } else if (c.tissue === "lymphoid") {
    const reticular = new THREE.MeshStandardMaterial({
      color: 0xe8cbd9,
      roughness: 0.8,
    });
    for (let i = 0; i < 25; i++) {
      const x = ((i * 13) % 45) - 22,
        z = ((i * 19) % 43) - 21;
      tube(
        [
          new THREE.Vector3(x, 0.1, z),
          new THREE.Vector3(x + 2, 0.3, z + 2),
          new THREE.Vector3(x + 4, 0.1, z - 1),
        ],
        0.035,
        reticular,
      );
    }
    for (const f of c.fields) {
      const loop = [];
      for (let j = 0; j < 40; j++) {
        const a = (j / 40) * Math.PI * 2;
        loop.push(
          new THREE.Vector3(
            f.center.x + Math.cos(a) * f.radius,
            0.16,
            f.center.z + Math.sin(a) * f.radius,
          ),
        );
      }
      tube(loop, 0.07, endothelium, true);
    }
  } else {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2,
        x = Math.cos(a) * 23,
        z = Math.sin(a) * 20;
      const points = Array.from({ length: 17 }, (_, j) => {
        const t = j / 16;
        return new THREE.Vector2(
          0.1 + 1.1 * Math.sin(t * Math.PI * 0.95),
          t * 4.4,
        );
      });
      const villus = own(
        new THREE.LatheGeometry(points, 24),
        new THREE.MeshStandardMaterial({ color: 0xe4b7ad, roughness: 0.55 }),
      );
      villus.position.set(x, -0.2, z);
      const cap = [];
      for (let j = 0; j < 24; j++) {
        const t = j / 23,
          a = t * Math.PI * 2;
        cap.push(
          new THREE.Vector3(
            x + Math.cos(a) * 0.65,
            0.3 + 3.3 * Math.sin(t * Math.PI),
            z + Math.sin(a) * 0.65,
          ),
        );
      }
      tube(cap, 0.065, vesselMat);
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        const stripe = [];
        for (let k = 0; k < 12; k++) {
          const t = k / 11;
          stripe.push(
            new THREE.Vector3(
              x + Math.cos(a) * (1.1 * Math.sin(t * Math.PI * 0.95) + 0.12),
              t * 4.4 - 0.2,
              z + Math.sin(a) * (1.1 * Math.sin(t * Math.PI * 0.95) + 0.12),
            ),
          );
        }
        tube(stripe, 0.025, junction);
      }
    }
  }
  // All access structures follow the terrain instead of cutting through it.
  const conform = (points: number[][], clearance: number) => {
    const horizontal = new THREE.CatmullRomCurve3(
      points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    );
    return horizontal
      .getPoints(180)
      .map(
        (p) =>
          new THREE.Vector3(p.x, anatomyHeight(p.x, p.z, c) + clearance, p.z),
      );
  };
  const borderMat = new THREE.MeshStandardMaterial({
    color: 0xe6cad7,
    roughness: 0.5,
  });
  tube(
    conform(
      [
        [-11, 16.5],
        [-3, 16.5],
        [3, 16.5],
        [11, 16.5],
      ],
      0.14,
    ),
    0.1,
    borderMat,
  );
  // The vascular entry is on the tissue side; entry through barriers is compressed, not an open airway.

  const vesselPoints = conform(
    [
      [-23, 20],
      [-13, 19.4],
      [-3, 18.8],
      [4, 18.8],
      [13, 20],
      [24, 20],
    ],
    0.82,
  );
  tube(vesselPoints, 0.55, vesselMat).name = "vascular-core";
  tube(vesselPoints, 0.64, endothelium).name = "vascular-wall";
  const portal = own(
    new THREE.TorusGeometry(1.25, 0.055, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xb6efff }),
  );
  portal.rotation.x = -Math.PI / 2;
  portal.position.set(
    c.portal.x,
    anatomyHeight(c.portal.x, c.portal.z, c) + 0.18,
    c.portal.z,
  );
  if (c.lymphExit) {
    const p = c.lymphExit;
    const lymphMat = new THREE.MeshStandardMaterial({
      color: 0x95c6bc,
      roughness: 0.48,
      transparent: true,
      opacity: 0.65,
    });
    tube(
      conform(
        [
          [p.x - 5, p.z + 4],
          [p.x - 2, p.z + 2],
          [p.x, p.z],
        ],
        0.35,
      ),
      0.23,
      lymphMat,
    );
    const opening = own(
      new THREE.TorusGeometry(0.75, 0.06, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xc1eadb }),
    );
    opening.rotation.x = -Math.PI / 2;
    opening.position.set(p.x, anatomyHeight(p.x, p.z, c) + 0.18, p.z);
  }
  return { root, materials, geometries, regions };
}
