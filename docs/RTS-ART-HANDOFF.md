# M1 佔位素材與美術接手

2026-10-17，Asia/Taipei。這是第一階段可玩佔位版；尚未驗收最終 C 精緻畫質。參考圖已實際檢視，未當背景或可分層素材使用。所有畫面與程式圖形是本專案原創，無下載外部模型／貼圖。

## 執行與入口

```sh
npm ci
npm run dev
# 開啟 http://localhost:5173/Immuminati/#visual-lab
npm run preview:art
# production
npm run build
npm run preview
```

正式遊戲與 lab 共用 `presentation/World.tsx`、`Visual` adapter 及純規則引擎。Lab 不寫入正式存檔，可選三類細胞、單步／1×／2×／4×、正常／降低／略過、清除／存活分支及替換外觀。存活為受控展示，不宣稱 M2 已實作或為 M1 常見病程。

## 實際清單

| visualId／資產                   | 實際來源                                     | 尺寸半徑（世界單位）     | 狀態／動作                                                 |
| -------------------------------- | -------------------------------------------- | ------------------------ | ---------------------------------------------------------- |
| cell.macrophage.v1               | `src/rts/presentation/visuals.tsx`／SVG path | 30                       | 佔位；軟膜、腎形核、局部待機、接觸、包覆、囊泡、分解／活菌 |
| cell.neutrophil.v1               | 同上                                         | 23                       | 佔位；分葉核、顆粒、局部待機、趨化、吞噬                   |
| cell.dendritic.v1                | 同上                                         | 30，突起較寬             | 佔位；連續漸細輪廓、攜抗原、成熟／遷移                     |
| pathogen.spn.v1                  | 同上                                         | 約 16，負荷以 1–4 對代表 | 佔位；莢膜雙球對、補體 Y 標記／抗體 Y 標記、負荷密度       |
| tissue／vessel／lymph outlet     | `src/rts/presentation/World.tsx`             | 1000 × 680               | 佔位；連續低對比隔壁、血管、內皮虛線、出口、局部損傷       |
| CXCL8 overlay                    | 同上，讀取權威 25 × 17 網格                  | 每格 40                  | 真實場平滑覆層、來源標記，無傷害作用                       |
| engulf／arrive／opsonize／result | 同上、`visuals.tsx`、`ui/style.css`          | 依相同世界比例           | 不同階段幾何、跨內皮位移、標記沉積、結算入場               |
| replacement example              | `presentation/replacement-example.tsx`       | 沿用原錨點               | 巨噬外觀 B 調色，其餘委派原 provider                       |
| site mark                        | `public/assets/mark.svg`                     | UI favicon               | 沿用 repo 的標誌；不當正式細胞模型                         |

版本為 manifest `version: 1`。可編輯來源就是 TSX／CSS，沒有未提供的 Blender 或透明圖片素材包。Manifest 集中於 `visuals.tsx`，記錄來源、原創專案程式授權狀態、佔位及動作清單；未加入未核實的第三方資產授權。後續新增檔案要記錄其原始檔、匯出物、來源與授權。

## Adapter API 與替換

`VisualProvider.render(VisualPose): ReactNode` 是唯一角色外觀入口；`setVisualProvider(provider)` 切換實作，舊 provider 的 `dispose?()` 與新 provider 的 `reset?()` 處理快取。預設為無持久資源的純 SVG，因此 React mount／props update／unmount 負責建立、更新、播放、重設及釋放。同步產圖失敗退回佔位 provider。若改為異步素材，載入期間及失敗必須保留相同可辨識 fallback，並在 dispose 釋放 texture／動畫資源。

`VisualPose` 提供 ID、visualId、phase、progress（0–1）、純視覺 time（秒）、降低動態、調理、負荷、抗原／囊泡及選取狀態。沒有規則回呼。引擎權威狀態每 0.2 模擬秒推進，展示按已提交階段呈現，不在動畫完成時修改負荷、資源或結果。事件 ID 只用於因果紀錄；持續動作直接由 `since/until` 與 step 推導，沒有可二次扣點的播放器佇列。讀檔重新投影目前階段，不重播規則事件。

