import { useEffect, useRef, useState } from "react";
import type { State, Point, Settings } from "../domain/types";
import { GRID_W } from "../engine/simulation";
import { Visual, VisualDefs, poseFor } from "./visuals";
import { actionNames, kindNames } from "../content/m1";
type Props = {
  state: State;
  settings: Settings;
  selected?: string;
  onSelect: (id: string) => void;
  onPoint: (p: Point) => void;
  mode: string;
};
export default function World({
  state: s,
  settings,
  selected,
  onSelect,
  onPoint,
  mode,
}: Props) {
  const ref = useRef<SVGSVGElement>(null),
    gesture = useRef<{
      x: number;
      y: number;
      ox: number;
      oy: number;
      moved: boolean;
    } | null>(null);
  const [camera, setCamera] = useState({
      x: 0,
      y: 0,
      zoom: matchMedia("(max-width:850px)").matches ? 1.5 : 1,
    }),
    [time, setTime] = useState(0);
  useEffect(() => {
    let raf = 0;
    const animate = (t: number) => {
      setTime(t / 1000);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);
  const [size, setSize] = useState({ w: 1000, h: 680 });
  useEffect(() => {
    const el = ref.current!;
    const observer = new ResizeObserver(([r]) =>
      setSize({ w: r.contentRect.width, h: r.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(size.w / 1000, size.h / 680) * camera.zoom;
  const tx = size.w / 2 - 500 * scale + camera.x,
    ty = size.h / 2 - 340 * scale + camera.y;
  const point = (x: number, y: number) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(35, Math.min(965, (x - r.left - tx) / scale)),
      y: Math.max(35, Math.min(645, (y - r.top - ty) / scale)),
    };
  };
  function finish(e: React.PointerEvent<SVGSVGElement>) {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (g.moved) return;
    const id = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-unit]")
      ?.getAttribute("data-unit");
    if (id && mode === "select") onSelect(id);
    else if (mode !== "select") onPoint(point(e.clientX, e.clientY));
  }
  const reduced = settings.motion !== "normal";
  return (
    <div className={`world mode-${mode}`}>
      <svg
        ref={ref}
        data-testid="world"
        aria-label="連續肺組織戰場，可拖曳平移"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            ox: camera.x,
            oy: camera.y,
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (Math.hypot(dx, dy) > 7) g.moved = true;
          if (g.moved) setCamera((c) => ({ ...c, x: g.ox + dx, y: g.oy + dy }));
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          gesture.current = null;
        }}
      >
        <VisualDefs />
        <g
          transform={`translate(${tx} ${ty}) scale(${scale})`}
          data-testid="map-layer"
        >
          <rect x="-300" y="-300" width="1600" height="1280" fill="#e9dde0" />
          <path
            d="M -70 200 Q 20 -30 265 40 T 550 15 Q 750 40 1000 130 L 1070 530 Q 860 700 680 660 T 270 700 Q 20 620 -70 200"
            fill="url(#tissue)"
          />
          <g fill="none" strokeLinecap="round">
            <path
              d="M -30 180 C 130 330 160 40 340 190 S 630 80 820 155 S 1000 240 1100 180 M 70 570 C 230 330 390 600 530 450 S 850 580 1040 380"
              stroke="#bda6b5"
              strokeOpacity=".22"
              strokeWidth="32"
            />
            <path
              d="M 65 210 C 230 240 230 355 385 340 S 580 230 730 290 S 810 420 990 380"
              stroke="#fff5f2"
              strokeOpacity=".4"
              strokeWidth="15"
            />
            <path
              data-testid="vessel"
              d="M -100 590 C 170 455 340 620 580 564 S 850 590 1100 510"
              stroke="#c58e9c"
              strokeWidth="86"
            />
            <path
              d="M -100 590 C 170 455 340 620 580 564 S 850 590 1100 510"
              stroke="#ecc0c6"
              strokeWidth="65"
            />
            <path
              d="M -100 590 C 170 455 340 620 580 564 S 850 590 1100 510"
              stroke="#ad6e89"
              strokeOpacity={s.endothelial / 180}
              strokeDasharray="12 8"
              strokeWidth="75"
            />
          </g>
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse
              key={i}
              cx={i * 98 - 30 + ((reduced ? 0 : time * 8) % 90)}
              cy={558 + Math.sin(i) * 20}
              rx="13"
              ry="7"
              fill="#bc7f92"
              fillOpacity=".35"
            />
          ))}
          <path
            d="M 870 145 Q 925 90 1015 90"
            stroke="#9fbaad"
            strokeWidth="22"
            fill="none"
            strokeDasharray="5 5"
          />
          <g className="map-labels" fill="#786d7b" fontSize="16">
            <text x="85" y="125" data-testid="landmark">
              肺泡隔壁
            </text>
            <text x="140" y="625">
              微血管 · 內皮 {s.endothelial.toFixed(0)}%
            </text>
            <text x="785" y="63">
              引流淋巴出口 ↗
            </text>
            <text x="655" y="200">
              呼吸道侵入口 {s.sourceClosed ? "已控制" : "持續播散"}
            </text>
          </g>
          {s.damage.pathogen > 1 && (
            <path
              d="M 620 260 Q 710 230 780 330 T 700 450 Q 580 430 620 260"
              fill="#a17d88"
              opacity={Math.min(0.3, s.damage.pathogen / 100)}
              stroke="#a48590"
              strokeDasharray="4 8"
            />
          )}
          {settings.signals && (
            <g filter="url(#soft)" pointerEvents="none">
              {s.field.map((v, i) =>
                v > 0.025 ? (
                  <rect
                    key={i}
                    x={(i % GRID_W) * 40}
                    y={Math.floor(i / GRID_W) * 40}
                    width="42"
                    height="42"
                    fill="#e2ae35"
                    opacity={Math.min(0.46, v / 8)}
                  />
                ) : null,
              )}
            </g>
          )}
          {s.units
            .filter((u) => u.signal && u.action !== "exit")
            .map((u) => (
              <g
                key={`s${u.id}`}
                transform={`translate(${u.x} ${u.y})`}
                pointerEvents="none"
              >
                <path
                  d="M -34 -8 Q -48 -30 -30 -44 M 34 -8 Q 48 -30 30 -44"
                  stroke="#c19330"
                  fill="none"
                  strokeWidth="2"
                  strokeDasharray="3 6"
                  opacity={reduced ? 0.5 : 0.5 + Math.sin(time * 2) * 0.2}
                />
                {settings.signals && (
                  <text
                    y="-51"
                    textAnchor="middle"
                    fontSize="12"
                    fill="#886719"
                  >
                    CXCL8 來源
                  </text>
                )}
              </g>
            ))}
          {s.recruits.map((r) => {
            const progress =
              r.phase === "crossing" ? 1 - (r.until - s.step) / 15 : 0;
            return (
              <g
                key={r.id}
                transform={`translate(${r.entrance.x} ${r.entrance.y - progress * 30})`}
                opacity={r.phase === "waiting" ? 0.4 : 1}
              >
                <Visual
                  id={r.id}
                  visualId="cell.neutrophil.v1"
                  phase="extravasate"
                  progress={progress}
                  time={time}
                  reduced={reduced}
                />
                <text y="37" textAnchor="middle" fontSize="12">
                  {r.phase === "waiting"
                    ? "等待內皮"
                    : r.phase === "mobilizing"
                      ? "血管動員"
                      : "跨內皮"}
                </text>
              </g>
            );
          })}
          {s.pathogens
            .filter((b) => b.compartment === "external")
            .map((b) => (
              <g
                key={b.id}
                data-unit={b.id}
                transform={`translate(${b.x} ${b.y})`}
                role="button"
                aria-label={`病原 ${b.id}`}
              >
                <circle r="27" fill="transparent" />
                {selected === b.id && (
                  <ellipse
                    rx="34"
                    ry="29"
                    fill="none"
                    stroke="#315d7b"
                    strokeDasharray="4 4"
                  />
                )}
                <Visual
                  id={b.id}
                  visualId={b.visualId}
                  phase="external"
                  progress={Math.min(1, (s.step - b.opsAt) / 15)}
                  time={time}
                  reduced={reduced}
                  opsonin={b.opsonin}
                  load={b.load}
                />
                <text y="36" textAnchor="middle" fontSize="12" fill="#345b5b">
                  {b.id} · {b.load.toFixed(1)}
                </text>
              </g>
            ))}
          {s.units
            .filter((u) => u.action !== "exit")
            .map((u) => {
              const b = s.pathogens.find((b) => b.id === u.target),
                p = poseFor(u, s.step, time, reduced);
              const d = b ? Math.hypot(b.x - u.x, b.y - u.y) : 0,
                angle = b
                  ? (Math.atan2(b.y - u.y, b.x - u.x) * 180) / Math.PI
                  : 0;
              return (
                <g
                  key={u.id}
                  data-unit={u.id}
                  transform={`translate(${u.x} ${u.y})`}
                  role="button"
                  aria-label={`${kindNames[u.kind]} ${u.id}`}
                >
                  <circle r="35" fill="transparent" />
                  {selected === u.id && (
                    <ellipse
                      rx="43"
                      ry="37"
                      fill="#ecf6ff"
                      fillOpacity=".25"
                      stroke="#3d6c83"
                      strokeWidth="2"
                    />
                  )}
                  {u.order && (
                    <path
                      d={`M 0 0 L ${u.order.x - u.x} ${u.order.y - u.y}`}
                      fill="none"
                      stroke="#5a7984"
                      strokeDasharray="5 7"
                      pointerEvents="none"
                    />
                  )}
                  <Visual {...p} selected={selected === u.id} />
                  {b && ["contact", "wrap"].includes(u.action) && (
                    <g transform={`rotate(${angle})`} pointerEvents="none">
                      <path
                        d={`M 10 -15 Q ${d * 0.65} ${-26 - p.progress * 10} ${d + 17} ${-14 * (1 - p.progress)} M 10 15 Q ${d * 0.65} ${26 + p.progress * 10} ${d + 17} ${14 * (1 - p.progress)}`}
                        stroke="#b8a9dc"
                        strokeWidth={u.action === "wrap" ? 9 : 3}
                        fill="none"
                        strokeLinecap="round"
                      />
                      {u.action === "wrap" && (
                        <ellipse
                          cx={d}
                          rx="22"
                          ry={12 + p.progress * 8}
                          fill="#c5b9dd"
                          fillOpacity={p.progress * 0.5}
                          stroke="#a999c4"
                          strokeDasharray={`${p.progress * 130} 140`}
                        />
                      )}
                    </g>
                  )}
                  <text y="50" textAnchor="middle" fontSize="12" fill="#564d69">
                    {u.id} · {kindNames[u.kind]}
                  </text>
                  {selected === u.id && (
                    <text
                      y="65"
                      textAnchor="middle"
                      fontSize="12"
                      fill="#425d6c"
                    >
                      {actionNames[u.action]}
                    </text>
                  )}
                </g>
              );
            })}
        </g>
      </svg>
      <div className="camera-tools">
        <button
          aria-label="放大"
          onClick={() =>
            setCamera((c) => ({ ...c, zoom: Math.min(2.3, c.zoom * 1.2) }))
          }
        >
          ＋
        </button>
        <button
          aria-label="縮小"
          onClick={() =>
            setCamera((c) => ({ ...c, zoom: Math.max(0.65, c.zoom / 1.2) }))
          }
        >
          −
        </button>
        <button
          onClick={() =>
            setCamera({
              x: 0,
              y: 0,
              zoom: matchMedia("(max-width:850px)").matches ? 1.5 : 1,
            })
          }
        >
          重設鏡頭
        </button>
      </div>
      <div className="world-caption">
        {mode === "select"
          ? "拖曳抓取地圖 · 點選細胞或使用名單"
          : mode === "move"
            ? "點按組織：移動到此（拖曳只平移）"
            : "點按組織：設定募集支援位置"}
        <br />
        {settings.signals
          ? "CXCL8：淡金低 → 濃金高｜來源 → 嗜中性球趨化；非傷害"
          : "佔位美術 · 分層 2.5D｜C 柔光微觀方向待精修"}
      </div>
    </div>
  );
}
