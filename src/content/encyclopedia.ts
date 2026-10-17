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
  B17: {
    name: "Rubtsov 等 · Treg 衍生 IL-10 限制屏障發炎（小鼠）",
    url: "https://pubmed.ncbi.nlm.nih.gov/18387831/",
  },
  B18: {
    name: "Janeway · 誘導性先天反應、趨化與 NK 訊號",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK27122/",
  },
  B19: {
    name: "Janeway · 細胞毒性、穿孔素與顆粒酶",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK27101/",
  },
  B20: {
    name: "Janeway · 效應 T 細胞啟動與抗原呈遞",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK27118/",
  },
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
    id: "prr",
    name: "模式辨識與 TLR",
    english: "Pattern recognition receptors · TLRs",
    keywords: "PRRs TLR PAMP DAMP 模式辨識",
    summary: "先天免疫辨識共享的微生物模式，並非抗原專一性辨識。",
    mechanism:
      "TLRs 是 PRRs 的一類。模式辨識可促使抗原呈遞細胞成熟與細胞激素產生；適應性淋巴球仍須其相應受體與共刺激。",
    scope:
      "本輪吞噬者接近病原會產生辨識事件，提升 CXCL8、IL-12 與發炎。省略個別 TLR 配體、下游轉錄與訊號擴散；不表示所有 TLR 作用相同。",
    sources: ["B18", "B20"],
  },
  {
    id: "cytokines",
    name: "細胞激素與趨化",
    english: "Cytokines · Chemokines",
    keywords: "CXCL8 IL-8 IL12 IFNγ IL10 cytokine chemokine",
    summary: "訊號改變接收細胞的功能與交通，並非傷害法術。",
    mechanism:
      "CXCL8 可促進嗜中性球趨化／募集；IL-12 可促使 NK 產生 IFN-γ；IFN-γ 增強巨噬功能；IL-10 限制部分促炎反應。來源、接收者與組織背景都會影響效果。",
    scope:
      "本輪採防區濃度模型，非真實空間擴散：CXCL8 縮短指定募集等待，IFN-γ 增強巨噬清除，Treg 降低發炎並減弱部分促炎訊號。未模擬全部細胞激素網路、IL-17 或 Type I IFN。",
    sources: ["B4", "B18"],
  },
  {
    id: "treg",
    name: "調節型 T 細胞",
    english: "Regulatory T cell · Treg",
    keywords: "Treg IL10 調節 免疫耐受 發炎",
    summary: "限制過強反應及維持耐受；並不是直接治療組織的單位。",
    mechanism:
      "Treg 可透過 IL-10 等訊號及細胞接觸調節免疫反應，實際作用依組織與感染而異。抑制發炎也可能削弱抗感染防禦。",
    scope:
      "M1 可募集既存 Treg 族群，以 IL-10 調節所在區域。減少超過閾值的發炎損傷，但不恢復已損組織。未模擬 Treg 的完整分化、CTLA-4 與接觸機制。",
    sources: ["B17", "B18"],
  },
  {
    id: "pneumococcus",
    name: "肺炎鏈球菌",
    english: "Streptococcus pneumoniae",
    keywords: "細菌 莢膜 雙球菌 M1",
    summary: "莢膜讓病原較難被吞噬；調理能提高吞噬者的辨識與清除效率。",
    mechanism:
      "特異性抗體與補體的沉積可促進調理吞噬。標記並不等於病原已死亡，仍需要同區域吞噬者作用。",
    scope:
      "M1 為局部肺部教學情境：有限 C3b 調理支援可即時使用；新生蛋白抗原特異性抗體需 DC、CD4 T 與 B 細胞依序活化。不是初次感染瞬間產生抗體。負荷、時間與比例均為抽象。",
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
      "新版 M1 接觸後每 3 模擬秒吞噬一次：已調理 3、未調理 1。沿組織通道移動；本輪 IFN-γ ≥20 可額外增強吞噬 1，並支援囊泡內清除。",
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
      "新版 M1 接觸後每 2 模擬秒吞噬一次：已調理 2、未調理 1；募集後通常 5 秒到場，再走向防區；CXCL8 ≥20 的區域縮短 1 秒到場等待。沒有把每次吞噬固定算成組織傷害。",
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
      "M1 取樣吞入 1 負荷後攜帶蛋白抗原，經引流至淋巴結（綠色淋巴引流入口代表離場後的抽象結內區室，與血管入口分開）；MHC-II 呈遞／共刺激等待 8 秒後，可啟動相符 CD4 T。不是把胞外抗原直接交給 CD8。",
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
      "M1 的 6 次支援表示局部補體 C3b 覆蓋，每次花 1 反應資源，持續 20 模擬秒。同群體新繁殖負荷承接局部覆蓋，擴散離開者不承接。",
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
    scope:
      "M1 可募集 NK，IL-12 足夠時提供 IFN-γ；無適合殺傷的病毒宿主。獨立機制演練中可對壓力高、MHC-I 降低的宿主形成突觸並誘導凋亡。多受體整合以兩個必要條件簡化。",
    sources: ["B18", "B19"],
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
      "M1 可募集、調度初始 CD8，但 MHC-II 呈遞不會活化它，也沒有合適的感染宿主。機制演練使用預先活化且已知抗原的 CD8，示範相符 MHC-I 肽、穿孔素／顆粒酶與宿主凋亡；不相符與健康宿主保留。完整初始 CD8 活化及 HIV 潛伏機制未實作。",
    sources: ["B19", "B20", "B11"],
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
      "本輪 CD4 支援族群聚合 Th1／Tfh 功能：完成 MHC-II 活化後，調度至組織可提供 IFN-γ。M1 無持續胞內活菌；囊泡內清除規則可供後續內容使用，M2／M3 尚不可玩。",
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
      "本輪蛋白抗原呈遞就緒後，CD4 T 需 8 模擬秒活化，再在抽象淋巴結向相符 B 細胞提供幫助。Tfh／Th1 以一個族群聚合；未模擬濾泡微結構、胚中心或親和力選擇。",
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
      "無永久戰力升級或裝備。單局反應仍受啟動與分化條件限制。B 細胞接受相符蛋白抗原與 T 幫助後，10 模擬秒分化為漿細胞，之後每 5 秒增加抗體支援並促進調理；不直接殺菌。省略胚中心、親和力成熟及莢膜多醣 T 非依賴反應。T 細胞不套用 B 式成熟。",
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
      "固定模擬步進：移動與接觸 → 合法吞噬及冷卻 → 殘餘病原繁殖／擴散 → 組織損傷 → 等待到場 → 勝敗。反應資源每 8 秒恢復 1；移動與指定目標免費，調理花 1，招募依細胞花 2–4。暫停時可撤銷部署，恢復後不能回溯已發生的戰鬥。",
    scope:
      "新版 M1 任一區失守即失敗，最長 180 模擬秒；三波感染來源都清除且三區存活才勝利。成功後以三區等權保全率評星：≥85% 三星、≥60% 二星、其餘一星。標記、數量、比例與時間是教學抽象，非醫療預測。",
    sources: ["B3", "B4"],
  },
];
