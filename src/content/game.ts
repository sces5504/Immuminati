import type { Content, ScenarioDefinition } from "../domain/model";
const m1: ScenarioDefinition = {
  id: "m1",
  title: "莢膜防線",
  pathogen: "pneumococcus",
  mode: "clearance",
  description:
    "肺炎鏈球菌進入肺部。運用案例提供的有限既存特異性抗體與補體，讓吞噬者穿越莢膜防線。",
  regions: [
    {
      id: "a",
      name: "肺泡入口",
      subtitle: "感染前緣",
      x: 27,
      y: 28,
      capacity: 3,
      maxHealth: 100,
      weight: 1,
      neighbors: ["b", "c"],
    },
    {
      id: "b",
      name: "肺泡深部",
      subtitle: "擴散路徑",
      x: 74,
      y: 31,
      capacity: 3,
      maxHealth: 100,
      weight: 1,
      neighbors: ["a", "c"],
    },
    {
      id: "c",
      name: "微血管側",
      subtitle: "增援入口",
      x: 50,
      y: 74,
      capacity: 4,
      maxHealth: 100,
      weight: 1,
      neighbors: ["a", "b"],
    },
  ],
  initialLoads: [9, 6, 3],
  variants: [
    [6, 9, 3],
    [8, 4, 6],
  ],
  initialUnits: [
    { kind: "macrophage", region: "a" },
    { kind: "neutrophil", region: "b" },
    { kind: "dendritic", region: "c" },
  ],
  pool: ["macrophage", "neutrophil"],
  ap: 4,
  opsonins: 6,
  opsoninDuration: 3,
  maxTurns: 12,
  spreadThreshold: 9,
  damagePerLoad: 2,
  stars: [85, 60],
};
export const content: Content = {
  cells: {
    macrophage: {
      id: "macrophage",
      name: "巨噬細胞",
      short: "巨噬",
      cost: 2,
      delay: 2,
      power: 5,
      unmarkedPower: 1,
      description:
        "偽足包覆病原。已調理時清除 5 負荷，未調理時 1；每回合一次主要吞噬。",
      encyclopedia: "macrophage",
    },
    neutrophil: {
      id: "neutrophil",
      name: "嗜中性球",
      short: "嗜中性",
      cost: 2,
      delay: 1,
      power: 4,
      unmarkedPower: 1,
      description:
        "快速到場的吞噬者。已調理時清除 4 負荷，未調理時 1；每回合一次主要吞噬。",
      encyclopedia: "neutrophil",
    },
    dendritic: {
      id: "dendritic",
      name: "樹突細胞",
      short: "樹突",
      cost: 2,
      delay: 2,
      power: 1,
      unmarkedPower: 1,
      description:
        "M1 以局部取樣吞噬為基本行為，每回合清除 1 負荷。呈遞及分化流程留待 M2。",
      encyclopedia: "dendritic",
    },
  },
  pathogens: {
    pneumococcus: {
      id: "pneumococcus",
      name: "肺炎鏈球菌",
      english: "Streptococcus pneumoniae",
      antigen: "pneumo-capsule",
      survivesEngulfment: false,
      replication: 2,
      intracellularGrowth: 0,
      sources: ["B3", "B10"],
    },
  },
  scenarios: { m1 },
};
export const scenarioCards = [
  {
    id: "m1",
    index: "01",
    name: "肺炎鏈球菌",
    subtitle: "莢膜防線",
    tag: "調理 × 吞噬",
    ready: true,
  },
  {
    id: "m2",
    index: "02",
    name: "沙門氏菌",
    subtitle: "吞入之後",
    tag: "胞內存活",
    ready: false,
  },
  {
    id: "m3",
    index: "03",
    name: "結核分枝桿菌",
    subtitle: "感染灶的控制",
    tag: "限制擴散",
    ready: false,
  },
  {
    id: "m4",
    index: "04",
    name: "流感 A",
    subtitle: "病毒與感染細胞",
    tag: "目標辨識",
    ready: false,
  },
  {
    id: "m5",
    index: "05",
    name: "白色念珠菌",
    subtitle: "黏膜防禦",
    tag: "上皮與形態",
    ready: false,
  },
  {
    id: "m6",
    index: "06",
    name: "HIV",
    subtitle: "免疫防線",
    tag: "病毒控制",
    ready: false,
  },
];
export function validateContent(c: Content): string[] {
  const errors: string[] = [];
  for (const s of Object.values(c.scenarios)) {
    const ids = s.regions.map((r) => r.id);
    if (new Set(ids).size !== ids.length || !c.pathogens[s.pathogen])
      errors.push(`${s.id}: ID／病原不合法`);
    for (const r of s.regions)
      if (
        r.neighbors.some(
          (n) =>
            !ids.includes(n) ||
            !s.regions.find((v) => v.id === n)?.neighbors.includes(r.id),
        )
      )
        errors.push(`${r.id}: 連線不對稱`);
    if (
      s.initialLoads.length !== ids.length ||
      s.variants.some((v) => v.length !== ids.length)
    )
      errors.push(`${s.id}: 配置長度`);
    for (const u of s.initialUnits)
      if (!ids.includes(u.region) || !c.cells[u.kind])
        errors.push(`${s.id}: 初始單位`);
  }
  return errors;
}
