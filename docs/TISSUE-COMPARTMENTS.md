# 組織與胞內／胞外一致性 v2.3

## 本輪決策與範圍

使用者指出地圖腔室看不出是胞內或胞外，確認每關都必須顯示宿主人體細胞，而非只在胞內病原關出現。保留原 UI、柔光模型風格、指揮列、選取／調度、抓取式鏡頭與無單位名額限制，不進行 RTS 重製，不新增 M2–M6。

M1 中央空間明示為肺泡腔（胞外）；肺泡壁由可選的第一型／第二型上皮細胞構成，血管內皮排列於組織側。每顆可見宿主有權威 ID，選取可查看種類、健康、感染、MHC-I 與局部剖視。正常 M1 初始有 27 個上皮示意單元、5 個血管內皮示意單元，都是未感染宿主，不是肺炎鏈球菌在細胞質感染。

解剖資訊圖區分肺泡腔→上皮／基底膜→間質→內皮／血管腔。肺泡腔、間質與血管腔皆為細胞外，但互不等同。血管募集與淋巴引流置於組織側，跨屏障入口採時間／路徑壓縮，沒有逐層的真實遷移模擬。

## 實作

- `content/anatomy.ts`：共用宿主生成、細胞種類／功能、區室名稱與區域健康映射。器官 profile 皆生成宿主，非特定病毒關限定。
- `domain/model.ts`：HostCell 種類、層次、健康、可選的 infection（病原與 cytosol／nucleus）；免疫細胞內來源 Internal 明記 compartment（phagosome／cytosol）、stage（processing／persistent）、clearAt。位置與活負荷、抗原、健康分開。
- `presentation/TissueGeometry.ts`：沿肺泡隔貼合的薄上皮膜、細胞接合與核，第二型的層板小體示意，血管內皮；所選細胞有選圈，剖視時膜局部透明。移除原先未對應細胞的裝飾核。
- `ui/AnatomyPanel.tsx`：可開啟的空間剖面、人體／免疫細胞清單與局部剖視。核、質、吞噬體與活病原由同一權威狀態顯示；沒有活來源時不畫病原。支援直向捲動，開啟安全暫停，關閉不自動開始行動。
- M1 攝入先從胞外菌群轉入宿主綁定吞噬體，活負荷守恆；嗜中性 2 秒，巨噬／DC 3 秒後才完成殺菌與 clear 事件。這是教學時間，不代表實驗時間。勝利等待所有活來源，展示／加速不重算。
- persistent 囊泡不自動清除；IFN-γ 的巨噬支援只作用於 persistent phagosome，不能當成通用細胞質殺菌。調理只接受胞外菌群，NK／CD8 只接受合法感染宿主，健康人體細胞不得被攻擊。
- 區域健康映射到該區組織細胞，沒有按可見細胞數重複扣損傷。演練凋亡宿主健康為 0。
- 教學與百科增加胞內／胞外、腔面／組織側與吞入不等於死亡的說明。

## 相容性

存檔保留 key `immuminati:tactics:v2`，schema 2，規則 2.3、內容 m1-tactics.4。2.0/.1、2.1/.2、2.2/.3 配對存檔及暫停撤銷快照均可遷移。補上健康組織與既有活菌的吞噬體狀態，不重建舊局過去已完成的吞噬，也不虛構新的病毒感染。首次覆寫前保留原始文字到 `immuminati:tactics:pre-2.3`，舊 pre-2.2 與 v1 紀錄不刪除。新格式缺少區室／組織資訊則拒絕，不默默補成另一種感染。

## 實際驗證與交付

