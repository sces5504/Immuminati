import type { TacticalContent, TacticalState } from "../domain/model";
import { validateTactical } from "../engine/simulation";
export function AntibodyPanel({
  state: s,
  content,
  region,
  onRecruit,
  onTarget,
  onClose,
}: {
  state: TacticalState;
  content: TacticalContent;
  region: string;
  onRecruit: (kind: "bcell" | "helperT") => void;
  onTarget: () => void;
  onClose: () => void;
}) {
  return (
    <section
      className="t-recruit-card t-antibody-card"
      aria-label="B 細胞與抗體"
    >
      <div className="t-card-heading">
        <h3>
          <span className="t-ig-symbol">Y</span> B → 抗體
        </h3>
        <button onClick={onClose} aria-label="關閉抗體面板">
          ×
        </button>
      </div>
      <p className="t-antibody-route">
        DC 呈遞 → CD4 活化 → T–B 同源對接 → 漿細胞
      </p>
      <p data-testid="antibody-stock">
        現有抗體：<b>{s.immunity.antibodies}</b> · 漿細胞{" "}
        {s.cells.filter((u) => u.kind === "plasma").length} · 對接{" "}
        {s.cells.filter((u) => u.kind === "bcell" && u.partner).length}
      </p>
      <p>
        蛋白抗原：B 呈遞 MHC-II 肽，接受 T 的
        CD40L／細胞激素幫助，再等待分化；對接在淋巴組織。
      </p>
      {(["helperT", "bcell"] as const).map((kind) => {
        const error = validateTactical(
          s,
          { type: "recruit", kind, region },
          content,
        );
        return (
          <button
            className="t-antibody-recruit"
            key={kind}
            disabled={!!error}
            title={error}
            onClick={() => onRecruit(kind)}
          >
            <span>募集{content.cells[kind].name}</span>
            <b>{content.cells[kind].cost} 資源</b>
          </button>
        );
      })}
      <button
        className="t-primary"
        data-testid="antibody-target"
        disabled={s.immunity.antibodies < 1 || !!s.result}
        onClick={onTarget}
      >
        指定目標 · 1 抗體
      </button>
      <small>
        <span className="t-ig-symbol">Y 抗體</span>：調理／中和胞外病毒。
        <span className="t-c3-symbol">● C3b</span>
        ：補體。兩者不是胞內殺菌。多醣亦可有 T 非依賴反應，本局未模擬。
      </small>
    </section>
  );
}
