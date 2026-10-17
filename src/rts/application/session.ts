import type { Save, Command, Settings, State } from "../domain/types";
import { createState, step, validate, cost } from "../engine/simulation";
export class Session {
  state: State;
  plans: Command[] = [];
  paused = true;
  nextCommand = 1;
  settings: Settings = { speed: 1, motion: "normal", signals: false };
  constructor(save?: Save) {
    this.state = save?.state ?? createState();
    if (save) {
      this.plans = save.plans;
      this.settings = save.settings;
      this.nextCommand = save.nextCommand;
    }
  }
  enqueue(input: Omit<Command, "id" | "step">) {
    const cmd: Command = {
      ...input,
      id: `c${this.nextCommand++}`,
      step: this.state.step + 1,
    };
    const shadow = structuredClone(this.state);
    shadow.resources -= this.plans.reduce((n, c) => n + cost(c), 0);
    shadow.supply -= this.plans.filter((c) => c.type === "recruit").length;
    const reason = validate(shadow, cmd);
    if (reason) return reason;
    this.plans.push(cmd);
  }
  cancel(id: string) {
    this.plans = this.plans.filter((c) => c.id !== id);
  }
  tick() {
    if (this.paused || this.state.result) return;
    const commands = this.plans;
    this.plans = [];
    step(this.state, commands);
  }
  snapshot(): Save {
    return {
      schema: 3,
      state: this.state,
      plans: this.plans,
      settings: this.settings,
      nextCommand: this.nextCommand,
    };
  }
}
