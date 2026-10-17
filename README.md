# Immuminati · 微觀防線

**下一版改為「混合型 RTS ＋ 可暫停即時戰略」。** 2026-10-17 本次先更新規格，供另一個 AI 從頭重建；新玩法尚未實作。C「柔光微觀立體」風格保留，但目前模型需改善，地圖拖曳需修正，區域單位上限取消。

## 新版開工入口

1. [開發指引 AGENTS.md](AGENTS.md)
2. [唯一現行玩法規格 v2.0](docs/Immuminati-spec.md)
3. [C 美術、建模改善與動畫規格 v2.0](docs/art-direction/C-art-and-animation.md)
4. [交接與可直接貼給新 AI 的開工 prompt](docs/CLOUD-HANDOFF.md)
5. 實際檢視 [C 參考圖](docs/art-direction/c-soft-micro-3d.png)；圖中的回合／AP 介面不是新規則。

新版目標是自主細胞 AI、訊號場與趨化、延遲募集、發炎取捨、連動淋巴結，以及隨時暫停與 1×／2×／4×。玩家協調反應，也能指揮關鍵單位；沒有同區格位或容量預留。先交付完整可玩的 M1，再擴充指定六關；最終全部開場可選，沒有永久戰力升級或裝備。

## 目前公開版本是舊原型

[GitHub Pages 舊原型](https://sces5504.github.io/Immuminati/) 仍可開啟。它的 `src/tactics`、每區／全場名額、模型、速度與流程不符合 v2.0，不代表新的 RTS 已完成；新規格不會因本次文件修改自動出現在網頁。

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
```

Production preview 預設 `http://localhost:4173/Immuminati/`。這些測試目前驗證舊原型，重建時需依 v2.0 更新，不以保住舊容量斷言為目標。手機瀏覽器腳本是 viewport／touch 模擬，不等同真機測試。

## 歷史資料與相容性

- [舊即時戰術原型決策](docs/TACTICAL-REDESIGN.md)／[其實作與驗證](docs/TACTICAL-VALIDATION.md)
- [首版實作](docs/IMPLEMENTATION.md)／[首版驗證](docs/VALIDATION.md)
- [ImmuneQuest 截圖參考觀察](docs/art-direction/ImmuneQuest-reference-review.md)
- [舊原型桌面](docs/evidence/tactics/desktop-field.png)／[手機](docs/evidence/tactics/mobile-field.png)／[舊短剪輯](docs/evidence/tactics/m1-highlights.webm)

歷史截圖、影片及測試結果不作新版品質或完成證據。舊存檔 `immuminati:save:v1` 與 `immuminati:tactics:v2` 必須保留；新規則採獨立 schema／key，不靜默轉換或覆寫。

Pages base 維持 `/Immuminati/`。重建後需驗證資產、重新整理及公開網址；本次只有文件變更。
