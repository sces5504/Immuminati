# Immuminati · 微觀防線

**保留已發布立體戰術版的 UI、畫面、操作與整體風格，並依本輪八項需求改善組織／細胞模型及免疫機制。** 使用者已撤回從頭 RTS 重建與替換佔位模型的安排；`src/tactics` 是正式入口，原版不是待淘汰的畫面。

[線上遊玩](https://sces5504.github.io/Immuminati/)。保留程式基準為 `d2c16ab`，畫面與影片見 `af6bcb3` 的證據；`6e1d5f7` 已回退另一次 RTS 重製。本輪 `814243e` 已發布並完成桌面／手機公開操作與資產驗證；詳見[交付紀錄與畫面／短片](docs/IMMUNE-EXPANSION.md)。

## 開發入口

1. [開發指引](AGENTS.md)
2. [現行主規格 v2.2](docs/Immuminati-spec.md)
3. [展示保留與動畫規格](docs/art-direction/C-art-and-animation.md)
4. [交接與下一個 AI 的工作說明](docs/CLOUD-HANDOFF.md)

維持可暫停立體戰術操作。本輪加入自動尋敵、戰場 2×、9 種細胞、PRR／局部訊號、抗原呈遞與適應性抗體流程、Treg 調節，以及十步互動教學。肺泡組織與細胞形態同步改善；[實作、驗證與限制](docs/IMMUNE-EXPANSION.md)。既有[拖曳／無名額修正](docs/TACTICAL-REFINEMENT.md)保留。M2–M6 尚未製作。

## 執行與驗證

現有專案以 Node 24、package-lock.json 鎖定依賴：

```sh
npm ci
npm run dev
```

開啟 `http://localhost:5173/Immuminati/`。目前驗證與預覽命令：

```sh
npm run verify
npm run preview
npx playwright install --with-deps chromium
npm run test:browser
npm run test:animation
npm run test:immune
```

Production preview 預設 `http://localhost:4173/Immuminati/`。這些測試覆蓋既有立體戰術版；改規則時同步更新相應斷言，並保留其餘回歸檢查。手機瀏覽器腳本是 viewport／touch 模擬，不等同真機測試。

## 歷史資料與相容性

- [立體戰術基準決策](docs/TACTICAL-REDESIGN.md)／[其實作與驗證](docs/TACTICAL-VALIDATION.md)
- [首版實作](docs/IMPLEMENTATION.md)／[首版驗證](docs/VALIDATION.md)
- [ImmuneQuest 截圖參考觀察](docs/art-direction/ImmuneQuest-reference-review.md)
- [基準桌面](docs/evidence/tactics/desktop-field.png)／[手機](docs/evidence/tactics/mobile-field.png)／[基準短剪輯](docs/evidence/tactics/m1-highlights.webm)

基準截圖與影片用於確認原體驗保留；歷史測試結果不能作後續改動已通過的證據。舊存檔 `immuminati:save:v1` 與 `immuminati:tactics:v2` 必須保留；玩法改動先確認相容性，不靜默轉換或覆寫不同規則的存檔。

Pages base 維持 `/Immuminati/`。程式修改後驗證資產、重新整理及公開網址；純文件變更不重新部署遊戲。
