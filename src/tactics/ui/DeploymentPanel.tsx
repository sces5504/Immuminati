import { useState } from "react";
import { Dialog } from "../../ui/Dialog";
import { CellArt } from "../../presentation/CellArt";
import { deploymentKits, DEPLOYMENT_BUDGET } from "../content/deployment";
import { recruitableCells } from "../content/cells";
import type {
  TacticalCommand,
  TacticalContent,
  TacticalState,
} from "../domain/model";
export function DeploymentPanel({
  state,
  content,
  command,
  onBack,
}: {
  state: TacticalState;
  content: TacticalContent;
  command: (cmd: TacticalCommand) => boolean;
  onBack: () => void;
}) {
  const [region, setRegion] = useState(content.fields[0].id);
  const [error, setError] = useState("");
  const p = state.preparation!;
  const send = (cmd: TacticalCommand) => {
    if (!command(cmd)) setError("無法完成此部署，請檢查剩餘部署點與細胞條件。");
    else setError("");
  };
  return (
    <Dialog
      title={`${content.id.toUpperCase()} · 選擇起始防線`}
      onClose={onBack}
    >
      <section
        className="t-deployment"
        aria-label="開局部署"
        data-testid="deployment-panel"
      >
        <p className="t-deploy-intro">
          <b>{content.pathogen.name}</b> ·
          開局時間暫停。運用免疫知識配置隊伍，再觀察反應結果。
        </p>
        <div className="t-deploy-budget">
          <strong>
            剩餘 {p.remaining} / {DEPLOYMENT_BUDGET} 部署點
          </strong>
          <small>只供開局配置；開戰資源另計，無單位名額限制。</small>
        </div>
        {p.fixed.length > 0 && (
          <p className="t-deploy-resident">
            情境已有感染巨噬細胞，保留其胞內活菌；它不是可撤下的部署單位。
          </p>
        )}
        <div className="t-deploy-kits">
          {deploymentKits[content.id]?.map((kit) => (
            <button
              key={kit.id}
              data-kit={kit.id}
              onClick={() => send({ type: "deploy-kit", kit: kit.id })}
            >
              <b>
                {kit.name}
                <small>
                  {kit.units.reduce(
                    (n, u) => n + content.cells[u.kind].cost,
                    0,
                  )}{" "}
                  點 · 選用 ↗
                </small>
              </b>
              <span>{kit.reason}</span>
              <small>{kit.followup}</small>
            </button>
          ))}
        </div>
        <div className="t-deploy-roster" aria-label="已選部署">
          {state.cells.filter((u) => !p.fixed.includes(u.id)).length === 0 && (
            <p>尚未選隊伍。可選上方套組，或展開自行部署。</p>
          )}
          {state.cells.map((u) => (
            <div key={u.id}>
              <CellArt kind={u.kind} />
              <span>
                {content.cells[u.kind].short} · {u.region.toUpperCase()}
              </span>
              <button
                aria-label={`撤下 ${u.id}`}
                disabled={p.fixed.includes(u.id)}
                onClick={() => send({ type: "withdraw", cell: u.id })}
              >
                {p.fixed.includes(u.id) ? "宿主" : "撤下"}
              </button>
            </div>
          ))}
        </div>
        <details className="t-deploy-custom">
          <summary>自行部署／調整隊伍</summary>
          <label>
            起始防區
            <select
              aria-label="部署防區"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              {content.fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id.toUpperCase()} · {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="t-deploy-cells">
            {recruitableCells
              .filter((k) => !content.allowed || content.allowed.includes(k))
              .map((kind) => (
                <button
                  key={kind}
                  data-deploy={kind}
                  disabled={content.cells[kind].cost > p.remaining}
                  onClick={() => send({ type: "deploy", kind, region })}
                  title={content.cells[kind].description}
                >
                  <CellArt kind={kind} />
                  <span>
                    {content.cells[kind].short}
                    <small>{content.cells[kind].cost} 點 · ＋</small>
                  </span>
                </button>
              ))}
          </div>
          <p>
            適應性細胞仍需合法呈遞與活化；部署不等於已有抗體或效應資格。漿細胞由
            B 細胞分化取得。
          </p>
        </details>
        {error && <p role="status">{error}</p>}
        <footer>
          <button onClick={onBack}>儲存並回主頁</button>
          <button
            className="t-primary"
            data-testid="deployment-confirm"
            disabled={!state.cells.some((u) => !p.fixed.includes(u.id))}
            onClick={() => send({ type: "begin" })}
          >
            確認部署，進入戰場
          </button>
        </footer>
        <p className="t-deploy-note">
          選用套組會取代尚未開戰的自選隊伍。未用部署點不轉為資源；確認後仍暫停，可安排指令，再按「開始行動」。
        </p>
      </section>
    </Dialog>
  );
}
