import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** Replaceable, independent molecular assets. Y arms and globular C3b are not color-only icons. */
export function antibodyModel(material: THREE.Material) {
  const root = new THREE.Group();
  root.name = "antibody";
  const segments = [
    [
      [0, 0, 0],
      [0, 0.5, 0],
    ],
    [
      [0, 0.5, 0],
      [-0.3, 0.85, 0],
    ],
    [
      [0, 0.5, 0],
      [0.3, 0.85, 0],
    ],
  ] as const;
  for (const [a, b] of segments) {
    const g = new THREE.TubeGeometry(
      new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b)),
      1,
      0.06,
      7,
      false,
    );
    root.add(new THREE.Mesh(g, material));
  }
  for (const x of [-0.3, 0.3]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), material);
    tip.position.set(x, 0.85, 0);
    root.add(tip);
  }
  return root;
}
export function complementModel(material: THREE.Material) {
  const root = new THREE.Group();
  root.name = "c3b";
  for (let i = 0; i < 3; i++) {
    const part = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), material);
    part.position.set((i - 1) * 0.12, (i % 2) * 0.12, 0);
    part.scale.set(0.14, 0.19, 0.12);
    root.add(part);
  }
  return root;
}
export function pathogenGeometry(
  shape: string,
  hypha = false,
): THREE.BufferGeometry {
  if (shape === "rod" || shape === "acidfast")
    return new THREE.CapsuleGeometry(
      0.65,
      shape === "acidfast" ? 2.8 : 1.8,
      6,
      14,
    );
  if (shape === "fungus" && hypha) {
    const pieces = [
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, -2, 0),
          new THREE.Vector3(0.2, 0, 0),
          new THREE.Vector3(0, 2.8, 0.2),
        ]),
        14,
        0.3,
        10,
        false,
      ),
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.1, 0.3, 0),
          new THREE.Vector3(-0.8, 1.1, 0.1),
          new THREE.Vector3(-1.3, 1.7, 0.3),
        ]),
        8,
        0.23,
        8,
        false,
      ),
    ];
    const g = mergeGeometries(pieces);
    pieces.forEach((p) => p.dispose());
    return g;
  }
  if (shape === "virus" || shape === "retrovirus") {
    const pieces: THREE.BufferGeometry[] = [
      new THREE.SphereGeometry(0.85, 18, 12),
    ];
    for (let i = 0; i < 18; i++) {
      const y = 1 - (2 * (i + 0.5)) / 18,
        a = i * 2.39996,
        r = Math.sqrt(1 - y * y);
      const normal = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const spike = new THREE.CylinderGeometry(0.09, 0.055, 0.4, 6);
      spike.applyQuaternion(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          normal,
        ),
      );
      spike.translate(
        ...(normal.multiplyScalar(0.96).toArray() as [number, number, number]),
      );
      pieces.push(spike);
    }
    const g = mergeGeometries(pieces);
    pieces.forEach((p) => p.dispose());
    return g;
  }
  if (shape === "fungus") {
    const a = new THREE.SphereGeometry(1, 18, 12);
    a.scale(0.8, 1.15, 0.8);
    const b = new THREE.SphereGeometry(0.55, 14, 10);
    b.translate(0.7, 0.75, 0);
    const g = mergeGeometries([a, b]);
    a.dispose();
    b.dispose();
    return g;
  }
  return new THREE.SphereGeometry(1, 14, 10);
}
