import type {
  CellType,
  TissueCellKind,
  TacticalContent,
} from "../domain/model";

/** Replaceable art slots; biological state and identity remain owned by domain. */
export const immuneArt: Record<CellType, string> = {
  macrophage: "macrophage",
  neutrophil: "neutrophil",
  dendritic: "dendritic",
  helperT: "t-lymphocyte",
  cytotoxicT: "t-lymphocyte",
  bcell: "bcell",
  plasma: "plasma",
  nk: "nk",
  th1: "t-lymphocyte",
  tfh: "t-lymphocyte",
  th17: "t-lymphocyte",
  ilc3: "nk",
  pdc: "pdc",
  treg: "t-lymphocyte",
};
export const hostArt: Record<TissueCellKind, string> = {
  alveolarI: "epithelial",
  alveolarII: "epithelial",
  endothelial: "epithelial",
  enterocyte: "enterocyte",
  goblet: "goblet",
  mucosal: "epithelial",
  cd4host: "t-lymphocyte",
  stromal: "dendritic",
};
export const tissueArt = {
  lung: "alveolar-septum",
  intestinal: "intestinal-villus",
  oral: "oral-mucosa",
  lymphoid: "lymph-reticulum",
} as const;
export const pathogenArt = {
  coccus: "diplococcus",
  rod: "bacillus",
  acidfast: "bacillus",
  virus: "enveloped-virus",
  retrovirus: "enveloped-virus",
  fungus: "yeast",
} as const;
export const SAMPLE_RADII: Partial<Record<CellType, number>> = {
  macrophage: 1.9,
  neutrophil: 1.6,
  dendritic: 2.15,
  pdc: 1.6,
  helperT: 1.4,
  cytotoxicT: 1.4,
  bcell: 1.5,
  plasma: 1.65,
  nk: 1.55,
  th1: 1.45,
  tfh: 1.45,
  th17: 1.45,
  treg: 1.45,
  ilc3: 1.55,
};
export function scenarioArt(content: TacticalContent) {
  return [
    "macrophage",
    "neutrophil",
    tissueArt[content.tissue],
    pathogenArt[content.pathogen.shape ?? "coccus"],
    ...(content.tissue === "lung"
      ? ["epithelial"]
      : content.tissue === "intestinal"
        ? ["enterocyte", "goblet", "epithelial"]
        : content.tissue === "oral"
          ? ["epithelial"]
          : ["t-lymphocyte", "dendritic", "epithelial"]),
  ];
}
