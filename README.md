> v3.1 更新：新局先選知識套組／自行配置（12部署點），手機戰場支援雙指縮放，移除略過動畫鍵。舊局保留原隊伍。[本輪進度與驗證](docs/DEPLOYMENT-AND-GESTURES.md) · [給美術建模組的交接 prompt](docs/ART-HANDOFF-PROMPT.md)。

# Immuminati · 微觀防線

[線上遊玩](https://sces5504.github.io/Immuminati/?v=f004bdf)。保留已確認的立體戰術 UI、指揮、鏡頭與 C「柔光微觀立體」風格；沒有另做整套 RTS。

六關從開場全可選，使用同一套規則／展示架構：

| 關卡 | 核心 |
|---|---|
| M1 肺炎鏈球菌 | 莢膜、補體／抗體調理、吞入與胞內殺菌 |
| M2 鼠傷寒沙門氏菌 | 腸黏膜、巨噬含菌囊泡、Th1／IFN-γ |
| M3 結核 | 肺部既存感染焦點、圍堵及組織保全，不要求滅菌 |
| M4 流感 A | 胞外病毒、上皮感染、IFN-I、NK、DC 交叉呈遞與 CD8 |
| M5 白色念珠菌 | 口腔上皮、酵母／菌絲、Th17／ILC3 與顆粒防禦 |
| M6 HIV | 淋巴組織、易感／產毒／潛伏宿主、CD4 免疫支援 |

14 種免疫細胞／狀態可募集或分化：巨噬、嗜中性、DC、一般 helper T、Th1、Tfh、Th17、CD8、B、漿細胞、NK、Treg、pDC、ILC3。無同區或全場單位名額限制，保留反應資源與到場等待；新局自動尋敵預設開、手動移動優先，可隨時暫停或切換2×。

補體黃三葉與抗體綠 Y 有各自的模型、移近／灑落／附著動畫及期限。有抗體庫存直接指定目標；獨立 ⓘ 說明蛋白抗原的同源 T–B 對接及分化等待。頁首「回主頁」會保存並暫停當前局。關內保留教學、百科、因果紀錄、組織與胞內剖視、本機續玩及匯入／匯出。

[本輪實作與生物學依據](docs/CAMPAIGN-IMPLEMENTATION.md)／[本輪實測、畫面與動畫證據](docs/CAMPAIGN-VERIFICATION.md)／[接續交接](docs/CLOUD-HANDOFF.md)。免疫數值與時間為教學抽象；模型為可替換程序素材，未含完整全身反應、胚中心或專業美術精修。實體 iPhone Safari／Android GPU 尚待驗證。

## 啟動

Node 24，依賴鎖定於 package-lock.json：

```sh
npm ci
npm run dev
```

開啟 `http://localhost:5173/Immuminati/`。正式建置以 `/Immuminati/` 作為 Pages 子路徑。

```sh
npm run verify
npm run preview
npx playwright install --with-deps chromium
npm run test:browser
npm run test:animation
npm run test:immune
npm run test:anatomy
npm run test:clarity
npm run test:campaign
npm run test:campaign-ui
node scripts/campaign-compartments.mjs
```

`DEVICE=desktop|mobile`、`CASE=m1|...|m6` 可限定六關驗證；`TARGET_URL` 指向公開站則驗證實際發布版本。受控時鐘在載入遊戲前安裝／暫停，仍透過正式 UI 與 RAF 固定步進，沒有注入通關狀態。胞內剖視檢查使用實際遊玩累積的病原來源。

## 接續與相容性

先讀 [AGENTS.md](AGENTS.md)、[現行規格](docs/Immuminati-spec.md)、[美術規範](docs/art-direction/C-art-and-animation.md) 與 [交接](docs/CLOUD-HANDOFF.md)。正式入口為 `src/tactics`，維持 TypeScript＋Vite＋React＋Three.js 的 domain／content／engine／application／presentation／UI／persistence 分層。

存檔 schema2、規則3.0、內容campaign.1；舊2.0–2.4的 state／undo 顯式遷移，保留原本尋敵選擇與進度，另留原文備份，不刪歷史 key。M3 控制感染與 M6 特殊有限結果的定義見主規格與實作文件；不要改成六關全部清場勝利。

歷史 [v2.4 UI 精簡](docs/UI-CLARITY.md)、[胞內區室](docs/TISSUE-COMPARTMENTS.md)、[v2.2 免疫擴充](docs/IMMUNE-EXPANSION.md) 與 [立體基準](docs/TACTICAL-VALIDATION.md) 供追溯，舊測試數字及影片不能當作本輪通過證據。
