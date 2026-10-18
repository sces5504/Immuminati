# 名稱與細胞避讓局部證據

2026-10-18；遊戲程式來源 `ff62c59`。未執行其他關卡整局策略或完整回歸矩陣。

- `results.json`：桌面1440×1000、直向手機390×844，共14項局部檢查。六關逐一選取病原，檢查正式名稱、感染負荷及標題寬度；另各以真實UI命令兩個巨噬細胞移到相同權威座標，確認可分開顯示與選取、1×／2×保持原結算。
- 第一輪桌面操作時，避讓仍先檢查地形再檢查空間桶；之後只將順序交換以減少擁擠時無用計算，名稱UI與尋位結果未變。手機全部檢查使用該最終最佳化建置；`spacing-final.json` 另記錄最終建置桌面避讓補查。
- `desktop-pathogen-name.png`／`mobile-pathogen-name.png`：病原名稱與副標題。
- `desktop-separated-cells.png`／`mobile-separated-cells.png`：兩個巨噬細胞權威位置相同，展示層自然分開；桌面圖由最後補查更新。
- `performance.json`：同點擁擠的純函式20次計算；`npx vite-node docs/evidence/cell-layout/profile.ts` 可重做量測。屬雲端CPU，非真機或瀏覽器FPS。

使用 Chromium 的軟體 WebGL；沒有實體 iPhone／Android 實測。空間不足時仍容許重疊；沒有強制名額或物理碰撞。

[發布39104837457](https://github.com/sces5504/Immuminati/actions/runs/39104837457) 建置／部署成功，HEAD `a32fd98`；`public-assets.json` 記錄公開站HTML引用的4資產皆與本機正式建置逐位元相同。公開站未另跑完整遊玩矩陣。
