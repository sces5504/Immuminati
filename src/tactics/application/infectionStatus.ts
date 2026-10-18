import { intracellularControl } from "../engine/intracellularControl";
import type { Cell, TacticalContent, TacticalState } from "../domain/model";
/** Read-only explanation of the same authoritative thresholds used by the engine. */
export function intracellularStatus(
  cell: Cell,
  s: TacticalState,
  c: TacticalContent,
) {
  const load = s.internal
    .filter((p) => p.host === cell.id && p.stage === "persistent")
    .reduce((n, p) => n + p.load, 0);
  if (!load || !c.lifecycle?.intracellular) return undefined;
  const { activated: active, contained } = intracellularControl(s, cell, c);
  const seconds = Math.max(
    0,
    Math.ceil(((cell.replicateAt ?? s.tick) - s.tick) * 0.2),
  );
  return {
    load,
    controlled: active || contained,
    text: `${c.pathogen.name} · 囊泡內 ${load}｜${active || contained ? "增殖受抑制" : `約 ${seconds} 秒後增殖`}；${active ? "IFN-γ 支援中" : contained ? "圍堵維持中" : "需要活化巨噬細胞"}`,
    warning: load >= c.lifecycle.intracellular.ruptureAt * 0.7,
  };
}
export function infectionSummary(s: TacticalState, c: TacticalContent) {
  const persistent = s.internal
    .filter((p) => p.stage === "persistent")
    .reduce((n, p) => n + p.load, 0);
  const processing = s.internal
    .filter((p) => p.stage === "processing")
    .reduce((n, p) => n + p.load, 0);
  const productive = s.hosts.filter(
    (h) => h.load > 0 && h.infection?.phase === "productive",
  ).length;
  const latent = s.hosts.filter(
    (h) => h.load > 0 && h.infection?.phase === "latent",
  ).length;
  const eclipse = s.hosts.filter(
    (h) => h.load > 0 && h.infection?.phase === "eclipse",
  ).length;
  const outside = s.colonies.reduce((n, p) => n + p.load, 0);
  return c.mechanics === "viral" || c.mechanics === "retroviral"
    ? `胞外 ${outside} · 建立中 ${eclipse} · 產毒 ${productive}${c.mechanics === "retroviral" ? ` · 潛伏 ${latent}` : ""}`
    : `胞外 ${outside} · 囊泡存活 ${persistent} · 待殺菌 ${processing}`;
}
