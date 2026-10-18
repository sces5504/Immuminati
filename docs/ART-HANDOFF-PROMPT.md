# 現行追加：首批已確認並完成全角色擴充（2026-10-18）

後續接手請繼續 `art/tripo-samples`／PR #3，不從main覆蓋待審閱美術。使用者已授權首批之外的模型；16件新生成共320 credits、餘額620，沒有繼續付費生成的必要。先讀 [完整素材／接點／限制](art/tripo-expansion/README.md) 與最新Preview／驗證，保留原模型切換、獨立動畫與既有玩法。**最終合併main仍等使用者核准**，不要執行正式Pages發布。下方樣本階段prompt為歷史，不需重新做三件或重花費。

# 給美術／建模 AI 的交接 prompt（v3.1）

以下區塊可整段貼給另一個 AI。開始時以遠端最新 main 為準，不從歷史 commit 整包覆蓋。這是美術精修任務；不要藉機重做玩法、UI 或 RTS。

---

請實際精修 `sces5504/Immuminati` 的 3D 美術模型。專案預期在 `/workspace/Immuminati`；先確認 repo、git 狀態及最新 main，保留其他人的變更。先讀 `AGENTS.md`、`docs/Immuminati-spec.md`、`docs/art-direction/C-art-and-animation.md`、`docs/CLOUD-HANDOFF.md`、`docs/DEPLOYMENT-AND-GESTURES.md`，並實際看 `docs/art-direction/c-soft-micro-3d.png`、目前 Pages 遊戲及最新證據圖。公開站：https://sces5504.github.io/Immuminati/ 。

使用者喜歡目前立體戰術版的 UI、構圖、操作與 C「柔光微觀立體」方向。**本輪只美化模型、材質、光照及其局部動畫。** 保留首頁／HUD／指揮列、三防區可行走範圍、相機投影、點選位置與新局部署流程。不要改用整張背景圖加熱區，不換渲染器，不另做 RTS，不先把所有模型降成球形占位。

當前已可玩 M1–M6：肺炎鏈球菌、局部鼠傷寒沙門氏菌、結核感染圍堵、流感 A、口腔白色念珠菌、HIV。14 種免疫細胞／分化狀態沿用共用引擎；M3 可保留活菌，M6 是特殊有限結局。新局由玩家選知識套組／自行配置（12 開局部署點），舊局保留原隊伍；不要動這些規則。

優先工作：
1. 改善器官組織的自然連續形態：肺泡隔／上皮／微血管、腸黏膜柱狀上皮與刷狀緣／杯狀細胞、口腔鱗狀上皮接合、淋巴組織網狀基質。尤其修掉淋巴場景目前方塊／散珠感。區分肺泡腔、上皮屏障、組織側與血管；不能把肺泡隔當單一細胞膜。這是有標示的教學剖視，不能用裝飾改變可走通道或掩蓋單位。
2. 精修細胞膜面、核與局部結構：巨噬彎曲核／偽足、嗜中性分葉核與連絲、樹突細胞連續突起、淋巴細胞較大緻密核、細胞毒顆粒、漿細胞偏心核與分泌結構。不同角色要靠輪廓與結構辨識，不能只換顏色。
3. 病原維持可辨識差異：莢膜雙球菌、桿菌、抗酸桿菌、具包膜與突起的病毒、出芽酵母／分枝菌絲。抗體為**綠色 Y 形**，C3b 為**黃色三葉／顆粒形**，在模型、圖示與狀態顏色保持一致，兼具非顏色辨識。
4. 每個單位獨立模型與相位。保留漂浮／呼吸／膜 morph、沿路移動、偽足包覆與吞入、胞內清除／存活差異、顆粒／穿孔及宿主凋亡、病毒入侵／釋出、菌絲延伸、T–B 局部對接、C3b 灑落與抗體移向目標再附著。不能用通用閃光取代過程。組織細胞錨定在屏障，不跟游離細胞一起漂。

技術接點：
- 正式入口 `src/tactics`，TypeScript＋Vite＋React＋Three.js。`domain`／`content`／`engine`／`application`／`persistence` 保持不變；規則先產生權威事件，展示只能讀取，不從動畫回呼扣資源、殺菌、換區室或決定勝敗。
- `presentation/CellGeometry.ts`：`membraneGeometry(kind)` 有 position morph target；`BattleScene.ts` 的 Actor 需保留 root/body/shell/lobes/granules/vacuole/ring 與 kind/phase 語意。替換模型時提供 adapter，不能讓動畫找不到部件。保留根節點原點、尺度、接觸錨點與選取圈，不能讓模型外觀與權威位置／可點位置脫離。
- `TissueGeometry.ts`：`makeTissueActor`／`updateTissueActor`／`disposeTissueActor`；子部件 membrane、junction、nucleus、infection、selection、fragments 為現有更新接點，保留或明確轉接。健康宿主不畫假病原。
- `Anatomy.ts`：`buildAnatomy`／`anatomyHeight`／`tissueFloor`。場景地面、血管、損傷層、宿主高度、投影選取需一致，不能產生血管穿面或遮住可操作模型。
- `MolecularModels.ts`：`antibodyModel(material)`／`complementModel(material)`／`pathogenGeometry(shape)` 可獨立替換；保留材質控制、命名及清理責任。
- 主戰場和局部剖視 `presentation/Anatomy.ts`、`ui/AnatomyPanel.tsx`、肖像 `src/presentation/CellArt.tsx` 必須對得上。核內感染畫基因組／複製區室，不把核內畫成一堆成熟病毒。
- 不改 `BattleScene.ts` 的手勢狀態機。手機已支援單指同向拖曳、雙指縮放（0.75–1.7）、中途放一指不誤下令，保留 ±／旋轉／重設的替代操作；UI 目標及命中區至少44px。

可用程序模型精修，也可加入自己製作且授權清楚的 glTF／紋理。所有資產以 Vite `/Immuminati/` 子路徑載入，提供來源／授權／尺寸／貼圖與面數資料。載入失敗保留現有可玩模型。不要讓外部模型變成開局必須等待的單點故障；dispose 幾何、材質、貼圖，必要時快取共享資源，並驗證手機效能。

工作方式：先列具體美術計畫，再實作**一組可審閱樣本（肺部組織＋巨噬／嗜中性＋病原／調理動畫）**，與目前畫面並排比較；這一階段先交付樣本、可啟動分支及截圖短片，供使用者判斷風格。不要先把六關全部覆蓋或自行推送到正式 Pages。保留可回退的原模型／adapter；若使用者認可，再擴展其他器官及全部單位。

驗證：跑相應型別、規則與正式建置；實際操作桌面與360／390px直向手機，確認模型選取、路徑、剖視、縮放、血管貼地、核心動畫、降低動態及1×／2×結算一致。留下同構圖前後截圖、包含待機／調度／包覆吞入／C3b與抗體附著的短片，量測實際效能而非宣稱「已優化」。未驗證真機、粗模／素材缺項要列明。更新 repo 的素材清單、接點與交接，先交付可審閱結果。

---

此 prompt 特意讓美術先做一組樣本，保留現行模型與功能回退路徑，方便使用者決定是否繼續交由該組製作。這是本次交接建議，後續使用者的明確授權優先。
