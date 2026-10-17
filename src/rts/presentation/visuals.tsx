import type { ReactNode } from "react";
import type { Action, Unit, Pathogen, Point } from "../domain/types";
// The provider consumes presentation snapshots only. Never pass engine callbacks.
export type VisualPose = {
  id: string;
  visualId: string;
  phase: Action | "external";
  progress: number;
  time: number;
  reduced: boolean;
  opsonin?: Pathogen["opsonin"];
  load?: number;
  antigen?: boolean;
  cargo?: boolean;
  selected?: boolean;
};
export const visualAnchors = {
  origin: { x: 0, y: 0 },
  contact: { x: 34, y: 0 },
  pseudopod: { x: 10, y: 0 },
  vesicle: { x: 13, y: 8 },
  status: { x: 20, y: -19 },
  selection: { x: 0, y: 0 },
};
export type VisualDefinition = {
  visualId: string;
  source: string;
  license: string;
  status: "placeholder";
  version: number;
  radius: number;
  anchor: Point;
  anchors: typeof visualAnchors;
  actions: string[];
};
const actions = [
  "idle",
  "move",
  "contact",
  "wrap",
  "ingest",
  "digest",
  "survive",
  "opsonize",
  "signal",
  "extravasate",
  "migrate",
  "result",
];
export const manifest: VisualDefinition[] = [
  {
    visualId: "cell.macrophage.v1",
    radius: 30,
    anchor: { x: 0, y: 0 },
    anchors: visualAnchors,
    source: "src/rts/presentation/visuals.tsx",
    license: "original project code",
    status: "placeholder",
    version: 1,
    actions,
  },
  {
    visualId: "cell.neutrophil.v1",
    radius: 23,
    anchor: { x: 0, y: 0 },
    anchors: visualAnchors,
    source: "src/rts/presentation/visuals.tsx",
    license: "original project code",
    status: "placeholder",
    version: 1,
    actions,
  },
  {
    visualId: "cell.dendritic.v1",
    radius: 30,
    anchor: { x: 0, y: 0 },
    anchors: visualAnchors,
    source: "src/rts/presentation/visuals.tsx",
    license: "original project code",
    status: "placeholder",
    version: 1,
    actions,
  },
  {
    visualId: "pathogen.spn.v1",
    radius: 16,
    anchor: { x: 0, y: 0 },
    anchors: visualAnchors,
    source: "src/rts/presentation/visuals.tsx",
    license: "original project code",
    status: "placeholder",
    version: 1,
    actions,
  },
];
export interface VisualProvider {
  render(pose: VisualPose): ReactNode;
  reset?(): void;
  dispose?(): void;
}
export function VisualDefs() {
  return (
    <defs>
      <radialGradient id="macro" cx="32%" cy="25%">
        <stop stopColor="#efecff" />
        <stop offset=".55" stopColor="#b5a7dc" />
        <stop offset="1" stopColor="#8479b5" />
      </radialGradient>
      <radialGradient id="neutro" cx="35%" cy="25%">
        <stop stopColor="#fffdf8" />
        <stop offset="1" stopColor="#d9bcca" />
      </radialGradient>
      <radialGradient id="dc" cx="30%" cy="20%">
        <stop stopColor="#e6f6f2" />
        <stop offset="1" stopColor="#6faea5" />
      </radialGradient>
      <radialGradient id="nucleus">
        <stop stopColor="#b7a1da" />
        <stop offset="1" stopColor="#66518e" />
      </radialGradient>
      <radialGradient id="bacteria">
        <stop stopColor="#c2f4ed" />
        <stop offset="1" stopColor="#3b928d" />
      </radialGradient>
      <radialGradient id="tissue">
        <stop stopColor="#f4ecea" />
        <stop offset="1" stopColor="#d9bdc6" />
      </radialGradient>
      <filter id="soft">
        <feGaussianBlur stdDeviation="19" />
      </filter>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow
          dx="0"
          dy="3"
          stdDeviation="3"
          floodColor="#65546f"
          floodOpacity=".18"
        />
      </filter>
    </defs>
  );
}
function membrane(radius: number, phase: number, dc = false) {
  const pts = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    const l = dc
      ? i % 4 === 0
        ? 1.48
        : i % 4 === 1
          ? 1.02
          : 0.79
      : 1 +
        0.065 * Math.sin(a * 5 + phase) +
        0.045 * Math.sin(a * 3 - phase * 0.7);
    return { x: Math.cos(a) * radius * l, y: Math.sin(a) * radius * l * 0.86 };
  });
  return (
    pts
      .map((p, i) => {
        const q = pts[(i + 1) % pts.length];
        return `${i === 0 ? `M ${(pts[31].x + p.x) / 2} ${(pts[31].y + p.y) / 2}` : ""} Q ${p.x} ${p.y} ${(p.x + q.x) / 2} ${(p.y + q.y) / 2}`;
      })
      .join(" ") + " Z"
  );
}
export const placeholderProvider: VisualProvider = {
  render(p) {
    const phase =
        Number(p.id.replace(/\D/g, "")) * 0.83 + (p.reduced ? 0 : p.time * 1.5),
      float = p.reduced ? 0 : Math.sin(phase * 0.7) * 1.4;
    if (p.visualId === "pathogen.spn.v1") {
      const pairs = Math.max(1, Math.min(4, Math.ceil((p.load ?? 4) / 3)));
      return (
        <g transform={`translate(0 ${float})`}>
          <title>具莢膜雙球菌</title>
          {Array.from({ length: pairs }, (_, i) => {
            const x = (i % 2) * 18 - 7,
              y = Math.floor(i / 2) * 15 - 7;
            return (
              <g key={i} transform={`translate(${x} ${y}) rotate(${i * 28})`}>
                <ellipse
                  rx="12"
                  ry="8"
                  fill="#d9ffff"
                  fillOpacity=".45"
                  stroke="#65a8ad"
                  strokeWidth="1"
                />
                {[-4, 4].map((v) => (
                  <ellipse
                    key={v}
                    cx={v}
                    rx="4.6"
                    ry="5.7"
                    fill="url(#bacteria)"
                  />
                ))}
              </g>
            );
          })}
          {p.opsonin !== "none" &&
            p.opsonin &&
            Array.from({ length: 9 }, (_, i) => {
              const a = (i / 9) * Math.PI * 2;
              const appear = p.reduced
                ? 1
                : Math.min(1, p.progress * 3 + i * 0.1);
              return (
                <path
                  key={i}
                  d="M -2 -3 L 0 0 L 2 -3 M 0 0 L 0 3"
                  transform={`translate(${Math.cos(a) * 26} ${Math.sin(a) * 21}) scale(${appear}) rotate(${i * 40})`}
                  fill="none"
                  stroke={p.opsonin === "antibody" ? "#985fa2" : "#b48925"}
                  strokeWidth="2"
                />
              );
            })}
        </g>
      );
    }
    const dc = p.visualId.includes("dendritic"),
      neutro = p.visualId.includes("neutrophil"),
      r = manifest.find((v) => v.visualId === p.visualId)?.radius ?? 30;
    return (
      <g
        transform={`translate(0 ${float}) scale(${p.phase === "extravasate" ? 1 - 0.35 * Math.sin(p.progress * Math.PI) : 1} ${p.phase === "extravasate" ? 1 + 0.2 * Math.sin(p.progress * Math.PI) : 1})`}
        filter="url(#shadow)"
      >
        <path
          d={membrane(r, phase, dc)}
          fill={`url(#${dc ? "dc" : neutro ? "neutro" : "macro"})`}
          stroke={p.selected ? "#315d7b" : dc ? "#75a69e" : "#a399bb"}
          strokeWidth={p.selected ? 2.8 : 1.3}
        />
        <path
          d={membrane(r * 0.89, phase + 0.2, dc)}
          fill="none"
          stroke="#fff"
          strokeOpacity=".45"
        />
        {neutro ? (
          <>
            <path
              d="M -9 -5 Q 0 4 9 -3"
              stroke="#82628e"
              strokeWidth="5"
              fill="none"
            />
            {[-9, 0, 9].map((x, i) => (
              <ellipse
                key={x}
                cx={x}
                cy={i === 1 ? 5 : -5}
                rx="6"
                ry="7"
                fill="url(#nucleus)"
              />
            ))}
          </>
        ) : (
          <path
            d={
              dc
                ? "M -8 -6 Q 10 -15 13 0 Q 9 14 -5 11 Q -15 5 -8 -6"
                : "M -13 -7 C -4 -18 15 -9 10 2 C 6 8 1 1 -1 10 C -15 19 -20 1 -13 -7"
            }
            fill="url(#nucleus)"
            stroke="#8c78ac"
          />
        )}
        {Array.from({ length: neutro ? 12 : 5 }, (_, i) => {
          const a = i * 2.4;
          return (
            <ellipse
              key={i}
              cx={Math.cos(a) * r * 0.65}
              cy={Math.sin(a) * r * 0.57}
              rx={neutro ? 1.3 : 2.6}
              ry={neutro ? 1.6 : 2}
              fill={dc ? "#cbe5bd" : "#ad8dbb"}
              fillOpacity=".65"
            />
          );
        })}
        {p.antigen && (
          <path
            d="M 17 -19 L 24 -23 L 26 -15 L 19 -11 Z"
            fill="#d6ac54"
            stroke="#fff3c9"
          />
        )}
        {p.cargo && (
          <g
            transform={`translate(${p.phase === "ingest" ? visualAnchors.contact.x - (visualAnchors.contact.x - visualAnchors.vesicle.x) * p.progress : visualAnchors.vesicle.x} ${p.phase === "ingest" ? visualAnchors.vesicle.y * p.progress : visualAnchors.vesicle.y})`}
          >
            <circle r="9" fill="#e2f2e8" stroke="#9bb6a5" />
            {p.phase === "survive" || p.phase === "ingest" ? (
              <>
                <ellipse rx="5" ry="3" fill="#389d8c" />
                <circle cx="3" cy="-2" r="1.4" fill="#bcf6b7" />
              </>
            ) : (
              Array.from({ length: 5 }, (_, i) => (
                <circle
                  key={i}
                  cx={Math.cos(i * 1.3) * 5 * (1 - p.progress * 0.8)}
                  cy={Math.sin(i * 1.3) * 4}
                  r={Math.max(0.3, 2 * (1 - p.progress * 0.85))}
                  fill="#7aa7a0"
                />
              ))
            )}
          </g>
        )}
      </g>
    );
  },
};
let activeProvider: VisualProvider = placeholderProvider;
export function setVisualProvider(provider: VisualProvider) {
  activeProvider.dispose?.();
  activeProvider = provider;
  activeProvider.reset?.();
}
export function Visual(p: VisualPose) {
  try {
    return <>{activeProvider.render(p)}</>;
  } catch {
    return <>{placeholderProvider.render(p)}</>;
  }
}
export function poseFor(
  u: Unit,
  step: number,
  time: number,
  reduced: boolean,
): VisualPose {
  return {
    id: u.id,
    visualId: u.visualId,
    phase: u.action,
    progress:
      u.until > u.since
        ? Math.max(0, Math.min(1, (step - u.since) / (u.until - u.since)))
        : 0,
    time,
    reduced,
    antigen: !!u.antigen,
    cargo: !!u.cargo,
  };
}
