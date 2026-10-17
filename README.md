# Immuminati

可玩 M1（肺炎鏈球菌，佔位美術）的混合型 RTS＋可暫停即時戰略。

[直接遊玩 GitHub Pages](https://sces5504.github.io/Immuminati/) · [主規格 v2.0](docs/Immuminati-spec.md) · [實作與驗證紀錄](docs/RTS-M1-DELIVERY.md) · [素材替換交接](docs/RTS-ART-HANDOFF.md)

細胞自主偵測、移動、接觸與吞噬。玩家隨時暫停，安排調理、募集、位置／目標及反應政策。CXCL8 擴散場影響趨化，內皮決定募集啟動；蛋白抗原 DC→T→B→抗體經多階段與交通延遲支援。沒有回合 AP 或同區單位名額。

## 啟動

Node 24（已實測），npm lockfile 固定依賴。

```sh
npm ci
npm run dev
# http://localhost:5173/Immuminati/
npm run verify
npx playwright install --with-deps chromium
npm run test:browser
npm run test:animation
npm run build
npm run preview
# http://localhost:4173/Immuminati/
```

獨立素材預覽：`/Immuminati/#visual-lab`，或 `npm run preview:art`。可單步看包覆／吞入／清除與受控胞內存活、調整速度／動態及切換替換 provider。

## 操作

- 點選細胞或使用「細胞名單」明確選取密集對象。選細胞後「移動到此」，再點戰場；拖曳只平移，不下令。
- 拖右時地形也向右；桌面與觸控共用相同螢幕座標。按鈕可放大、縮小及重設。
- 點選病原使用有限補體調理；其表面標記與後續吞噬分開。募集先選支援位置，再等待活化內皮、血管動員與到場。
- 暫停時可規劃多指令、撤銷；恢復時依序提交。速度 1×／2×／4×，百科等遮擋面板與背景切換安全暫停。
- 淋巴結查看抗原與各階段等待。支援不能跳過成熟、遷移、活化、分化或交通。
- 本機自動續玩、JSON 匯入／匯出；新 key 為 `immuminati:rts:v3`，保留舊 v1／tactics v2，不轉換不同規則的舊局。

## 範圍與架構

`src/rts/{domain,content,engine,application,presentation,ui,persistence}` 分離。引擎固定 0.2 秒、明確種子與帶步號指令；動畫不決定規則結果。第一階段使用原創 SVG 2.5D 可替換佔位，精緻 C 美術由後續 agent 接手，核心動作已在本階段實作。

M1 可玩；M2–M6 題材／百科開場可查，入口明示開發中。舊 `src/tactics`、舊測試與歷史證據保留，不是新規格完成證據。`npm test` 僅執行新的 RTS 測試，舊測試保留為 `npm run test:legacy`。

CI 在 main 驗證後部署至 Pages `/Immuminati/`，另跑公開頁面操作檢查。實際執行環境、畫面／影片、測試結果與限制見本次交付紀錄；觸控模擬不是實體手機驗證。
