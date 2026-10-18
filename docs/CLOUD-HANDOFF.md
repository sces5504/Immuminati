# Tripo 全角色／器官預覽交接（2026-10-18）

第一批已由使用者確認；本輪擴充14種免疫、六關病原、八種宿主與四種組織。工作分支 `art/tripo-samples`、Draft PR #3，仍不可合併main／正式Pages。原規則3.1、部署、存檔與操作保留。最新素材、320 credits收據、adapter與實際新驗證見 [本輪美術交接](art/tripo-expansion/README.md)；部署來源核對 `art/tripo-expansion/preview.json`，不要沿用首批preview.json或舊錄影當成最新。

# 本分支：Tripo 第一批樣本，等待使用者確認

`art/tripo-samples` 由main `36a1f39`建立；不是正式站改版。三次已授權Tripo生成均成功，總60 credits，沒有追加付費或重試。兩種細胞膜＋M1入口A區局部隔壁已接入實際遊戲，原模型可切換、載入失敗可回退；一般建置預設原版。引擎、存檔與main均未更動。

17項相關單元、型別、預覽／一般建置、桌面／手機局部操作與完全載入失敗回退通過，新截圖／短片見 [本輪證據](evidence/tripo-samples/README.md)。來源／接點／限制見 [素材紀錄](art/tripo-samples/README.md)，私人預覽身分見 `art/tripo-samples/preview.json`。

**交付這一組樣本後先停下來等使用者確認，不自行擴充、不再付費生成、不合併Immuminati main或發布正式Pages。** 使用者的樣本認可與最終合併認可分開處理。以下公開站資料仍描述未改動的main。

私人預覽已部署成功：https://immuminati-tripo-samples-20261018.paleswift64.chatgpt.site 。[草稿PR #3](https://github.com/sces5504/Immuminati/pull/3) 已附預覽與檢查；遊戲來源 `bd4b0b1`，託管來源 `d28892e`，版本／部署ID在preview.json。GitHub新增deployment狀態卡API回403，未寫入狀態卡；獨立Sites預覽已由原生部署結果確認成功。分支未觸發完整Actions矩陣，main核對仍為 `36a1f39`。

# 最新交接 v3.1（優先於下文 v3.0 基準）

