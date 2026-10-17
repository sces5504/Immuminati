import type { TacticalContent, TacticalState } from "../domain/model";
import { m1 } from "./m1";
import { createTactical } from "../engine/simulation";
/** A disposable bench using the same rules and renderer, never a campaign level or a saved battle. */
export const practiceContent: TacticalContent = {
  ...m1,
  id: "mechanism-practice",
  title: "機制演練",
  practice: true,
  waves: [
    {
      after: 0,
      label: "機制演練",
      groups: [{ region: "a", offset: { x: 1, z: -1 }, load: 10 }],
    },
  ],
  initial: [
    { kind: "macrophage", region: "a", offset: { x: -2, z: 2 } },
    { kind: "dendritic", region: "a", offset: { x: -1, z: 1 } },
    { kind: "nk", region: "b", offset: { x: 0, z: 3 } },
    { kind: "cytotoxicT", region: "c", offset: { x: 0, z: 1 } },
    { kind: "helperT", region: "c", offset: { x: -1, z: 6 } },
    { kind: "bcell", region: "c", offset: { x: 1, z: 6 } },
    { kind: "treg", region: "a", offset: { x: 2, z: 2 } },
    { kind: "neutrophil", region: "a", offset: { x: -3, z: 2 } },
  ],
  damagePerLoad: 0,
  growth: 0,
};
export function createPractice(): TacticalState {
  const s = createTactical(practiceContent, 1);
  s.immunity.autoSeek = true;
  s.energy = 8;
  const ct = s.cells.find((u) => u.kind === "cytotoxicT")!;
  ct.activation = "effector";
  ct.antigen = "viral-peptide-A";
  s.hosts = [
    {
      id: `h${s.serial++}`,
      region: "b",
      position: { x: 10, z: -7 },
      antigen: "viral-peptide-A",
      mhc1: false,
      stressed: true,
      load: 3,
      apoptoticAt: 0,
    },
    {
      id: `h${s.serial++}`,
      region: "c",
      position: { x: 1, z: 6 },
      antigen: "viral-peptide-A",
      mhc1: true,
      stressed: false,
      load: 3,
      apoptoticAt: 0,
    },
    {
      id: `h${s.serial++}`,
      region: "b",
      position: { x: 13, z: -3 },
      antigen: "unrelated-peptide",
      mhc1: true,
      stressed: false,
      load: 2,
      apoptoticAt: 0,
    },
    {
      id: `h${s.serial++}`,
      region: "c",
      position: { x: -4, z: 6 },
      antigen: "self",
      mhc1: true,
      stressed: false,
      load: 0,
      apoptoticAt: 0,
    },
  ];
  return s;
}