程式版本 `942529389658ef0f89b6964e65fe3d525c7aecf4`；[發布前 CI 39037490956](https://github.com/sces5504/Immuminati/actions/runs/39037490956) 的規則、建置、原桌面／手機、免疫桌面／手機、組織桌面／手機、動畫及 deploy 全部成功。公開網址：[GitHub Pages](https://sces5504.github.io/Immuminati/?v=9425293)。

- 59 項單元測試通過，其中本輪新增 9 個組織／區室與 3 個命中優先權測試；型別與 production build 通過。
- 原操作桌面／手機共 28 項檢查通過，包含八種旋轉／縮放的正反抓取式拖曳、真實觸控單位選取、無名額限制、指令／撤銷、存檔、完整 M1 與資產／執行期錯誤。
- 新剖視桌面／手機共 10 項檢查通過：真實 canvas 上皮點選、32 個正常宿主、未感染／吞噬體／細胞質視圖、暫停、分開的攝入與殺菌、實際匯出／匯入／續玩，以及演練不改 M1 原局。
- 免疫教學／適應性支援／NK-CD8 演練／遷移等桌面／手機共 10 項檢查通過；吞噬動畫清除與持續存活雙分支通過。持續存活為抽象測試標本，不冒稱 M1 胞內繁殖。
- 實際策略結果：原指揮策略桌面 90.8 模擬秒、83% 保全、2 星；手機 69.6 秒、88%、3 星。適應性支援策略桌面／手機均 92.4 秒、53%、1 星。它們為不同 UI 操作時序，不能用來比較裝置效能。
- 額外使用 repo 前輪保留的真實規則 2.2、tick 20 存檔作瀏覽器續玩：保留時間、單位、路徑、菌群、到場佇列、資源、波次、健康、訊號、事件與 RNG，補上健康組織，`pre-2.3` 原始文字備份完全一致。重現腳本及結果見證據目錄。
- 公開 HTML 與 4 個資產（主 JS、Three.js、CSS、SVG）皆 HTTP 200，內容與本機 production build 位元組一致；使用正常 TLS 驗證。雲端本機 Chromium 不信任代理 CA，未關閉憑證驗證；真正公開瀏覽器的桌面／手機整局回歸已由 [CI 39038356284](https://github.com/sces5504/Immuminati/actions/runs/39038356284) 完成且全部成功，來源仍是同一程式 `9425293`。見 `live-ci-summary.json`。

### 畫面與錄影

所有下列本輪證據在 [evidence/anatomy/](evidence/anatomy/)；檔案 hash、來源與範圍見 `evidence-index.json`、`recording-provenance.json`，不以舊截圖代替本輪驗證。

- [桌面戰場](evidence/anatomy/desktop-tissue-field.png)、[手機戰場](evidence/anatomy/mobile-tissue-field.png)。
- [健康上皮剖視](evidence/anatomy/desktop-healthy-cutaway.png)、[手機吞噬體處理](evidence/anatomy/mobile-phagosome-processing.png)、[演練感染宿主](evidence/anatomy/mobile-infected-host-cutaway.png)。
- [手機剖視操作錄影，53 秒](evidence/anatomy/mobile-anatomy.webm)、[桌面完整剖視操作，126 秒](evidence/anatomy/desktop-anatomy.webm)。
- [M1 手機短片，42 秒](evidence/anatomy/mobile-m1-highlights.webm)：待機、指揮、吞噬與結算；取自同版 CI 真實 UI 紀錄，僅依時間順序剪輯，沒有改速或修改戰場狀態。原片／片段範圍記在來源 JSON。
- [包覆吞入與胞內存活分支](evidence/anatomy/engulf-branches.webm)：明確標示的開發 fixture。
- [桌面結算](evidence/anatomy/desktop-result.png)、[手機結算](evidence/anatomy/mobile-result.png)、[適應性策略結算](evidence/anatomy/desktop-adaptive-result.png)。

本輪瀏覽器均 Chromium 141.0.7390.37／SwiftShader；手機為 360×800 或 390×844 直向觸控模擬。沒有實體 iPhone／Safari／硬體 GPU 效能測試，不能把觸控模擬說成真機認證。

啟動：`npm ci`、`npm run dev`，開啟終端所列網址的 `/Immuminati/`。驗證：`npm run verify`、`npm run test:browser`、`npm run test:immune`、`npm run test:anatomy`、`npm run test:animation`。雲端可指定 `PLAYWRIGHT_BROWSERS_PATH` 與 `DEVICE`；瀏覽器腳本會啟動各自的 production preview／dev fixture，避免共用相同埠並行執行。

## 開發中發現與修正

- 原操作 CI 的手機命中回歸抓到背景上皮搶走免疫細胞觸控目標；優先保留原免疫／菌群命中，組織作背景檢視，明確移動模式忽略背景宿主。新增命中規則測試，並重跑原有真實觸控回歸，沒有刪掉其選取斷言。
- 初輪手機流程抓到組織選取的提示橫幅遮住開始鍵；移除重複橫幅，改由底部資訊面板與剖視呈現，選免疫細胞也清掉舊提示。沒有以 force click 繞過。
- 淺色視窗上的新面板文字對比不足，改為深色內文並明確保留選取樣式；手機空間提示移開因果紀錄。
- 本機同時跑多個 SwiftShader 流程曾造成一個規則壓力測試超時及教學點擊逾時；改為避免資源競爭，完整回歸由各自獨立 CI 執行。只以後續完成的結果作交付依據。

## 限制

這是程序式教學解剖，細胞大小／數量／壁厚不按真實比例。單顆組織細胞的獨立損傷、修復與訊號尚未實作，健康沿用防區值；沒有逐層跨內皮／上皮遷移、肺泡液與氣體交換模擬。局部剖視為權威狀態驅動的放大示意，沒有額外胞內小遊戲。

細胞質／核內感染資料與剖視分支已預留，演練有獨立細胞質病毒標本；病毒入侵、複製、釋出、宿主死亡後殘存病原命運及胞內菌逃逸未實作，不代表 M2–M6 已完成。現行仍以 scenario 的 survives 參數決定吞噬後持續存活，尚非任意多病原／宿主配對的生命週期系統。

口腔／腸道只有共用組織資料與基礎 profile／模型分支，未完成對應關卡或器官精模。瀏覽器證據使用 Chromium／SwiftShader 及觸控模擬，不能當成實體 iPhone／Safari 或硬體效能認證。
