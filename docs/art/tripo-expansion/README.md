整體私人Preview已隨v3.2核心修正更新；最新運行來源／部署見 [本輪preview.json](../../evidence/core-lifecycle/preview.json)。此目錄原preview.json保留美術批次的歷史來源，不代表目前運行的引擎版本。

本分支後續已獲授權修正核心玩法 v3.2；原素材／費用不變，新增胞內增殖與生命週期展示。現行規則、驗證與預覽來源見 [本輪修正](../../CORE-LIFECYCLE.md)。下文是美術批次交接，不能把其「不改規則」當成最新任務限制。

# 六關 Tripo 美術擴充（待最終審閱）

使用者已確認前三件遊戲樣本，授權擴充其他免疫細胞、病原、人體宿主與器官組織。沿用 `art/tripo-samples`／[Draft PR #3](https://github.com/sces5504/Immuminati/pull/3)，**不合併 Immuminati main、不發布正式 Pages**。主站來源仍為 `36a1f39`，最後合併另等使用者核准。

同一[私人 Preview](https://immuminati-tripo-samples-20261018.paleswift64.chatgpt.site) 沿用獨立 origin／存檔；首頁與設定可切回原模型。只有 `VITE_ART_PREVIEW=tripo` 建置啟用新模型，一般建置保持原版。本輪已成功部署，遊戲來源 `bdc98ee`、託管來源 `509ed06`；精確版本／部署記在 `preview.json`，不能把上一批的部署當成本輪。

## 本輪素材與費用

- 16 件新的標準文字建模，均成功，每件 20 credits，合計 **320 credits**。連同上一批三件 60，共 380 credits。
- 最終餘額 **620 credits**、凍結 **0**；沒有付費重試、高清、綁骨、生成拆件或付費重拓樸。
- 前十件送出後，六次提交因 API 同時生成上限 HTTP 429 被拒收，沒有任務 ID。先核對十件成功、餘額740／凍結0，再提交剩下六個唯一素材；不是把已受理任務重送。`billing.json`、`tasks.json` 與 `*-request.json` 保留安全收據／提示／參數，不含 key 或簽名下載 URL。
- [官方收費](https://developers.tripo3d.ai/en/pricing)、[文字生成](https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard)、[使用條款](https://developers.tripo3d.ai/en/terms)。來源為使用者授權的 Tripo 帳戶生成與本機修整，未另稱 CC0 或醫學認證。

| 遊戲類別 | 接入內容 | 基底與結構 |
| --- | --- | --- |
| 14 種免疫細胞／狀態 | 巨噬、嗜中性、樹突、CD4、CD8、B、漿細胞、NK、Th1、Tfh、Th17、pDC、ILC3、Treg | 保留已認可兩件，新增 DC、T、B、漿、NK、pDC 六件基底。T 家族共用膜，再區分受體輪廓、原有顆粒、核／ER；受體數目為可讀性示意，不是定量生物模型。 |
| 六關病原 | 莢膜雙球菌、沙門桿菌、結核桿菌、流感包膜病毒、念珠菌酵母／菌絲、HIV | 四件生成基底；結核重建無鞭毛桿形，HIV 重建較稀疏三聚體突起；菌絲保留獨立長分枝及生長動畫、沿用酵母壁材質。 |
| 八種正常宿主 | 肺泡I／II、內皮、腸吸收上皮、杯狀、口腔黏膜、CD4宿主、網狀基質 | 三件新宿主基底及 T／DC 膜變體；原宿主ID、核、感染／潛伏、選取、凋亡碎片與剖視語意保留。 |
| 四種器官組織 | 肺泡（M1／3／4）、腸（M2）、口腔（M5）、淋巴（M6） | 已認可肺泡隔延伸至三區；新增絨毛、口腔淺層黏膜與淋巴網架三件。網架生成形態過尖，離線重建平滑開放纖維並沿用素材材質；絨毛平滑／去褐色，統一柔光粉色系。 |

19 份優化 GLB：單材質、內嵌貼圖，免疫／組織512px內、病原256px內，無外部GLTF依賴或新執行套件。精確大小／面數在 `public/assets/tripo/manifest.json`，新批原始生成在忽略的 `.art-source/`。`scripts/prepare-tripo-expansion.py` 與 `adapter.json` 可離線重作；`scripts/prepare-tripo-samples.py` 支援 `ART_ASSETS=alveolar-septum` 單件修整並保留其他manifest條目。

## 遊戲接點與效能邊界

- `presentation/artCatalog.ts`：完整類型→素材與展示半徑。新增共用模型變體主要改對應表及 adapter，不改純引擎。
- `TripoSamples.ts`：依器官／病原預載少量必要模型，其他免疫膜在實際出場時才請求；每場景每來源只載入／解碼一次。多單位共用幾何／貼圖，材質與膜 morph 各自獨立。
- `BattleScene.ts`：保留 Actor 核、顆粒、ER、吞噬體、包覆吞入、活菌／清除、選取與事件動畫；胞內吞噬體也使用當關病原形態。宿主獨立膜配合剖視透明化／凋亡。肺泡I／II以均勻細分曲面膜承接生成材質，避免低面數輸入拉伸後浮出三角片；其他宿主保留生成幾何。綠Y抗體、黃C3b、飛行／灑落／附著仍獨立。
- 肺泡隔／其他地圖在載入時貼合 `anatomyHeight`，合批為每器官一個主要 draw call；保留通道、血管、原地形／宿主位置。彎曲時保持面朝向並重算宿主包圍範圍，避免相機裁切。
- 病原仍用 InstancedMesh，共用400–900級面數幾何；展示每群最多20對（原版50對）、菌絲9對。這只是可見代表，不改實際感染負荷、傷害或勝敗。菌群標籤顯示完整權威負荷。
- 失敗／超時／超過3MiB或6500面的外部模型保留原版。場景拆除中止請求並釋放資源，宿主局部彎曲幾何與共用模板分開清理。
- 沒有修改 domain、engine、application、persistence 或舊存檔；不刪 localStorage、不改 undo／規則。手勢、無名額限制、手動優先、新局部署與自動尋敵維持。

## 檢查與限制

本輪相關命令、結果與畫面索引在 `validation.md`／`docs/evidence/tripo-expansion/`。第一批的17項與舊錄影是歷史，不能拿來當本輪新證據。

- 待審閱的是遊戲尺寸下的美術，仍有共用家族模型；沒有14件各自付費生成。
- 剖視與列表肖像保留資訊清楚的原結構示意，不用生成材質覆蓋核內基因組或把感染狀態畫死在外膜上。這些2D示意並非新3D寫實肖像。
- 組織為戰術尺度的解剖簡化、跨屏障與時間仍是教學壓縮，未宣稱真實比例。
- 雲端 Chromium／軟體WebGL與觸控模擬，不能取代實體 iPhone Safari／Android GPU 測量。只報面數與 draw call，不宣稱真機 FPS。
- Vite 提示 Three.js／主包超過500kB，建置成功；沒有為消除提示而隱藏問題或更改渲染器。

## 最終核准後的發布注意

目前合併權限仍未授予。使用者確認整批後，應再核對最新main並保留他人變更；啟用正式建置的 `VITE_ART_PREVIEW=tripo`（或將已審閱adapter設為正式預設），再跑相應Pages子路徑與部署檢查。單純按Merge而沿用未設旗標的一般建置，仍會顯示原模型；不可把這種結果稱為新美術已正式上線。不要自動新增付費Tripo工作，原始輸出可依任務ID重新取得下載鏈，不需重送生成。
