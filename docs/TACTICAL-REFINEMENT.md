# 立體戰術版：保留體驗與第一輪玩法修正

日期：2026-10-17。使用者選定改 RTS 規格前已發布的立體戰術版為保留基準；本輪延續該版本，不重做 UI、美術或操作。

## 範圍與決策

- 保留 `d2c16ab`／`af6bcb3` 的首頁、戰場、模型、組織、材質、光照、配色、指揮列、手機布局及動作。CSS、CellArt 與既有素材／public 資產相對基準沒有變更；場景程式只改地圖拖曳、共用地面拾取及重疊標記避讓，不改幾何、材質或角色動作。
- 遠端 `6e1d5f7` 已回退另一個 AI 的完整 RTS 重製；本輪同步該回退後再修改。規格 v2.1 與交接已撤除重建、換簡模與另派美術重製的指示。
- 第一輪先處理已回報的拖曳方向及同區名額，暫不加入訊號場、淋巴結、發炎模擬或新一套 AI／波次。這些後續玩法需逐項評估。

## 實際修改

鏡頭以拖曳前後的射線／地面交點計算相機平移，讓抓住的地面位置跟隨滑鼠／手指，不再用固定比例和世界軸估算。沿用原拖曳、旋轉、縮放與重設操作，以及 6 px 拖曳門檻；拖動放手不發移動命令；對快速放手的情況，放手前補上最後位置，避免漏掉拖曳或誤判點選。

移除區域 `capacity`、全場 `maxCells` 與招募／移動／攻擊的名額拒絕，移除存檔的相應限制；資源成本、恢復速度、增援到場延遲、合法目標與組織條件延續。原元件只更新數量、募集等待與提示文字，不改版面。

既有 `immuminati:tactics:v2` key／schema 保留。新規則標記為 `2.1`、內容為 `m1-tactics.2`；讀取舊 `2.0`／`m1-tactics.1` 時明確更新版本標記，位置、時間、病原、資源、規劃撤銷與事件不變。拒絕不配對的規則／內容版本。這是放寬名額的相容升級，沒有把另一套 RTS 存檔混成同一局。

驗證另發現兩個操作邊界，已同步修正：防區標記與細胞／菌群的點按框重疊時，防區標記小幅向上避讓，避免手機上被透明點按範圍遮住；匯入尚未行動（tick 0、只有開場事件）的存檔後，明確提供「繼續防線」，不要求先有進度才能續玩。兩者沿用原元件與流程，不重排面板或換美術。

## 已完成的本機規則／建置檢查

- `npm run verify`：33 項測試通過，TypeScript 與 Vite production 建置通過。
- 規則壓力 fixture：同一防區加入超過舊上限的群組，驗證移動、指定攻擊、募集、到場及存讀；全場 31 群組、同區 30 群組仍合法，這是測試規模而非新玩法上限。資源不足仍拒絕且不改狀態。
- 舊存檔相容：戰鬥與暫停快照完整保留，規則／內容版本標記可更新，混合錯誤版本拒絕。
- 原有三個種子 × 兩種策略仍可通關，固定步進／速度／降低動態一致性、勝敗及星等等回歸通過。
- 文件入口：12 份 Markdown 格式、50 個本機連結／錨點及 `git diff --check` 通過。

## 瀏覽器與部署

本機實測為 Chromium 141.0.7390.37／SwiftShader；桌面 1440×1000，手機 360×800 觸控模擬，非實體手機。

- [最新桌面](evidence/tactical-refinement/desktop-field.png)／[手機](evidence/tactical-refinement/mobile-field.png)：沿用原版場景與介面，三個防區標記中心均可點選，無新增 console 錯誤或橫向溢出。見 [畫面／點按結果](evidence/tactical-refinement/current-screen-results.json)。
- [密集場景與舊檔結果](evidence/tactical-refinement/crowd-browser-results.json)：桌面／手機各自以真實介面驗證 30 群組的選取、調度／指定目標、募集及續玩；實際匯入原版匯出檔，戰鬥與撤銷快照完全保留。影片：[桌面](evidence/tactical-refinement/desktop-crowd.webm)／[手機](evidence/tactical-refinement/mobile-crowd.webm)。
- [快速觸控結果](evidence/tactical-refinement/fast-touch-results.json)：四個旋轉方向 × 兩種縮放，正向拖曳投影為 `(24, 18)` CSS px，反向回到原位，權威狀態不變。觸控從保留手指範圍的空白地圖開始，避免瀏覽器把靠近按鈕的觸控派給標記；驗證亦等待實際畫面呈現。
- [吞噬分支結果](evidence/tactical-refinement/animation-results.json)／[錄影](evidence/tactical-refinement/engulf-branches.webm)：接觸、偽足包覆、吞入，清除後無胞內負荷；存活分支保留囊泡內 3 負荷。受控 dev fixture 不是 M1 病程或 M2 已完成的證據。
- 首輪同戰鬥規則的本機實戰，桌面 86%、手機 89% 保全，均三星。[約 46 秒桌面剪輯](evidence/tactical-refinement/desktop-highlights.webm) 含原版畫面、鏡頭、吞噬與結算；此剪輯早於最後的標記／零步匯入 UI 修正，不能當作這兩項的驗證。各證據 commit 與剪輯區間見 [來源索引](evidence/tactical-refinement/evidence-index.json)。

證據放在 `docs/evidence/tactical-refinement/`，不覆寫保留基準。最終版本 `7d9c82c` 的 [完整 CI／Pages 流程](https://github.com/sces5504/Immuminati/actions/runs/39013892747) 已成功：33 項規則測試、型別、建置、24 類瀏覽器檢查與吞噬分支檢查通過，部署成功。最終桌面／手機均由真實介面完成三波，組織保全分別 87%／91%，均三星。詳見 [CI 摘要](evidence/tactical-refinement/ci-summary.json)。

[公開新版本](https://sces5504.github.io/Immuminati/?v=7d9c82c) 已核對 HTML 與本機建置的程式指紋一致；JS、Three.js、CSS 及圖示全為 HTTP 200，子路徑正確。CSS 檔仍為原版 `index-DSd6G-bR.css`。見 [公開資產檢查](evidence/tactical-refinement/public-assets.json)。公開站的額外完整瀏覽器 workflow 另由既有自動流程執行，不把其尚未完成的結果列為本次已通過項目。

## 保留的限制與下一步

本輪未重設細胞功能、調理次數、募集成本、波次時間或組織傷害，沒有宣稱已完成全面平衡。後續可依試玩優先改善自主行為與策略節奏，保持原版畫面與操作。M2–M6 仍為未完成內容；沒有新增音效或真機／Safari／Firefox 的驗證結論。密集時仍可透過原有單位列、目標標記與鏡頭操作選取；沒有宣稱所有重疊標記或極端密度均已最佳化。
