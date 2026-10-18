# v3.1 開局部署與雙指縮放證據

程式來源 `26a26d118b08bd76fa7d77c03cff8103674bf89c`。[發布前原始 workflow](https://github.com/sces5504/Immuminati/actions/runs/39093196864)。下列 PNG 均為該來源新錄製的原圖；原始連續影片在 workflow 的 deployment-*-evidence artifacts，artifact ID 及 ZIP SHA-256 記錄於 [provenance.json](provenance.json)。

| 平台 | 開局／套組 | 雙指放大／縮小 | 40秒短片 | 檢查 |
|---|---|---|---|---|
| 桌面1440×1000 | [M4](desktop/desktop-m4-deployment.png) | [放大](desktop/desktop-pinch-out.png)／[縮小](desktop/desktop-pinch-in.png) | [觀看](desktop/deployment-pinch-highlights.webm) | [JSON](desktop/browser-results-desktop.json) |
| 手機390×844 | [M1](mobile/mobile-m1-deployment.png)／[M3](mobile/mobile-m3-deployment.png) | [放大](mobile/mobile-pinch-out.png)／[縮小](mobile/mobile-pinch-in.png) | [觀看](mobile/deployment-pinch-highlights.webm) | [JSON](mobile/browser-results-mobile.json) |
| 窄手機360×800 | [M1](narrow/narrow-m1-deployment.png) | [放大](narrow/narrow-pinch-out.png)／[縮小](narrow/narrow-pinch-in.png) | [觀看](narrow/deployment-pinch-highlights.webm) | [JSON](narrow/browser-results-narrow.json) |

每個平台資料夾均含六關部署畫面及首頁新文案。測試透過正式按鈕選套組／自選細胞與保存草稿，時間保持暫停；沒有直接注入隊伍或通關狀態。CDP 原生多指輸入測試手勢，而非只派發合成 DOM pointer 事件；涵蓋第一指落在細胞標籤、捕捉轉移、縮放上下限、中途放一指、第三指／取消、取消後的鍵盤Enter選取，及恢復單指同方向拖曳。相同權威 state、選取與頁面 scale 均保留。

短片僅從原始連續影片擷取開頭8秒及末尾32秒，維持原順序與速度，沒有合成遊戲畫面；剪接來源秒數見 [clip-edits.json](clip-edits.json)。

[policies.json](policies.json) 是純引擎合法策略比對，不是瀏覽器影片；包含舊預配零指令、玩家選第一套組後觀察及補充部署／支援三條路徑。規則、限制與發布／公開站結果見 [本輪紀錄](../../DEPLOYMENT-AND-GESTURES.md)。

觸控為 Chromium 模擬，尚未於實體 iPhone Safari／Android 驗證。所有模型維持目前程序美術，交接精修另見 [美術 prompt](../../ART-HANDOFF-PROMPT.md)。

## 公開站與完整關卡

[公開站完整回歸](https://github.com/sces5504/Immuminati/actions/runs/39093783396) 全16個工作成功，含六關雙平台12次通關、三種螢幕配置與原操作36項PASS。[公開結果](public-results.json)／[公開workflow](public-workflow.json)／[資產逐位元比對](public-assets.json)。

[發布前六關結果](campaign-results.json) 與 [全部26個發布工作](build-workflow.json) 可核對同一來源；本目錄短片專注部署與相機手勢，完整關卡遊玩原片在workflow的campaign artifacts，核心動畫原片在animation artifact。
