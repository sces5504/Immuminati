import { useEffect, useRef, useState } from "react";
import type {
  CellType,
  TacticalCommand,
  TacticalSave,
  TacticalState,
  TacticalContent,
} from "../domain/model";
import { m1, tacticalScenarios } from "../content/m1";
import { TacticalController } from "../application/controller";
import {
  distance,
  fieldOf,
  loadOf,
  occupied,
  preservation,
  validateTactical,
} from "../engine/simulation";
import {
  TACTICS_KEY,
  exportTactical,
  parseTactical,
  readTactical,
  writeTactical,
} from "../persistence/save";
import {
  BattleScene,
  type Pick,
  type SceneInput,
} from "../presentation/BattleScene";
import { Encyclopedia } from "../../ui/Encyclopedia";
import { Dialog } from "../../ui/Dialog";
import { scenarioCards } from "../../content/game";
import { CellArt, PathogenArt } from "../../presentation/CellArt";
import "./tactics.css";
type Modal =
  | "help"
  | "settings"
  | "log"
  | "encyclopedia"
  | "unavailable"
  | null;
function time(tick: number) {
  const s = Math.floor(tick * 0.2);
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export default function TacticalApp() {
  const [boot] = useState(() => {
    let content = m1;
    try {
      const id = JSON.parse(localStorage.getItem(TACTICS_KEY) ?? "null")?.state
        ?.scenario;
      content = tacticalScenarios[id] ?? m1;
    } catch {
      /* readTactical reports malformed saves without replacing them. */
    }
    return { content, ...readTactical(content) };
  });
  const [controller, setController] = useState(() => {
    const ctrl = new TacticalController(boot.content, boot.save);
    if (!boot.save)
      ctrl.save.settings.reduced = matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
    ctrl.save.paused = true;
    return ctrl;
  });
  const content = controller.content;
  const [snapshot, setSnapshot] = useState(() => controller.snapshot());
  const [home, setHome] = useState(true);
  const homeRef = useRef(true);
  const [selected, setSelected] = useState<string>();
  const [region, setRegion] = useState(boot.content.fields[0].id);
  const [mode, setMode] = useState<"command" | "mark" | "move">("command");
  const [modal, setModal] = useState<Modal>(null);
  const [entry, setEntry] = useState("");
  const [unavailable, setUnavailable] = useState("");
  const [notice, setNotice] = useState(boot.error ?? "");
  const [storage, setStorage] = useState(boot.save ? "已載入存檔" : "本機存檔");
  const [sceneError, setSceneError] = useState("");
  const [cameraHint, setCameraHint] = useState(true);
  const [menu, setMenu] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    scene = useRef<BattleScene | null>(null),
    file = useRef<HTMLInputElement>(null);
  const input = useRef<SceneInput>({
    state: snapshot.state,
    selected,
    reduced: snapshot.settings.reduced,
    idle: snapshot.settings.idle,
    speed: snapshot.settings.speed,
  });
  const pickRef = useRef<(pick: Pick) => void>(() => {});
  input.current = {
    state: controller.save.state,
    selected,
    reduced: snapshot.settings.reduced,
    idle: snapshot.settings.idle,
    speed: snapshot.settings.speed,
  };
  const update = (persist = false) => {
    setSnapshot(controller.snapshot());
    input.current.state = controller.save.state;
    if (persist) setStorage(writeTactical(controller.save));
  };
  const command = (cmd: TacticalCommand) => {
    const error = controller.command(cmd);
    if (error) {
      setNotice(error);
      return false;
    }
    setNotice("");
    update(true);
    return true;
  };
  function pick(pick: Pick) {
    const s = controller.save.state;
    if (homeRef.current || s.result) return;
    if (pick.type === "cell") {
      setSelected(pick.id);
      const cell = s.cells.find((u) => u.id === pick.id);
      if (cell) setRegion(cell.region);
      setMode("command");
    } else if (pick.type === "colony") {
      const p = s.colonies.find((p) => p.id === pick.id);
      if (!p) return;
      if (mode === "mark") {
        command({ type: "mark", target: p.id });
        setMode("command");
        setSelected(p.id);
        setRegion(p.region);
      } else if (selected && s.cells.some((u) => u.id === selected)) {
        command({ type: "attack", cell: selected, target: p.id });
        setRegion(p.region);
        setMode("command");
      } else {
        setSelected(p.id);
        setRegion(p.region);
      }
    } else {
      if (mode === "mark") {
        setNotice("請點選一群仍存活的胞外病原。");
        return;
      }
      if (selected && s.cells.some((u) => u.id === selected)) {
        if (command({ type: "move", cell: selected, point: pick.point })) {
          setRegion(fieldOf(pick.point, content).id);
          setMode("command");
        }
      } else {
        setRegion(fieldOf(pick.point, content).id);
        setSelected(undefined);
      }
    }
  }
  pickRef.current = pick;
  useEffect(() => {
    try {
      const view = new BattleScene(
        host.current!,
        canvas.current!,
        content,
        () => ({ ...input.current, state: controller.save.state }),
        (p) => pickRef.current(p),
      );
      scene.current = view;
      return () => {
        view.dispose();
        scene.current = null;
      };
    } catch (e) {
      setSceneError(
        "無法啟動立體戰場。請啟用 Chrome 的硬體加速，重新整理後再試。",
      );
      console.error(e);
    }
  }, [controller]);
  useEffect(() => {
    let previous = performance.now(),
      accumulator = 0,
      raf = 0,
      lastSavedTick = controller.save.state.tick;
    const frame = (now: number) => {
      const dt = Math.min(0.5, (now - previous) / 1000);
      previous = now;
      if (
        !homeRef.current &&
        !controller.save.paused &&
        !controller.save.state.result
      ) {
        accumulator += dt * controller.save.settings.speed;
        let steps = 0;
        while (accumulator >= 0.2 && steps < 5) {
          controller.step();
          accumulator -= 0.2;
          steps++;
        }
        if (steps) {
          const persist =
            controller.save.state.tick < lastSavedTick ||
            controller.save.state.tick - lastSavedTick >= 25 ||
            !!controller.save.state.result;
          if (persist) lastSavedTick = controller.save.state.tick;
          update(persist);
        }
      } else accumulator = 0;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const hide = () => {
      if (document.hidden && !homeRef.current) {
        controller.pause(true);
        update(true);
      }
    };
    const leave = () => {
      if (!homeRef.current) writeTactical(controller.save);
    };
    const keys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        document.querySelector("dialog[open]")
      )
        return;
      if (e.code === "Space" && !homeRef.current) {
        e.preventDefault();
        controller.pause(!controller.save.paused);
        update(true);
      }
      if (e.code === "Escape") {
        setMode("command");
        setSelected(undefined);
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", leave);
    window.addEventListener("keydown", keys);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("keydown", keys);
    };
  }, [controller]);
  useEffect(() => {
    if (modal && !homeRef.current && !controller.save.paused) {
      controller.pause(true);
      update(true);
    }
  }, [modal, controller]);
  function start(fresh = true, id = content.id) {
    const nextContent = tacticalScenarios[id];
    if (!nextContent) return;
    if (fresh && id !== content.id) {
      const next = new TacticalController(nextContent);
      next.save.settings = { ...controller.save.settings };
      next.save.read = [...controller.save.read];
      next.save.records = structuredClone(controller.save.records);
      setController(next);
      setSnapshot(next.snapshot());
      setStorage(writeTactical(next.save));
      homeRef.current = false;
      setHome(false);
      setSelected(undefined);
      setRegion(nextContent.fields[0].id);
      setMenu(false);
      return;
    }
    if (fresh) controller.restart((controller.save.state.seed % 3) + 1);
    controller.pause(true);
    homeRef.current = false;
    setHome(false);
    setSelected(undefined);
    setRegion(content.fields[0].id);
    setMode("command");
    setNotice("");
    setMenu(false);
    update(true);
    scene.current?.reset();
  }
  function back() {
    controller.pause(true);
    update(true);
    homeRef.current = true;
    setHome(true);
    setMenu(false);
    setSelected(undefined);
  }
  function togglePause() {
    controller.pause(!controller.save.paused);
    update(true);
  }
  function settings(next: Partial<TacticalSave["settings"]>) {
    controller.save.settings = { ...controller.save.settings, ...next };
    update(true);
  }
  function encyclopedia(id = "") {
    setEntry(id);
    setModal("encyclopedia");
    if (id && !controller.save.read.includes(id)) {
      controller.save.read.push(id);
      update(true);
    }
  }
  async function importFile(f: File) {
    try {
      if (f.size > 2_000_000) throw new Error("檔案超過 2 MB。");
      const text = await f.text();
      let id: string | undefined;
      try {
        id = JSON.parse(text)?.state?.scenario;
      } catch {
        /* parser supplies a useful error */
      }
      const nextContent = id ? tacticalScenarios[id] : undefined;
      const save = parseTactical(text, nextContent ?? content);
      save.paused = true;
      if (nextContent && nextContent.id !== content.id) {
        const next = new TacticalController(nextContent, save);
        setController(next);
        setSnapshot(next.snapshot());
        setStorage(writeTactical(save));
      } else {
        controller.save = save;
        update(true);
      }
      homeRef.current = true;
      setHome(true);
      setModal(null);
      setSelected(undefined);
      setRegion((nextContent ?? content).fields[0].id);
      setNotice("已匯入新版存檔，繼續遊玩時先維持戰術暫停。");
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  const s = snapshot.state,
    cell = s.cells.find((u) => u.id === selected),
    colony = s.colonies.find((p) => p.id === selected),
    field = content.fields.find((f) => f.id === region) ?? content.fields[0];
  const paused = snapshot.paused,
    result = s.result,
    burden = loadOf(s),
    lastEvent = [...s.events]
      .reverse()
      .find((e) =>
        ["engulf", "mark", "arrive", "spread", "wave", "result"].includes(
          e.type,
        ),
      );
  const remainingWave = Math.max(0, Math.ceil((s.nextWaveAt - s.tick) * 0.2));
  const isMarked = !!colony && colony.markedUntil > s.tick;
  const markError = colony
    ? validateTactical(s, { type: "mark", target: colony.id }, content)
    : undefined;
  return (
    <div
      className={`tactical-root ${home ? "t-home" : ""} ${paused ? "t-paused" : ""}`}
      data-tick={s.tick}
      data-paused={paused}
      data-reduced={snapshot.settings.reduced}
      data-wave={s.wave + 1}
      data-load={burden}
      data-selected={selected}
    >
      <div className="t-scene" ref={host} data-testid="tactical-scene">
        <canvas
          ref={canvas}
          aria-label="可操作的立體肺部戰場，點細胞後再點菌群或地面；也可使用下方單位按鈕"
        />
        {!home && (
          <div className="t-world-labels">
            {content.fields.map((f) => (
              <button
                key={f.id}
                data-world-label={`field-${f.id}`}
                className={`t-field-label ${region === f.id ? "is-chosen" : ""}`}
                onClick={() => {
                  if (cell)
                    command({ type: "move", cell: cell.id, point: f.center });
                  else {
                    setRegion(f.id);
                    setSelected(undefined);
                  }
                }}
                aria-label={`防區${f.name}`}
              >
                <b>{f.id.toUpperCase()}</b>
                <span>
                  {f.name}
                  <small>
                    {Math.round(s.health[f.id])}% · {occupied(s, f.id)} 族群
                  </small>
                </span>
              </button>
            ))}
            {s.cells.map((u) => (
              <button
                key={u.id}
                data-world-label={u.id}
                className={`t-cell-label ${selected === u.id ? "is-chosen" : ""}`}
                onClick={() => pick({ type: "cell", id: u.id })}
                aria-label={`場上${content.cells[u.kind].name} ${u.id}`}
              >
                <span>
                  {selected === u.id ? content.cells[u.kind].name : "◇"}
                </span>
                {s.internal.some((p) => p.host === u.id) && (
                  <small>胞內存活</small>
                )}
              </button>
            ))}
            {s.colonies.map((p) => (
              <button
                key={p.id}
                data-world-label={p.id}
                data-colony={p.id}
                className={`t-colony-label ${p.markedUntil > s.tick ? "is-marked" : ""} ${selected === p.id ? "is-chosen" : ""}`}
                onClick={() => pick({ type: "colony", id: p.id })}
                aria-label={`菌群 ${p.id} 負荷 ${p.load}`}
              >
                <span>
                  {p.markedUntil > s.tick ? "Y " : ""}
                  {p.load}
                </span>
              </button>
            ))}
            <span className="t-portal-label" data-world-label="portal">
              微血管增援入口
            </span>
          </div>
        )}
        {sceneError && (
          <div className="t-scene-error" role="alert">
            {sceneError}
          </div>
        )}
      </div>
      <header className="t-topbar">
        <button className="t-brand" onClick={back}>
          <img src={`${import.meta.env.BASE_URL}assets/mark.svg`} alt="" />
          <span>
            IMMUMINATI<small>TACTICAL IMMUNITY</small>
          </span>
        </button>
        <div className="t-top-links">
          <button onClick={() => encyclopedia()} aria-label="開啟百科">
            ▤ <span>百科</span>
          </button>
          <button onClick={() => setModal("help")} aria-label="操作說明">
            ? <span>說明</span>
          </button>
          <button onClick={() => setModal("settings")} aria-label="設定與存檔">
            ⚙
          </button>
        </div>
      </header>
      {notice && (
        <div className="t-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="關閉提示">
            ×
          </button>
        </div>
      )}
      {home ? (
        <main className="t-landing">
          <div className="t-landing-copy">
            <span className="t-kicker">微觀世界，重新集結。</span>
            <h1>
              進入防線。
              <br />
              <em>直接指揮免疫反應。</em>
            </h1>
            <p>
              讓細胞穿過組織、包圍菌群，
              <br />
              在擴散之前，安排下一次協作。
            </p>
            <div className="t-landing-actions">
              <button
                className="t-primary"
                aria-label="開始 M1"
                onClick={() => start(true)}
                disabled={!!sceneError}
              >
                開始 M1 <span>↗</span>
              </button>
              {boot.save || s.tick > 0 || s.eventId > 1 ? (
                <button className="t-outline" onClick={() => start(false)}>
                  繼續防線 →
                </button>
              ) : null}
            </div>
            <div className="t-landing-facts">
              <span>即時行動</span>
              <span>隨時暫停部署</span>
              <span>無永久戰力升級</span>
            </div>
          </div>
          <div className="t-landing-specimen">
            <i /> LIVE MICROENVIRONMENT <span>肺部 · 莢膜防線</span>
          </div>
          <section className="t-case-strip" aria-label="選擇情境">
            <div className="t-case-title">
              <span>CHOOSE A CASE</span>
              <p>自由選關。每個病原，都有不同的防線。</p>
            </div>
            <div className="t-case-cards">
              {scenarioCards.map((c) => (
                <button
                  key={c.id}
                  className={tacticalScenarios[c.id] ? "ready" : ""}
                  onClick={() => {
                    if (tacticalScenarios[c.id]) start(true, c.id);
                    else {
                      setUnavailable(c.id);
                      setModal("unavailable");
                    }
                  }}
                >
                  <small>
                    {c.index} / {tacticalScenarios[c.id] ? "可玩" : "開發中"}
                  </small>
                  <b>{c.name}</b>
                  <span>
                    {c.subtitle} {tacticalScenarios[c.id] ? "↗" : "→"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </main>
      ) : (
        <main className="t-game">
          <section className="t-hud" aria-label="防線資源">
            <div className="t-mission">
              <button className="t-back" onClick={back} aria-label="返回選關">
                ‹
              </button>
              <div>
                <span>
                  {content.id.toUpperCase()} · {content.title}
                </span>
                <b>{content.pathogen.name}</b>
              </div>
            </div>
            <div className="t-hud-stat">
              <small>組織保全</small>
              <b className={preservation(s) < content.stars[1] ? "warn" : ""}>
                {preservation(s)}
                <i>%</i>
              </b>
              <span className="t-health-track">
                <i style={{ width: `${preservation(s)}%` }} />
              </span>
            </div>
            <div className="t-hud-stat t-energy">
              <small>
                反應資源 <span>每 {content.energyEvery * 0.2} 秒 +1</span>
              </small>
              <b>
                {s.energy}
                <i>/ {content.energyMax}</i>
              </b>
              <span className="t-energy-dots">
                {Array.from({ length: content.energyMax }, (_, i) => (
                  <i key={i} className={i < s.energy ? "full" : ""} />
                ))}
              </span>
            </div>
            <div className="t-time">
              <b>{time(s.tick)}</b>
              <small>
                感染波次 {s.wave + 1} / {content.waves.length}
              </small>
            </div>
            <button
              className={`t-pause ${paused ? "is-paused" : ""}`}
              onClick={togglePause}
              disabled={!!result}
              data-testid="pause-toggle"
            >
              {paused ? "▶" : "Ⅱ"}{" "}
              <span>
                {paused ? (s.tick === 0 ? "開始行動" : "繼續行動") : "戰術暫停"}
              </span>
            </button>
          </section>
          <div className="t-objective">
            <span className="t-kicker">DEFEND THE ALVEOLI</span>
            <h2>守住組織，清除 {content.waves.length} 波感染。</h2>
            <div className="t-wave-pips">
              {content.waves.map((w, i) => (
                <span className={s.wave >= i ? "active" : ""} key={w.label}>
                  <i />
                  {i + 1}
                </span>
              ))}
              <small>
                活感染負荷 <b>{burden}</b>
              </small>
            </div>
            {burden === 0 && s.wave < content.waves.length - 1 ? (
              <button
                className="t-next-wave"
                onClick={() => command({ type: "advance" })}
              >
                提前迎擊下一波 <b>+1 資源</b>
              </button>
            ) : (
              <p>
                {s.wave < content.waves.length - 1
                  ? `下一波約 ${remainingWave} 秒 · ${content.waves[s.wave + 1].label}`
                  : "最後一波 · 處理所有活感染來源"}
              </p>
            )}
            <button
              className="t-objective-detail"
              onClick={() => encyclopedia(content.pathogen.id)}
            >
              案例與機制 ↗
            </button>
          </div>
          <div className="t-field-tools">
            <button
              className={mode === "mark" ? "active" : ""}
              onClick={() => {
                setMode(mode === "mark" ? "command" : "mark");
                setSelected(undefined);
              }}
              disabled={!s.support || s.energy < 1 || !!result}
              data-testid="mark-tool"
            >
              <b>Y</b>
              <span>
                調理支援<small>1 資源 · 剩 {s.support} 次</small>
              </span>
            </button>
            <button
              onClick={() => setMenu(!menu)}
              className={menu ? "active" : ""}
            >
              <b>＋</b>
              <span>
                募集增援
                <small>
                  {s.cells.length + s.arrivals.length} 族群 · 按資源募集
                </small>
              </span>
            </button>
            <button className="t-log-tool" onClick={() => setModal("log")}>
              ☷ <span>因果紀錄</span>
            </button>
          </div>
          {menu && (
            <section className="t-recruit-card" aria-label="募集增援">
              <div className="t-card-heading">
                <h3>募集增援</h3>
                <button
                  onClick={() => setMenu(false)}
                  aria-label="關閉增援面板"
                >
                  ×
                </button>
              </div>
              <label>
                駐守防區
                <select
                  aria-label="增援防區"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {content.fields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} · {occupied(s, f.id)} 族群
                    </option>
                  ))}
                </select>
              </label>
              {(["neutrophil", "macrophage"] as CellType[]).map((kind) => {
                const def = content.cells[kind],
                  cmd: TacticalCommand = { type: "recruit", kind, region };
                const error = validateTactical(s, cmd, content);
                return (
                  <button
                    className="t-recruit-option"
                    key={kind}
                    disabled={!!error}
                    title={error}
                    onClick={(event) => {
                      if (event.detail < 2) command(cmd);
                    }}
                    data-recruit={kind}
                  >
                    <CellArt kind={kind} />
                    <span>
                      <b>{def.name}</b>
                      <small>{def.delay * 0.2} 秒後到場 · 沿通道支援</small>
                    </span>
                    <strong>
                      {def.cost}
                      <small>資源</small>
                    </strong>
                  </button>
                );
              })}
              <small>
                抵達後會由微血管沿通道走向防區。等待只在行動時推進。
              </small>
            </section>
          )}
          {s.arrivals.length > 0 && (
            <div className="t-arrival-queue">
              {s.arrivals.map((a) => (
                <div key={a.id}>
                  <i>◷</i>
                  <span>
                    {content.cells[a.kind].short} →{" "}
                    {content.fields.find((f) => f.id === a.region)!.name}
                  </span>
                  <b>{Math.ceil((a.at - s.tick) * 0.2)}s</b>
                </div>
              ))}
            </div>
          )}
          <div className="t-camera-controls" aria-label="鏡頭控制">
            <button
              onClick={() => scene.current?.setZoom(0.13)}
              aria-label="放大戰場"
            >
              ＋
            </button>
            <button
              onClick={() => scene.current?.setZoom(-0.13)}
              aria-label="縮小戰場"
            >
              −
            </button>
            <button
              onClick={() => scene.current?.rotate(Math.PI / 8)}
              aria-label="旋轉鏡頭"
            >
              ↻
            </button>
            <button
              onClick={() => scene.current?.reset()}
              aria-label="重設鏡頭"
            >
              ⌂
            </button>
          </div>
          {cameraHint && (
            <button
              className="t-camera-hint"
              onClick={() => setCameraHint(false)}
            >
              拖曳移動畫面 · ＋／− 調整鏡頭 <span>×</span>
            </button>
          )}
          {(mode !== "command" || (paused && s.tick === 0)) && (
            <div className="t-order-banner">
              <i>{mode === "mark" ? "Y" : mode === "move" ? "✥" : "Ⅱ"}</i>
              <span>
                {mode === "mark"
                  ? "點選菌群附著調理標記"
                  : mode === "move"
                    ? "點選地面，指定防守位置"
                    : "戰術暫停：先調理與部署，再開始行動"}
              </span>
              {mode !== "command" && (
                <button onClick={() => setMode("command")}>取消</button>
              )}
            </div>
          )}
          <section className="t-command-dock" aria-label="戰場指揮">
            <div className="t-dock-main">
              {cell ? (
                <>
                  <div className="t-dock-portrait">
                    <CellArt kind={cell.kind} />
                  </div>
                  <div className="t-selection-info">
                    <small>
                      {content.fields.find((f) => f.id === cell.region)!.name} ·{" "}
                      {cell.order.type === "attack"
                        ? "追蹤菌群"
                        : cell.path.length
                          ? "移動中"
                          : "自動巡防"}
                    </small>
                    <h2>{content.cells[cell.kind].name}</h2>
                    <p>
                      {mode === "move"
                        ? "點地面指定位置"
                        : "點菌群指定目標 · 點地面調度"}
                    </p>
                  </div>
                  <div className="t-context-actions">
                    <button
                      className={mode === "move" ? "active" : ""}
                      onClick={() =>
                        setMode(mode === "move" ? "command" : "move")
                      }
                    >
                      ✥ <span>移動防線</span>
                    </button>
                    <button
                      onClick={() => command({ type: "guard", cell: cell.id })}
                    >
                      ◎ <span>就地巡防</span>
                    </button>
                    <button
                      className="t-info-button"
                      onClick={() => encyclopedia(cell.kind)}
                      aria-label="所選細胞百科"
                    >
                      i
                    </button>
                  </div>
                </>
              ) : colony ? (
                <>
                  <div className="t-dock-portrait">
                    <PathogenArt marked={isMarked} />
                  </div>
                  <div className="t-selection-info">
                    <small>{field.name} · 胞外菌群</small>
                    <h2>感染負荷 {colony.load}</h2>
                    <p>
                      {isMarked
                        ? `已調理 · ${Math.ceil((colony.markedUntil - s.tick) * 0.2)} 秒`
                        : "莢膜保護 · 吞噬效率受限"}
                    </p>
                  </div>
                  <div className="t-context-actions">
                    <button
                      className="t-mark-action"
                      disabled={!!markError}
                      title={markError}
                      onClick={() =>
                        command({ type: "mark", target: colony.id })
                      }
                      data-testid="apply-mark"
                    >
                      Y <span>{isMarked ? "調理有效" : "施加調理"}</span>
                      <small>1</small>
                    </button>
                    <button
                      onClick={() => {
                        const candidate = [...s.cells]
                          .filter((u) => u.kind !== "dendritic")
                          .sort(
                            (a, b) =>
                              distance(a.position, colony.position) -
                              distance(b.position, colony.position),
                          )
                          .find(
                            (u) =>
                              !validateTactical(
                                s,
                                {
                                  type: "attack",
                                  cell: u.id,
                                  target: colony.id,
                                },
                                content,
                              ),
                          );
                        if (candidate) {
                          command({
                            type: "attack",
                            cell: candidate.id,
                            target: colony.id,
                          });
                          setSelected(candidate.id);
                        } else setNotice("目前沒有可指派的吞噬者。");
                      }}
                    >
                      ↗ <span>指派吞噬者</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="t-dock-emblem">⌁</div>
                  <div className="t-selection-info">
                    <small>
                      {field.name} · {occupied(s, region)} 族群（含待到場）
                    </small>
                    <h2>選擇你的防線</h2>
                    <p>點場上的細胞或菌群，直接下達指令。</p>
                  </div>
                  <div className="t-context-actions">
                    <button onClick={() => setModal("help")}>
                      ? <span>操作提示</span>
                    </button>
                  </div>
                </>
              )}
              <button
                className="t-undo"
                disabled={!paused || !snapshot.undo.length || !!result}
                onClick={() => {
                  controller.undo();
                  update(true);
                }}
                title="戰術暫停時，可撤銷尚未恢復行動的指令"
                aria-label="撤銷暫停指令"
              >
                ↶
              </button>
            </div>
            <div className="t-roster">
              <span>免疫防線</span>
              {s.cells.map((u) => (
                <button
                  key={u.id}
                  data-cell-id={u.id}
                  className={selected === u.id ? "active" : ""}
                  onClick={() => pick({ type: "cell", id: u.id })}
                  aria-label={`選取${content.cells[u.kind].name} ${u.id}`}
                >
                  <CellArt kind={u.kind} />
                  <small>{content.cells[u.kind].short}</small>
                  {u.path.length > 0 && <i>↗</i>}
                </button>
              ))}
              <button
                className="t-roster-add"
                onClick={() => setMenu(!menu)}
                aria-label="開啟募集增援"
              >
                ＋
              </button>
              <span className="t-dock-save">{storage}</span>
            </div>
          </section>
          {!result && (
            <div className="t-event-ribbon" aria-live="polite">
              <span>◉</span>
              <p>{lastEvent?.message ?? "初始防線已就緒。"}</p>
            </div>
          )}
          {snapshot.settings.hints && !result && (
            <div className="t-tactical-hint">
              <button
                onClick={() => settings({ hints: false })}
                aria-label="關閉戰術提示"
              >
                ×
              </button>
              <b>協作提示</b>
              <p>
                {s.tick < 20
                  ? "先調理入口與深部菌群，再調入嗜中性球支援微血管防區。調理不直接殺菌，需要吞噬者接近。"
                  : burden === 0
                    ? "防線清場了。可以等待資源與增援，或提前迎擊換取額外資源。"
                    : "點細胞再點菌群，能改派防線。位置與接觸距離會影響何時開始吞噬。"}
              </p>
            </div>
          )}
          {result && (
            <section
              className={`t-result ${result.type}`}
              aria-label={`${content.id.toUpperCase()} 結算`}
              data-testid="tactical-result"
            >
              <span className="t-kicker">
                FIELD REPORT · {content.id.toUpperCase()}
              </span>
              <div className="t-result-stars">
                {result.stars ? "★".repeat(result.stars) : "⌁"}
              </div>
              <h1>
                {result.type === "victory"
                  ? "防線，守住了。"
                  : "防線需要重新部署。"}
              </h1>
              <p>{result.reason}。</p>
              <div className="t-result-metrics">
                <span>
                  <b>{result.preservation}%</b>組織保全
                </span>
                <span>
                  <b>{Math.round(result.seconds)} 秒</b>防禦時間
                </span>
              </div>
              <small>
                三星 ≥{content.stars[0]}% · 二星 ≥{content.stars[1]}%
                <br />
                此為教學情境結果，不代表臨床治癒。
              </small>
              <div>
                <button
                  className="t-primary"
                  onClick={() => {
                    controller.restart(s.seed);
                    setSelected(undefined);
                    update(true);
                    scene.current?.reset();
                  }}
                >
                  重試同一配置
                </button>
                <button className="t-outline" onClick={() => start(true)}>
                  新的配置
                </button>
                <button className="t-text" onClick={() => setModal("log")}>
                  查看因果紀錄
                </button>
              </div>
            </section>
          )}
        </main>
      )}
      {modal === "encyclopedia" && (
        <Encyclopedia
          initial={entry}
          read={snapshot.read}
          onRead={(id) => {
            if (!controller.save.read.includes(id)) {
              controller.save.read.push(id);
              update(true);
            }
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "help" && (
        <Dialog title="直接指揮你的免疫防線" onClose={() => setModal(null)}>
          <div className="t-dialog-content">
            <ol>
              <li>
                <b>先暫停，觀察菌群。</b>{" "}
                空白鍵或上方按鈕可暫停／恢復，思考時不會受損。
              </li>
              <li>
                <b>點細胞，再點菌群或地面。</b>{" "}
                指派目標或部署位置；細胞會沿組織通道移動，接近合法目標後自動吞噬。
              </li>
              <li>
                <b>調理需要吞噬者配合。</b> 點菌群按「施加調理」，或使用 Y
                工具再點目標。花 1 資源、持續 20 秒，沒有直接傷害。
              </li>
              <li>
                <b>叫增援填補空缺。</b> 嗜中性球花 3 資源、5 秒後到場；巨噬花
                4、8 秒後到場。各區不限名額，仍需資源與到場時間。
              </li>
              <li>
                <b>守住 {content.waves.length} 波感染。</b>{" "}
                菌群會繁殖、擴散並損傷組織；清場後可提前迎擊。所有防區都要存活。
              </li>
            </ol>
            <p>
              反應資源每 {content.energyEvery * 0.2} 秒恢復 1，上限{" "}
              {content.energyMax}
              。沒有區域或全場名額限制，依資源與到場時間安排支援。
              時間與數量為遊戲抽象。
            </p>
            <button className="t-primary" onClick={() => setModal(null)}>
              回到戰場
            </button>
          </div>
        </Dialog>
      )}
      {modal === "settings" && (
        <Dialog title="設定與存檔" onClose={() => setModal(null)}>
          <div className="t-dialog-content">
            <label className="toggle">
              行動速度
              <select
                aria-label="行動速度"
                value={snapshot.settings.speed}
                onChange={(e) =>
                  settings({ speed: Number(e.target.value) as 1 | 2 })
                }
              >
                <option value="1">正常</option>
                <option value="2">2×</option>
              </select>
            </label>
            <label className="toggle">
              降低動態效果
              <input
                type="checkbox"
                checked={snapshot.settings.reduced}
                onChange={(e) => settings({ reduced: e.target.checked })}
              />
            </label>
            <label className="toggle">
              細胞待機呼吸
              <input
                type="checkbox"
                checked={snapshot.settings.idle}
                onChange={(e) => settings({ idle: e.target.checked })}
              />
            </label>
            <label className="toggle">
              協作提示
              <input
                type="checkbox"
                checked={snapshot.settings.hints}
                onChange={(e) => settings({ hints: e.target.checked })}
              />
            </label>
            <h3>防線備份</h3>
            <p>
              {storage}
              。新版即時戰術使用獨立存檔，舊版回合制紀錄不會被覆寫。讀取後先暫停，準備好再繼續。
            </p>
            <div className="t-save-actions">
              <button
                className="t-primary"
                onClick={() => exportTactical(controller.snapshot())}
              >
                匯出存檔
              </button>
              <button
                className="t-outline"
                onClick={() => file.current?.click()}
              >
                匯入存檔
              </button>
            </div>
            <p className="fine-print">
              本機儲存不會自動跨裝置同步。匯入失敗不變更目前進度。此版無音效。
            </p>
          </div>
        </Dialog>
      )}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        aria-label="新版存檔檔案"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = "";
        }}
      />
      {modal === "log" && (
        <Dialog title="防線因果紀錄" onClose={() => setModal(null)} wide>
          <div className="t-dialog-content">
            <p>
              指令、接觸、調理、吞噬與損傷來自實際規則事件；以模擬時間記錄，保留最近
              400 筆。
            </p>
            {[...s.events].reverse().map((e) => (
              <div className="t-log-row" key={e.id}>
                <time>{time(e.tick)}</time>
                <p>{e.message}</p>
              </div>
            ))}
          </div>
        </Dialog>
      )}
      {modal === "unavailable" && (
        <Dialog
          title={scenarioCards.find((c) => c.id === unavailable)!.name}
          onClose={() => setModal(null)}
        >
          <div className="t-dialog-content">
            <span className="t-kicker">開發中 · 無須解鎖</span>
            <h3>{scenarioCards.find((c) => c.id === unavailable)!.subtitle}</h3>
            <p>
              此情境的專用規則、角色與動作仍在製作。目前可玩的是新版
              M1「莢膜防線」。
            </p>
            <button
              className="t-primary"
              onClick={() =>
                encyclopedia(
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
              查看相關機制
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
