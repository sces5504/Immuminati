import { useEffect, useRef, useState } from "react";
import type {
  BattleState,
  CellKind,
  Command,
  Progress,
  Session,
} from "../domain/model";
import { content, scenarioCards } from "../content/game";
import {
  createBattle,
  occupancy,
  power,
  preservation,
  validateCommand,
} from "../engine/battle";
import {
  dispatch,
  newSession,
  recordResult,
  undo,
} from "../application/session";
import {
  defaultProgress,
  downloadSave,
  load,
  pack,
  parseSave,
  store,
} from "../persistence/save";
import { Playback, type VisualState } from "../presentation/playback";
import { CellArt, PathogenArt } from "../presentation/CellArt";
import { Board } from "./Board";
import { Dialog } from "./Dialog";
import { Encyclopedia } from "./Encyclopedia";
type Modal =
  | "encyclopedia"
  | "settings"
  | "log"
  | "lymph"
  | "unavailable"
  | null;
const totalLoad = (b: BattleState) =>
  b.populations.reduce((a, p) => a + p.load, 0);
export default function App() {
  const [initial] = useState(() => load(content));
  const [progress, setProgress] = useState<Progress>(
    () =>
      initial.save?.progress ??
      defaultProgress(matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [session, setSession] = useState<Session | null>(
    initial.save?.session ?? null,
  );
  const sessionRef = useRef(session);
  const progressRef = useRef(progress);
  const [view, setView] = useState<"home" | "battle">("home");
  const [modal, setModal] = useState<Modal>(null);
  const [entry, setEntry] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [visual, setVisual] = useState<VisualState>({
    state: session?.state ?? createBattle("m1", 1, content),
    duration: 0,
  });
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const playback = useRef<Playback | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const [region, setRegion] = useState("a");
  const [moveMode, setMoveMode] = useState(false);
  const [seed, setSeed] = useState("1");
  const [message, setMessage] = useState(initial.error ?? "");
  const [saveStatus, setSaveStatus] = useState(
    initial.save ? "已載入本機存檔" : "本機存檔就緒",
  );
  const file = useRef<HTMLInputElement>(null);
  const persist = (next: Session | null, p = progressRef.current) =>
    setSaveStatus(store(pack(next, p)));
  function updateProgress(p: Progress) {
    progressRef.current = p;
    setProgress(p);
    persist(sessionRef.current, p);
  }
  function commit(next: Session, p = progressRef.current) {
    sessionRef.current = next;
    setSession(next);
    progressRef.current = p;
    setProgress(p);
    persist(next, p);
  }
  function start(id = "m1", variantSeed = Number(seed) || 1) {
    playback.current?.cancel();
    lockedRef.current = false;
    setLocked(false);
    const next = newSession(id, variantSeed, content);
    commit(next);
    setVisual({ state: next.state, duration: 0 });
    setSelected(undefined);
    setRegion("a");
    setMoveMode(false);
    setView("battle");
    setMessage("");
    setModal(null);
  }
  function resume() {
    if (!sessionRef.current) return;
    setVisual({ state: sessionRef.current.state, duration: 0 });
    setView("battle");
    setSelected(undefined);
    setMoveMode(false);
  }
  function finishPlayback() {
    lockedRef.current = false;
    setLocked(false);
  }
  function perform(cmd: Command) {
    const current = sessionRef.current;
    if (!current || lockedRef.current) return;
    const result = dispatch(current, cmd, content);
    if (result.resolution.error) {
      setMessage(result.resolution.error);
      return;
    }
    lockedRef.current = true;
    setLocked(true);
    setMessage("");
    setMoveMode(false);
    commit(result.session, recordResult(progressRef.current, result.session));
    if (cmd.type === "move") setRegion(cmd.region);
    playback.current?.cancel();
    const p = new Playback(current.state, setVisual, finishPlayback);
    playback.current = p;
    p.speed = progressRef.current.settings.speed;
    p.reduced = progressRef.current.settings.reducedMotion;
    if (matchMedia("(max-width: 760px)").matches)
      document
        .querySelector(".battlefield")
        ?.scrollIntoView({ block: "center", behavior: "instant" });
    p.play(current.state, result.resolution.frames, result.session.state);
  }
  function doUndo() {
    if (lockedRef.current || !sessionRef.current) return;
    const next = undo(sessionRef.current, content);
    commit(next);
    setVisual({ state: next.state, duration: 0 });
    setMoveMode(false);
    setMessage("已撤銷最後一項指令，AP、預約與紀錄一併恢復。");
  }
  function showEntry(id = "") {
    setEntry(id);
    setModal("encyclopedia");
    if (id && !progressRef.current.read.includes(id))
      updateProgress({
        ...progressRef.current,
        read: [...progressRef.current.read, id],
      });
  }
  useEffect(() => {
    const hide = () => {
      if (document.hidden) playback.current?.skip();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      playback.current?.cancel();
    };
  }, []);
  useEffect(() => {
    if (playback.current) {
      playback.current.speed = progress.settings.speed;
      playback.current.reduced = progress.settings.reducedMotion;
    }
  }, [progress.settings]);
  async function importFile(f: File) {
    try {
      if (f.size > 2_000_000) throw new Error("檔案超過 2 MB 上限。");
      const save = parseSave(await f.text(), content);
      playback.current?.cancel();
      finishPlayback();
      sessionRef.current = save.session;
      setSession(save.session);
      progressRef.current = save.progress;
      setProgress(save.progress);
      persist(save.session, save.progress);
      if (save.session) setVisual({ state: save.session.state, duration: 0 });
      setView("home");
      setModal(null);
      setMessage("存檔匯入成功；可繼續進行中的防線。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  const b = session?.state,
    s = b ? content.scenarios[b.scenario] : content.scenarios.m1;
  const unit = b?.units.find((u) => u.id === selected),
    pathogen = b?.populations.find((p) => p.id === selected),
    rs = s.regions.find((r) => r.id === region) ?? s.regions[0];
  const localPathogens =
    b?.populations.filter(
      (p) =>
        p.region === unit?.region &&
        p.compartment === "extracellular" &&
        p.load > 0,
    ) ?? [];
  const settings = progress.settings;
  const selectedTarget =
    localPathogens.find((p) => p.id === unit?.priority) ||
    [...localPathogens].sort(
      (a, z) => z.load - a.load || a.id.localeCompare(z.id),
    )[0];
  const openSettings = () => setModal("settings");
  const changeSetting = (next: Partial<Progress["settings"]>) =>
    updateProgress({
      ...progressRef.current,
      settings: { ...progressRef.current.settings, ...next },
    });
  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            playback.current?.skip();
            setView("home");
          }}
          aria-label="Immuminati 返回選關"
        >
          <img src={`${import.meta.env.BASE_URL}assets/mark.svg`} alt="" />
          <span>
            IMMUMINATI<small>微觀防線 · IMMUNE COMMAND</small>
          </span>
        </button>
        <div className="top-actions">
          <button onClick={() => showEntry()} aria-label="開啟百科">
            ▤ <span>百科</span>
          </button>
          <button onClick={openSettings} aria-label="設定與存檔">
            ⚙ <span>設定</span>
          </button>
        </div>
      </header>
      {message && (
        <div className="message" role="status">
          <span>{message}</span>
          <button onClick={() => setMessage("")} aria-label="關閉提示">
            ×
          </button>
        </div>
      )}
      {view === "home" ? (
        <main className="home">
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">A WORLD WITHIN · 身體裡的指揮室</span>
              <h1>
                微小的細胞，
                <br />
                共同守住<span>防線。</span>
              </h1>
              <p>
                觀察、調度、協作。進入柔光微觀世界，
                <br className="desktop-only" />
                讓每一次免疫反應，都成為有意義的決定。
              </p>
              <div className="hero-actions">
                <button className="primary" onClick={() => start()}>
                  {session && !session.state.outcome
                    ? "開始新的 M1"
                    : "進入莢膜防線"}{" "}
                  <span>↗</span>
                </button>
                {session && (
                  <button className="secondary" onClick={resume}>
                    {session.state.outcome
                      ? "查看上次結算"
                      : `繼續回合 ${session.state.turn}`}{" "}
                    →
                  </button>
                )}
              </div>
              <div className="hero-facts">
                <span>4 AP 多指令</span>
                <span>回合制區域指揮</span>
                <span>無永久數值升級</span>
              </div>
            </div>
            <div
              className={`hero-microscope ${settings.idle && !settings.reducedMotion ? "idle-on" : ""}`}
              aria-label="分層細胞動態預覽"
            >
              <div className="microscope-tissue" />
              <div className="orb-ring" />
              <div className="hero-cell cell-one">
                <CellArt />
              </div>
              <div className="hero-cell cell-two">
                <CellArt kind="neutrophil" />
              </div>
              <div className="hero-cell cell-three">
                <CellArt kind="dendritic" />
              </div>
              <div className="hero-pathogen">
                <PathogenArt marked />
              </div>
              <div className="microscope-caption">
                <i /> 肺部微環境 <span>LIVE FIELD</span>
              </div>
              <div className="specimen-tag">
                巨噬細胞 <small>MACROPHAGE</small>
              </div>
            </div>
          </section>
          <section className="scenario-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CHOOSE A CASE</span>
                <h2>選擇你的防禦情境</h2>
              </div>
              <label className="seed-picker">
                配置種子
                <input
                  type="number"
                  min="1"
                  max="4294967295"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
              </label>
            </div>
            <p className="section-intro">
              所有情境從開場可查閱，無須解鎖。目前可玩里程碑為
              M1，其餘關卡開發中。
            </p>
            <div className="scenario-grid">
              {scenarioCards.map((card) => (
                <button
                  className={`scenario-card ${card.ready ? "ready" : ""}`}
                  key={card.id}
                  onClick={() => {
                    if (card.ready) start(card.id);
                    else {
                      setUnavailable(card.id);
                      setModal("unavailable");
                    }
                  }}
                >
                  <div className="card-top">
                    <span>{card.index} /</span>
                    <small>
                      {card.ready
                        ? `● ${card.id.toUpperCase()} 可玩`
                        : "開發中"}
                    </small>
                  </div>
                  <div className="card-specimen">
                    {card.ready ? (
                      <PathogenArt />
                    ) : (
                      <span
                        className={`abstract-pathogen pathogen-${card.id}`}
                      />
                    )}
                  </div>
                  <h3>{card.name}</h3>
                  <p>{card.subtitle}</p>
                  <div className="card-footer">
                    <span>{card.tag}</span>
                    <span>
                      {progress.records[card.id]
                        ? "★".repeat(progress.records[card.id].stars)
                        : card.ready
                          ? "進入 →"
                          : "查看 →"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <footer className="home-footer">
            <p>細胞是群體、回合是決策片段。這是一個關於協作的免疫學遊戲。</p>
            <span>
              M1 · 0.1.0 <i /> {saveStatus}
            </span>
          </footer>
        </main>
      ) : (
        b && (
          <main className="game">
            <div className="case-heading">
              <button
                className="back-link"
                onClick={() => {
                  playback.current?.skip();
                  setView("home");
                }}
              >
                ← 選關
              </button>
              <div>
                <span className="eyebrow">
                  {s.id.toUpperCase()} ·{" "}
                  {content.pathogens[s.pathogen].english.toUpperCase()}
                </span>
                <h1>
                  {s.title} <small>{content.pathogens[s.pathogen].name}</small>
                </h1>
              </div>
              <button
                className="text-button"
                onClick={() => showEntry(s.pathogen)}
              >
                案例說明 ↗
              </button>
            </div>
            <section className="command-bar" aria-label="回合資源">
              <div className="turn-stat">
                <small>指揮回合</small>
                <b>
                  {b.turn}
                  <span>/ {s.maxTurns}</span>
                </b>
              </div>
              <div className="ap-stat">
                <small>共用行動點</small>
                <div>
                  <b>{b.ap}</b>
                  <span className="ap-dots">
                    {Array.from({ length: s.ap }, (_, i) => (
                      <i className={i < b.ap ? "filled" : ""} key={i} />
                    ))}
                  </span>
                </div>
              </div>
              <div>
                <small>組織保全</small>
                <b
                  className={
                    preservation(b, content) < 60
                      ? "danger-text"
                      : "healthy-text"
                  }
                >
                  {preservation(b, content)}
                  <span>%</span>
                </b>
                <span className="preservation-bar">
                  <i style={{ width: `${preservation(b, content)}%` }} />
                </span>
              </div>
              <div>
                <small>感染負荷</small>
                <b>
                  {totalLoad(b)}
                  <span> 活來源</span>
                </b>
              </div>
              <button className="log-button" onClick={() => setModal("log")}>
                因果紀錄 <span>↗</span>
              </button>
            </section>
            <div className="game-layout">
              <section className="field-column">
                <div className="field-toolbar">
                  <span>
                    <i className="status-dot" />
                    {locked
                      ? "已提交 · 動作播放中"
                      : b.outcome
                        ? "此局已結算"
                        : "指揮階段 · 基本行為於回合末自動執行"}
                  </span>
                  <div>
                    <label>
                      速度
                      <select
                        aria-label="動畫速度"
                        value={settings.speed}
                        onChange={(e) =>
                          changeSetting({ speed: Number(e.target.value) })
                        }
                      >
                        <option value="1">正常</option>
                        <option value="2">2×</option>
                        <option value="4">4×</option>
                      </select>
                    </label>
                    <button
                      onClick={() => playback.current?.skip()}
                      disabled={!locked}
                    >
                      跳過動畫 »
                    </button>
                  </div>
                </div>
                <Board
                  visual={visual}
                  content={content}
                  selected={selected}
                  onSelect={(id) => {
                    setSelected(id);
                    const obj = [...b.units, ...b.populations].find(
                      (v) => v.id === id,
                    );
                    if (obj) setRegion(obj.region);
                    setMoveMode(false);
                    if (matchMedia("(max-width: 760px)").matches)
                      requestAnimationFrame(() =>
                        document
                          .querySelector(".control-panel")
                          ?.scrollIntoView({
                            block: "start",
                            behavior: "instant",
                          }),
                      );
                  }}
                  selectedRegion={region}
                  onRegion={(id) => {
                    if (moveMode && unit)
                      perform({ type: "move", unitId: unit.id, region: id });
                    else {
                      setRegion(id);
                      setSelected(undefined);
                    }
                  }}
                  moveMode={moveMode}
                  idle={settings.idle}
                  reduced={settings.reducedMotion}
                />
                <div className="event-caption" aria-live="polite">
                  <span className="event-symbol">
                    {visual.event ? "◉" : "⌁"}
                  </span>
                  <p>
                    {visual.event?.reason ??
                      (b.outcome
                        ? b.outcome.reason
                        : "點選細胞查看作用，點選雙球菌施加調理；也可點區域安排增援。")}
                  </p>
                </div>
                {settings.hints && (
                  <div className="context-hint">
                    <span>策略提示</span>
                    <p>
                      {b.outcome
                        ? "星等取決於結算時的組織保全，不提供永久戰力加成。"
                        : b.opsonins > 0 &&
                            b.populations.some((p) => !p.opsonin && p.load > 0)
                          ? "先標記高負荷群體，讓同區吞噬者在回合末免費執行基本行為。手動吞噬適合先清場再調度。"
                          : "留意增援抵達與標記到期。調度不占主要作用；移到新區後仍能在回合末吞噬。"}
                    </p>
                    <button
                      onClick={() => changeSetting({ hints: false })}
                      aria-label="關閉情境提示"
                    >
                      ×
                    </button>
                  </div>
                )}
                <div className="forecast">
                  <div>
                    <span className="eyebrow">NEXT RESOLUTION</span>
                    <h3>下次結算預告</h3>
                  </div>
                  <ol>
                    <li>
                      <b>01</b> 未使用主要作用者自動吞噬
                    </li>
                    <li>
                      <b>02</b> 殘餘群體繁殖 +
                      {content.pathogens[s.pathogen].replication}；≥
                      {s.spreadThreshold} 時擴散 1
                    </li>
                    <li>
                      <b>03</b> 每點殘餘負荷造成 {s.damagePerLoad} 組織損傷
                    </li>
                    <li>
                      <b>04</b> 等待推進 → 標記到期 → 勝敗
                    </li>
                  </ol>
                </div>
              </section>
              <aside className="control-panel" aria-label="指揮面板">
                <div className="panel-tabs">
                  <button className="active">區域指揮</button>
                  <button onClick={() => setModal("lymph")}>淋巴結 ↗</button>
                  <button onClick={() => setModal("log")}>紀錄 ↗</button>
                </div>
                <div className="selection-detail">
                  <span className="eyebrow">
                    {unit
                      ? "CELL COMMAND"
                      : pathogen
                        ? "PATHOGEN STATUS"
                        : "REGION COMMAND"}
                  </span>
                  <h2>
                    {unit
                      ? content.cells[unit.kind].name
                      : pathogen
                        ? content.pathogens[pathogen.pathogen].name
                        : rs.name}
                  </h2>
                  <p className="selection-subtitle">
                    {rs.name} <span>·</span>{" "}
                    {unit
                      ? unit.used
                        ? "主要作用已使用"
                        : "主要作用可用"
                      : pathogen
                        ? pathogen.opsonin
                          ? `已調理 · 尚餘 ${pathogen.opsonin} 次結算`
                          : "莢膜保護 · 尚未調理"
                        : `${rs.subtitle} · 容量 ${occupancy(b, region)}/${rs.capacity}`}
                  </p>
                  {unit ? (
                    <>
                      <div
                        className={`portrait ${settings.idle && !settings.reducedMotion ? "idle-on" : ""}`}
                      >
                        <CellArt
                          kind={unit.kind}
                          infected={b.populations.some(
                            (p) => p.hostId === unit.id && p.load > 0,
                          )}
                        />
                        <span className="portrait-grid" />
                      </div>
                      <p className="unit-description">
                        {content.cells[unit.kind].description}
                      </p>
                      <div className="command-stack">
                        <button
                          className={`primary ${moveMode ? "picking" : ""}`}
                          disabled={locked || !!b.outcome || b.ap < 1}
                          onClick={() => {
                            setMoveMode(!moveMode);
                            setMessage("");
                          }}
                        >
                          ✥ {moveMode ? "點選戰場目的區域" : "調度至相鄰區域"}{" "}
                          <small>1 AP</small>
                        </button>
                        {moveMode && (
                          <div className="target-buttons">
                            {rs.neighbors.map((id) => {
                              const cmd: Command = {
                                type: "move",
                                unitId: unit.id,
                                region: id,
                              };
                              const error = validateCommand(b, cmd, content);
                              return (
                                <button
                                  key={id}
                                  disabled={!!error || locked}
                                  title={error}
                                  onClick={() => perform(cmd)}
                                >
                                  {s.regions.find((r) => r.id === id)!.name}
                                  {error && <small>{error}</small>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {localPathogens.length > 1 && (
                          <label>
                            自動作用優先群體
                            <select
                              aria-label="優先目標"
                              value={unit.priority ?? selectedTarget?.id}
                              onChange={(e) =>
                                perform({
                                  type: "priority",
                                  unitId: unit.id,
                                  targetId: e.target.value,
                                })
                              }
                              disabled={locked}
                            >
                              {localPathogens.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.id} · 負荷 {p.load}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <button
                          className="navy"
                          disabled={
                            locked ||
                            !!b.outcome ||
                            !selectedTarget ||
                            unit.used ||
                            b.ap < 2
                          }
                          onClick={() =>
                            selectedTarget &&
                            perform({
                              type: "engulf",
                              unitId: unit.id,
                              targetId: selectedTarget.id,
                            })
                          }
                        >
                          ◕ 主動吞噬 <small>2 AP</small>
                        </button>
                        <p className="action-explainer">
                          {unit.used
                            ? "已使用主要作用，本回合不再自動吞噬。"
                            : selectedTarget
                              ? `現在吞入 ${Math.min(selectedTarget.load, power(unit, selectedTarget, content))} 負荷；會取代本回合自動吞噬。`
                              : "同區沒有合法胞外目標。"}
                        </p>
                      </div>
                      <button
                        className="detail-link"
                        onClick={() =>
                          showEntry(content.cells[unit.kind].encyclopedia)
                        }
                      >
                        查看細胞機制 ↗
                      </button>
                    </>
                  ) : pathogen ? (
                    <>
                      <div className="portrait pathogen-portrait">
                        <PathogenArt marked={pathogen.opsonin > 0} />
                      </div>
                      <div className="pathogen-readout">
                        <span>
                          胞外負荷 <b>{pathogen.load}</b>
                        </span>
                        <span>
                          繁殖 <b>+2 / 回合</b>
                        </span>
                      </div>
                      <p className="unit-description">
                        莢膜限制吞噬。使用既存特異性抗體與補體做局部標記，讓吞噬者提高效率。
                      </p>
                      <button
                        className="primary full"
                        disabled={
                          locked ||
                          !!b.outcome ||
                          pathogen.opsonin > 0 ||
                          b.opsonins === 0 ||
                          b.ap < 1
                        }
                        onClick={() =>
                          perform({ type: "opsonize", targetId: pathogen.id })
                        }
                      >
                        Y 施加調理 <small>1 AP</small>
                      </button>
                      <p className="action-explainer">
                        {pathogen.opsonin > 0
                          ? `已標記，尚餘 ${pathogen.opsonin} 次結算；標記不直接減少負荷。`
                          : `支援剩餘 ${b.opsonins} 次；作用持續 ${s.opsoninDuration} 次結算。`}
                      </p>
                      <button
                        className="detail-link"
                        onClick={() => showEntry("opsonization")}
                      >
                        調理為何不是清除？ ↗
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="region-summary">
                        <strong>
                          {b.regions[region]}
                          <small>%</small>
                        </strong>
                        <span>組織完整度</span>
                        <p>
                          同區自動作用，沿連線調度。增援預約會先占用目的地容量。
                        </p>
                      </div>
                      <div className="region-unit-list">
                        {b.units
                          .filter((u) => u.region === region)
                          .map((u) => (
                            <button
                              key={u.id}
                              onClick={() => setSelected(u.id)}
                            >
                              <CellArt kind={u.kind} />
                              <span>
                                {content.cells[u.kind].name}
                                <small>
                                  {u.used ? "作用已使用" : "回合末自動吞噬"}
                                </small>
                              </span>
                              <b>→</b>
                            </button>
                          ))}
                      </div>
                    </>
                  )}
                </div>
                <section className="recruit-panel">
                  <div className="mini-heading">
                    <h3>募集增援</h3>
                    <span>→ {rs.name}</span>
                  </div>
                  <p>AP 支付後預留容量，等待回合結算。</p>
                  {s.pool.map((kind) => {
                    const d = content.cells[kind];
                    const cmd: Command = { type: "recruit", kind, region };
                    const error = validateCommand(b, cmd, content);
                    return (
                      <button
                        className="recruit-button"
                        key={kind}
                        onClick={() => perform(cmd)}
                        disabled={locked || !!error}
                        title={error}
                      >
                        <CellArt kind={kind} />
                        <span>
                          <b>{d.name}</b>
                          <small>{d.delay} 次結算後到場 · 預留 1 格</small>
                        </span>
                        <strong>
                          ＋<small>{d.cost} AP</small>
                        </strong>
                      </button>
                    );
                  })}
                  {occupancy(b, region) >= rs.capacity && (
                    <p className="capacity-warning">此區容量已滿，請先調度。</p>
                  )}
                  {b.recruits.length > 0 && (
                    <div className="recruit-queue">
                      {b.recruits.map((r) => (
                        <div key={r.id}>
                          <span>
                            ◷ {content.cells[r.kind].short} →{" "}
                            {s.regions.find((v) => v.id === r.region)!.name}
                          </span>
                          <b>{r.remaining} 回</b>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                <div className="panel-footer">
                  {locked && (
                    <button
                      className="mobile-skip secondary"
                      onClick={() => playback.current?.skip()}
                    >
                      跳過動畫 »
                    </button>
                  )}
                  <button
                    className={`undo ${locked ? "mobile-hidden" : ""}`}
                    disabled={locked || !session.commands.length || !!b.outcome}
                    onClick={doUndo}
                  >
                    ↶ 撤銷指令
                  </button>
                  <button
                    className="end-turn"
                    disabled={locked || !!b.outcome}
                    onClick={() => perform({ type: "endTurn" })}
                  >
                    結束回合 <span>→</span>
                  </button>
                  <small>{saveStatus}</small>
                </div>
              </aside>
            </div>
            {b.outcome && !locked && (
              <section
                className={`result-panel ${b.outcome.type}`}
                aria-label="關卡結算"
                data-testid="result"
              >
                <div>
                  <span className="eyebrow">
                    FIELD REPORT · {s.id.toUpperCase()}
                  </span>
                  <h2>
                    {b.outcome.type === "victory"
                      ? "防線，守住了。"
                      : "重整防線，再試一次。"}
                  </h2>
                  <p>
                    {b.outcome.reason}。
                    {b.outcome.type === "victory"
                      ? "此結果代表遊戲情境目標達成，不代表臨床治癒。"
                      : "先調理高負荷群體、增援與調度可減少持續損傷。"}
                  </p>
                  <div className="result-causality">
                    {session.events
                      .filter((e) =>
                        [
                          "OpsoninApplied",
                          "PathogenEngulfed",
                          "TissueDamaged",
                        ].includes(e.type),
                      )
                      .slice(-4)
                      .map((e) => (
                        <small key={e.id}>{e.reason}</small>
                      ))}
                  </div>
                </div>
                <div className="result-score">
                  <span className="stars">
                    {b.outcome.stars ? "★".repeat(b.outcome.stars) : "—"}
                  </span>
                  <b>{b.outcome.preservation}%</b>
                  <small>組織保全 · {b.outcome.turn} 回合</small>
                  <p>
                    三星 ≥{s.stars[0]}% · 二星 ≥{s.stars[1]}%
                  </p>
                </div>
                <div className="result-actions">
                  <button
                    className="primary"
                    onClick={() => start(b.scenario, b.seed)}
                  >
                    重試相同配置
                  </button>
                  <button
                    className="secondary"
                    onClick={() => start(b.scenario, b.seed + 1)}
                  >
                    切換配置變體
                  </button>
                  <button onClick={() => setModal("log")}>
                    查看完整因果紀錄
                  </button>
                </div>
              </section>
            )}
          </main>
        )
      )}
      {modal === "encyclopedia" && (
        <Encyclopedia
          initial={entry}
          read={progress.read}
          onRead={(id) => {
            if (!progressRef.current.read.includes(id))
              updateProgress({
                ...progressRef.current,
                read: [...progressRef.current.read, id],
              });
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "settings" && (
        <Dialog title="設定與存檔" onClose={() => setModal(null)}>
          <div className="settings-content">
            <h3>動態與節奏</h3>
            <label className="toggle">
              <span>細胞待機漂浮與局部形變</span>
              <input
                type="checkbox"
                checked={settings.idle}
                onChange={(e) => changeSetting({ idle: e.target.checked })}
              />
            </label>
            <label className="toggle">
              <span>降低動態效果</span>
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => {
                  changeSetting({ reducedMotion: e.target.checked });
                  if (e.target.checked) playback.current?.skip();
                }}
              />
            </label>
            <label className="toggle">
              <span>顯示情境提示</span>
              <input
                type="checkbox"
                checked={settings.hints}
                onChange={(e) => changeSetting({ hints: e.target.checked })}
              />
            </label>
            <p>降低模式使用短過渡；規則、AP 與結果保持相同。此版無音效。</p>
            <h3>本機續玩與備份</h3>
            <p>
              {saveStatus}
              。存檔包含當局、撤銷快照、因果紀錄、百科已讀與設定。跨裝置請手動匯出／匯入。
            </p>
            <div className="save-actions">
              <button
                className="primary"
                onClick={() =>
                  downloadSave(pack(sessionRef.current, progressRef.current))
                }
              >
                ↓ 匯出存檔
              </button>
              <button
                className="secondary"
                onClick={() => file.current?.click()}
              >
                ↑ 匯入存檔
              </button>
            </div>
            <p className="fine-print">
              支援本版格式，最多 2
              MB；驗證失敗不覆寫。清除瀏覽器資料會失去本機紀錄。
            </p>
            <button className="detail-link" onClick={() => showEntry("rules")}>
              查閱規則、組織保全與星等 ↗
            </button>
          </div>
        </Dialog>
      )}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="匯入存檔檔案"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {modal === "log" && (
        <Dialog title="因果紀錄" onClose={() => setModal(null)} wide>
          <div className="log-content">
            <p>
              由權威規則事件產生：投入 → 條件 → 作用 →
              結果。跳過動畫仍保留全部紀錄。
            </p>
            {session?.events.length ? (
              session.events.map((e) => (
                <div className="log-entry" key={e.id}>
                  <span>
                    回合 {e.turn}
                    <small>
                      {
                        {
                          command: "指揮",
                          cells: "細胞",
                          pathogens: "病原",
                          tissue: "組織",
                          waiting: "等待",
                          result: "結果",
                        }[e.phase]
                      }
                    </small>
                  </span>
                  <p>{e.reason}</p>
                  <small>{e.id}</small>
                </div>
              ))
            ) : (
              <p>尚未下達指令。</p>
            )}
          </div>
        </Dialog>
      )}
      {modal === "lymph" && (
        <Dialog title="引流淋巴結 · 支援區" onClose={() => setModal(null)}>
          <div className="settings-content">
            <span className="eyebrow">SUPPORT NETWORK</span>
            <h3>這次，先運用既存的防線。</h3>
            <p>
              M1
              提供有限既存特異性抗體與補體支援，無須在短局內重新產生抗體。抗原呈遞、T／B
              活化與分化等待將在 M2 擴充。
            </p>
            <p>淋巴結是啟動與分化支援區，不是可任意駐留的第四個戰鬥區域。</p>
            <button className="primary" onClick={() => showEntry("dendritic")}>
              查看抗原呈遞機制 ↗
            </button>
          </div>
        </Dialog>
      )}
      {modal === "unavailable" && (
        <Dialog
          title={scenarioCards.find((c) => c.id === unavailable)!.name}
          onClose={() => setModal(null)}
        >
          <div className="settings-content">
            <span className="eyebrow">開發中 · 無須解鎖</span>
            <h3>{scenarioCards.find((c) => c.id === unavailable)!.subtitle}</h3>
            <p>
              此情境的規格與百科可查閱，玩法及專用動畫尚未完成。本次可玩交付是
              M1「莢膜防線」。
            </p>
            <button
              className="primary"
              onClick={() =>
                showEntry(
                  (
                    {
                      m2: "salmonella",
                      m3: "tuberculosis",
                      m4: "influenza",
                      m5: "candida",
                      m6: "hiv",
                    } as Record<string, string>
                  )[unavailable],
                )
              }
            >
              查閱機制與簡化範圍 ↗
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
