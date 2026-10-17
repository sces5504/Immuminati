# 六關畫面與動畫證據

來源 `f004bdf`，發布工作流 [39063810584](https://github.com/sces5504/Immuminati/actions/runs/39063810584)。以下是本輪重新執行正式建置產生的畫面，不使用舊影片；桌面與手機每關都經實際 UI 通關／有限結算、返回續玩及資產檢查。結算圖及短片包含結果。

| 關卡 | 桌面 | 直向手機 | 實際結果（兩裝置一致） |
|---|---|---|---|
| M1 肺炎鏈球菌 | [戰場](desktop-m1/desktop-m1-start.png) · [作戰](desktop-m1/desktop-m1-action.png) · [結算](desktop-m1/desktop-m1-result.png) · [18秒短片](desktop-m1/highlights.webm) | [戰場](mobile-m1/mobile-m1-start.png) · [作戰](mobile-m1/mobile-m1-action.png) · [結算](mobile-m1/mobile-m1-result.png) · [18秒短片](mobile-m1/highlights.webm) | 3 星 · 保全 88% · 83 秒 |
| M2 鼠傷寒沙門氏菌 | [戰場](desktop-m2/desktop-m2-start.png) · [作戰](desktop-m2/desktop-m2-action.png) · [結算](desktop-m2/desktop-m2-result.png) · [18秒短片](desktop-m2/highlights.webm) | [戰場](mobile-m2/mobile-m2-start.png) · [作戰](mobile-m2/mobile-m2-action.png) · [結算](mobile-m2/mobile-m2-result.png) · [18秒短片](mobile-m2/highlights.webm) | 3 星 · 保全 90% · 102 秒 |
| M3 結核分枝桿菌 | [戰場](desktop-m3/desktop-m3-start.png) · [作戰](desktop-m3/desktop-m3-action.png) · [結算](desktop-m3/desktop-m3-result.png) · [18秒短片](desktop-m3/highlights.webm) | [戰場](mobile-m3/mobile-m3-start.png) · [作戰](mobile-m3/mobile-m3-action.png) · [結算](mobile-m3/mobile-m3-result.png) · [18秒短片](mobile-m3/highlights.webm) | 3 星 · 保全 95% · 82.2 秒 |
| M4 流感 A | [戰場](desktop-m4/desktop-m4-start.png) · [作戰](desktop-m4/desktop-m4-action.png) · [結算](desktop-m4/desktop-m4-result.png) · [18秒短片](desktop-m4/highlights.webm) | [戰場](mobile-m4/mobile-m4-start.png) · [作戰](mobile-m4/mobile-m4-action.png) · [結算](mobile-m4/mobile-m4-result.png) · [18秒短片](mobile-m4/highlights.webm) | 3 星 · 保全 87% · 130.6 秒 |
| M5 白色念珠菌 | [戰場](desktop-m5/desktop-m5-start.png) · [作戰](desktop-m5/desktop-m5-action.png) · [結算](desktop-m5/desktop-m5-result.png) · [18秒短片](desktop-m5/highlights.webm) | [戰場](mobile-m5/mobile-m5-start.png) · [作戰](mobile-m5/mobile-m5-action.png) · [結算](mobile-m5/mobile-m5-result.png) · [18秒短片](mobile-m5/highlights.webm) | 3 星 · 保全 99% · 78.2 秒 |
| M6 HIV | [戰場](desktop-m6/desktop-m6-start.png) · [作戰](desktop-m6/desktop-m6-action.png) · [結算](desktop-m6/desktop-m6-result.png) · [18秒短片](desktop-m6/highlights.webm) | [戰場](mobile-m6/mobile-m6-start.png) · [作戰](mobile-m6/mobile-m6-action.png) · [結算](mobile-m6/mobile-m6-result.png) · [18秒短片](mobile-m6/highlights.webm) | 有限觀察／無星等 · 81.4 秒 |

短片從同一份連續遊玩錄影剪成開場指揮、早期反應、後期反應與結算四段，未生成或替換遊戲畫面。[剪輯時間表](clip-edits.json)保留原始影片長度與取樣時段；[來源與完整影片連結](provenance.json)保留 Actions artifact ID、ZIP雜湊及每關驗證結果。完整連續影片仍保存在該工作流的各關 artifact。

## 分子與吞噬近拍

[36秒動畫近拍](animation/highlights.webm) · [C3b 灑落](animation/complement-flight.png) · [C3b 沉積](animation/complement-attached.png) · [Y 抗體移近](animation/antibody-flight.png) · [Y 抗體附著](animation/antibody-attached.png) · [吞噬清除](animation/engulf-clear.png) · [胞內存活](animation/engulf-survival.png)。

這段使用明確標示的開發 fixture，只驗證獨立動畫與事件展示；六關完成證據是上方各關真正遊玩的錄影與存檔，不能以 fixture 取代。

## 手機 UI 與胞內剖視

[紅圈文字／按鈕修正](regression/clarity-mobile/mobile-overflow-fixed.png) · [有庫存直接使用抗體](regression/clarity-mobile/mobile-antibody-attached.png)。UI 庫存及清空當波為明示版面 fixture，不作通關證據。

[12次實際胞內／健康剖視](../campaign-compartments/results.json)：每關兩裝置都先實際遊玩，選取真正在處理／持續存活的吞噬體，或核內病毒／HIV潛伏宿主，再選健康宿主確認負荷0；未注入感染狀態。

- M1：[桌面剖視](../campaign-compartments/desktop-m1-cutaway.png)／[手機剖視](../campaign-compartments/mobile-m1-cutaway.png)
- M2：[桌面剖視](../campaign-compartments/desktop-m2-cutaway.png)／[手機剖視](../campaign-compartments/mobile-m2-cutaway.png)
- M3：[桌面剖視](../campaign-compartments/desktop-m3-cutaway.png)／[手機剖視](../campaign-compartments/mobile-m3-cutaway.png)
- M4：[桌面剖視](../campaign-compartments/desktop-m4-cutaway.png)／[手機剖視](../campaign-compartments/mobile-m4-cutaway.png)
- M5：[桌面剖視](../campaign-compartments/desktop-m5-cutaway.png)／[手機剖視](../campaign-compartments/mobile-m5-cutaway.png)
- M6：[桌面剖視](../campaign-compartments/desktop-m6-cutaway.png)／[手機剖視](../campaign-compartments/mobile-m6-cutaway.png)

[公開站12次實玩](public-playthroughs.json)與[36項介面／操作回歸](public-regression.json)亦全部通過。

[公開站資產逐檔比對](public-assets.json)驗證 `/Immuminati/` 路徑、JS、Three.js、CSS 與圖示均為同一正式建置。[完整實測紀錄](../../CAMPAIGN-VERIFICATION.md)包含公開站驗證與限制。
