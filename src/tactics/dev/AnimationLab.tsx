import { useEffect, useRef, useState } from "react";
import { m1 } from "../content/m1";
import { copy, createTactical, stepTactical } from "../engine/simulation";
import { BattleScene } from "../presentation/BattleScene";
function sample(survives = false) {
  const c = copy(m1);
  c.pathogen.survives = survives;
  const s = createTactical(c);
  s.colonies = [s.colonies[0]];
  s.colonies[0].load = 3;
  s.colonies[0].markedUntil = 100;
  s.cells = [s.cells[0]];
  s.cells[0].position = {
    x: s.colonies[0].position.x - 2,
    z: s.colonies[0].position.z,
  };
  return { c, s };
}
export default function AnimationLab() {
  const [initial] = useState(() => sample());
  const [state, setState] = useState(initial.s);
  const current = useRef(state);
  current.current = state;
  const [busy, setBusy] = useState(false);
  const host = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    view = useRef<BattleScene | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    view.current = new BattleScene(
      host.current!,
      canvas.current!,
      m1,
      () => ({
        state: current.current,
        selected: "u1",
        idle: true,
        reduced: false,
        speed: 0.5,
      }),
      () => {},
    );
    view.current.focus(initial.s.cells[0].position, 3);
    return () => {
      view.current?.dispose();
      clearTimeout(timer.current);
    };
  }, []);
  function play(survives: boolean) {
    const fixture = sample(survives);
    fixture.s.eventId = current.current.eventId + 10;
    fixture.s.events = [];
    let resolved = stepTactical(fixture.s, fixture.c);
    setState(resolved);
    setBusy(true);
    timer.current = setTimeout(() => {
      for (let i = 0; i < 15; i++) resolved = stepTactical(resolved, fixture.c);
      setState(resolved);
      setBusy(false);
    }, 2800);
  }
  const internal = state.internal.reduce((n, p) => n + p.load, 0);
  return (
    <main
      style={{
        maxWidth: 1000,
        padding: 20,
        margin: "0 auto",
        color: "#28435f",
      }}
    >
      <span className="eyebrow">
        DEVELOPMENT FIXTURE · 展示契約，非可玩關卡
      </span>
      <h1 style={{ fontSize: 23, margin: "12px 0" }}>
        立體吞噬：清除與胞內存活
      </h1>
      <p style={{ fontSize: 12, lineHeight: 1.8 }}>
        這是半速動畫測試群體，沿用雙球字形；不表示 M1
        肺炎鏈球菌會在本案例胞內存活。
      </p>
      <div style={{ display: "flex", gap: 10, margin: "15px 0" }}>
        <button disabled={busy} onClick={() => play(false)}>
          播放清除分支
        </button>
        <button disabled={busy} onClick={() => play(true)}>
          播放胞內存活分支
        </button>
      </div>
      <div
        ref={host}
        style={{
          height: 540,
          position: "relative",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvas}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            touchAction: "none",
          }}
        />
      </div>
      <p data-testid="lab-result" style={{ fontSize: 13, padding: 20 }}>
        {busy
          ? "偽足伸展、包覆與吞入中…"
          : internal
            ? `胞內存活 ${internal} 負荷；宿主內保留可見囊泡與活菌。`
            : "已清除；沒有活的胞內來源。"}
      </p>
    </main>
  );
}
