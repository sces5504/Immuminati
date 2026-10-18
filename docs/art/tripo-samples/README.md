# TripoAI 第一批遊戲建模樣本

本分支 `art/tripo-samples` 由 main `36a1f39` 建立。這是待使用者審閱的樣本，**不代表全遊戲美術重置完成，也不合併 main／發布正式 Pages**。確認方向後才能擴充；正式合併另等使用者核准。

## 素材與費用

已實際呼叫 Tripo v3 API H3.1文字建模三次，每件20 credits，共60 credits。沒有付費重試、高清、綁骨、重拓樸或追加模型。原提示、參數、任務ID、實際費用保留在三份 `*-request.json` 與 `tasks.json`；沒有金鑰或帶簽名下載網址。

素材為使用者授權的 Tripo 帳戶生成，依 [Tripo 使用條款](https://developers.tripo3d.ai/en/terms) 使用，未另行聲稱 CC0 或專業醫學建模認證。參數／收費核對：[官方文字建模](https://developers.tripo3d.ai/en/docs/generation-text-to-model/standard)、[官方價格](https://developers.tripo3d.ai/en/pricing)。

- 巨噬細胞：Tripo獨立外膜／短偽足，遊戲保留可獨立讀取的彎曲核與吞噬體。
- 嗜中性球：Tripo獨立外膜，遊戲保留分葉核／連絲與顆粒。
- 肺泡隔：Tripo短組織模組，僅在M1入口A區示範。依現行地形逐頂點彎曲／貼地後合批，不更改可行走範圍、通道、宿主ID、血管或點選。B/C區保留原外觀作參考，並非整張地圖重做完成。

三份正式GLB合計約1.6 MiB；細胞各不超過4000三角形、地圖模組不超過3000，單材質、512px內嵌貼圖。確切數字在 `public/assets/tripo/manifest.json`。本機Blender清理法線、平滑、縮貼圖、調尺寸，並為兩種膜加入獨立GPU morph；沒有額外API費用。原始高解析輸出留在忽略的 `.art-source/`，由 `scripts/prepare-tripo-samples.py` 可重作轉換。

## 接點與回退

`TripoSamples.ts` 的每個場景每素材只載入／解碼一次；各細胞共用幾何與貼圖，材質與morph權重獨立。仍由既有Actor body播放漂浮／呼吸與既有偽足吞入事件，不由模型或動畫回呼改規則。局部剖視／肖像保留原有權威結構示意，這批尚未重做。

僅 `VITE_ART_PREVIEW=tripo` 且M1啟用樣本；首頁與設定提供原版比較，切換不寫戰鬥狀態或存檔。一般建置預設保持原模型。資產錯誤／超出預算保留原模型，場景拆除會中止未完成請求並釋放幾何、材質及貼圖。展示避讓用本批外膜尺寸，維持有限鄰近搜尋；不改引擎。

本批展示半徑在 `TripoSamples.ts` 的 `SAMPLE_RADII`，原模型仍用 `cellLayout.ts` 預設值；修改輪廓後需同步更新，最大直徑不得超過空間桶寬度，保持鄰近搜尋邊界正確。

## 啟動與檢查

`VITE_ART_PREVIEW=tripo npm run dev` 可在開發環境預覽。`node scripts/build-art-preview.mjs` 建置可放在獨立根目錄或 `/Immuminati/` 子路徑的相對資產版本。此命令只建置，絕不呼叫Tripo API。

相關單元檢查：

```sh
npx vitest run tests/tactics/tripoSamples.test.ts tests/tactics/cellLayout.test.ts tests/tactics/selection.test.ts
npm run typecheck
node scripts/build-art-preview.mjs
PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright node scripts/tripo-samples-acceptance.mjs
```

僅針對素材預算／貼地／形變／中斷回退、模型點選、視覺避讓、切換、移動、C3b／吞噬、1×／2×與降低動態；沒有跑完整六關回歸矩陣。瀏覽器最終結果、同構圖原版／樣本與短片見 `docs/evidence/tripo-samples/`，最終發布／待審閱狀態另補交接。

此批是遊戲尺寸下的程序結構＋生成外膜樣本；仍待真人審美回饋、實體手機GPU驗證與後續全部器官／角色美化。不得把Chromium觸控模擬或雲端軟體WebGL當成真機效能認證。
