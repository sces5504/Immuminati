# Immuminati · 微觀防線

**線上遊玩：[Immuminati／M1 莢膜防線](https://sces5504.github.io/Immuminati/)**

新版 M1 是可暫停的即時戰術遊戲。直接在連續立體組織戰場選取細胞、指定菌群或防守位置，運用調理與增援守住三波感染。細胞會沿通道移動，接近合法目標後自動吞噬；位置、距離、冷卻及感染擴散都有實際規則。

本次依使用者選擇將畫面、操作與玩法一起重做，取代首版的回合／4 AP。M2–M6 的入口與百科可查，但專用關卡仍開發中，沒有解鎖鏈或永久戰力升級。

## 執行與驗證

Node 24，依賴版本由 package-lock.json 鎖定。

```sh
npm ci
npm run dev
```

開啟 `http://localhost:5173/Immuminati/`。

```sh
npm run verify
npm run preview
npx playwright install --with-deps chromium
npm run test:browser
npm run test:animation
```

Production preview 預設在 `http://localhost:4173/Immuminati/`。瀏覽器腳本會自行啟動 4175 埠，也可透過 BASE_URL 檢查已發布版本。雲端 headless 測試採 Chromium SwiftShader，不代表已測實體手機 GPU。

## 怎麼玩

1. 進入 M1，初始為戰術暫停。先點菌群、施加調理，再募集增援補強防區。
2. 點細胞再點菌群，指派吞噬目標；點地面或防區，調度位置。細胞接觸目標後自動作用。
3. 點「開始／繼續行動」推進時間，可隨時暫停。空白鍵切換暫停，Escape 取消選取。
4. 反應資源每 8 模擬秒恢復 1，上限 8。調理花 1，嗜中性球／巨噬募集花 3／4，5／8 秒後從血管到場。調理不直接減少感染。
5. 清場後可提前迎擊下一波，取得 1 資源；也可等待資源及增援。清除全部三波且三區存活才勝利。
6. 組織保全 ≥85% 三星、≥60% 二星。暫停時能撤銷部署，恢復行動後不能回溯戰鬥。

拖曳可平移鏡頭，右側按鈕可縮放、旋轉及重設。手機採直向戰場與下方指揮列；單位列與菌群標記提供穩定點按目標。百科及設定會安全暫停時間。

## 架構、存檔與證據

- [最新玩法及規格修訂](docs/TACTICAL-REDESIGN.md)
- [新版實作與驗證紀錄](docs/TACTICAL-VALIDATION.md)
- [ImmuneQuest 參考檢視](docs/art-direction/ImmuneQuest-reference-review.md)
- [原始六關內容規格](docs/Immuminati-spec.md)
- [新版桌面畫面](docs/evidence/tactics/desktop-field.png)／[手機畫面](docs/evidence/tactics/mobile-field.png)
- [實戰短剪輯](docs/evidence/tactics/m1-highlights.webm)
- [桌面錄影](docs/evidence/tactics/desktop-m1.webm)／[手機錄影](docs/evidence/tactics/mobile-m1.webm)／[立體吞噬分支](docs/evidence/tactics/engulf-branches.webm)

`src/tactics` 分離 domain、content、engine、application、presentation、persistence、ui。引擎固定步進且無瀏覽器相依，Three.js 展示層不計算傷害或扣資源。正式立體幾何及材質為本專案原創，不使用參考網站的角色或截圖素材。

新存檔為 `immuminati:tactics:v2`，包含暫停部署快照、事件、設定與表現，可匯出／匯入。舊版 `immuminati:save:v1` 保留，不能直接轉成不同規則的新局。

Pages base 為 `/Immuminati/`。main 的 Actions 在本機子路徑驗證通過後發布，live-pages 再直接操作公開網址。先前 `docs/VALIDATION.md` 與 `docs/IMPLEMENTATION.md` 為第一版歷史紀錄。
