# Immuminati 開發交接 v3.0

本輪使用者明確授權完成 M2–M6、手機溢出／回主頁／抗體面板修正、獨立抗體建模與飛行附著、T–B 協作。保留已發布戰術 UI 與操作，不改做另一套 RTS。現行規則3.0／內容campaign.1；下文「本輪不新增 M2–M6」及「僅 M1 可玩」為歷史範圍，不適用本次。

現行細節、免疫學依據、分層實作、素材邊界與存檔遷移見 [六關實作紀錄](CAMPAIGN-IMPLEMENTATION.md)。六關正式定義仍依主規格 §10；M3 控制感染、M6 特殊有限結局不可改成通用清場勝利。測試／發布待本輪驗證記錄核對。

---

以下為歷史 v2.4 基準，UI／鏡頭／純引擎等保留約束仍有效；範圍與版本依上文。

# Immuminati 開發交接 v2.4

先讀 [AGENTS.md](../AGENTS.md)、[主規格](Immuminati-spec.md)、[美術與動畫](art-direction/C-art-and-animation.md)、[本輪 UI 紀錄](UI-CLARITY.md)，實際檢視 C 概念圖及最新截圖。

## 現行方向（不要套用歷史重製提案）

保留已發布的原立體戰術 UI、指揮方式、抓取式拖曳與柔光微觀風格；不再做另一套 RTS。無區域／全場單位名額限制，仍有資源與募集等待。M1 三波肺炎鏈球菌是唯一完整關卡；M2–M6 不製作。教學宿主演練不算新關卡、不覆寫 M1。

使用者最近七項要求是：減少浮動標籤及任務卡遮擋、補體／B 抗體分開、血管破面修正、新局預設自動尋敵、提示移右並壓縮空選指揮列、增援點外部關閉、完整交接。這些追加優先於先前「保持完全相同布局」的描述。詳見 UI 紀錄，不任意改換整套介面或渲染器。

## 目前架構與必要約束

- 正式入口 `src/tactics`，TypeScript＋Vite＋React＋Three.js；舊根目錄回合制不是現行遊戲。
- `domain/model.ts`：權威狀態、指令、細胞角色、來源區室、事件。
- `content/{m1,cells,tissues,anatomy,practice}.ts`：單關、9 種細胞、器官 profile、健康宿主與可丟棄演練。8 種可募集，漿細胞由 B 分化。
- `engine/{simulation,immunity,opsonization,events}.ts`：固定 0.2 秒步進、RNG、路徑、調理、吞噬、延遲胞內殺菌、訊號、呈遞、分化與勝敗。引擎先提交，再播放動畫；禁止動畫回呼計算資源／傷害。
- `application/controller.ts`：暫停、撤銷與設定。新局 autoSeek=true，手動移動優先；舊局保存選擇原樣保留。
- `presentation/{Anatomy,TissueGeometry,CellGeometry,BattleScene,labelLayout,selection}.ts`：程序模型 adapter、動作、相機、投影與選取。保留獨立單位待機、包覆吞入、清除／胞內存活、調理、募集、結算；不退成整張圖片或通用閃光。
- `ui/{TacticalApp,AntibodyPanel,AnatomyPanel,ImmunePanel,Tutorial}.tsx`：精簡預設標籤、原指揮列、抗體流程、實際區室剖視與十步教學。完整標籤設定可開；透明命中區與 aria 名稱仍可操作。

每關都有健康宿主組織，M1 有 27 個肺泡上皮及 5 個內皮。肺泡腔是胞外，上皮與血管間有屏障，肺泡隔不是單一細胞膜。宿主健康映射防區，不依可見細胞數重複扣損傷。吞入後是宿主綁定的活菌吞噬體，不能立即當成清除／宿主感染／呈遞。嗜中性 2 秒、巨噬／樹突 3 秒處理為教學壓縮。健康宿主不是 NK／CD8 合法對象。

## 補體、抗體與生物學邊界

C3b 補體支援耗 1 資源與支援次數；抗體按鈕說明 DC → MHC-II → CD4 協助 → B → 漿細胞，沒有抗體不能指定。新生抗體原自動分配保留，也可消耗 1 份優先指定。`complementUntil`、`antibodyUntil` 獨立，`markedUntil` 是兩者最大值；共存只計一次既有吞噬加成。C3b 小點與 Ig Y 形分別顯示，不能只顯示最後一種。重複施放／非法胞內對象不得扣資源；驗證函式不得突變。

