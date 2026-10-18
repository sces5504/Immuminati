# Tripo 首批樣本：本輪實際證據

2026-10-18，獨立 `art/tripo-samples` 分支，尚待使用者確認；不代表已完成全美術重置。只跑與本次模型、載入、點選與動畫接點相關的檢查。

- 17項相關Vitest通過（Tripo素材預算／形變／貼地／取消／失敗回退6項，避讓8項，點選優先序3項）。型別檢查、獨立預覽相對資產建置，以及一般未啟用樣本的建置通過。
- `results.json`／`browser.log`：實際Chromium桌面1440×1000及觸控模擬390×844。透過原部署UI配置三種細胞，讀入三份真實GLB；原模型／Tripo切換、細胞選取與移動、C3b與吞噬、暫停、2×及降低動態通過。切換及暫停下調整展示時權威state逐值相同，各場景三份GLB只各下載一次。沒有注入通關狀態。
- `desktop-sample.png`／`desktop-original.png`、`mobile-sample.png`／`mobile-original.png`：同構圖的樣本與原版；`*-after-engulf.png`為實際遊玩後畫面。
- `desktop-motion.webm`／`mobile-motion.webm`：本輪操作原片各截約20秒，包含指令／C3b、待機與吞噬過程；原片時間點在results的actionStart前4秒，未沿用舊片。原片保留本機忽略路徑 `*-raw.webm`。
- `mobile-fallback.png`：主動讓三份GLB請求失敗，回退原版仍可選取，沒有runtime error。

最終場景的render統計（非FPS）：桌面樣本229026／原版200380三角形，draw calls同為209；手機樣本227330／原版198684，draw calls同為197。樣本約增加14.3%三角形；組織只示範A區，貼地後靜態合批，細胞幾何／貼圖共享。這是雲端軟體WebGL，不是實體手機GPU效能認證。

曾在第一版圖發現組織片段穿入舊地形；已改為逐頂點貼地後合批並重新驗證。此目錄保留的是修正後的截圖、結果及影片。費用、來源、模型預算與尚未完成項目見 [樣本紀錄](../../art/tripo-samples/README.md)。預覽發布結果另在交接追加。

遊戲來源 `bd4b0b1`；獨立私人Sites部署已成功，未更動main或正式Pages。部署ID／版本與GitHub PR見 `docs/art/tripo-samples/preview.json`。沒有把本輪局部通過說成完整六關／實體手機驗證。
