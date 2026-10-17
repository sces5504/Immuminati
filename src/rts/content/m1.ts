import type { Scenario, NodePhase } from "../domain/types";
export const ANTIGEN = "spn:surface-protein-A";
export const M1: Scenario = {
  id: "M1",
  version: "rts-m1-1",
  width: 1000,
  height: 680,
  tissueBottom: 500,
  dt: 0.2,
  initial: [
    { kind: "macrophage", x: 370, y: 270 },
    { kind: "macrophage", x: 530, y: 420 },
    { kind: "dendritic", x: 500, y: 255 },
  ],
  foci: [
    { x: 600, y: 245 },
    { x: 710, y: 390 },
  ],
  sourceSteps: [1, 200, 400],
  sourceClose: 550,
  growthEvery: 50,
  growth: 1.22,
  split: 8,
  signalStrength: 1.6,
  signalDiffusion: 0.17,
  signalDecay: 0.975,
  resources: 55,
  regen: 0.65,
  supply: 6,
  supplyRegen: 0.045,
  costs: { recruit: 15, opsonize: 18, support: 22 },
  recruitDelay: 35,
  crossing: 15,
  tissueDamage: 0.04,
  inflammationDamage: 0.11,
  stages: {
    maturation: 30,
    migration: 65,
    presentation: 65,
    bActivation: 50,
    differentiation: 100,
    transport: 60,
  },
  stars: [55, 80],
  timeLimit: 2400,
};
export const nodeLabels: Record<NodePhase, string> = {
  antigen: "等待 DC 攝取蛋白抗原",
  maturation: "DC 成熟／共刺激準備",
  migration: "DC 遷移至引流淋巴結",
  presentation: "蛋白呈遞 → 初始 CD4 活化",
  bActivation: "同抗原 B 細胞辨識＋T 協助",
  differentiation: "B 細胞增殖／漿細胞分化",
  transport: "新生特異性抗體運送",
  active: "抗體已到組織：促進調理",
};
export const missions = [
  ["M1", "肺炎鏈球菌", "莢膜、調理與吞噬協作"],
  ["M2", "鼠傷寒沙門氏菌", "囊泡內存活與 Th1 支援"],
  ["M3", "結核分枝桿菌", "控制負荷、擴散與組織保全"],
  ["M4", "流感 A", "抗病毒狀態與感染宿主辨識"],
  ["M5", "白色念珠菌", "口腔黏膜、菌絲與 IL-17"],
  ["M6", "HIV", "局部免疫防禦教學情境"],
];
export const encyclopedia = [
  [
    "巨噬細胞",
    "組織常駐哨兵。自主巡邏、偵測、接近、接觸並吞噬；莢膜降低未調理攝入效率。辨識感染後釋放 CXCL8，並引發 TNF／IL-1 相關發炎環境。",
    "B3",
  ],
  [
    "嗜中性球",
    "募集須有供應、資源與活化內皮；先在血管動員，再跨內皮，沿 CXCL8 梯度趨化。壽命有限；過強反應可造成旁觀者損傷。",
    "B3",
  ],
  [
    "樹突細胞 DC",
    "攝取 spn:surface-protein-A 後成熟、遷移，呈遞蛋白抗原並提供共刺激。離開局部防線後才開始初次適應性流程。",
    "B1",
  ],
  [
    "肺炎鏈球菌／M1",
    "具莢膜雙球菌；胞外繁殖及空間擴散。補體或抗體調理提高後續攝入，不直接殺菌；不能假定補體終末裂解普遍有效。",
    "B3",
  ],
  [
    "CXCL8／發炎",
    "CXCL8 是趨化訊號，不是傷害法術。低解析場依固定步擴散衰減。TNF／IL-1 合併發炎模型促進內皮活化；過度持續反應損傷組織。抑制會延緩募集。",
    "B3",
  ],
  [
    "抗原與調理",
    "M1 對追蹤的表面蛋白尚無特異性記憶。早期按鈕提供有限補體沉積；淋巴結產生針對暴露蛋白靶標的新生抗體。這不是所有抗莢膜抗體的唯一路徑；莢膜多醣可有 T 非依賴反應。",
    "B1",
  ],
  [
    "淋巴結與時間",
    "DC 攝取→成熟→遷移→T 活化→B 辨識／協助→分化→抗體交通，各階段有模擬延遲。關卡時間為教學壓縮，不代表臨床時數。單位代表同類細胞群，病原負荷與代表密度一致。",
    "B10",
  ],
  [
    "吞入與清除",
    "接觸、包覆、吞入、胞內處理分開。M1 正常走清除；預覽中的存活分支為受控機制示範，不是 M1 常見病程，也不代表 M2 已完成。",
    "B11",
  ],
  [
    "M2：鼠傷寒沙門氏菌",
    "選定局部組織／巨噬細胞情境：胞內存活，適當 Th1／IFN-γ 支援；不能以 CD8 萬用清場。開發中。",
    "B4",
  ],
  [
    "M3：結核分枝桿菌",
    "以控制感染與維持組織為目標，可有殘存活菌，不代表臨床治癒；肉芽腫不是瞬間無敵圍牆。開發中。",
    "B12",
  ],
  [
    "M4：流感 A",
    "游離病毒與感染宿主分開；Type I IFN、NK、特異性 CD8 與抗體中和各有辨識／交通條件。開發中。",
    "B5",
  ],
  [
    "M5：白色念珠菌",
    "酵母與菌絲不同；Th17 經組織／上皮 IL-17 反應支持黏膜防禦，不直接射殺真菌。開發中。",
    "B7",
  ],
  [
    "M6：HIV",
    "病毒感染有宿主易感性與潛伏狀態；CD8 不能直接識別所有潛伏來源。現代抗反轉錄病毒治療可有效控制感染，讓人長期健康生活。開發中。",
    "B13",
  ],
  [
    "策略與結果",
    "先天調理／募集可較早控制；也可維持防線等待抗體。呼吸道來源於 110 模擬秒關閉，仍有活病原或未來來源不會誤勝。組織 ≤0 或 480 秒未控制即失敗；勝利組織 ≥80 三星、≥55 二星，其餘一星。無永久戰力。",
    "B3",
  ],
];
export const sources: Record<string, { label: string; url: string }> = {
  B1: {
    label: "Janeway：B 細胞反應",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK27142/",
  },
  B3: {
    label: "肺炎鏈球菌莢膜與補體研究",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2812187/",
  },
  B4: {
    label: "Salmonella 巨噬細胞研究",
    url: "https://pubmed.ncbi.nlm.nih.gov/15908373/",
  },
  B5: {
    label: "Medical Microbiology：免疫防禦",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK8423/",
  },
  B7: {
    label: "口腔上皮 IL-17 訊號",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5147498/",
  },
  B10: {
    label: "Janeway：體液免疫",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK10752/",
  },
  B11: {
    label: "Janeway：胞內病原",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK27176/",
  },
  B12: {
    label: "CDC：Inactive Tuberculosis",
    url: "https://www.cdc.gov/tb/about/inactive-tuberculosis.html",
  },
  B13: {
    label: "NIH：HIV 基礎",
    url: "https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-and-aids-basics",
  },
};
export const kindNames = {
  macrophage: "巨噬細胞",
  neutrophil: "嗜中性球",
  dendritic: "樹突細胞",
};
export const actionNames = {
  patrol: "巡邏：等待感染訊息",
  chemotaxis: "趨化：沿 CXCL8 梯度",
  approach: "接近目標／指定位置",
  contact: "接觸：辨識莢膜／調理",
  wrap: "偽足包覆",
  ingest: "吞入胞內囊泡",
  digest: "胞內處理",
  survive: "胞內活菌存留",
  cooldown: "冷卻：恢復作用機會",
  mature: "攜抗原／成熟",
  migrate: "遷移：前往淋巴出口",
  exit: "已離開組織",
  extravasate: "跨內皮擠出",
};
