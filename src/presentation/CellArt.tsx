import { useId } from "react";
import type { CellKind } from "../domain/model";
const macrophage =
  "M 47 14 C 44 4 38 3 37 16 C 31 20 29 14 23 11 C 15 8 21 21 19 25 C 13 30 5 21 5 30 C 4 38 16 35 16 43 C 13 48 2 48 7 55 C 11 62 19 51 23 59 C 25 65 12 72 20 77 C 27 80 29 66 35 72 C 39 77 31 86 39 89 C 48 90 44 77 52 78 C 60 77 58 91 66 88 C 73 84 62 77 68 71 C 75 66 80 80 86 74 C 91 67 76 62 81 56 C 86 52 94 58 95 49 C 94 41 82 47 80 40 C 79 33 94 32 89 25 C 84 20 78 30 72 26 C 67 20 75 11 67 10 C 59 9 64 23 56 22 C 49 22 54 11 47 14 Z";
const dendritic =
  "M47 34 C42 27 45 17 39 4 L39 24 Q35 35 31 30 L12 13 L24 32 L5 30 L27 40 L29 46 L5 53 L28 51 L28 59 L15 85 L34 66 L41 67 L45 97 L49 69 L57 66 L78 88 L65 62 L72 56 L99 56 L74 50 L72 43 L93 20 L66 35 L59 32 L65 4 L53 31 Z";
