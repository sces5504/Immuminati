> v3.0 追加：本文件保留 v2.4 歷史驗證。當前六關／抗體／手機修正見 [六關實作](CAMPAIGN-IMPLEMENTATION.md) 與 [本輪驗證](CAMPAIGN-VERIFICATION.md)，勿引用下方舊數字當作新測試。

# v2.4 畫面精簡、獨立調理來源與交接

使用者七項回饋的實作紀錄（2026-10-17 UTC）。保留原立體戰術版，不新增關卡。

## 變更與注意事項

1. 地圖預設只有小型 A/B/C，取消常駐菌量、C3／Ig、胞內處理、宿主名稱與入口浮卡。點模型後仍在指揮列看完整資訊；「設定 → 顯示完整地圖標籤」可恢復。透明 44px 命中區、鍵盤焦點與可存取名稱保留，不能移除組織模型。
2. 任務卡預設收合，保留胞外空間、波數、總負荷；無菌可提前下一波，點開讀完整目標。上方組織剖視可看屏障層次，不另放大黑色空間卡。空選指揮列把操作提示放右邊，降低高度。因果紀錄收進任務展開內容，右側只保留三個行動入口；在 360px 直向手機確認每個菌群的點擊中心都可操作。
3. 「補體調理」與「B／抗體」獨立。補體耗原資源／支援；抗體顯示 B 活化與漿細胞分化前提，可募集 CD4／B，已有抗體才可優先指定胞外目標。原自動抗體分配保留；沒有抗體時不會用按鈕憑空生成。
4. C3b 與抗體期限分開，可同時附著，模型小點／Y 形分別由權威資料控制；共享一次既有吞噬加成。雙擊／重複指令不重複扣，驗證不修改狀態；不可對胞內病原施放。
5. 血管破面來源之一是固定高度平面穿過起伏組織：移除該面，以主地形頂點色表現組織側帶。血管／淋巴／界線沿地形取樣，損傷色層也貼合。多角度截圖供檢視；未宣稱完整解剖或醫學精模。
6. 新局自動尋敵預設開；保留舊局開關。手動移動優先、固定步進與 2× 不變，無同區／全場名額限制。
7. 募集／抗體面板有透明外部點擊層，第一下外部輸入只收起面板，不穿透下命令或扣資源；保留關閉鈕及 Escape。選單內可捲動，教程轉步會關閉增援避免遮擋。

存檔 schema 2、規則 2.4／m1-tactics.5。接受 2.0–2.3 合法配對並遷移 state／undo；保留原局時間、指令、資源、事件與已存自動尋敵選擇。較早沒有免疫狀態者仍從未啟動開始。首次覆寫原文備份 pre-2.4；不刪舊 key／備份。

## 驗證與證據

本機 64 項測試、型別與正式建置通過。首輪 CI ecfdfd2 發現較窄 360px 手機的因果紀錄按鈕擋住菌群，已把紀錄移到任務展開內容、縮短行動按鈕副文字；也修正精簡命中區 hover 仍出現實色方塊。修正後的完整發布 CI 已成功；首輪失敗不計入通過數字。下列為最終程式來源的新驗證與部署。新目錄 `docs/evidence/ui-clarity/`；舊 anatomy／immune-expansion 是歷史。

新增 `test:clarity` 驗證桌面／直向手機的精簡尺寸、預設尋敵、右側提示、外部收起不穿透、C3／B 抗體入口、存檔標籤選擇、多鏡頭血管、2× 自主吞噬及資產／錯誤。規則測試包含合法／非法／重複抗體、獨立期限、非疊加吞噬、撤銷、遷移及貼地幾何。

## 發布與實際驗證

