# 核心生命週期 v3.2：本輪新證據

引擎 `f169904`；完整桌面／手機遊玩為此來源。之後 `e1f81b6` 改死亡／產毒來源文字與hover，`97aa825` 改選取剖視定位與SVG圖示，沒有改結算；最新UI另做手機實玩檢查。私人站部署見 [preview.json](preview.json)，規則／查證／遷移見 [CORE-LIFECYCLE.md](../../CORE-LIFECYCLE.md)。

- [107項相關單元結果](unit-results.json)
- [12組實際六關遊玩結果](results.json)：由可見UI部署與合法命令，未注入勝利／失敗狀態。
- [12份終局UI重播＋1份實際舊HIV檔遷移](report-replays.json)：只為穩定報告截圖／相容性驗證，不冒充新通關。
- [TB失控分支](tb-failure-branch.json)：新局、無Th1，第375步破裂釋出42負荷；[最新剖視與原版切換／hover檢查](tb-inspection.json)。
- [23資產／Pages子路徑核對](assets-prefix.json)；[HIV純引擎三種合法策略](policies/policies.json)並非瀏覽器通關。
- [剪接來源、時間窗及SHA](clip-provenance.json)。原始長錄影與重複的中間操作截圖留於工作區、Git忽略；Git保留12個終局報告、3個關鍵機制／續玩截圖、8段短片與全部規則／狀態紀錄；下方MP4為H264/yuv420p、剪接未後製調速。瀏覽器使用控制時鐘，不能由此宣稱真機FPS。六關片尾2秒是同局實際存檔的原生UI重播截圖，沒有修改數字；TB分支片尾為同一失控局截圖，沒有接入勝利報告。

| 關卡 | 桌面／手機結果 | 最終報告 | 新短片 |
|---|---|---|---|
| M1 | 勝利，88%，83秒 | [桌面](desktop-m1-report.png)／[手機](mobile-m1-report.png) | [M1](mobile-m1-highlights.mp4) |
| M2 | 勝利，90%，70.2秒 | [桌面](desktop-m2-report.png)／[手機](mobile-m2-report.png) | [M2](mobile-m2-highlights.mp4) |
| M3 | 圍堵，89%，75.2秒，仍有活菌 | [桌面](desktop-m3-report.png)／[手機](mobile-m3-report.png) | [M3](mobile-m3-highlights.mp4) |
| M4 | 勝利，81%，155.6秒，DC／CD8接力 | [桌面](desktop-m4-report.png)／[手機](mobile-m4-report.png) | [M4](mobile-m4-highlights.mp4) |
| M5 | 勝利，98%，74秒 | [桌面](desktop-m5-report.png)／[手機](mobile-m5-report.png) | [M5](mobile-m5-highlights.mp4) |
| M6 | 持續至436秒、全部保全0，無星等 | [桌面](desktop-m6-report.png)／[手機](mobile-m6-report.png) | [M6](mobile-m6-highlights.mp4) |

## 胞內可見性與播散

[囊泡內15活負荷／下一輪增殖](mobile-tb-growing-cutaway.png) · [破裂後42活負荷回胞外](mobile-tb-rupture.png) · [實際舊HIV局續玩](mobile-hiv-real-legacy-resume.png)。

[新剖視與增殖短片](tb-intracellular-inspection.mp4) · [無Th1的破裂播散短片](tb-rupture.mp4)。剖視在暫停狀態讀同一戰場權威資料，不是獨立預錄小遊戲。

`progress.log` 在15:01 UTC之前是診斷執行；`interrupted-before-dc-fix.json` 是發現路徑問題後主動中止的首輪，不計成功。最終12組以 `results.json` 為準。

環境：Linux Chromium 141、軟體WebGL，桌面1024×768／手機觸控360×800；額外最新UI390×844。沒有實體手機GPU／Safari或全站舊回合制回歸宣稱。
