import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BattleState, Content, Population, Unit } from "../domain/model";
import type { VisualState } from "../presentation/playback";
import { CellArt, PathogenArt } from "../presentation/CellArt";
import { eventMap } from "../presentation/playback";
import { occupancy } from "../engine/battle";
export function positionUnit(u: Unit, b: BattleState, c: Content) {
  const r = c.scenarios[b.scenario].regions.find((r) => r.id === u.region)!;
  const i = b.units
    .filter((v) => v.region === u.region)
    .findIndex((v) => v.id === u.id);
  return { x: r.x - 10 + (i % 2) * 12, y: r.y - 3 + Math.floor(i / 2) * 12 };
}
export function positionPathogen(p: Population, b: BattleState, c: Content) {
  const r = c.scenarios[b.scenario].regions.find((r) => r.id === p.region)!;
  const i = Math.max(
    0,
    b.populations
      .filter(
        (v) =>
          v.region === p.region &&
          v.compartment === "extracellular" &&
          v.load > 0,
      )
      .findIndex((v) => v.id === p.id),
  );
  return { x: r.x + 12, y: r.y + 1 + i * 10 };
}
export function Board({
  visual,
  content: c,
  selected,
  onSelect,
  selectedRegion,
  onRegion,
  moveMode,
  idle,
  reduced,
}: {
  visual: VisualState;
  content: Content;
  selected?: string;
  onSelect: (id: string) => void;
  selectedRegion: string;
  onRegion: (id: string) => void;
  moveMode: boolean;
  idle: boolean;
  reduced: boolean;
}) {
  const b = visual.state,
    e = visual.event,
    s = c.scenarios[b.scenario];
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  useEffect(() => {
    const el = ref.current!;
    const observer = new ResizeObserver(([v]) =>
      setSize({ w: v.contentRect.width, h: v.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const unit = b.units.find((u) => u.id === e?.source);
  const target = b.populations.find((p) => p.id === e?.target);
  const pt =
    target && target.compartment === "extracellular"
      ? positionPathogen(target, b, c)
      : unit
        ? positionUnit(unit, b, c)
        : { x: 50, y: 50 };
  const style = {
    "--clip-time": `${visual.duration}ms`,
    "--board-width": `${size.w}px`,
    "--board-height": `${size.h}px`,
  } as CSSProperties;
  return (
    <div
      ref={ref}
      className={`battlefield ${idle && !reduced ? "idle-on" : ""} ${reduced ? "reduced" : ""} ${e ? "is-playing" : ""}`}
      style={style}
      data-testid="battlefield"
      aria-label="肺部三區戰場"
    >
      <div className="tissue-underlay" />
      <svg
        className="region-links"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="route">
            <stop stopColor="#d8e8ff" />
            <stop offset="1" stopColor="#a4d9f0" />
          </linearGradient>
        </defs>
        {s.regions.flatMap((r) =>
          r.neighbors
            .filter((n) => r.id < n)
            .map((n) => {
              const to = s.regions.find((v) => v.id === n)!;
              return (
                <g key={r.id + n}>
                  <path
                    d={`M${r.x} ${r.y} Q${(r.x + to.x) / 2 + 5} ${(r.y + to.y) / 2 + 7} ${to.x} ${to.y}`}
                    stroke="#34334e"
                    strokeOpacity=".18"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    d={`M${r.x} ${r.y} Q${(r.x + to.x) / 2 + 5} ${(r.y + to.y) / 2 + 7} ${to.x} ${to.y}`}
                    stroke="url(#route)"
                    strokeOpacity=".8"
                    strokeWidth=".5"
                    strokeDasharray="1.1 1"
                    fill="none"
                  />
                </g>
              );
            }),
        )}
      </svg>
      {s.regions.map((r) => {
        const health = b.regions[r.id];
        const load = b.populations
          .filter((p) => p.region === r.id)
          .reduce((a, p) => a + p.load, 0);
        return (
          <div
            key={r.id}
            className={`region ${selectedRegion === r.id ? "region-selected" : ""} ${moveMode ? "region-target" : ""} ${e?.type === "TissueDamaged" && e.region === r.id ? "region-damaged" : ""} ${health === 0 ? "region-lost" : ""}`}
            style={
              {
                left: `${r.x}%`,
                top: `${r.y}%`,
                "--damage": 1 - health / r.maxHealth,
              } as CSSProperties
            }
          >
            <button
              className="region-hit"
              aria-label={`選取${r.name}`}
              onClick={() => onRegion(r.id)}
              disabled={!!e}
            />
            <div className="region-surface" />
            <div className="region-label">
              <b>{r.id.toUpperCase()}</b>
              <span>{r.name}</span>
            </div>
            <div className="region-vitals">
              <span>
                組織 <strong>{health}%</strong>
              </span>
              <span>
                ▥ {occupancy(b, r.id)}/{r.capacity}
              </span>
              <small>{load > 0 ? `感染 ${load}` : "無活感染"}</small>
              <div className="region-health">
                <i style={{ width: `${health}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      {b.units.map((u) => {
        const pos = positionUnit(u, b, c),
          isMover = e?.type === "UnitMoved" && e.source === u.id;
        const end =
          isMover && visual.after
            ? positionUnit(
                visual.after.units.find((v) => v.id === u.id)!,
                visual.after,
                c,
              )
            : pos;
        const isEngulf = e?.type === "PathogenEngulfed" && e.source === u.id;
        const delta = isEngulf
          ? { x: (pt.x - pos.x) * 0.68, y: (pt.y - pos.y) * 0.68 }
          : { x: end.x - pos.x, y: end.y - pos.y };
        const infected = b.populations.some(
          (p) => p.hostId === u.id && p.load > 0,
        );
        return (
          <button
            key={u.id}
            data-unit={u.id}
            className={`unit-anchor ${selected === u.id ? "selected" : ""} ${isMover ? "unit-moving" : ""} ${isEngulf ? "unit-engulfing" : ""} ${e?.type === "UnitArrived" && e.source === u.id ? "unit-arriving" : ""}`}
            style={
              {
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                "--dx": `${(delta.x / 100) * size.w}px`,
                "--dy": `${(delta.y / 100) * size.h}px`,
                "--phase": `${-Number(u.id.slice(1)) * 0.73}s`,
                "--idle-period": `${3.8 + (Number(u.id.slice(1)) % 4) * 0.49}s`,
              } as CSSProperties
            }
            onClick={() => onSelect(u.id)}
            aria-label={`選取${c.cells[u.kind].name} ${u.id}`}
            disabled={!!e}
          >
            <span className="contact-shadow" />
            <span className="select-ring" />
            <span className="unit-idle">
              <CellArt kind={u.kind} infected={infected} active={isEngulf} />
            </span>
            <span className="unit-name">
              {c.cells[u.kind].short}
              {u.used && <i title="主要作用已使用">✓</i>}
            </span>
            {infected && <span className="intracellular-badge">胞內存活</span>}
          </button>
        );
      })}
      {b.populations
        .filter((p) => p.load > 0 && p.compartment === "extracellular")
        .map((p) => {
          const pos = positionPathogen(p, b, c);
          return (
            <button
              key={p.id}
              data-pathogen={p.id}
              className={`pathogen-anchor ${selected === p.id ? "selected" : ""} ${e?.type === "PathogenEngulfed" && e.target === p.id ? "being-engulfed" : ""} ${e?.type === "PathogenReplicated" && e.target === p.id ? "replicating" : ""} ${e?.type === "OpsoninApplied" && e.target === p.id ? "marking" : ""}`}
              style={
                {
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  "--phase": `${-Number(p.id.slice(1)) * 0.91}s`,
                  "--idle-period": `${4.2 + (Number(p.id.slice(1)) % 3) * 0.7}s`,
                } as CSSProperties
              }
              onClick={() => onSelect(p.id)}
              disabled={!!e}
              aria-label={`選取${c.pathogens[p.pathogen].name} ${p.id}，負荷 ${p.load}`}
            >
              <span className="contact-shadow" />
              <span className="pathogen-idle">
                <PathogenArt marked={p.opsonin > 0} />
              </span>
              <span className={`load-badge ${p.opsonin ? "marked" : ""}`}>
                {p.opsonin > 0 ? "Y " : ""}
                {p.load}
              </span>
              {p.opsonin > 0 && (
                <small className="marked-label">調理 {p.opsonin}</small>
              )}
            </button>
          );
        })}
      {(e?.type === "RecruitmentRequested" && visual.after
        ? visual.after.recruits
        : b.recruits
      ).map((r, i) => {
        const region = s.regions.find((v) => v.id === r.region)!;
        return (
          <span
            className={`recruit-ghost ${e?.source === r.id ? "new-request" : ""}`}
            key={r.id}
            style={{
              left: `${region.x - 14 + (i % 3) * 10}%`,
              top: `${region.y + 12}%`,
            }}
          >
            <span>＋</span>
            <small>{r.remaining} 回</small>
          </span>
        );
      })}
      {e && (
        <div
          key={e.id}
          className={`event-layer clip-${eventMap[e.type].clip}`}
          aria-hidden="true"
        >
          {e.type === "PathogenEngulfed" && (
            <div
              className="engulf-performance"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              <svg viewBox="0 0 150 130">
                <defs>
                  <radialGradient id="cup" cx=".3" cy=".2">
                    <stop stopColor="#e3d6fa" stopOpacity=".5" />
                    <stop offset=".7" stopColor="#9e81ce" stopOpacity=".8" />
                    <stop offset="1" stopColor="#6a60ab" />
                  </radialGradient>
                </defs>
                <path
                  className="pseudopod-left"
                  fill="url(#cup)"
                  stroke="#d4dfff"
                  strokeWidth="2"
                  d="M30 108 Q17 65 34 40 Q42 37 42 49 Q32 80 61 88 L80 108Z"
                />
                <path
                  className="pseudopod-right"
                  fill="url(#cup)"
                  stroke="#d4dfff"
                  strokeWidth="2"
                  d="M120 108 Q136 65 118 40 Q109 37 109 49 Q120 80 88 88 L71 108Z"
                />
                <g className="swallowed-target">
                  <ellipse
                    cx="65"
                    cy="53"
                    rx="14"
                    ry="18"
                    fill="#6681c1"
                    stroke="#d5edff"
                  />
                  <ellipse
                    cx="87"
                    cy="53"
                    rx="14"
                    ry="18"
                    fill="#6681c1"
                    stroke="#d5edff"
                  />
                </g>
                <ellipse
                  className="phagosome"
                  cx="75"
                  cy="88"
                  rx="25"
                  ry="20"
                  stroke="#dce9ff"
                  fill="#ad8ccc"
                  fillOpacity=".3"
                />
                <g
                  className={`digestion ${e.data?.result === "survived" ? "surviving" : "clearing"}`}
                >
                  <circle cx="65" cy="88" r="6" />
                  <circle cx="80" cy="89" r="6" />
                </g>
              </svg>
              <span>
                {e.data?.result === "survived"
                  ? "吞入 → 胞內存活"
                  : "包覆 → 吞入 → 清除"}
              </span>
            </div>
          )}
          {e.type === "OpsoninApplied" && (
            <div
              className="opsonin-performance"
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  style={{ "--angle": `${i * 60}deg` } as CSSProperties}
                >
                  {i % 2 ? "Y" : "●"}
                </span>
              ))}
            </div>
          )}
          {(e.type === "PathogenReplicated" ||
            e.type === "PathogenCleared" ||
            e.type === "IntracellularSurvival") && (
            <div
              className={`pathogen-performance ${e.type === "PathogenReplicated" ? "division" : e.type === "IntracellularSurvival" ? "survival" : "debris"}`}
              style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
            >
              <PathogenArt />
              <PathogenArt />
              {e.type === "IntracellularSurvival" && <b>囊泡內仍有活菌</b>}
            </div>
          )}
          {e.type === "UnitArrived" && (
            <div
              className="arrival-performance"
              style={{
                left: `${s.regions.find((r) => r.id === e.region)!.x}%`,
                top: `${s.regions.find((r) => r.id === e.region)!.y}%`,
              }}
            >
              <CellArt kind={e.data?.kind as Unit["kind"]} />
              <span>由血液抵達</span>
            </div>
          )}
          {e.type === "PathogenSpread" && (
            <div
              className="spreading-pathogen"
              style={
                {
                  left: `${s.regions.find((r) => r.id === e.data?.from)!.x}%`,
                  top: `${s.regions.find((r) => r.id === e.data?.from)!.y}%`,
                  "--dx": `${((s.regions.find((r) => r.id === e.region)!.x - s.regions.find((r) => r.id === e.data?.from)!.x) / 100) * size.w}px`,
                  "--dy": `${((s.regions.find((r) => r.id === e.region)!.y - s.regions.find((r) => r.id === e.data?.from)!.y) / 100) * size.h}px`,
                } as CSSProperties
              }
            >
              <PathogenArt />
            </div>
          )}
          {(e.type === "TurnEnded" || e.type === "BattleEnded") && (
            <div className="turn-performance">
              <span>
                {e.type === "BattleEnded" ? "感染結果已確定" : "防線重整"}
              </span>
              <b>
                {e.type === "BattleEnded"
                  ? e.reason
                  : `回合 ${visual.after?.turn}`}
              </b>
            </div>
          )}
        </div>
      )}
      <div className="field-caption">
        <span>肺部微環境</span>
        <span>示意比例 · 一單位代表細胞群</span>
      </div>
    </div>
  );
}
