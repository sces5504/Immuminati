# Immuminati · 微觀防線

一款回合制免疫指揮遊戲，採 TypeScript、Vite、React，以及獨立規則引擎與事件式動畫。

目前交付 **M1「莢膜防線／肺炎鏈球菌」**：三個相連肺部區域、共用 AP、多指令、調理與吞噬、細胞自動行為、調度及增援、組織損傷與保全星等。M2–M6 自首頁可查閱但明示開發中；沒有解鎖鏈或永久戰力升級。

## 執行

需要 Node 24。

```sh
npm ci
npm run dev
```

開啟 `http://localhost:5173/Immuminati/`。

```sh
npm run verify       # 規則／存檔／播放器測試、型別與 production build
npm run preview      # http://localhost:4173/Immuminati/
npx playwright install --with-deps chromium
npm run test:browser # 桌面／360px 手機完整操作、截圖與錄影
npm run test:animation # 偽足包覆、清除／胞內存活展示契約
```

## 怎麼玩

1. 選擇 M1。點選雙球菌，花 1 AP 施加調理；標記不直接殺菌。
2. 同區細胞在回合末自動吞噬。巨噬／嗜中性球對已標記來源效率更好；也可花 2 AP 主動吞噬，再安排移動。
3. 點選細胞調度，或點區域招募。增援會預留容量、等待 1–2 次結算。
4. 結束回合依序播放細胞、病原、組織與等待結果；可加速或跳過，結果相同。
5. 清除感染且保住三區取得勝利。組織保全 ≥85% 三星、≥60% 二星。每回合未結算前可撤銷；本機自動續玩，設定內可匯出／匯入。

百科可隨時查閱全部九種角色、六種病原、機制來源與簡化範圍。

## 文件與證據

- [規格入口](AGENTS.md)／[主規格](docs/Immuminati-spec.md)／[C 美術規格](docs/art-direction/C-art-and-animation.md)
- [實作、數值、存檔與擴充指南](docs/IMPLEMENTATION.md)
- [素材來源、完成狀態與動畫映射](docs/ART-MANIFEST.md)
- [實際驗證結果與限制](docs/VALIDATION.md)
- [桌面畫面](docs/evidence/desktop-field.png)／[手機畫面](docs/evidence/mobile-field.png)
- [桌面通關錄影](docs/evidence/desktop-m1.webm)／[手機通關錄影](docs/evidence/mobile-m1.webm)／[吞噬分支錄影](docs/evidence/engulf-branches.webm)

GitHub Pages base 為 `/Immuminati/`，main 的 Actions 會在驗證通過後發布 dist；需於 repository Pages 設定使用 GitHub Actions。遠端是否已發布請以驗證紀錄為準。
