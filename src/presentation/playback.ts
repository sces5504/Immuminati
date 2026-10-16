import type { BattleEvent, BattleState, Frame } from "../domain/model";
export const eventMap: Record<
  BattleEvent["type"],
  { clip: string; duration: number }
> = {
  UnitMoved: { clip: "move", duration: 1000 },
  PathogenEngulfed: { clip: "engulf", duration: 1500 },
  PathogenCleared: { clip: "clear", duration: 550 },
  IntracellularSurvival: { clip: "survive", duration: 850 },
  OpsoninApplied: { clip: "opsonize", duration: 1100 },
  OpsoninExpired: { clip: "expire", duration: 500 },
  RecruitmentRequested: { clip: "request", duration: 650 },
  RecruitmentWaiting: { clip: "wait", duration: 400 },
  UnitArrived: { clip: "arrive", duration: 1000 },
  PathogenReplicated: { clip: "divide", duration: 850 },
  PathogenSpread: { clip: "spread", duration: 900 },
  TissueDamaged: { clip: "damage", duration: 650 },
  PriorityChanged: { clip: "target", duration: 300 },
  PriorityFallback: { clip: "target", duration: 300 },
  TurnEnded: { clip: "turn", duration: 650 },
  BattleEnded: { clip: "result", duration: 1100 },
};
export interface VisualState {
  state: BattleState;
  event?: BattleEvent;
  after?: BattleState;
  duration: number;
}
/** Playback has no dispatch callback and never calculates a rule. */
export class Playback {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private frames: Frame[] = [];
  private index = 0;
  private visual: BattleState;
  private final: BattleState;
  private running = false;
  speed = 1;
  reduced = false;
  constructor(
    initial: BattleState,
    private show: (v: VisualState) => void,
    private done: () => void,
  ) {
    this.visual = initial;
    this.final = initial;
  }
  play(before: BattleState, frames: Frame[], final: BattleState) {
    this.cancel();
    this.visual = before;
    this.final = final;
    this.frames = frames;
    this.index = 0;
    this.running = true;
    this.next();
  }
  private next() {
    if (!this.running) return;
    const frame = this.frames[this.index];
    if (!frame) {
      this.skip();
      return;
    }
    const duration = this.reduced
      ? 100
      : eventMap[frame.event.type].duration / this.speed;
    this.show({
      state: this.visual,
      event: frame.event,
      after: frame.state,
      duration,
    });
    this.timer = setTimeout(() => {
      this.visual = frame.state;
      this.index++;
      this.next();
    }, duration);
  }
  skip() {
    if (!this.running) return;
    this.cancel();
    this.visual = this.final;
    this.show({ state: this.final, duration: 0 });
    this.done();
  }
  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.running = false;
  }
}
