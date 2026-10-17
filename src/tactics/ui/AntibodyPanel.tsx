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
        <h3>B 細胞 → 抗體</h3>
        <button onClick={onClose} aria-label="關閉抗體面板">
          ×
        </button>
      </div>
      <p>
        樹突細胞攜帶抗原 → 淋巴結呈遞 → CD4 T 輔助 → B 細胞活化 →
        漿細胞分泌抗體。
      </p>
      <p data-testid="antibody-stock">
        現有抗體：<b>{s.immunity.antibodies}</b> · 漿細胞：
        {s.cells.filter((u) => u.kind === "plasma").length}
      </p>
      <p>
        募集 B 細胞不會立即得到抗體，需符合抗原與 T
        細胞協助，並等待分化。產生後會自動調理；也能指定優先目標。
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
            募集 {content.cells[kind].name} · {content.cells[kind].cost} 資源
          </button>
        );
      })}
      <button
        className="t-primary"
        data-testid="antibody-target"
        disabled={s.immunity.antibodies < 1 || !!s.result}
        onClick={onTarget}
      >
        指定抗體調理（1 抗體）
      </button>
      <small>
        抗體的 Fc 部分協助吞噬者辨識；不直接射殺細菌。C3b
        補體使用另一個按鈕，兩者可同時附著。
      </small>
    </section>
  );
}
