import type { TacticalContent, CellType } from "../domain/model";
/** Mechanism variations use the same authority, orders, tissue and presentation pipeline. */
export function campaignLevels(
  base: TacticalContent,
): Record<string, TacticalContent> {
  const initial = (...kinds: CellType[]) =>
    kinds.map((kind, i) => ({
      kind,
      region: ["a", "b", "c"][i % 3],
      offset: { x: (i % 2) * 2 - 1, z: 2 },
    }));
  const wave = (after: number, label: string, loads: number[]) => ({
    after,
    label,
    groups: loads.flatMap((load, i) =>
      load
        ? [{ region: ["a", "b", "c"][i], offset: { x: 0, z: 0 }, load }]
        : [],
    ),
  });
  const make = (
    id: string,
    overrides: Partial<TacticalContent>,
  ): TacticalContent => ({
    ...base,
    id,
    limit: 1600,
    damagePerLoad: 0.06,
    ...overrides,
  });
  return {
    m2: make("m2", {
      title: "囊泡內的躲藏者",
      tissue: "intestinal",
      mechanics: "intravesicular",
      pathogen: {
        id: "salmonella",
        name: "鼠傷寒沙門氏菌",
        survives: true,
        shape: "rod",
      },
      briefing:
        "沙門氏菌可在巨噬細胞的含菌囊泡存活。吞入不是殺死：建立 Th1／IFN-γ 支援，同時控制胞外擴散。",
      objective: "清除胞外與囊泡內活菌，保全腸黏膜。",
      fields: base.fields.map((f, i) => ({
        ...f,
        name: ["絨毛入口", "黏膜固有層", "引流前緣"][i],
      })),
      initial: initial("macrophage", "neutrophil", "dendritic", "th1", "nk"),
      waves: [
        wave(0, "跨越腸黏膜", [7, 5, 0]),
        wave(260, "局部再播散", [0, 5, 4]),
      ],
      growth: 1,
      growEvery: 55,
      spreadAt: 20,
    }),
    m3: make("m3", {
      title: "封鎖持續感染",
      mechanics: "containment",
      pathogen: {
        id: "tuberculosis",
        name: "結核分枝桿菌",
        survives: true,
        shape: "acidfast",
      },
      briefing:
        "這是已有感染巨噬細胞的肺部防禦片段。以巨噬細胞及 Th1 支援建立局部圍堵，限制播散；仍有活菌不等於防禦失敗。",
      objective:
        "負荷 ≤ 25、每個感染防區圍堵 ≥ 60%，連續維持 20 秒；各區保全 ≥ 45%。",
      initial: initial("macrophage", "dendritic", "th1", "macrophage"),
      waves: [wave(0, "持續感染焦點", [10, 0, 0])],
      growth: 1,
      growEvery: 90,
      damagePerLoad: 0.025,
      spreadAt: 18,
    }),
    m4: make("m4", {
      title: "被挾持的肺泡",
      mechanics: "viral",
      pathogen: {
        id: "influenza-a",
        name: "A 型流感病毒",
        survives: false,
        antigen: "influenza:protein",
        shape: "virus",
      },
      briefing:
        "病毒顆粒在胞外傳播，感染後於宿主內複製。第一型干擾素降低傳播，NK 辨識異常宿主；DC 交叉呈遞後，相符 CD8 清除感染細胞。抗體只能中和胞外病毒。",
      objective: "清除胞外病毒與產毒感染宿主，保全肺泡。",
      initial: initial("macrophage", "nk", "dendritic", "pdc", "cytotoxicT"),
      waves: [
        wave(0, "病毒入侵", [6, 4, 0]),
        wave(400, "呼吸道再暴露", [0, 4, 0]),
      ],
      growth: 0,
      damagePerLoad: 0.018,
    }),
    m5: make("m5", {
      title: "黏膜上的菌絲",
      tissue: "oral",
      mechanics: "fungal",
      pathogen: {
        id: "candida",
        name: "白色念珠菌",
        survives: false,
        shape: "fungus",
      },
      briefing:
        "酵母可被吞噬；長菌絲需要接觸性的嗜中性球顆粒防禦。IL-17 透過口腔上皮提高抗菌肽與募集，IL-22 支持屏障；不是細胞激素攻擊魔法。",
      objective: "清除酵母與菌絲，保全口腔黏膜。",
      fields: base.fields.map((f, i) => ({
        ...f,
        name: ["頰側黏膜", "口咽表面", "上皮前緣"][i],
      })),
      initial: initial("macrophage", "neutrophil", "dendritic", "th17", "ilc3"),
      waves: [wave(0, "酵母聚落", [7, 9, 3]), wave(350, "黏膜擴增", [5, 0, 6])],
      growth: 2,
      growEvery: 50,
      damagePerLoad: 0.06,
    }),
    m6: make("m6", {
      title: "免疫支援的考驗",
      tissue: "lymphoid",
      mechanics: "retroviral",
      pathogen: {
        id: "hiv",
        name: "HIV",
        survives: false,
        antigen: "hiv:protein",
        shape: "retrovirus",
      },
      briefing:
        "觀察 CD4 宿主的易感性、產毒與潛伏狀態。協調先天及特異性防禦，盡量維持局部控制與免疫支援時間。此情境沒有使用抗反轉錄病毒治療。",
      objective: "維持功能性 CD4 支援，抑制胞外傳播與產毒宿主。",
      fields: base.fields.map((f, i) => ({
        ...f,
        name: ["旁皮質區", "濾泡邊界", "髓質引流區"][i],
      })),
      initial: initial(
        "dendritic",
        "pdc",
        "nk",
        "cytotoxicT",
        "helperT",
        "bcell",
      ),
      waves: [wave(0, "局部病毒暴露", [4, 3, 0])],
      limit: 1250,
      growth: 0,
      damagePerLoad: 0.008,
    }),
  };
}