範例 `exampleProvider` 只覆寫巨噬 visualId 的顏色，其餘轉交 `placeholderProvider`。Lab「切換替換外觀 A/B」會實際套用，瀏覽器測試比較切換前後完整權威 JSON 完全相同。逐角色替換不需要改引擎、平衡、AI 或 schema。

## 空間與錨點

- SVG 世界 X 向右、Y 向下，中心錨點 `(0,0)`，固定觀察平面；以橢圓、柔和漸層及陰影表現 2.5D 深度。沒有自由旋轉或透視相機。
- 地圖 1000 × 680；組織通行面是開放連通區 `x=35..965, y=35..500`，血管在下方。這個切片沒有需繞行的內部障礙；路徑為合法平面上的連續直線，不以區域格位替代。
- 桌面預設 fit 1×；窄螢幕預設 fit ×1.5，縮放 0.65–2.3。相機平移使用 CSS px，所有圖層共用同一 transform；拖 `(80,40)` 就平移 `(80,40)`。不設地圖邊界夾限，可重設鏡頭。
- `visualAnchors`：origin `(0,0)`、contact `(34,0)`、pseudopod `(10,0)`、vesicle `(13,8)`、status `(20,-19)`、selection `(0,0)`。包覆層依目標方向旋轉，吞入由接觸錨點移至胞內囊泡；核與主要囊泡保持膜內。
- 模擬接觸距離目前 34；它是規則，不能隨美術半徑改變。畫面細胞選取半徑 35、病原 27，密集目標以名單明確選取。外觀過大需調 presentation 選取邊界／標記，不能擴大規則作用距離。

## 動作契約

| 語義／權威 phase               | 行為、循環與中斷                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------- |
| idle／patrol                   | 依 ID 獨立相位的膜面局部起伏、核內結構及輕浮；只用視覺 time，不用規則 RNG；可循環 |
| move／approach／chemotaxis     | 權威連續位置與目的線；局部膜動態保留，各單位並行；沒有全局鎖                      |
| contact                        | 5 步接觸辨識；低效莢膜嘗試可能回到 cooldown                                       |
| wrap                           | 8 步連續偽足弧線包覆與膜合攏；目標在吞入前仍為胞外                                |
| ingest                         | 7 步，囊泡從接觸點向胞內移動；吞入仍不等於清除                                    |
| digest／clear                  | 12 步，囊泡內碎片縮小，權威 clear 後退場                                          |
| survive／intracellular-alive   | 囊泡保留青色活菌與狀態；負荷仍存在，阻止誤勝；受控示範                            |
| opsonized                      | 表面 Y 標記依 opsAt 沉積；補體金、蛋白抗體紫，持續可讀；不以閃光殺菌              |
| signal                         | 辨識來源局部虛線釋放，覆層讀實際擴散場；接收者狀態可查                            |
| arrive／extravasate            | 等待內皮→血管動員→沿邊界擠出；從血管位置到場，再前往支援點／趨化                  |
| antigen-carry／mature／migrate | 攜抗原角標、成熟等待、前往出口，離開組織後保留交通流程                            |
| result                         | 凍結生理時間；入場卡片、感染控制／組織與損傷來源、星等                            |

暫停時純膜待機可繼續，規則動作 progress 不前進。降低／略過取消漂浮與持續膜變形，仍保留各階段、標記與結果，不能刪規則步。新移動命令在正在攝入的細胞上等待共用作用機會完成；被吞入／清除的優先目標失效後恢復自主。卸載／重開 Lab 重設 provider；React 重繪不提交規則。

## 後續精修與限制

目前是乾淨的低成本幾何佔位；不宣稱已具備最終參考圖的微透膜、體積光、精細胞器、真實肺泡深度或 C 材質。待精修：更自然的巨噬偽足與 DC 分枝、膜與胞器分層、連續吞噬膜面、移動前緣伸展、自然肺泡隔壁、各負荷的代表密度／LOD、跨內皮擠壓、局部損傷紋理、手機字級與鏡頭閱讀。先逐角色替換，再重測遊戲尺度與近景。

所有正式素材用 import 或 `import.meta.env.BASE_URL`；不得引入本機絕對路徑或網域根目錄假設。新增外部圖像要驗 404、透明排序、記憶體釋放、選取對位及 1×／4× 效能。效能依本次 headless 紀錄，不宣稱實體手機達到目標 FPS。
