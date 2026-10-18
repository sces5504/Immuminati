import type { CellType } from "../domain/model";
export const DEPLOYMENT_BUDGET = 12;
export interface DeploymentKit {
  id: string;
  name: string;
  reason: string;
  followup: string;
  units: { kind: CellType; region: string }[];
}
/** Suggestions teach a causal plan, not automatic victory or preset activation. */
export const deploymentKits: Record<string, DeploymentKit[]> = {
  m1: [
    {
      id: "opsonic",
      name: "調理與吞噬",
      reason: "莢膜妨礙攝入：C3b 搭配吞噬者，處理胞外菌。",
      followup: "開戰後選擇調理目標與增援時機；尚未配置抗原呈遞。",
      units: [
        { kind: "macrophage", region: "a" },
        { kind: "neutrophil", region: "b" },
      ],
    },
    {
      id: "antigen",
      name: "抗原接力",
      reason: "巨噬細胞守住前線，樹突細胞捕捉抗原並引流。",
      followup: "需再募集 Tfh／B 並等待協作；早期清菌較慢。",
      units: [
        { kind: "macrophage", region: "a" },
        { kind: "dendritic", region: "c" },
      ],
    },
  ],
  m2: [
    {
      id: "vesicle",
      name: "囊泡內防禦",
      reason: "巨噬細胞吞入沙門氏菌後仍可能保留活菌，需 Th1／IFN-γ。",
      followup: "Th1 尚未活化；開戰後優先補上樹突細胞呈遞鏈。",
      units: [
        { kind: "macrophage", region: "a" },
        { kind: "th1", region: "a" },
      ],
    },
    {
      id: "present",
      name: "先建立呈遞",
      reason: "樹突細胞取得抗原，為後續同源 Th1 活化做準備。",
      followup: "需再募集 Th1；吞入不能當成已清除。",
      units: [
        { kind: "macrophage", region: "a" },
        { kind: "dendritic", region: "b" },
      ],
    },
  ],
  m3: [
    {
      id: "contain",
      name: "圍堵感染焦點",
      reason: "樹突細胞與 Th1 建立 IFN-γ 支援，回應已感染的巨噬細胞。",
      followup: "保持 Th1 靠近感染焦點；目標是圍堵而非滅菌。",
      units: [
        { kind: "dendritic", region: "a" },
        { kind: "th1", region: "a" },
      ],
    },
    {
      id: "front",
      name: "先控制胞外",
      reason: "增加巨噬細胞處理胞外菌，同時引流抗原。",
      followup: "仍須補上 Th1 與局部圍堵，單靠吞噬不會過關。",
      units: [
        { kind: "macrophage", region: "b" },
        { kind: "dendritic", region: "a" },
      ],
    },
  ],
  m4: [
    {
      id: "antiviral",
      name: "先天抗病毒",
      reason: "pDC 的第一型干擾素降低感染；NK 辨識壓力高且 MHC-I 下降的宿主。",
      followup: "NK 不是萬用殺傷：需增援 DC／CD8，或建立胞外抗體中和。",
      units: [
        { kind: "pdc", region: "a" },
        { kind: "nk", region: "b" },
        { kind: "dendritic", region: "c" },
      ],
    },
    {
      id: "specific",
      name: "交叉呈遞接力",
      reason: "DC 交叉呈遞後，相符 CD8 才能清除感染宿主。",
      followup: "CD8 尚未活化；以 pDC 爭取等待時間，勿把胞外病毒當 CD8 目標。",
      units: [
        { kind: "dendritic", region: "a" },
        { kind: "cytotoxicT", region: "b" },
        { kind: "pdc", region: "a" },
      ],
    },
  ],
  m5: [
    {
      id: "mucosa",
      name: "黏膜屏障協作",
      reason: "ILC3 訊號經上皮支持防禦；嗜中性球接觸長菌絲後釋放顆粒。",
      followup: "需補足清菌者與呈遞；IL-17／IL-22 不會直接射殺真菌。",
      units: [
        { kind: "neutrophil", region: "b" },
        { kind: "ilc3", region: "a" },
        { kind: "dendritic", region: "c" },
      ],
    },
    {
      id: "th17",
      name: "建立 Th17 支援",
      reason: "樹突細胞呈遞抗原，活化後的 Th17 經上皮增強黏膜反應。",
      followup: "Th17 需要等待活化；早期要用嗜中性球守住菌絲。",
      units: [
        { kind: "dendritic", region: "a" },
        { kind: "th17", region: "a" },
        { kind: "neutrophil", region: "b" },
      ],
    },
  ],
  m6: [
    {
      id: "support",
      name: "先天支援",
      reason: "pDC 降低胞外傳播；NK 僅辨識具壓力與 MHC 條件的產毒宿主。",
      followup: "觀察 CD4 功能與病毒所在區室，按需求建立後續特異性支援。",
      units: [
        { kind: "pdc", region: "a" },
        { kind: "nk", region: "b" },
        { kind: "dendritic", region: "c" },
      ],
    },
    {
      id: "specific",
      name: "特異性接力",
      reason: "DC 交叉呈遞啟動相符 CD8；pDC 爭取活化時間。",
      followup: "只有呈現相符病毒肽的宿主才是 CD8 合法目標。",
      units: [
        { kind: "dendritic", region: "a" },
        { kind: "cytotoxicT", region: "b" },
        { kind: "pdc", region: "a" },
      ],
    },
  ],
};
