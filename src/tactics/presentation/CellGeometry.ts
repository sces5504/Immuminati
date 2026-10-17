import * as THREE from "three";
import type { CellType } from "../domain/model";
export function membraneGeometry(kind: CellType) {
  const geo = new THREE.SphereGeometry(1, 64, 28),
    pos = geo.attributes.position;
  const branch = kind === "dendritic" || kind === "pdc",
    amoeba = kind === "macrophage",
    count = branch ? 8 : 7;
  const target = new Float32Array(pos.array.length);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      y = pos.getY(i),
      z = pos.getZ(i),
      a = Math.atan2(z, x);
    let extension = 0;
    if (branch || amoeba)
      for (let j = 0; j < count; j++) {
        const axis = (j / count) * Math.PI * 2 + 0.15 * Math.sin(j * 3.1);
        const da = Math.atan2(Math.sin(a - axis), Math.cos(a - axis));
        extension +=
          (branch ? 1.15 : 0.38) *
          Math.exp(-Math.pow(da / (branch ? 0.095 : 0.24), 2)) *
          Math.exp(-Math.pow(y / 0.31, 2)) *
          (0.85 + 0.15 * Math.cos(j * 2.3));
      }
    const r =
      1 + extension + 0.025 * Math.sin(a * 7 + y * 5) * Math.pow(1 - y * y, 2);
    const px = x * r,
      pz = z * r,
      py = y * (branch ? 0.78 : 1);
    pos.setXYZ(i, px, py, pz);
    const local = 1 + 0.045 * Math.sin(a * 3 + y * 2) * (1 - y * y);
    target.set([px * local, py, pz * local], i * 3);
  }
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(target, 3)];
  geo.computeVertexNormals();
  return geo;
}
export const lymphoid = (kind: string) =>
  !["macrophage", "neutrophil", "dendritic", "pdc"].includes(kind);
