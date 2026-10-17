import type {
  TacticalState,
  TacticalContent,
  HostCell,
  Cell,
} from "../domain/model";
import {
  compartmentNames,
  hostStatus,
  tissueCellCatalog,
} from "../content/anatomy";
import { tissueProfiles } from "../content/tissues";

function SectionDiagram({
  lung,
  lymphoid = false,
}: {
  lung: boolean;
  lymphoid?: boolean;
}) {
  return (
    <svg
      className="t-anatomy-section"
      viewBox="0 0 560 240"
      role="img"
      aria-label={
        lung
          ? "肺泡腔、肺泡上皮、間質與微血管的剖面位置關係"
          : "黏膜腔面、上皮與組織側的剖面位置關係"
      }
    >
      <rect x="0" y="0" width="560" height="240" rx="16" fill="#263a50" />
      <path d="M18 15H542V92H18Z" fill="#d4e6e5" />
      <text x="32" y="39" fill="#284456">
        {lung
          ? "肺泡腔｜細胞外"
          : lymphoid
            ? "淋巴組織間隙｜細胞外"
            : "黏膜腔面｜細胞外"}
      </text>
      <text x="32" y="63" className="t-svg-small" fill="#48626a">
        {lymphoid
          ? "基質與淋巴球之間是胞外；潛伏病毒位於 CD4 宿主細胞核內"
          : "病原與巡防免疫細胞位於腔面；這個空間不是一顆細胞"}
      </text>
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path
            d={`M${18 + i * 105} 96 Q${70 + i * 105} 87 ${120 + i * 105} 96V118H${18 + i * 105}Z`}
            fill="#dcaebe"
            stroke="#8f718e"
            strokeWidth="2"
          />
          <ellipse
            cx={68 + i * 105}
            cy="105"
            rx={i === 3 ? 12 : 16}
            ry={i === 3 ? 8 : 4}
            fill="#97769f"
          />
        </g>
      ))}
      <text x="32" y="141" fill="#f0d7e2">
        {lymphoid
          ? "網狀基質＋淋巴球｜細胞膜內才是胞內"
          : "上皮細胞＋基底膜｜區隔腔面與組織側"}
      </text>
      <path d="M18 122H542" stroke="#c9cee4" strokeWidth="3" />
      <text x="32" y="168" fill="#cededc">
        間質｜也是細胞外，但不等於肺泡腔
      </text>
      <rect
        x="25"
        y="184"
        width="400"
        height="37"
        rx="18"
        fill="#a36386"
        stroke="#d9bbd3"
        strokeWidth="4"
      />
      <ellipse cx="77" cy="202" rx="16" ry="8" fill="#df9ca7" />
      <ellipse cx="137" cy="202" rx="16" ry="8" fill="#df9ca7" />
      <text x="190" y="208" fill="#fff0f5">
        血管腔｜細胞外
      </text>
      <path d="M477 201V153M477 92V80" stroke="#b9f0dc" strokeWidth="3" />
      <path
        d="M469 88L477 79L485 88"
        fill="none"
        stroke="#b9f0dc"
        strokeWidth="3"
      />
      <text x="438" y="225" fill="#c5eadc" className="t-svg-small">
        募集跨越屏障
      </text>
    </svg>
  );
}
function Cutaway({
  host,
  cell,
  state,
  content,
}: {
  host?: HostCell;
  cell?: Cell;
  state: TacticalState;
  content: TacticalContent;
}) {
  const cargo = cell ? state.internal.filter((p) => p.host === cell.id) : [];
  const load = cargo.reduce((n, p) => n + p.load, 0) + (host?.load ?? 0);
  const compartment = host?.infection?.compartment ?? cargo[0]?.compartment;
  const processing = cargo.some((p) => p.stage === "processing");
  return (
    <div
      className="t-cutaway"
      data-testid="cell-cutaway"
      data-compartment={compartment ?? "none"}
      data-internal-load={load}
    >
      <svg
        viewBox="0 0 440 255"
        role="img"
        aria-label={`所選${cell ? content.cells[cell.kind].name : host ? tissueCellCatalog[host.kind].name : "細胞"}的局部剖視；${load ? `${compartmentNames[compartment!]}活負荷 ${load}` : "無活病原"}`}
      >
        <rect width="440" height="255" rx="18" fill="#243b50" />
        <text x="18" y="26" fill="#c9e6e6">
          細胞外
        </text>
        <path
          d="M47 139C38 55 120 45 221 51C345 39 401 77 392 143C399 221 299 227 216 223C103 234 37 205 47 139Z"
          fill="#d7bbc9"
          stroke="#a4e2db"
          strokeWidth="3"
        />
        <text x="77" y="88" fill="#4d4a65">
          細胞質
        </text>
        <ellipse
          cx="147"
          cy="148"
          rx="48"
          ry="43"
          fill="#9a7ba2"
          stroke="#dcc4de"
          strokeWidth="2"
        />
        <text x="123" y="153" fill="#f8edf9">
          細胞核
        </text>
        {cargo.some((p) => p.compartment === "phagosome") && (
          <g>
            <ellipse
              cx="290"
              cy="143"
              rx="57"
              ry="43"
              fill="#dfc293"
              stroke="#9e7c57"
              strokeWidth="3"
            />
            <text x="253" y="208" fill="#574a60">
              吞噬體
            </text>
          </g>
        )}
        {load > 0 &&
          Array.from({ length: Math.min(8, load) }, (_, i) => {
            const x =
              (compartment === "nucleus"
                ? 145
                : compartment === "phagosome"
                  ? 288
                  : 290) +
              Math.cos(i * 2.4) * 22;
            const y = 143 + Math.sin(i * 2.4) * 20;
            return (
              <g key={i} fill={processing ? "#668eaa" : "#b55c88"}>
                {host?.infection?.compartment === "nucleus" ? (
                  <path
                    d={`M${x - 7} ${y - 6}L${x + 6} ${y - 3}L${x - 6} ${y}L${x + 7} ${y + 4}L${x - 4} ${y + 7}`}
                    fill="none"
                    stroke={
                      host.infection.phase === "latent" ? "#796783" : "#b55c88"
                    }
                    strokeWidth="3"
                  />
                ) : host?.infection ? (
                  <g>
                    <circle
                      cx={x}
                      cy={y}
                      r="6"
                      stroke="#f1b5d0"
                      strokeWidth="2"
                    />
                    {[0, 1, 2, 3, 4, 5].map((k) => (
                      <path
                        key={k}
                        d={`M${x + Math.cos((k * Math.PI) / 3) * 6} ${y + Math.sin((k * Math.PI) / 3) * 6}L${x + Math.cos((k * Math.PI) / 3) * 9} ${y + Math.sin((k * Math.PI) / 3) * 9}`}
                        stroke="#b55c88"
                        strokeWidth="2"
                      />
                    ))}
                  </g>
                ) : (
                  <>
                    <ellipse cx={x - 4} cy={y} rx="5" ry="7" />
                    <ellipse cx={x + 4} cy={y} rx="5" ry="7" />
                  </>
                )}
              </g>
            );
          })}
        <path d="M376 83L411 55" stroke="#a4e2db" />
        <text x="330" y="45" fill="#c9e6e6">
          細胞膜邊界
        </text>
        <text x="19" y="247" fill="#c9e6e6" className="t-svg-small">
          局部放大示意；內部位置與活負荷讀取同一個戰場狀態
        </text>
      </svg>
      <p>
        <b>
          {load
            ? `${compartmentNames[compartment!]} · 活負荷 ${load}`
            : "胞內沒有活病原"}
        </b>
        {processing
          ? ` · 胞內處理中，最早 ${Math.max(0, Math.ceil((Math.min(...cargo.filter((p) => p.stage === "processing").map((p) => p.clearAt)) - state.tick) * 0.2))} 秒後完成一批殺菌。時間已暫停。`
          : load
            ? " · 活病原仍計入感染負荷；位置不由模型重疊判定。"
            : "；沒有感染不代表這顆細胞沒有功能。"}
      </p>
      {host?.infection && (
        <p>
          {hostStatus(host)}
          。核內線段代表病毒基因組／複製材料，不是成熟病毒顆粒。
          {host.infection.phase === "latent"
            ? "潛伏整合 DNA 未表達病毒肽，不能被 CD8 當成產毒宿主。"
            : `MHC-I ${host.mhc1 ? "保留" : "降低"} · 抗原 ${host.antigen}`}
        </p>
      )}
      {host?.apoptoticAt ? (
        <p>
          此宿主已凋亡，停止產毒；已釋出的胞外病原仍獨立存在，不隨宿主消失。
        </p>
      ) : null}
    </div>
  );
}
export function AnatomyPanel({
  state: s,
  content: c,
  selected,
  onSelect,
}: {
  state: TacticalState;
  content: TacticalContent;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  const host = s.hosts.find((h) => h.id === selected),
    cell = s.cells.find((u) => u.id === selected);
  return (
    <div className="t-anatomy-panel">
      <p className="t-anatomy-intro">
        <b>{tissueProfiles[c.tissue].name} · 開放剖視</b>：戰場中央是
        {c.tissue === "lung" ? "肺泡腔" : "黏膜腔面"}
        的細胞外環境。周圍薄片是宿主上皮細胞，不是包住整個戰場的單一細胞膜。
      </p>
      <SectionDiagram
        lung={c.tissue === "lung"}
        lymphoid={c.tissue === "lymphoid"}
      />
      <p className="t-anatomy-note">
        圖中以放大間距區分各層，非真實厚度。微血管與淋巴引流在組織側；目前募集以等待＋跨屏障入口壓縮呈現，並未完整模擬穿越各層。
      </p>
      <div className="t-anatomy-columns">
        <section>
          <h3>選取人體細胞</h3>
          <div className="t-tissue-list" aria-label="人體組織細胞">
            {s.hosts.map((h) => (
              <button
                key={h.id}
                data-tissue-id={h.id}
                aria-pressed={h.id === selected}
                onClick={() => onSelect(h.id)}
              >
                <span>
                  {tissueCellCatalog[h.kind].name}{" "}
                  <small>
                    {h.id} · {c.fields.find((f) => f.id === h.region)?.name}
                  </small>
                </span>
                <b>
                  {Math.round(h.health)}%<small>{hostStatus(h)}</small>
                </b>
              </button>
            ))}
          </div>
          <h3>免疫細胞也能檢視內部</h3>
          <div className="t-inspect-immune">
            {s.cells.map((u) => (
              <button
                key={u.id}
                data-inspect-cell={u.id}
                aria-pressed={u.id === selected}
                onClick={() => onSelect(u.id)}
              >
                {c.cells[u.kind].name} {u.id}
              </button>
            ))}
          </div>
        </section>
        <section aria-live="polite">
          {host || cell ? (
            <>
              <h3>
                {host
                  ? tissueCellCatalog[host.kind].name
                  : c.cells[cell!.kind].name}{" "}
                · {selected}
              </h3>
              {host ? (
                <p>
                  {tissueCellCatalog[host.kind].function}
                  <br />
                  位於
                  {host.layer === "vascular"
                    ? "組織側的血管壁"
                    : host.layer === "lymphoid"
                      ? "淋巴組織間隙中的宿主細胞"
                      : "上皮屏障"}
                  ；健康 {Math.round(host.health)}% · {hostStatus(host)}。<br />
                  MHC-I {host.mhc1 ? "保留" : "降低"}；
                  {host.antigen === "self"
                    ? host.infection?.phase === "latent"
                      ? "潛伏感染未表達病毒肽；自身背景抗原不代表已清除。"
                      : "呈現自身背景抗原，不代表受感染。"
                    : `抗原 ${host.antigen}；抗原呈現與活病原分開記錄。`}
                </p>
              ) : (
                <p>
                  細胞本體位於胞外環境，自己的細胞膜內則是另一個區室。吞入不等於已殺死，也不等於建立可繁殖的胞內感染。
                </p>
              )}
              <Cutaway host={host} cell={cell} state={s} content={c} />
            </>
          ) : (
            <p>從清單選取一顆組織或免疫細胞，查看細胞膜內的狀況。</p>
          )}
        </section>
      </div>
      <details>
        <summary>本版已完成與保留空間</summary>
        <p>
          M1
          顯示健康／受損肺泡上皮、血管內皮，以及吞噬體內的活菌處理。機制演練顯示帶有細胞質感染標記的宿主；這是獨立教學標本。M2
          追蹤含菌囊泡與再播散，M3 追蹤圍堵；M4／M6
          分開胞外病毒、核內基因組與產毒／潛伏宿主，M5
          有菌絲及上皮防禦。尚未模擬囊泡逃入細胞質。組織細胞健康沿用區域保全數值，未另算單顆細胞損傷或修復。
        </p>
      </details>
    </div>
  );
}