最新遊戲程式來源 `ff62c59`，[直接遊玩](https://sces5504.github.io/Immuminati/?v=ff62c59)。本次顯示病原名稱、加入純展示層輕量避讓；13項相關單元測試、型別／建置、雙平台14項局部操作與最終桌面避讓補查通過。詳見 [本次實作與限制](CELL-LAYOUT.md) 及 [新證據](evidence/cell-layout/README.md)。前一版 `26a26d1` 的完整關卡／發布驗證不能當成本次驗證；黑畫面修正來源 `cb7580e` 仍包含於本版。

六關與14種免疫細胞／分化狀態已可玩。這輪保留模型與戰術UI，改為玩家開局部署、知識套組、手機雙指縮放，移除略過動畫鍵並調整首頁文案。最新進度／實測／發布見 [v3.1紀錄](DEPLOYMENT-AND-GESTURES.md)；外部美術建模組直接使用 [交接prompt](ART-HANDOFF-PROMPT.md)。原模型可替換但尚未經新一輪專業美化。

- 新局使用 `createDeployment`；`createTactical` 僅為歷史active狀態／機制測試工廠，不再作正式新局隊伍。M3保留感染宿主，其他無預配可指揮隊伍。
- `content/deployment.ts` 配置各關兩套知識套組；`engine/deployment.ts` 處理預算／撤下／套組／確認，`ui/DeploymentPanel.tsx` 沿用對話框及戰術語彙。12部署點不是單位上限；戰中募集無變。
- preparation狀態阻止步進及戰鬥命令，確認時清undo階段邊界；已配置草稿可儲存／續玩。舊active state／undo無損遷移，絕不清隊。
- 規則3.1／campaign.2，schema2。保留pre-3.1及歷史key；遷移中不重跑感染初始化。
- `BattleScene.ts` 新增pointer集合／雙指中點錨定，暫時剩一指、第三指、取消／失焦後不得點選或移動細胞。不要為換模型改這套相機輸入。玩家UI無略過動畫，底層開發工具仍存在。
- 新驗證：`npm run test:deployment`、`npm run test:deployment-policy` 及擴充的單元測試。原回歸腳本透過可見部署UI實際配置隊伍，不再假定u1是第一個新部署單位。重新發布的實測數字以v3.1紀錄為準。

---

以下為v3.0完整六關機制／架構基準；版本、開局配置及略過鍵描述依上文更新。

# Immuminati 開發交接 v3.0

公開站：[Immuminati](https://sces5504.github.io/Immuminati/?v=f004bdf)。本輪由 main `b10c428` 延續；遊戲程式來源 `ca00027`，最終驗證／發布來源 `f004bdf`。文件與證據提交不改遊戲資產。實際檢查見 [本輪驗證](CAMPAIGN-VERIFICATION.md)，不要引用舊64項或舊影片當作新驗證。

## 必須保留

- 原立體戰術 UI、指揮與 C 柔光風格，不重做另一套 RTS；抓取式拖曳同方向、無單位名額上限，仍受資源與等待約束。
- 六關一開始全可選。M3 為含活菌的感染控制；M6 為未治療有限觀察結果，不給一般勝利或星等。不要提前在首次進入 UI 劇透；說明只在結果實際顯示後解鎖，含 ART 可有效控制 HIV 的正確資訊。
- 新局自動尋敵開，手動移動優先；舊局保留原選擇。暫停、2×、略過／降低動態不改同一步數結算，不從動畫回呼扣資源或殺菌。
- 病原所在區室由權威狀態判定，不從模型重疊判定。胞外調理／中和、吞入、吞噬體殺菌、胞內存活、核內基因組、抗原呈遞及宿主凋亡分開。
- 頁首回主頁保存且暫停；抗體有庫存直接進指定模式，ⓘ 獨立開流程。抗體面板手機不需捲動，名稱／價格不拆行，主要操作至少44px。面板外第一次點擊只關閉，不能穿透下命令。

## 架構

`src/tactics` 為正式入口，TypeScript＋Vite＋React＋Three.js；根目錄舊回合制引擎不是現行遊戲。

- `domain/model.ts`：14種細胞／狀態、命令、病原／宿主區室、訊號、事件及關卡結果。
- `content/m1.ts`／`campaign.ts`：六關入口與資料。沿用機制新增關卡主要改資料；新增生物機制需引擎／展示擴充。
- `content/{cells,tissues,anatomy}.ts`：共用細胞、肺／腸／口腔／淋巴器官及健康宿主。每關都有可選正常組織；M3 開場已有6負荷在巨噬吞噬體；M6 有已存在的潛伏來源。
- `engine/{simulation,immunity,infection,opsonization,goals,events}.ts`：純0.2秒固定步進、RNG、命令、調理、吞噬、呈遞、T–B 對接、感染／產毒、菌絲／上皮防禦、圍堵與結果。存檔與引擎共用目標判定，不能匯入偽造的提早 HIV 結局。
- `application/controller.ts`：暫停／撤銷／時序與紀錄。只以單一 performance 時基排程固定步進；規則不在展示中。
- `presentation/{MolecularModels,CellGeometry,TissueGeometry,Anatomy,BattleScene,...}.ts`：獨立可替換模型、每單位不同相位待機、包覆吞入、清除／存活、C3b灑落、Y抗體移近、T–B 對接、病毒進出、菌絲延伸、鏡頭與選取。
- `ui/{TacticalApp,AntibodyPanel,AnatomyPanel,ImmunePanel,Tutorial}.tsx`：原UI增量調整、剖視與教學；百科在 `src/content/encyclopedia.ts`。
- `persistence/save.ts`：schema2／rules3.0／campaign.1，嚴格解析、原文備份與 state／undo 同步遷移。舊已開始的 B 分化保留資格，不倒退補作新對接；不追算過去免疫反應、不清空舊 key。

## 生物學與展示邊界

T–B 依賴反應用蛋白抗原：B 呈遞同源來源肽／MHC-II，在淋巴組織近距離接受 T 幫助（CD40L／CD40及細胞激素），再等待分化。不是要求 helper 回到感染腔面；T 非依賴多醣反應明示未模擬。來源與更細機制見 [實作與查證](CAMPAIGN-IMPLEMENTATION.md)。

C3b 黃三葉、抗體綠 Y，模型／工具／狀態／肖像／圖例一致，可共存但不重複加成。附著動畫不決定權威效力；病毒中和只降低胞外感染能力，不表示進入核內抹除基因組。

M2 是 Typhimurium 的局部巨噬／腸組織教學，不是所有沙門氏菌或傷寒病程。M3 圍堵依感染巨噬、相鄰已活化 Th1／IFN-γ 與組織狀態，成功仍有活菌。M4 的 CD8 必須另經 DC MHC-I 交叉呈遞，不能由 MHC-II 直接取得資格。M5 長菌絲用接觸顆粒作用；IL-17／IL-22 經上皮而非傷害魔法。ILC3 僅作一種黏膜支援示例，不宣稱所有人類口腔反應皆由其主導。

M6 產毒、潛伏、CD4功能與組織健康各自保存。未治療功能障礙連續受病毒壓力影響，策略會影響支援時間；沒有最後一刻清場。長壽命潛伏來源可在整段短觀察期不再活化，並非宣稱現實某細胞永不再活化。

## 驗證與後續

用 Node24、`npm ci`、`npm run verify`，其他瀏覽器命令見 README。發布工作流須全部通過才部署 `/Immuminati/`；另有公開站桌面／手機六關與原操作回歸。測試時鐘在空白頁先安裝／暫停，再載入遊戲；禁止中途切換時鐘造成 RAF 佇列競爭，亦不能用直接注入勝利狀態替代通關。

可替換程序模型尚待專業美術精修；未做完整全身免疫、胚中心／親和力成熟、全部抗原／HLA、病毒變異、器官修復或所有細胞亞群。訊號是防區聚合，時間與群體負荷為教學抽象。初版平衡需要真人遊玩回饋；實體 iPhone Safari／Android GPU 尚未實測。

# 2026-10-18：增援選單移出後黑畫面修正

- 原因：選單外的全畫面 `.t-panel-dismiss` 是透明按鈕，但一般按鈕的 hover 規則優先度更高；滑鼠移出面板會把整層塗成深色。
- 修正：為該關閉層明確設定一般／hover 狀態均透明、無陰影與過渡。募集與抗體面板共用此層，保留點擊空白處關閉且不穿透下令的行為。
- 使用者本輪明確要求不跑任何測試；未執行規則、型別或瀏覽器測試，也未宣稱實機重現／驗證。發布僅執行 Vite 建置。
- 新增手動 `pages-build-only.yml`，僅供明確授權不測試時發布；本次提交使用 `[skip ci]`，避免觸發正常測試。原 `pages.yml` 與公開站驗證工作流保持原設定；此手動流程不觸發其 `workflow_run`。
- [本次發布 39103710710](https://github.com/sces5504/Immuminati/actions/runs/39103710710)：Vite 建置與 Pages 部署成功，來源 `cb7580e`；未做瀏覽器遊玩驗證。

# 2026-10-18：病原名稱與輕量避讓

- 使用者要求只跑相關測試。本次13項單元、型別／建置、桌面／390px手機的六關名稱與同點細胞實際下令檢查通過（14項），效能調整後另補查一次桌面避讓，沒有跑完整關卡策略／回歸。最終畫面與量測見上方新證據。
- `presentation/cellLayout.ts` 使用空間桶、有限候選與有界鄰居，僅state變更時計算。展示偏移同步套到點選／標籤與動作來源，權威規則／位置／存檔／undo均不改；沒有新的單位名額限制。空間不足容許重疊。
- 美術換模型請同步調整避讓半徑與桶寬，詳見實作紀錄。既有C風格、相機、拖曳／雙指與黑畫面修正保留。
- 提交使用 `[skip ci]` 並手動發布建置，避免跑使用者未要求的完整測試矩陣；正常發布工作流未減少檢查。
- [發布39104837457](https://github.com/sces5504/Immuminati/actions/runs/39104837457) 建置／Pages部署成功；發布HEAD `a32fd98`、遊戲程式 `ff62c59`。公開HTML引用的4個資產與本機正式建置逐位元相同，詳見新證據的 `public-assets.json`。

