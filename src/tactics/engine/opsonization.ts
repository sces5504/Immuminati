import type { Colony } from "../domain/model";
/** C3b and antibody can coexist; their shared uptake benefit is not counted twice. */
export function coatings(p: Colony, tick: number) {
  const complementUntil =
    p.complementUntil ?? (p.opsonin !== "antibody" ? p.markedUntil : 0);
  const antibodyUntil =
    p.antibodyUntil ?? (p.opsonin === "antibody" ? p.markedUntil : 0);
  return {
    complement: complementUntil > tick,
    antibody: antibodyUntil > tick,
    complementUntil,
    antibodyUntil,
  };
}
export function coat(p: Colony, kind: "c3b" | "antibody", until: number) {
  const old = coatings(p, 0);
  p.complementUntil = kind === "c3b" ? until : old.complementUntil;
  p.antibodyUntil = kind === "antibody" ? until : old.antibodyUntil;
  p.markedUntil = Math.max(p.complementUntil, p.antibodyUntil);
  p.opsonin = kind;
}
