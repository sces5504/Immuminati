export interface Entry {
  id: string;
  name: string;
  english: string;
  keywords: string;
  summary: string;
  mechanism: string;
  scope: string;
  sources: string[];
}
export const sources: Record<string, { name: string; url: string }> = {
  B1: {
    name: "Janeway · B 細胞反應與分化",
    url: "https://www.ncbi.nlm.nih.gov/sites/books/NBK27142/",
  },
  B2: {
    name: "Janeway · 免疫記憶",
    url: "https://www.ncbi.nlm.nih.gov/sites/books/NBK27158/",
  },
  B3: {
    name: "肺炎鏈球菌莢膜、補體與吞噬研究",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2812187/",
  },
  B4: {
    name: "Janeway · 巨噬細胞活化與胞內清除",
    url: "https://www.ncbi.nlm.nih.gov/sites/books/NBK27153/",
  },
  B4S: {
    name: "Gordon 等 · Typhimurium 人體巨噬細胞實驗",
    url: "https://pubmed.ncbi.nlm.nih.gov/15908373/",
  },
  B5: {
    name: "Medical Microbiology · Immune Defenses",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK8423/",
  },
  B7: {
    name: "口腔上皮 IL-17 訊號研究",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5147498/",
  },
  B8: {
    name: "真菌大小與嗜中性球反應",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4236687/",
  },
  B10: {
    name: "Janeway · 體液免疫反應",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK10752/",
  },
  B11: {
    name: "Janeway · 胞內病原與免疫逃避",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK27176/",
  },
  B12: {
    name: "CDC · Tuberculosis",
    url: "https://www.cdc.gov/tb/about/inactive-tuberculosis.html",
  },
  B13: {
    name: "NIH · HIV and AIDS Basics",
    url: "https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-and-aids-basics",
  },
  B14: {
    name: "NIH · Latent HIV Reservoir",
    url: "https://hivinfo.nih.gov/understanding-hiv/fact-sheets/what-latent-hiv-reservoir",
  },
  B15: {
    name: "NIH · HIV Life Cycle",
    url: "https://hivinfo.nih.gov/understanding-hiv/fact-sheets/hiv-life-cycle",
  },
};
export const entries: Entry[] = [
  {
    id: "pneumococcus",
    name: "肺炎鏈球菌",
    english: "Streptococcus pneumoniae",
    keywords: "細菌 莢膜 雙球菌 M1",
    summary: "莢膜讓病原較難被吞噬；調理能提高吞噬者的辨識與清除效率。",
    mechanism:
      "特異性抗體與補體的沉積可促進調理吞噬。標記並不等於病原已死亡，仍需要同區域吞噬者作用。",
    scope:
      "M1 為局部肺部教學情境，提供有限既存特異性抗體；不表示初次感染能立即產生新抗體。負荷、模擬秒數與圖像比例均是遊戲抽象。",
    sources: ["B3", "B10"],
  },
  {
    id: "macrophage",
    name: "巨噬細胞",
    english: "Macrophage",
    keywords: "巨噬 偽足 吞噬 囊泡",
    summary: "組織中的吞噬者，也參與訊號與胞內病原處理。",
    mechanism:
      "偽足包覆目標後形成吞噬囊泡。是否能清除取決於病原的存活機制及巨噬細胞活化狀態，吞入並不保證消滅。",
    scope:
      "新版 M1 接觸後每 3 模擬秒吞噬一次：已調理 3、未調理 1。沿組織通道移動；M2 才導入 Th1 活化流程。",
    sources: ["B4", "B11"],
  },
  {
    id: "neutrophil",
    name: "嗜中性球",
    english: "Neutrophil",
    keywords: "嗜中性 分葉核 吞噬 顆粒",
    summary: "能快速募集到感染部位的先天免疫吞噬者。",
    mechanism:
      "可吞噬合適的目標，也能依情境透過顆粒等胞外效應處理病原。不同形態及大小會改變作用方式。",
    scope:
      "新版 M1 接觸後每 2 模擬秒吞噬一次：已調理 2、未調理 1；募集後 5 秒到場，再走向防區。沒有把每次吞噬固定算成組織傷害。",
    sources: ["B3", "B8"],
  },
  {
    id: "dendritic",
    name: "樹突細胞",
    english: "Dendritic cell",
    keywords: "樹突 抗原 呈遞 淋巴結",
    summary: "取得抗原、遷移並呈遞，連結先天與適應性反應。",
    mechanism:
      "抗原取得、攜帶、呈遞、特異性淋巴細胞啟動及分化是有條件、有時間順序的流程。",
    scope:
      "新版 M1 接觸後每 4 模擬秒取樣吞噬 1 負荷，調理不再提高此案例取樣量；沒有瞬間生成 T／B 的按鈕。淋巴結呈遞流程留待 M2。",
    sources: ["B1", "B5"],
  },
  {
    id: "opsonization",
    name: "調理與補體",
    english: "Opsonization · Complement",
    keywords: "抗體 標記 Y 調理 補體 M1",
    summary: "把難以辨識的病原標記給吞噬者，並非直接殺菌。",
    mechanism:
      "抗體與補體成分可附著於合適的病原表面，讓吞噬者透過相應受體更有效辨識。抗體調理、中和及補體其他作用應分開理解。",
    scope:
      "新版 M1 的 6 次支援合併表示有限既存特異性抗體／補體局部覆蓋，每次花 1 反應資源，持續 20 模擬秒。同群體新繁殖負荷承接局部覆蓋，擴散離開者不承接。",
    sources: ["B3", "B10"],
  },
  {
    id: "nk",
    name: "NK 細胞",
    english: "Natural killer cell",
    keywords: "NK 先天 細胞毒性",
    summary: "依可辨識條件作用於部分感染或異常宿主細胞。",
    mechanism:
      "活化與抑制訊號共同影響辨識；接觸合法宿主後產生細胞毒性作用，不是對所有感染細胞完全識別。",
    scope: "完整機制可查；M1 不含 NK，M4 規則及接觸動畫尚待製作。",
    sources: ["B5"],
  },
  {
    id: "cd8",
    name: "CD8 T 細胞",
    english: "Cytotoxic T lymphocyte",
    keywords: "CTL CD8 細胞毒性 特異性",
    summary: "對符合辨識條件的感染宿主細胞產生特異性作用。",
    mechanism:
      "需要相應啟動、抗原呈遞與合法目標條件。殺死感染宿主後，殘餘感染的去向仍須依病原機制處理。",
    scope:
      "M1 不含 CD8；不能作所有胞內菌的通解，也不能識別所有 HIV 潛伏感染宿主。",
    sources: ["B5", "B11", "B15"],
  },
  {
    id: "th1",
    name: "Th1",
    english: "Type 1 helper T cell",
    keywords: "Th1 巨噬 活化 訊號",
    summary: "在相應情境以訊號支援巨噬細胞的胞內清除能力。",
    mechanism:
      "Th1 的協作作用需要有效來源及合法接收細胞；訊號是細胞間協作，不是對病原直接發射傷害。",
    scope:
      "M1 不含 Th1。M2／M3 的呈遞、分化等待與訊號作用尚待製作；胞內存活已留有資料與動畫契約。",
    sources: ["B4", "B11"],
  },
  {
    id: "th17",
    name: "Th17",
    english: "Type 17 helper T cell",
    keywords: "Th17 口腔 黏膜 上皮 抗菌胜肽",
    summary: "參與特定部位的黏膜與上皮防禦。",
    mechanism:
      "口腔情境的 IL-17 相關作用包含上皮反應及抗菌胜肽，也可影響募集；不能簡化為直接殺菌或只增加嗜中性球。",
    scope: "M5 以口腔黏膜為案例；目前僅百科，尚無可玩規則與動畫。",
    sources: ["B7", "B8"],
  },
  {
    id: "tfh",
    name: "Tfh",
    english: "Follicular helper T cell",
    keywords: "Tfh B 濾泡 淋巴結",
    summary: "在相應反應中支援 B 細胞，主要位於淋巴結支援區。",
    mechanism:
      "協助相應的 B 細胞反應。並非所有抗體反應都必須依賴 Tfh；親和力成熟是特定反應的選擇過程。",
    scope:
      "M1 使用既存抗體，不要求本局從初始 B／Tfh 重新建立抗體來源；後續流程尚待製作。",
    sources: ["B1", "B10"],
  },
  {
    id: "bcell",
    name: "B 細胞與分化",
    english: "B cell · Plasma cell · Memory",
    keywords: "B 漿細胞 記憶 抗體 分化",
    summary: "特異性反應可產生後續抗體來源及記憶狀態。",
    mechanism:
      "初始、記憶、漿母／漿細胞是不同狀態或分化分支；記憶細胞本身不等於持續大量分泌抗體。",
    scope:
      "無永久戰力升級或裝備。單局反應仍受啟動與分化條件限制。首版省略親和力成熟細節，T 細胞不套用 B 式成熟。",
    sources: ["B1", "B2"],
  },
  {
    id: "salmonella",
    name: "沙門氏菌",
    english: "Salmonella enterica serovar Typhimurium",
    keywords: "M2 沙門 胞內 囊泡 存活",
    summary: "在選定案例中可於巨噬細胞內存活，吞入不一定清除。",
    mechanism:
      "胞外來源與吞噬囊泡內活菌需要分開保存與處理，經適當訊號支援改善胞內處理。",
    scope:
      "局部人體巨噬細胞教學模型，不代表所有沙門氏菌或傷寒病程。M2 開發中。",
    sources: ["B4S", "B11"],
  },
  {
    id: "tuberculosis",
    name: "結核分枝桿菌",
    english: "Mycobacterium tuberculosis",
    keywords: "M3 結核 控制 感染灶 肉芽腫",
    summary: "限制感染灶與擴散，不等同完全滅菌或臨床治癒。",
    mechanism:
      "巨噬細胞與 Th1 協作可限制感染，也可能伴隨活菌存留與局部損傷；感染灶控制不是永久無敵屏障。",
    scope: "M3 選定肺部防禦片段，以控制穩定及組織保全評價。開發中。",
    sources: ["B4", "B12"],
  },
  {
    id: "influenza",
    name: "流感 A",
    english: "Influenza A virus",
    keywords: "M4 流感 病毒 中和 感染細胞",
    summary: "游離病毒與感染宿主細胞是不同目標。",
    mechanism:
      "中和有助阻斷合適游離病毒；清除感染宿主需要其他辨識及作用路徑，不能由抗體中和直接視為已治好宿主。",
    scope: "M4 將明示案例初始免疫背景並分階段介紹反應。開發中。",
    sources: ["B5", "B10"],
  },
  {
    id: "candida",
    name: "白色念珠菌",
    english: "Candida albicans",
    keywords: "M5 真菌 酵母 菌絲 口腔",
    summary: "酵母與菌絲的形態差異會改變合理防禦方式。",
    mechanism:
      "口腔上皮屏障與 Th17 相關作用很重要，真菌大小及形態也影響嗜中性球的反應。",
    scope: "M5 是獨立口腔黏膜案例，不作 HIV 關的替代主對手。開發中。",
    sources: ["B7", "B8"],
  },
  {
    id: "hiv",
    name: "HIV",
    english: "Human immunodeficiency virus",
    keywords: "M6 HIV AIDS CD4 潛伏 抗反轉錄病毒",
    summary: "HIV 是病毒；AIDS 是感染的晚期疾病狀態。",
    mechanism:
      "HIV 可損害 CD4 支援，也能感染其他合適宿主。活躍與潛伏感染需區分，免疫辨識並非能看見所有潛伏來源。",
    scope:
      "遊戲時間與負荷不代表現實病程。現代抗反轉錄病毒治療能有效抑制 HIV，讓人長期健康生活。M6 開發中。",
    sources: ["B13", "B14", "B15"],
  },
  {
    id: "rules",
    name: "指揮、時序與組織保全",
    english: "Command · Resolution · Preservation",
    keywords: "暫停 即時 資源 容量 招募 結算 星等 存檔",
    summary:
      "可暫停的即時指揮；細胞接近合法目標後自動吞噬，位置、支援與部署由你安排。",
    mechanism:
      "固定模擬步進：移動與接觸 → 合法吞噬及冷卻 → 殘餘病原繁殖／擴散 → 組織損傷 → 等待到場 → 勝敗。反應資源每 8 秒恢復 1；移動與指定目標免費，調理花 1，招募花 3 或 4。暫停時可撤銷部署，恢復後不能回溯已發生的戰鬥。",
    scope:
      "新版 M1 任一區失守即失敗，最長 180 模擬秒；三波感染來源都清除且三區存活才勝利。成功後以三區等權保全率評星：≥85% 三星、≥60% 二星、其餘一星。標記、數量、比例與時間是教學抽象，非醫療預測。",
    sources: ["B3", "B4"],
  },
];
