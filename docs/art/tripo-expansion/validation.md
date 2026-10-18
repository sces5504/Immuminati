# 本輪相關驗證（2026-10-18）

只驗證這次美術整合相關項目。沒有變更引擎／規則／存檔，不跑完整舊規則矩陣，也不拿上輪數字或影片冒充本輪。

## 自動檢查

- 型別：`npm run typecheck`。
- 相關單元：`npx vitest run tests/tactics/tripoSamples.test.ts tests/tactics/cellLayout.test.ts tests/tactics/selection.test.ts`，**20項通過**。
- 含括19個GLB的完整類型覆蓋／尺寸、單材質與無外部buffer、面數、膜morph、原始三件60＋本批十六件320的安全收據、載入失敗／拆除取消、地形貼合與三區面朝向、視覺避讓與選取。
- Preview：`node scripts/build-art-preview.mjs`，相對資產可從 `/Immuminati/` 子路徑啟動。
- 原版建置：`npx vite build --outDir /tmp/immuminati-standard-build --emptyOutDir`，不啟用美術旗標時仍產生原版程式。
- Blender離線處理腳本通過Python編譯；來源掃描未發現API key字串。Vite有既存Three.js／大chunk提示，未把提示隱藏成通過。

## 瀏覽器證據與可重跑命令

本機以 `vite preview --host 127.0.0.1 --port 24862 --strictPort` 提供最新Preview建置（需啟用環境本機網路權限），並設定 `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright`：

- `node scripts/tripo-expansion-acceptance.mjs`：M1–M6 × 1440×1000桌面／390×844直向手機。真正的選關與部署UI，沒有注入規則狀態；透過UI事件與受控瀏覽器時鐘驗模型／器官、實際宿主繪製、原模型切換、選取／移動／撤銷、剖面、C3b扣一次、2×步進、資產與執行錯誤。`results.json` 是最後完整執行結果。
- `node scripts/tripo-art-coverage.mjs`：明確標示的匯入視覺fixture，**不是合法招募或自然產生抗體／通關的證據**。一次放14種免疫以驗全部adapter及獨立模型；兩份抗體庫存測綠Y飛行附著與重複指定不扣第二次，降低動態不改暫停中的權威。
- `DEVICE=mobile node scripts/tripo-expanded-m1-acceptance.mjs`：M1真實部署、同構圖原版比較、調度、C3b／包覆吞入、1×／2×與降低動態、下載共用、全部模型失敗時原版仍可選。保留真實時間動畫錄影；沒有把模型測試fixture當成自然免疫流程。

`docs/evidence/tripo-expansion/` 的本輪PNG／短片與JSON；完整raw錄影在忽略檔案，短片剪接與SHA另由evidence-index記錄。SW WebGL的像素比0.6／10FPS保護沿用既有軟體渲染設定，不能當成真機畫質與FPS上限。

## 過程中發現與修正

- API並行上限：十件受理後的六件HTTP429拒收，先對帳、再提交未受理的唯一素材；無付費重試。
- 原始生成網架過尖、腸絨毛偏褐：離線重建纖維／平滑及色彩修正，沒有再付費生成。
- 重複肺泡隔與病原面數放大：降低隔壁至1200面、宿主薄膜600面、代表病原480–900級；實際負荷不變。
- 貼合變形需保留面朝向與重算包圍範圍；補上三區數學檢查。
- 首次相關單元曾遇浮點邊界0.024999999999999994，改為容許1e-10數值誤差，沒有放寬實際貼地要求。
- 初次14種覆蓋fixture用了不存在的hold指令，被存檔驗證拒絕；已改為合法guard／point。初次5秒素材斷言也不足以等雲端軟體WebGL解碼，改為有界60秒；並非隱藏資產錯誤。最終結果另以成功重跑記錄。
- 組織末次修整後再跑雙平台六關；中斷的中間批不列為最終通過。

## 明確未驗證

沒有重新跑六關完整勝敗／平衡回歸；本輪只改展示，不能據短時間操作宣稱重新完成所有關卡通關驗證。沒有實體iPhone Safari／Android GPU、低記憶體機或多人同時使用實測。新模型的真人美感與裝置效能仍待使用者在私人Preview審閱。百科肖像／區室剖視繼續用原本結構示意。

## 最終成功結果

程式來源 `1faa5b3`。20項相關單元、型別、Preview與原版建置成功；六關×雙平台 **12組成功**，所有HTTP資產／JS錯誤列表為空。14種免疫／抗體覆蓋fixture成功；手機M1正常時間的C3b、吞噬／調度、速度／降低動態及全素材失敗回退成功。新證據與記錄均在本輪目錄，不沿用舊批。

開場畫面面數約22.5–29.2萬，draw call 136–193；不同器官／原版的同構圖比較見 `metrics.json`。面數有增有減，所有案例draw call低於原版；這不是密集後期戰場或真機FPS壓力測試。

[私人Preview](https://immuminati-tripo-samples-20261018.paleswift64.chatgpt.site) 已由Sites回傳succeeded；部署 `appgdep_6ad4ac3a2504819193efcb6d2cd47a89`，來源與版本見 `preview.json`。正式GitHub Pages與main未變更，等待最終審閱。

畫面：每關 `desktop-mN-field.png`、`mobile-mN-field.png`，剖面與實際行動各另有截圖。14種覆蓋與抗體fixture在 `coverage/`；M1同構圖原版比較、吞噬後與回退在 `actions/`。影片：`mobile-m1-engulf.webm` 為本輪正常時間實錄剪段；`mobile-m1-art.webm`–`mobile-m6-art.webm` 為受控瀏覽器時鐘的自動化畫面；`antibody-coverage-fixture.webm` 明確是視覺fixture。確切原片SHA、剪段與限制見 `recording-provenance.json`。