export function CellArt({
  kind = "macrophage",
  active = false,
  infected = false,
  decorative = false,
}: {
  kind?: CellKind;
  active?: boolean;
  infected?: boolean;
  decorative?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const path =
    kind === "macrophage"
      ? macrophage
      : kind === "dendritic"
        ? dendritic
        : "M50 10 C73 7 90 24 91 48 C95 70 77 89 53 91 C31 94 10 79 9 56 C5 30 22 11 50 10Z";
  const pink = kind === "neutrophil";
  return (
    <svg
      viewBox="0 0 100 100"
      className={`cell-art ${kind} ${active ? "cell-active" : ""}`}
      aria-hidden={decorative}
      role={decorative ? undefined : "img"}
      aria-label={
        decorative
          ? undefined
          : kind === "macrophage"
            ? "巨噬細胞，彎曲核與偽足"
            : kind === "neutrophil"
              ? "嗜中性球，分葉核與顆粒"
              : "樹突細胞，分枝突起"
      }
    >
      <defs>
        <radialGradient id={`${uid}mem`} cx="32%" cy="24%" r="78%">
          <stop stopColor={pink ? "#fff2ee" : "#e8e6ff"} />
          <stop offset=".27" stopColor={pink ? "#efc6d3" : "#b9a3e7"} />
          <stop offset=".72" stopColor={pink ? "#d59bad" : "#9683ce"} />
          <stop offset="1" stopColor={pink ? "#9b6e94" : "#575c9d"} />
        </radialGradient>
        <radialGradient id={`${uid}nuc`} cx="33%" cy="24%" r="80%">
          <stop stopColor="#b19cdb" />
          <stop offset=".36" stopColor="#7755aa" />
          <stop offset=".78" stopColor="#54357f" />
          <stop offset="1" stopColor="#36285e" />
        </radialGradient>
        <radialGradient id={`${uid}ves`} cx="28%" cy="25%">
          <stop stopColor="#faf4ff" />
          <stop offset=".45" stopColor="#a8acd8" />
          <stop offset="1" stopColor="#6962a7" />
        </radialGradient>
        <linearGradient id={`${uid}shine`} x2=".8" y2="1">
          <stop stopColor="white" stopOpacity=".9" />
          <stop offset=".5" stopColor="#f0e6ff" stopOpacity=".1" />
          <stop offset="1" stopColor="#a7d7ff" stopOpacity=".7" />
        </linearGradient>
        <filter
          id={`${uid}shadow`}
          x="-30%"
          y="-30%"
          width="160%"
          height="160%"
        >
          <feDropShadow
            dx="1"
            dy="3"
            stdDeviation="2"
            floodColor="#44366f"
            floodOpacity=".35"
          />
        </filter>
      </defs>
      <g className="membrane" style={{ transformOrigin: "50px 50px" }}>
        <path
          d={path}
          fill={`url(#${uid}mem)`}
          stroke="#dae5ff"
          strokeWidth="1.4"
          filter={`url(#${uid}shadow)`}
        />
        <path
          d={path}
          fill="none"
          stroke={`url(#${uid}shine)`}
          strokeWidth="3"
          opacity=".8"
          transform="translate(2 2) scale(.96)"
        />
      </g>
      <g className="organelles">
        {Array.from({ length: kind === "dendritic" ? 14 : 27 }, (_, i) => {
          const a = i * 2.39996;
          const r = 18 + (i % 4) * 4.4;
          return (
            <g
              key={i}
              transform={`translate(${50 + Math.cos(a) * r} ${50 + Math.sin(a) * r})`}
            >
              <circle
                r={1.3 + (i % 3) * 0.6}
                fill={`url(#${uid}ves)`}
                stroke="#e7dfff"
                strokeWidth=".4"
              />
              <circle cx="-.5" cy="-.6" r=".5" fill="#fff" opacity=".65" />
            </g>
          );
        })}
      </g>
      <g className="nucleus" filter={`url(#${uid}shadow)`}>
        {pink ? (
          <>
            <path
              d="M35 31 C42 25 50 28 49 36 Q49 42 42 42 C33 44 28 37 35 31 M55 36 C65 29 72 34 71 43 Q69 52 61 49 C54 48 51 43 55 36 M45 53 C47 44 58 47 59 54 Q62 65 53 68 C43 71 38 61 45 53"
              fill={`url(#${uid}nuc)`}
            />
            <path
              d="M43 39 Q48 43 58 42 M58 47 L53 54"
              stroke="#604081"
              strokeWidth="3"
              fill="none"
            />
          </>
        ) : kind === "dendritic" ? (
          <ellipse
            cx="49"
            cy="48"
            rx="13"
            ry="15"
            fill={`url(#${uid}nuc)`}
            stroke="#c1b2ed"
          />
        ) : (
          <path
            d="M51 29 C65 29 69 43 59 46 C48 48 52 54 59 56 C67 61 58 75 48 70 C30 64 30 45 38 36 C42 31 46 29 51 29"
            fill={`url(#${uid}nuc)`}
            stroke="#c4afe6"
            strokeWidth=".9"
          />
        )}
        <ellipse
          cx="44"
          cy="35"
          rx="5"
          ry="2.2"
          fill="#efe4ff"
          opacity=".22"
          transform="rotate(-30 44 35)"
        />
        <circle cx="49" cy="39" r="2" fill="#46306e" opacity=".6" />
      </g>
      <path
        d="M27 30 Q24 23 32 21 M29 24 L38 20"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity=".65"
      />
      {infected && (
        <g className="internal-pathogen">
          <ellipse
            cx="66"
            cy="59"
            rx="10"
            ry="8"
            fill="#fdc35f"
            fillOpacity=".35"
            stroke="#f8b74c"
            strokeDasharray="2 1"
          />
          <circle cx="63" cy="59" r="3.5" fill="#426db4" />
          <circle cx="69" cy="59" r="3.5" fill="#426db4" />
        </g>
      )}
    </svg>
  );
}
export function PathogenArt({ marked = false }: { marked?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 100 75"
      className="pathogen-art"
      role="img"
      aria-label={marked ? "已調理的肺炎鏈球菌" : "莢膜包覆的肺炎鏈球菌"}
    >
      <defs>
        <radialGradient id={`${id}p`} cx="30%" cy="24%" r="78%">
          <stop stopColor="#c3dbff" />
          <stop offset=".38" stopColor="#7a91d9" />
          <stop offset=".78" stopColor="#4b58a5" />
          <stop offset="1" stopColor="#384177" />
        </radialGradient>
        <radialGradient id={`${id}c`} cx="30%" cy="20%">
          <stop stopColor="#f0faff" stopOpacity=".8" />
          <stop offset=".6" stopColor="#acc9ef" stopOpacity=".3" />
          <stop offset="1" stopColor="#d2eaff" stopOpacity=".7" />
        </radialGradient>
      </defs>
      <g className="bacterial-membrane">
        <path
          d="M49 14 C22 -1 0 22 7 44 C12 63 36 68 49 58 C65 70 91 57 94 37 C97 15 70 0 49 14Z"
          fill={`url(#${id}c)`}
          stroke="#d2efff"
          strokeWidth="2"
        />
        <ellipse
          cx="31"
          cy="35"
          rx="19"
          ry="22"
          fill={`url(#${id}p)`}
          stroke="#afc6ed"
          strokeWidth="1.2"
          transform="rotate(24 31 35)"
        />
        <ellipse
          cx="68"
          cy="34"
          rx="19"
          ry="22"
          fill={`url(#${id}p)`}
          stroke="#afc6ed"
          strokeWidth="1.2"
          transform="rotate(24 68 34)"
        />
        {[22, 29, 38, 57, 65, 74].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={23 + (i % 3) * 10}
            r={1.7 + (i % 2)}
            fill="#c4d2ff"
            opacity=".55"
          />
        ))}
        <path
          d="M16 25 Q22 14 32 17 M54 23 Q60 13 69 16"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity=".7"
        />
      </g>
      {marked && (
        <g
          className="opsonin-marks"
          stroke="#ffe39a"
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          {[0, 60, 120, 180, 240, 300].map((a, i) => (
            <path
              key={a}
              d="M0 0 V-6 M0 -6 L-4 -10 M0 -6 L4 -10"
              transform={`translate(${50 + 45 * Math.cos((a * Math.PI) / 180)} ${36 + 30 * Math.sin((a * Math.PI) / 180)}) rotate(${a + 90})`}
              data-molecule={i % 2 ? "antibody" : "complement"}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
