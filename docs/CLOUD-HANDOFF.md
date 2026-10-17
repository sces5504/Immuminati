# Immuminati 開發交接 v2.2

先讀 [AGENTS.md](../AGENTS.md)、[主規格](Immuminati-spec.md)、[美術與動畫](art-direction/C-art-and-animation.md)，實際檢視 C 圖與本輪截圖。最新八項任務保留立體戰術 UI／操作與柔光風格，但明確要求改善組織／細胞模型，並增加免疫機制與教學；優先於 v2.1「模型不改」限制。禁止整套 RTS 重製或退回佔位球體。

Repo `sces5504/Immuminati`，通常 `/workspace/Immuminati`，開工確認 Git／環境與當次使用者要求。正式入口 `src/tactics`；延續 main，不 hard reset 回舊美術基準。已完成的抓取式拖曳與無區域／全場名額限制不可回退。

## 本輪架構

- `domain/model.ts`：權威狀態、細胞角色、訊號、抗原流程、宿主與事件。
- `content/cells.ts`：9 種細胞資料與角色；8 種可募集，漿細胞由 B 分化。
- `content/m1.ts`：肺炎鏈球菌、三區與三波、血管／淋巴入口及平衡。
- `content/tissues.ts`：肺、口腔、腸黏膜方向；後二者只是 profile／基礎分支，沒有後續關卡。
- `engine/simulation.ts`：固定 0.2 秒步進、路徑／指令、吞噬、感染、損傷與勝敗。
- `engine/immunity.ts`：PRR、局部訊號、DC 引流／呈遞、CD4／B 活化、漿細胞與抗體、Treg、IFN-γ 囊泡支援、NK／CD8 合法宿主作用。
- `engine/events.ts`：所有結果／事件由引擎提交；Three.js 不修改規則。
- `application/controller.ts`：暫停、撤銷、步進、紀錄。
- `presentation/Anatomy.ts`、`CellGeometry.ts`、`labelLayout.ts`、`BattleScene.ts`：可替換程序模型、獨立動畫、相機與命中。
- `ui/ImmunePanel.tsx`、`Tutorial.tsx`：機制資訊與實際操作驅動教學；沿用 `TacticalApp`／CSS。
- `content/practice.ts`：一次性機制演練，與 M1 共用規則／渲染；預先活化 CD8、合法／不相符／健康宿主。不算 M2–M6，不覆寫 M1 存檔，退出還原原局並暫停。

## 生物學邊界

M1 為胞外莢膜菌。C3b／抗體促進吞噬，不直接清菌；不是以 MAC 普遍裂解肺炎鏈球菌。蛋白抗原的 DC → MHC-II → CD4 幫助 → B → 漿細胞流程有順序與等待。莢膜多醣 T 非依賴反應、完整胚中心、親和力成熟及完整初始 CD8 活化未實作。

CD4 支援族群聚合 Th1／Tfh 功能；訊號採防區濃度，不是擴散 PDE。CXCL8 影響募集，IL-12／IFN-γ 影響細胞活化，IL-10 調節發炎。Treg 不回血；NK／CD8 不吞噬胞外菌，MHC-II 不直接活化 CD8。參數及時間均為教學抽象，沒有專家完整審查的宣稱。

## 存檔

保留 `immuminati:save:v1` 及其他歷史 key。現行 `immuminati:tactics:v2` 為 schema 2、規則 2.2、內容 `m1-tactics.3`。解析器接受配對的 2.0／.1、2.1／.2 並顯式補上未啟動免疫狀態（自動尋敵關、無新抗體）；時間、單位、指令、事件與撤銷快照保留。首次覆寫前把原始文字保存在 `immuminati:tactics:pre-2.2`，也保留格式損壞的原始資料。匯入驗證完整成功才替換。

新規則不重建舊局過去已發生的 PRR／呈遞，因此從當前局面繼續新反應；設定面板明示遷移。舊資料沒有新生抗體／訊號的歷史，不能假裝算過。

## 執行與交付

`npm ci` 後 `npm run dev`，網址使用終端顯示的 `/Immuminati/`。`npm run verify` 跑規則、型別與建置；`npm run test:browser` 為原操作／拖曳／擁擠／全局回歸；`npm run test:animation` 為吞噬兩分支；`npm run test:immune` 為新教學、適應性策略及 NK／CD8 演練。瀏覽器腳本的伺服器／埠需求見實作紀錄。

[本輪實作與驗證](IMMUNE-EXPANSION.md)記錄實測和限制；[前輪拖曳／容量修正](TACTICAL-REFINEMENT.md)與[原版驗證](TACTICAL-VALIDATION.md)作歷史背景。每輪只報自己真的跑過的結果。

[GitHub Pages](https://sces5504.github.io/Immuminati/) 為正式入口，Vite base 必須 `/Immuminati/`。必要檢查通過再發布並驗資產、公開 UI。純紀錄補充使用 `[skip ci]`，避免重跑未改程式的部署。最終 M2–M6 規格仍保留，但本輪不開發其關卡。

## 本輪已交付

程式 `814243e` 已通過 [CI 39027769861](https://github.com/sces5504/Immuminati/actions/runs/39027769861) 的47項測試、建置、桌面／手機各14項原操作、新功能10項、吞噬雙分支與部署。部署後公開桌面／手機整局 CI 與 smoke 亦通過，資產內容與本機建置一致。37秒桌面／32秒直向手機短片、截圖、來源／時間紀錄與限制都在 [實作紀錄](IMMUNE-EXPANSION.md)／`docs/evidence/immune-expansion/evidence-index.json`；不要沿用更早失敗或部分完成的數字。

CI 共用 `production-dist`，平行產生 `tactics-{device}-evidence`、`immune-{device}-evidence` 與 `animation-evidence`；部署仍依賴全部成功。額外自動公開整局回歸另見實作紀錄，其狀態不應混入發布前測試。

本環境曾遇 CLI 取得 artifact 的短效 blob redirect 返回403；已透過連接的 GitHub artifact 下載工具取得檔案參照並下載ZIP，證據完整。不要把短效簽名URL寫入repo或交接。
