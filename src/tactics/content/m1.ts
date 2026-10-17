import type { TacticalContent } from "../domain/model";
import { cellCatalog } from "./cells";
export const m1: TacticalContent = {
  id: "m1",
  title: "莢膜防線",
  tissue: "lung",
  pathogen: { id: "pneumococcus", name: "肺炎鏈球菌", survives: false },
  fields: [
    {
      id: "a",
      name: "肺泡入口",
      center: { x: -10, z: -7 },
      radius: 7.8,
    },
    {
      id: "b",
      name: "深部肺泡",
      center: { x: 10, z: -6 },
      radius: 7.8,
    },
    {
      id: "c",
      name: "肺泡壁前緣",
      center: { x: 0, z: 8 },
      radius: 7.8,
    },
  ],
  portal: { x: 0, z: 18 },
  lymphExit: { x: -5, z: 18 },
  cells: cellCatalog,
  initial: [
    { kind: "macrophage", region: "a", offset: { x: -1, z: 3 } },
    { kind: "neutrophil", region: "b", offset: { x: 0, z: 3 } },
    { kind: "dendritic", region: "c", offset: { x: -3, z: 1 } },
  ],
  waves: [
    {
      after: 0,
      label: "前緣接觸",
      groups: [
        { region: "a", offset: { x: 1, z: -1 }, load: 12 },
        { region: "b", offset: { x: -1, z: -1 }, load: 10 },
        { region: "c", offset: { x: 1, z: -2 }, load: 4 },
      ],
    },
    {
      after: 175,
      label: "側翼滲入",
      groups: [
        { region: "a", offset: { x: -3, z: 0 }, load: 8 },
        { region: "c", offset: { x: 2, z: -1 }, load: 8 },
      ],
    },
    {
      after: 350,
      label: "深部菌群",
      groups: [{ region: "b", offset: { x: 1, z: 0 }, load: 14 }],
    },
  ],
  limit: 900,
  energyMax: 8,
  energyEvery: 40,
  markCost: 1,
  markDuration: 100,
  growEvery: 35,
  growth: 2,
  damageEvery: 10,
  damagePerLoad: 0.12,
  spreadAt: 20,
  stars: [85, 60],
};
export const tacticalScenarios: Record<string, TacticalContent> = { m1 };
