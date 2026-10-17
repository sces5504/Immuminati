/** Development-only clip contract fixture. Never included in production UI. */
import { useEffect, useRef, useState } from "react";
import { content } from "../content/game";
import { clone, createBattle, resolveCommand } from "../engine/battle";
import { Playback, type VisualState } from "../presentation/playback";
import { Board } from "../ui/Board";
function fixture(survives: boolean) {
  const c = clone(content);
  c.pathogens.fixture = {
    ...c.pathogens.pneumococcus,
    id: "fixture",
    name: "展示契約樣本",
    survivesEngulfment: survives,
    replication: 0,
    intracellularGrowth: 0,
  };
  c.scenarios.fixture = {
    ...c.scenarios.m1,
    id: "fixture",
    pathogen: "fixture",
    initialLoads: [3, 0, 0],
    variants: [],
  };
  const before = createBattle("fixture", 1, c);
  before.populations[0].opsonin = 3;
  return { c, before };
}
export default function AnimationLab() {
  const [sample, setSample] = useState(() => fixture(false));
  const [visual, setVisual] = useState<VisualState>({
    state: sample.before,
    duration: 0,
  });
  const [busy, setBusy] = useState(false);
  const player = useRef<Playback | null>(null);
  useEffect(() => () => player.current?.cancel(), []);
  function play(survives: boolean) {
    player.current?.cancel();
    const next = fixture(survives);
    setSample(next);
    setBusy(true);
    const result = resolveCommand(
      next.before,
      { type: "engulf", unitId: "u1", targetId: "p1" },
      next.c,
    );
    const p = new Playback(next.before, setVisual, () => setBusy(false));
    player.current = p;
    p.play(next.before, result.frames, result.state);
  }
  const internal = visual.state.populations
    .filter((p) => p.compartment === "phagosome")
    .reduce((a, p) => a + p.load, 0);
  return (
    <main style={{ maxWidth: 900, margin: "20px auto", padding: 20 }}>
      <span className="eyebrow">DEVELOPMENT FIXTURE · 非可玩關卡</span>
      <h1 style={{ fontSize: 24, margin: "10px 0" }}>吞入後的兩種結果</h1>
      <p style={{ fontSize: 12, marginBottom: 15 }}>
        這是展示契約的抽象樣本；雙球菌圖示僅為測試字形，不代表肺炎鏈球菌在 M1
        中胞內存活。
      </p>
      <div style={{ display: "flex", gap: 12, marginBottom: 15 }}>
        <button disabled={busy} onClick={() => play(false)}>
          播放清除分支
        </button>
        <button disabled={busy} onClick={() => play(true)}>
          播放胞內存活分支
        </button>
      </div>
      <Board
        content={sample.c}
        visual={visual}
        selected="u1"
        selectedRegion="a"
        onSelect={() => {}}
        onRegion={() => {}}
        moveMode={false}
        idle
        reduced={false}
      />
      <p className="event-caption" data-testid="lab-result">
        {busy
          ? visual.event?.reason
          : internal
            ? `胞內存活 ${internal} 負荷；宿主仍在場且保留囊泡標記。`
            : "已清除；沒有活的胞內來源。"}
      </p>
    </main>
  );
}
