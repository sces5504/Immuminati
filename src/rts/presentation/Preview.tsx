import { useEffect, useState } from "react";
import World from "./World";
import { createState, spawn, step, makeUnit } from "../engine/simulation";
import { M1, kindNames } from "../content/m1";
import type { State, Kind, Settings } from "../domain/types";
import { setVisualProvider, placeholderProvider, manifest } from "./visuals";
import { exampleProvider } from "./replacement-example";
function initial() {
  const n = createState();
  n.units.push(makeUnit(n, "neutrophil", { x: 400, y: 430 }));
  n.pathogens[1].opsonin = "complement";
  return n;
}
export default function Preview() {
  const [s, setS] = useState<State>(initial),
    [running, setRunning] = useState(false),
    [kind, setKind] = useState<Kind>("macrophage"),
    [settings, setSettings] = useState<Settings>({
      speed: 1,
      motion: "normal",
      signals: true,
    }),
    [alternate, setAlternate] = useState(false),
    [selected, setSelected] = useState<string>();
  function scene(survives: boolean) {
    setRunning(false);
    const n = createState();
    n.pathogens = [];
    n.units = [makeUnit(n, kind, { x: 450, y: 300 })];
    const b = spawn(n, { x: 482, y: 300 }, 4, survives);
    b.opsonin = "complement";
    setS(n);
  }
  const tick = () =>
    setS((old) => {
      const n = structuredClone(old);
      step(n, [], { ...M1, sourceSteps: [], sourceClose: 100000 });
      return n;
    });
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(tick, 200 / settings.speed);
    return () => clearInterval(timer);
  }, [running, settings.speed]);
  useEffect(() => () => setVisualProvider(placeholderProvider), []);
  return (
    <main className="preview">
      <h1>Visual lab · 佔位動作契約</h1>
      <p>
        獨立預覽，共用正式引擎與視覺
        adapter，不寫入遊戲存檔。存活為受控分支示範。
      </p>
      <nav>
        <a href="#">返回遊戲</a>
        <button onClick={() => setRunning(!running)}>
          {running ? "停止" : "播放"}
        </button>
        <button onClick={tick}>單步</button>
        <button
          onClick={() => {
            setRunning(false);
            setS(initial());
          }}
        >
          三類細胞待機
        </button>
        <button onClick={() => scene(false)}>接觸 → 包覆 → 吞入 → 清除</button>
        <button onClick={() => scene(true)}>胞內存活示範</button>
        <button
          onClick={() => {
            setVisualProvider(
              alternate ? placeholderProvider : exampleProvider,
            );
            setAlternate(!alternate);
          }}
        >
          切換替換外觀 {alternate ? "B" : "A"}
        </button>
      </nav>
      <div className="button-row">
        <label>
          角色
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
          >
            {Object.entries(kindNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          預覽速度
          <select
            aria-label="預覽速度"
            value={settings.speed}
            onChange={(e) =>
              setSettings({
                ...settings,
                speed: Number(e.target.value) as 1 | 2 | 4,
              })
            }
          >
            <option value={1}>1×</option>
            <option value={2}>2×</option>
            <option value={4}>4×</option>
          </select>
        </label>
        <label>
          動態
          <select
            aria-label="預覽動態"
            value={settings.motion}
            onChange={(e) =>
              setSettings({
                ...settings,
                motion: e.target.value as Settings["motion"],
              })
            }
          >
            <option value="normal">正常</option>
            <option value="reduced">降低動態</option>
            <option value="skip">略過視覺動態</option>
          </select>
        </label>
      </div>
      <World
        state={s}
        settings={settings}
        selected={selected}
        mode="select"
        onPoint={() => {}}
        onSelect={setSelected}
      />
      <p data-testid="phase">
        {s.units.map((u) => `${u.id}: ${u.action}`).join(" ｜ ")} · step{" "}
        {s.step}
      </p>
      <output data-testid="authority" hidden>
        {JSON.stringify(s)}
      </output>
      <details>
        <summary>Manifest / anchors</summary>
        <pre>{JSON.stringify(manifest, null, 2)}</pre>
      </details>
    </main>
  );
}
