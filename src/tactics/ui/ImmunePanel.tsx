import type { Cell, TacticalContent, TacticalState } from "../domain/model";
import { tissueProfiles } from "../content/tissues";
export function cellActivity(cell: Cell, s: TacticalState, c: TacticalContent) {
  const role = c.cells[cell.kind].role;
  if (cell.order.type === "move") return "手動調度優先，抵達後恢復自主反應。";
  if (role === "presenter" && cell.antigen)
    return "已捕捉蛋白抗原；成熟遷移並在引流淋巴結呈遞。";
  if (["helper", "bcell"].includes(role) && cell.activation !== "effector")
    return cell.activation === "activating"
      ? `活化／分化中，還需 ${Math.max(0, Math.ceil(((cell.activationAt ?? s.tick) - s.tick) * 0.2))} 秒。`
      : role === "helper"
        ? "前往淋巴結，等待相符 MHC-II 肽及共刺激。"
        : "前往淋巴結，等待蛋白抗原與已活化 T 細胞幫助。";
  if (role === "cytotoxic" && c.practice)
    return `預先活化 CD8，辨識 ${cell.antigen}；只對相符 MHC-I 感染宿主作用。`;
  if (role === "cytotoxic")
    return "M1 無相符 MHC-I 感染宿主；不攻擊胞外菌。可至機制演練實作。";
  if (role === "nk" && c.practice)
    return "辨識壓力高且 MHC-I 降低的宿主，形成突觸後誘導凋亡；保留健康宿主。";
  if (role === "nk")
    return "此區 IL-12 足夠時提供 IFN-γ；M1 無適合的感染宿主殺傷目標。";
  if (role === "regulatory")
    return "IL-10 調節局部發炎；不回血，也可能減弱促炎防禦。";
  if (role === "antibody")
    return "持續分泌蛋白抗原特異性抗體，後續調理仍須吞噬者。";
  return c.cells[cell.kind].description;
}
const stages = {
  idle: "等待樹突細胞捕捉蛋白抗原",
  migrating: "樹突細胞成熟／攜抗原引流",
  presenting: "淋巴結 MHC-II 呈遞＋共刺激",
  primed: "抗原呈遞就緒，可啟動 CD4 T → B 反應",
};
export function ImmunePanel({
  state: s,
  content: c,
  onPractice,
  onEntry,
}: {
  state: TacticalState;
  content: TacticalContent;
  onPractice: () => void;
  onEntry: (id: string) => void;
}) {
  return (
    <div className="t-immune-panel">
      <p>
        <b>{tissueProfiles[c.tissue].name}</b> ·{" "}
        {tissueProfiles[c.tissue].structure}
        。地圖是肺泡腔的開放剖視；單位與距離不按真實比例。
      </p>
      <section>
        <h3>先天反應正在爭取時間</h3>
        <p>
          PRRs／TLRs 辨識微生物模式 → CXCL8／IL-12 → 招募與活化。CXCL8 ≥20
          時，該區嗜中性球到場等待縮短 1 秒；IFN-γ ≥20 時，巨噬吞噬效能
          +1，並增強囊泡內清除。訊號不是傷害法術。
        </p>
        <div className="t-signal-grid">
          {c.fields.map((f) => (
            <article key={f.id}>
              <h4>{f.name}</h4>
              {Object.entries(s.immunity.signals[f.id]).map(([key, n]) => (
                <label key={key}>
                  {
                    (
                      {
                        cxcl8: "CXCL8 趨化",
                        il12: "IL-12 活化 NK",
                        ifng: "IFN-γ 巨噬活化",
                        il10: "IL-10 調節",
                        inflammation: "發炎程度",
                      } as Record<string, string>
                    )[key]
                  }
                  <meter min="0" max="100" value={n} />
                  <b>{Math.round(n)}</b>
                </label>
              ))}
            </article>
          ))}
        </div>
        <p>
          發炎超過 60 開始增加旁觀損傷。Treg 降低發炎，也會減弱部分
          CXCL8／IFN-γ。已損傷組織不會因調節自動恢復。
        </p>
      </section>
      <section>
        <p>
          綠色淋巴引流入口代表離開組織後的結內流程，與血管增援入口分開；並非淋巴結位於肺泡腔內。
        </p>
        <h3>引流淋巴結 · 適應性免疫</h3>
        <p data-testid="node-stage">
          {stages[s.immunity.node.stage]}
          {s.immunity.node.stage === "presenting"
            ? ` · ${Math.max(0, Math.ceil((s.immunity.node.until - s.tick) * 0.2))} 秒`
            : ""}
        </p>
        <ol className="t-immune-chain">
          <li>DC 捕捉抗原並遷移</li>
          <li>MHC-II 肽＋共刺激（8 秒）</li>
          <li>CD4 T 活化（8 秒）</li>
          <li>B 結合蛋白抗原＋T 幫助（10 秒）</li>
          <li>漿細胞 → 特異性抗體 → 調理吞噬</li>
        </ol>
        <p>
          抗體支援庫存：<b>{s.immunity.antibodies}</b> /100。每個漿細胞每 5
          秒補充 10，每次更新一群菌的抗體覆蓋消耗
          1；既有覆蓋仍有效時不重複消耗。所有時間均為教學壓縮，並非真實免疫反應所需秒數。
        </p>
        <p>
          本案例呈現肺炎鏈球菌<b>蛋白抗原</b>的 T 細胞依賴反應。莢膜多醣亦可走 T
          非依賴路徑，本局未模擬；CD4 Tfh／Th1 功能聚合於一個支援族群。CD8 的
          MHC-I 活化另有條件，不能從 MHC-II 直接取得資格。
        </p>
      </section>
      <section>
        <h3>胞外與胞內，目標不同</h3>
        <p>
          M1：莢膜肺炎鏈球菌在胞外；C3b／抗體改善吞噬，厚細胞壁使終末補體膜攻擊複合體不能當成通用清菌技。吞入後本案例可清除；囊泡存活病原需要額外活化。NK／CD8
          則以感染宿主為目標，形成免疫突觸、穿孔素協助顆粒酶進入並誘導凋亡。
        </p>
        <button onClick={onPractice}>進入 NK／CD8 機制演練</button>
        <p>
          演練使用預先活化、已知抗原的 CD8；不新增病原關卡，也不代表 M1
          有病毒感染。
        </p>
      </section>
      <div className="t-immune-links">
        {[
          ["prr", "PRR／TLR"],
          ["cytokines", "細胞激素"],
          ["opsonization", "補體與調理"],
          ["bcell", "B／抗體"],
          ["treg", "Treg"],
          ["cd8", "MHC-I／CD8"],
        ].map(([id, title]) => (
          <button key={id} onClick={() => onEntry(id)}>
            {title} ↗
          </button>
        ))}
      </div>
    </div>
  );
}
