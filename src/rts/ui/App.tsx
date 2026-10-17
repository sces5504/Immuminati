import { useEffect, useRef, useState } from "react";
import World from "../presentation/World";
import { Session } from "../application/session";
import { cost, sample } from "../engine/simulation";
import {
  M1,
  missions,
  kindNames,
  actionNames,
  nodeLabels,
  encyclopedia,
  sources,
} from "../content/m1";
import { load, store, decode, SAVE_KEY } from "../persistence/save";
import type { Command, Point } from "../domain/types";
type Panel = "node" | "encyclopedia" | "log" | "settings" | "units" | null;
export default function App() {
  const session = useRef(new Session()),
    [revision, refresh] = useState(0),
    [screen, setScreen] = useState<"menu" | "game">("menu"),
    [panel, setPanel] = useState<Panel>(null),
    [selected, setSelected] = useState<string>(),
    [mode, setMode] = useState("select"),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState(""),
    [available, setAvailable] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    s = session.current.state,
    game = session.current;
  const update = () => refresh((v) => v + 1);
  function save() {
    try {
      store(game.snapshot());
      setAvailable(true);
    } catch {
      setMessage("本機儲存失敗，請匯出存檔。");
    }
  }
  useEffect(() => {
    try {
      const saved = load();
      setAvailable(!!saved);
      if (saved) {
        session.current = new Session(saved);
        update();
      }
    } catch {
      setMessage(
        "RTS 存檔損壞或版本不相容，未覆寫。可匯入有效存檔或開始新局。",
      );
    }
  }, []);
  useEffect(() => {
    let last = performance.now(),
      acc = 0,
      raf = 0;
    const frame = (now: number) => {
      const g = session.current,
        elapsed = Math.min(100, now - last);
      last = now;
      if (!g.paused && !g.state.result) {
        acc += elapsed * g.settings.speed;
        let changed = false;
        while (acc >= 200) {
          g.tick();
          acc -= 200;
          changed = true;
        }
        if (changed) {
          refresh((v) => v + 1);
          if (g.state.step % 10 === 0 || g.state.result)
            try {
              store(g.snapshot());
              setAvailable(true);
            } catch {
              setMessage("自動儲存失敗，請匯出。");
            }
        }
      } else acc = 0;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const background = () => {
      if (document.hidden) {
        session.current.paused = true;
        acc = 0;
        refresh((v) => v + 1);
        try {
          store(session.current.snapshot());
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", background);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", background);
    };
  }, []);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      session.current.settings.motion = "reduced";
      update();
    }
  }, []);
  function show(p: Panel) {
    game.paused = true;
    setPanel(p);
    if (screen === "game") save();
    update();
  }
  function queue(c: Omit<Command, "id" | "step">) {
    const error = game.enqueue(c);
    setMessage(
      error ??
        (game.paused
          ? "已加入暫停規劃；恢復後依序驗證提交。"
          : "已排入下一規則步。"),
    );
    save();
    update();
  }
  function chooseMode(mode: string) {
    setMode(mode);
    requestAnimationFrame(() =>
      document.querySelector(".world")?.scrollIntoView({ block: "center" }),
    );
  }
  function onPoint(p: Point) {
    if (mode === "move") queue({ type: "move", unit: selected, point: p });
    if (mode === "recruit") queue({ type: "recruit", point: p });
    setMode("select");
  }
  function start() {
    session.current = new Session();
    setSelected(undefined);
    setScreen("game");
    setPanel(null);
    setMessage("先觀察自主反應；可暫停募集或調理。來源於 110 模擬秒控制。");
    setMode("select");
    update();
  }
  function resume() {
    try {
      const saved = load();
      if (!saved) throw new Error("沒有存檔");
      session.current = new Session(saved);
      setScreen("game");
      setPanel(null);
      setMessage("已續玩並暫停，沒有離線追算。");
      update();
    } catch (e) {
      setMessage(String(e));
    }
  }
  function exportSave() {
    save();
    const url = URL.createObjectURL(
        new Blob([JSON.stringify(game.snapshot(), null, 2)], {
          type: "application/json",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = `immuminati-m1-step-${s.step}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(f?: File) {
    if (!f) return;
    try {
      if (f.size > 8_000_000) throw new Error("超過 8 MB");
      const parsed = decode(await f.text());
      store(parsed);
      session.current = new Session(parsed);
      setScreen("game");
      setPanel(null);
      setSelected(undefined);
      setAvailable(true);
      setMessage("存檔驗證成功，已安全載入並暫停。");
      update();
    } catch (e) {
      setMessage(`匯入失敗，原局保留：${String(e)}`);
    }
    if (file.current) file.current.value = "";
  }
  const unit = s.units.find((u) => u.id === selected),
    b = s.pathogens.find((b) => b.id === selected),
    reserved = game.plans.reduce((n, c) => n + cost(c), 0),
    loadValue = s.pathogens.reduce((n, b) => n + b.load, 0);
  return (
    <div className="app" data-revision={revision}>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            game.paused = true;
            setScreen("menu");
            update();
          }}
        >
          IMMUMINATI<span>免疫反應指揮室</span>
        </a>
        <span className="build-tag">可玩 M1 · 佔位美術</span>
        <button onClick={() => show("encyclopedia")}>百科</button>
        <button onClick={() => show("settings")}>存檔／設定</button>
      </header>
      {screen === "menu" ? (
        <main className="menu">
          <div className="intro">
            <span className="eyebrow">HYBRID RTS · REAL TIME WITH PAUSE</span>
            <h1>
              在感染與發炎之間，
              <br />
              守住組織。
            </h1>
            <p>
              細胞自主反應，你安排支援。暫停觀察因果，讓每一次募集、調理與遷移發揮作用。
            </p>
            <div className="menu-actions">
              <button className="primary" onClick={start}>
                開始 M1 肺部防禦
              </button>
              <button disabled={!available} onClick={resume}>
                本機續玩
              </button>
              <button
                onClick={() => {
                  game.paused = true;
                  file.current?.click();
                }}
              >
                匯入存檔
              </button>
            </div>
          </div>
          <div className="mission-grid">
            {missions.map(([id, name, desc]) => (
              <article key={id}>
                <span>
                  {id} · {id === "M1" ? "可玩" : "開發中"}
                </span>
                <h2>{name}</h2>
                <p>{desc}</p>
                {id === "M1" ? (
                  <button onClick={start}>進入關卡 →</button>
                ) : (
                  <button
                    onClick={() => {
                      setFilter(id);
                      show("encyclopedia");
                    }}
                  >
                    查看百科
                  </button>
                )}
              </article>
            ))}
          </div>
          <p className="subtle">
            關卡資訊開場全可查。M2–M6 尚不可玩；無永久升級。{" "}
            <a href="#visual-lab">素材與動作預覽</a>
          </p>
        </main>
      ) : (
        <main className="game">
          <section className="metrics" aria-label="戰場狀態">
            <div>
              <small>組織保全</small>
              <strong>{s.tissue.toFixed(1)}%</strong>
              <progress value={s.tissue} max="100" />
            </div>
            <div>
              <small>活病原負荷</small>
              <strong>{loadValue.toFixed(1)}</strong>
              <span>
                {s.pathogens.filter((b) => b.compartment === "internal").length}{" "}
                胞內群
              </span>
            </div>
            <div>
              <small>發炎／內皮</small>
              <strong>
                {s.inflammation.toFixed(0)} / {s.endothelial.toFixed(0)}%
              </strong>
              <span>過炎門檻 42%</span>
            </div>
            <div>
              <small>反應資源</small>
              <strong>
                {s.resources.toFixed(0)} <em>−{reserved}</em>
              </strong>
              <span>供應 {s.supply.toFixed(1)} · +0.045/s</span>
            </div>
          </section>
          <section className="toolbar">
            <button
              className={game.paused ? "primary" : ""}
              onClick={() => {
                game.paused = !game.paused;
                save();
                update();
              }}
              disabled={!!s.result}
            >
              {game.paused ? "▶ 恢復模擬" : "Ⅱ 暫停規劃"}
            </button>
            {([1, 2, 4] as const).map((speed) => (
              <button
                key={speed}
                className={game.settings.speed === speed ? "active" : ""}
                onClick={() => {
                  game.settings.speed = speed;
                  save();
                  update();
                }}
              >
                {speed}×
              </button>
            ))}
            <span className="clock">
              {(s.step * 0.2).toFixed(1)}s ·{" "}
              {s.result ? "已結算" : game.paused ? "模擬已暫停" : "模擬進行中"}
            </span>
            <button
              className={game.settings.signals ? "active" : ""}
              onClick={() => {
                game.settings.signals = !game.settings.signals;
                save();
                update();
              }}
            >
              訊號視圖
            </button>
            <button onClick={() => show("node")}>淋巴結</button>
            <button onClick={() => show("units")}>細胞名單</button>
            <button
              onClick={() => {
                setFilter("");
                show("log");
              }}
            >
              因果紀錄
            </button>
          </section>
          <div className="battle-layout">
            <World
              state={s}
              settings={game.settings}
              selected={selected}
              onSelect={setSelected}
              onPoint={onPoint}
              mode={mode}
            />
            <aside className="command-panel">
              <div className="objective">
                <span className="eyebrow">M1 · 肺炎鏈球菌</span>
                <p>控制侵入來源＋清除全部活病原，保留必要肺組織。</p>
                <small>
                  {s.sourceClosed
                    ? "來源已控制"
                    : `屏障修復中：${Math.max(0, 110 - s.step * 0.2).toFixed(0)} 秒`}{" "}
                  · 三星 ≥80%／二星 ≥55%
                </small>
              </div>
              <div className="selection">
                <h2>
                  {unit
                    ? kindNames[unit.kind]
                    : b
                      ? "肺炎鏈球菌"
                      : "自主防線已部署"}
                </h2>
                <p>
                  {unit
                    ? `${unit.id} · ${actionNames[unit.action]}`
                    : b
                      ? `${b.id} · 負荷 ${b.load.toFixed(1)} · ${b.compartment === "external" ? "胞外" : "胞內"}`
                      : "點選戰場或細胞名單查看意圖。未下令的細胞仍會自主行動。"}
                </p>
                {unit && (
                  <>
                    <small>
                      目標：{unit.target ?? "無"} ·{" "}
                      {unit.antigen ? "攜帶表面蛋白抗原" : "未攜抗原"}
                      <br />
                      CXCL8 採樣 {sample(s, unit).toFixed(2)} ·{" "}
                      {unit.signal ? "正在釋放訊號" : "接收環境訊息"}
                    </small>
                    <div className="button-row">
                      <button
                        disabled={unit.action === "exit"}
                        onClick={() => chooseMode("move")}
                      >
                        移動到此
                      </button>
                      <button
                        onClick={() => queue({ type: "auto", unit: unit.id })}
                      >
                        恢復自主
                      </button>
                    </div>
                    {unit.kind === "dendritic" && (
                      <button
                        onClick={() =>
                          queue({ type: "dispatch", unit: unit.id })
                        }
                      >
                        優先送出攜抗原 DC
                      </button>
                    )}
                    <label>
                      優先病原
                      <select
                        value={unit.priority ?? ""}
                        onChange={(e) =>
                          e.target.value
                            ? queue({
                                type: "target",
                                unit: unit.id,
                                target: e.target.value,
                              })
                            : queue({ type: "auto", unit: unit.id })
                        }
                      >
                        <option value="">自主選擇</option>
                        {s.pathogens
                          .filter((b) => b.compartment === "external")
                          .map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.id} · {b.load.toFixed(1)}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {b && (
                  <>
                    <p>
                      {b.opsonin === "none"
                        ? "莢膜：未調理攝入效率 26%"
                        : `${b.opsonin === "complement" ? "補體" : "蛋白靶向抗體"}已沉積：攝入效率 96%`}
                    </p>
                    <button
                      disabled={b.compartment !== "external"}
                      onClick={() => queue({ type: "opsonize", target: b.id })}
                    >
                      補體調理 · {M1.costs.opsonize}
                    </button>
                  </>
                )}
              </div>
              <div className="support">
                <button
                  className="primary"
                  onClick={() => chooseMode("recruit")}
                >
                  募集嗜中性球 · {M1.costs.recruit}
                </button>
                <small>
                  先選支援位置；內皮 ≥8% 後動員 7s＋跨內皮
                  3s，從血管到場。提交後供應已投入，不退款；規劃可撤銷。
                </small>
                {mode !== "select" && (
                  <button onClick={() => setMode("select")}>
                    取消位置指令
                  </button>
                )}
                <label>
                  反應政策
                  <select
                    aria-label="反應政策"
                    value={s.policy}
                    onChange={(e) =>
                      queue({
                        type: "policy",
                        policy: e.target.value as typeof s.policy,
                      })
                    }
                  >
                    <option value="restrained">抑制：減炎，也延緩募集</option>
                    <option value="balanced">平衡：維持先天防線</option>
                    <option value="intense">增強：加速活化，增加損傷</option>
                  </select>
                </label>
              </div>
              <div className="plans">
                <h3>待提交規劃 {game.plans.length}</h3>
                {game.plans.length === 0 ? (
                  <small>
                    暫停可排多條命令；恢復時依序驗證。拖曳地圖不會下令。
                  </small>
                ) : (
                  game.plans.map((c) => (
                    <div key={c.id}>
                      <span>
                        {c.type} {c.unit ?? c.target ?? ""} · {cost(c)}
                      </span>
                      <button
                        onClick={() => {
                          game.cancel(c.id);
                          save();
                          update();
                        }}
                      >
                        撤銷
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="hint">
                {s.pathogens.some((b) => b.opsonin === "none")
                  ? "情境提示：莢膜使攝入效率低。調理不直接殺菌，需吞噬細胞接觸。"
                  : s.node.phase === "active"
                    ? "抗體已到場。觀察表面標記與後續吞噬，不代表病原已清除。"
                    : "可維持先天防線，等待較慢的蛋白抗原淋巴結反應。"}
                <button
                  onClick={() => {
                    setFilter("");
                    show("encyclopedia");
                  }}
                >
                  理解機制
                </button>
              </div>
            </aside>
          </div>
          {s.result && (
            <section
              className={`result ${s.result.outcome}`}
              data-testid="result"
            >
              <h2>
                {s.result.outcome === "won" ? "感染已控制" : "防線失守"}{" "}
                <span>{"★".repeat(s.result.stars)}</span>
              </h2>
              <p>{s.result.reason}</p>
              <p>
                組織 {s.tissue.toFixed(1)}% · 病原損傷{" "}
                {s.damage.pathogen.toFixed(1)}／過炎{" "}
                {s.damage.inflammation.toFixed(1)}／旁觀者{" "}
                {s.damage.bystander.toFixed(1)}
              </p>
              <button
                onClick={() => {
                  setFilter("");
                  show("log");
                }}
              >
                查看策略因果
              </button>
              <button onClick={exportSave}>匯出本局</button>
              <button onClick={start}>重新挑戰</button>
            </section>
          )}
        </main>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
          <button aria-label="關閉提示" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      {panel && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={panel}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setPanel(null);
                return;
              }
              if (e.key === "Tab") {
                const nodes = Array.from(
                    e.currentTarget.querySelectorAll<HTMLElement>(
                      "button:not(:disabled),a,input:not([hidden]),select",
                    ),
                  ).filter((el) => el.offsetParent !== null),
                  first = nodes[0],
                  last = nodes[nodes.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <div className="modal-head">
              <h2>
                {
                  {
                    node: "引流淋巴結",
                    encyclopedia: "免疫百科",
                    log: "因果紀錄",
                    settings: "存檔與設定",
                    units: "細胞與病原名單",
                  }[panel]
                }
              </h2>
              <button autoFocus onClick={() => setPanel(null)}>
                返回{screen === "game" ? "戰場" : "選關"}
              </button>
            </div>
            <p className="subtle">模擬保持暫停；關閉後請手動恢復。</p>
            {panel === "node" && (
              <>
                <p>
                  抗原：{s.node.antigen ?? "尚未攝取 spn:surface-protein-A"}
                  <br />
                  背景：初次蛋白抗原反應，尚無特異性記憶。
                </p>
                <ol className="node-flow">
                  {Object.entries(nodeLabels).map(([phase, label]) => (
                    <li
                      key={phase}
                      className={s.node.phase === phase ? "current" : ""}
                    >
                      <strong>{label}</strong>
                      {s.node.phase === phase && (
                        <span>
                          目前階段 ·{" "}
                          {phase === "antigen"
                            ? "需要 DC 接觸並攝入病原"
                            : phase === "active"
                              ? "抗體持續調理相同暴露蛋白靶標"
                              : `剩餘 ${Math.max(0, (s.node.until - s.step) * 0.2).toFixed(1)} 模擬秒`}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                <button
                  onClick={() => queue({ type: "support" })}
                  disabled={s.node.supported || s.node.phase === "active"}
                >
                  支援反應準備 · {M1.costs.support}
                </button>
                <p>
                  新生抗體需要全部階段與交通。支援縮短後續準備
                  20%，不跳階段。抗體調理仍需吞噬；不是所有抗莢膜抗體都經本條蛋白
                  T 依賴路徑。時間為教學壓縮，不代表臨床時數。
                </p>
              </>
            )}
            {panel === "units" && (
              <div className="unit-list">
                {s.units.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelected(u.id);
                      setPanel(null);
                      setMode("select");
                    }}
                  >
                    <strong>
                      {kindNames[u.kind]} {u.id}
                    </strong>
                    <span>
                      {actionNames[u.action]} · ({u.x.toFixed(0)},{" "}
                      {u.y.toFixed(0)})
                    </span>
                  </button>
                ))}
                {s.pathogens.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelected(b.id);
                      setPanel(null);
                      setMode("select");
                    }}
                  >
                    病原 {b.id} · {b.load.toFixed(1)} ·{" "}
                    {b.compartment === "internal" ? "胞內" : "胞外"}
                  </button>
                ))}
              </div>
            )}
            {panel === "encyclopedia" && (
              <>
                <label>
                  搜尋機制或關卡
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="例如：調理、M2、CXCL8"
                  />
                </label>
                {encyclopedia
                  .filter((e) =>
                    e.join(" ").toLowerCase().includes(filter.toLowerCase()),
                  )
                  .map(([title, body, source]) => (
                    <article key={title} className="entry">
                      <h3>{title}</h3>
                      <p>{body}</p>
                      <a
                        href={sources[source].url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        來源：{sources[source].label}
                      </a>
                    </article>
                  ))}
              </>
            )}
            {panel === "log" && (
              <>
                <label>
                  篩選文字
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="接觸、調理、淋巴結、損傷…"
                  />
                </label>
                <p>
                  清除負荷 {s.stats.cleared.toFixed(1)} · 已到場{" "}
                  {s.stats.recruited} · 抗原攝取 {s.stats.captures}
                </p>
                <div className="event-log">
                  {s.events
                    .filter(
                      (e) => e.text.includes(filter) || e.type.includes(filter),
                    )
                    .slice()
                    .reverse()
                    .map((e) => (
                      <p key={e.id}>
                        <small>
                          {(e.step * 0.2).toFixed(1)}s ·{" "}
                          {e.actor ?? e.target ?? "組織"}{" "}
                          {e.at
                            ? `(${e.at.x.toFixed(0)},${e.at.y.toFixed(0)})`
                            : ""}
                        </small>
                        <br />
                        {e.text}
                      </p>
                    ))}
                </div>
              </>
            )}
            {panel === "settings" && (
              <>
                <p>
                  新存檔：{SAVE_KEY}。保留舊 v1／tactics v2，不轉換不同規則。
                </p>
                <div className="button-row">
                  <button
                    onClick={() => {
                      save();
                      setMessage("已儲存於此瀏覽器。");
                    }}
                  >
                    立即儲存
                  </button>
                  <button onClick={exportSave}>匯出 JSON</button>
                  <button onClick={() => file.current?.click()}>
                    匯入 JSON
                  </button>
                </div>
                <label>
                  動作顯示
                  <select
                    value={game.settings.motion}
                    onChange={(e) => {
                      game.settings.motion = e.target
                        .value as typeof game.settings.motion;
                      save();
                      update();
                    }}
                  >
                    <option value="normal">正常局部動態</option>
                    <option value="reduced">降低動態</option>
                    <option value="skip">略過視覺動態（規則不跳步）</option>
                  </select>
                </label>
                <p>
                  所有速度與視覺模式使用相同固定步進。背景安全暫停，不追算離線時間。匯入先驗證，成功才替換。
                </p>
                <a
                  href="#visual-lab"
                  onClick={() => {
                    game.paused = true;
                  }}
                >
                  獨立素材／動作預覽入口 →
                </a>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