M1 是胞外莢膜菌，補體／抗體促進吞噬，不直接清菌，不假裝 MAC 普遍裂解肺炎鏈球菌。訊號為防區濃度，無完整擴散；CD4 族群聚合 Th1／Tfh。Treg 不回血，MHC-II 不直接活化 CD8；NK／CD8 於獨立演練辨識合法宿主。莢膜多醣 T 非依賴反應、完整胚中心、親和力成熟、初始 CD8 活化與病毒生命週期未實作。

## 存檔（唯一現行版本描述）

key `immuminati:tactics:v2` 不變，schema 2、規則 **2.4**、內容 **m1-tactics.5**。解析器接受配對 2.0/.1、2.1/.2、2.2/.3、2.3/.4，state 與所有 undo 同步遷移。補體／抗體期限由原 opsonin 與 markedUntil 推定，不追算過去生物反應；保存已有 autoSeek=false。沒有免疫狀態的 2.0／2.1 舊檔由未啟動開始。

第一次覆寫舊格式前保存原始文字 `immuminati:tactics:pre-2.4`；不刪 pre-2.3、pre-2.2、回合制 `immuminati:save:v1` 或任何歷史 key。有效匯入才替換進度；讀取後安全暫停，不計離線生理時間。

## 驗證、啟動與發布

`npm ci`、`npm run dev`，網址為終端顯示的 `/Immuminati/`。`npm run verify` 是單元、型別、正式建置。瀏覽器腳本依序執行（本機軟體 WebGL 不並行）：`test:clarity`、`test:browser`、`test:immune`、`test:anatomy`、`test:animation`。`DEVICE=mobile|desktop` 可選；`EVIDENCE_DIR` 由 scripts 目錄解析。新輪證據不要覆寫歷史目錄。

本環境瀏覽器需授權本機網路／啟動權限；Playwright 路徑 `/workspace/.cache/ms-playwright`。GitHub Actions 每組在獨立 runner 驗證，部署依賴全部成功。正式 [Pages](https://sces5504.github.io/Immuminati/) 的 Vite base 固定 `/Immuminati/`。通過後發布並驗公開版本／資產，純紀錄追加用 `[skip ci]`。

本機透過代理連公開頁的 Chromium 曾遇憑證錯誤，不關閉 TLS；以正常 TLS 的 curl 比對公開資產，公開瀏覽器回歸使用 Actions 的正常網路。CLI artifact blob 403 可改用 GitHub 連接工具取檔案參照；下載工具單檔上限 32 MiB，本輪約 42 MB 的 live-pages-evidence 留在 CI，repo 保存成功日誌摘要與可下載的新 UI 證據。不能把短效簽名 URL 或憑證寫入 repo。

本輪程式 `addcee9` 已通過完整發布 CI 39044481225 並部署；主 JS／Three.js／CSS／mark.svg 及無版本參數的 HTML 與本機正式建置一致，公開新增 UI 的 12 組檢查通過。完整公開站回歸 39045223717 亦通過新增 UI 12 組與原操作／通關 24 項。來源與剩餘項目以 [UI-CLARITY.md](UI-CLARITY.md) 為準。真機 Safari／效能尚未驗證，不用觸控 Chrome 模擬冒充。模型仍為程序教學模型，沒有醫學精模／真實尺度宣稱。

## 歷史資料（保留背景，不代表現行版本）

- v2.3 組織／區室：原程式 9425293，見 [TISSUE-COMPARTMENTS.md](TISSUE-COMPARTMENTS.md)。
- v2.2 免疫擴充：原程式 814243e，見 [IMMUNE-EXPANSION.md](IMMUNE-EXPANSION.md)。
- 更早拖曳／無名額修正：[TACTICAL-REFINEMENT.md](TACTICAL-REFINEMENT.md)。
- 原立體版：[TACTICAL-VALIDATION.md](TACTICAL-VALIDATION.md)。

不要把歷史測試數字或畫面當成本輪新驗證。