程式來源 `addcee90afdea82c3c9e4d866f5b89d56600c15c`，已由完整成功的 [CI 39044481225](https://github.com/sces5504/Immuminati/actions/runs/39044481225) 部署至 [Pages 更新版](https://sces5504.github.io/Immuminati/?v=addcee9)。所有 verify、雙平台 browser／clarity／immune／anatomy、animation 及 deploy 均成功。上一輪 9425293 是歷史來源。

公開 HTML、主 JS、Three.js、CSS 與 mark.svg 均正常返回，資產 SHA-256 與本機正式建置一致，記錄在 `public-assets.json`。公開站 Chrome 雙平台新增 UI 的 12 組檢查亦通過，結果與公開站截圖見 `evidence/ui-clarity/public/`。完整通關的額外回歸 [39045223717](https://github.com/sces5504/Immuminati/actions/runs/39045223717) 亦已成功（2026-10-17 15:44:42 UTC）：公開新增 UI 12 組與原操作／完整通關 24 項，合計 36 組工作日誌 PASS。摘要見 [live-summary.json](evidence/ui-clarity/public/live-summary.json)；完整公開站原片保留在該 CI 的 live-pages-evidence artifact。

- 單元／規則：64 項；型別、正式建置通過。
- 新介面：桌面 1440×1000、直向 360×800，各 6 組，共 12 組；包含外部觸控收起、標頭點擊收起不穿透，以及所有初始菌群的點擊中心不被遮擋。
- 生物／教學：雙平台各 5 組，共 10 組；自然抗體策略均成功，組織保全 53%、1 星、92.4 遊戲秒。
- 組織／區室：雙平台各 5 組，共 10 組；新來源的結果 JSON 在 `evidence/ui-clarity/anatomy/`。
- 原操作整關：雙平台各 14 項，共 28 項成功。原手動策略明確關閉自動尋敵，以驗證調度；新局預設開啟另由 clarity 驗證。手機 64.6 遊戲秒、保全 88%、3 星；桌面 84 秒、保全 84%、2 星。瀏覽器策略的實際下令時點不同；相同固定步輸入的結算一致性另由單元測試驗證。
- 吞噬動畫：清除／胞內存活兩分支成功；明確開發樣本，不等於新關卡完成。

畫面：[手機戰場](evidence/ui-clarity/mobile-quiet-field.png)、[桌面戰場](evidence/ui-clarity/desktop-quiet-field.png)、[B／抗體面板](evidence/ui-clarity/mobile-b-antibody.png)、[任務展開](evidence/ui-clarity/mobile-objective-expanded.png)、[手機通關](evidence/ui-clarity/tactics/mobile-result.png)。

錄影：[40 秒 M1 精華](evidence/ui-clarity/mobile-m1-highlights.webm)（待機、調度、吞噬與結算）、[手機介面操作](evidence/ui-clarity/mobile-ui-clarity.webm)、[桌面介面操作](evidence/ui-clarity/desktop-ui-clarity.webm)、[吞噬雙分支](evidence/ui-clarity/animation/engulf-branches.webm)。精華僅依時間順序剪接，未後製調速或修改狀態（片內使用遊戲原有 2×）；原片仍在對應 CI artifact。來源與剪接秒數見 [recording-provenance.json](evidence/ui-clarity/recording-provenance.json)；完整檔案來源與 SHA-256 見 [evidence-index.json](evidence/ui-clarity/evidence-index.json)。

## 額外抗體操作驗證（明確標示的邊界測試）

本機 Chrome 直向 390×844，以合法 M1 存檔人工設定兩份抗體庫存並匯入，只測介面與規則邊界，不作為自然產生抗體的證據。先施加 C3b，再經 B／抗體入口指定同群：庫存減 1、資源／支援／負荷不變，底部顯示 C3b 20 秒與抗體 6 秒；再次指定同群不改狀態，撤銷還原庫存、期限、事件。結果與雙附著截圖見 `evidence/ui-clarity/manual-fixture/`。自然 DC → CD4 → B → 漿細胞產生抗體，另由未修改生物狀態的 immune 完整 UI 策略回歸驗證。

## 尚存限制與接手事項

- 真機 iPhone Safari 尚未實測；Chrome 觸控模擬不等於 Safari。背景安全暫停、手機完整操作要保留。
- 程序建模可繼續由美術 agent 精修，不能退回整張圖片或單位共用動畫；血管跨屏障仍為教學壓縮，不逐層模擬。
- 胞內／胞外一致性、吞入後延遲殺菌、正常宿主與 NK／CD8 合法性全部保留。M1 不可假冒病毒感染；胞內生命週期擴充尚未完成。
- 不新增 M2–M6，不引入區域名額、永久戰力或另一次 RTS 重製。完整後續規格仍保留。
