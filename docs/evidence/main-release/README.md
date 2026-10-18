# 正式 Pages 已發布（2026-10-18）

[直接遊玩](https://sces5504.github.io/Immuminati/?v=9dd5215) · [成功的發布工作流](https://github.com/sces5504/Immuminati/actions/runs/39150688765) · [發布識別](release.json)

PR #3 已合併main。公開來源 `9dd5215`，遊戲UI來源 `bdf1c94`、核心引擎來源 `f169904`；後續為測試驅動／證據整理，沒有改遊戲結算。新模型預設啟用，首頁與設定的樣本比較／切換入口已移除；載入失敗仍自動回退。後續只保證現行規則存檔，不再新增歷史遷移，不清除玩家資料。

## 本次實測

- 正常發布流程成功，136項單元、型別、建置、動畫、桌面／手機操作、組織／免疫／面板、三種部署尺寸與六關雙平台矩陣均為該流程的發布前門檻。未把重跑測試加總成更多獨立案例。
- 公開站23個JS／CSS／SVG／GLB資產HTTP200且與正式建置逐位元相同：[資產SHA256](public-assets.json)。
- 公開網址桌面1280×800與直向觸控390×844，由可見部署UI實際開TB新局、只部署DC與固定感染宿主，不注入權威狀態；胞內6→16活負荷、第102步可見增殖事件，6個新模型資產正常載入。首頁及設定均無模型切換；回主頁暫停／續玩保留完整狀態。兩平台JS／HTTP錯誤均0：[結果](public-smoke.json)、[桌面畫面](public-desktop-tb.png)、[手機畫面](public-mobile-tb.png)。
- 先前完成的本輪12局與8段H264短片、TB無Th1破裂播散，以及分支來源／時鐘／剪接限制見 [核心證據](../core-lifecycle/README.md)。那些影片來源97aa825，不冒充這次公開站錄影；這次新增公開站截圖與操作結果。
- 正式模型建置的本機補查：[手機胞內剖視](mobile-tb-growing-cutaway.png)、[原始結果](tb-inspection.json)、[組織操作](anatomy/anatomy-results.json)、[HIV長局驅動](m6-driver/results-desktop-m6.json)。HIV本機與CI均到436遊戲秒、全部防區0才給特殊無星等結果。

## 驗證工具與邊界

`NODE_USE_ENV_PROXY=1 SMOKE_USE_PROXY=1 PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright TARGET_URL='https://sces5504.github.io/Immuminati/?v=9dd5215' node scripts/core-release-smoke.mjs` 為此受管理環境的公開檢查命令；一般無代理環境不設前兩個變數。Node依管理代理CA驗證所有資產；Chromium的獨立信任庫在明確使用代理時採測試專用憑證例外，未改正式遊戲。初次Node直接連線遭拒、首次代理瀏覽器憑證不信任；修正測試傳輸後成功，沒有當成遊戲資產錯誤。

第一次正常CI的桌面HIV完整錄影觸及20分鐘上限（當時第1959步，無規則斷言失敗），故只對HIV改用同一正式RAF／固定步進加速測試；全部結局斷言與獨立正常動畫檢查保留。沒有為測試改HIV死亡時間或直接注入結局。曾試作另一個本機操作測試驅動，確認指令目的地與實際作用位置語意後撤回並中止，未計為通過；相關原始檔只留工作區。正式遊戲規則未因此變更。

本機先前核對檔案保留於工作區 `local-before-public/`，目標是localhost，不能當成公開檢查；本頁連結的public檔已由真實公開網址重新生成。大段原始錄影與中間截圖留工作區，Git只存必要證據。自動公開回歸另見 [工作流](https://github.com/sces5504/Immuminati/actions/runs/39151776296)，六關雙平台12組與三種部署尺寸已全數通過，[狀態快照](live-campaign-results.json)；額外長操作smoke仍在執行，未預先宣稱該項通過。

仍待真人難度回饋、實體iPhone Safari／Android GPU與大量單位壓測。Vite的主包／Three.js大於500kB警告仍在；時間、群體負荷、器官及HIV支援耗損為教學抽象，未模擬ART。此輪沒有新增Tripo生成或花費額度，未宣稱商業發行認證完成。
