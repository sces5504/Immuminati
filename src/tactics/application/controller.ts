import type {
  TacticalCommand,
  TacticalContent,
  TacticalSave,
  TacticalState,
} from "../domain/model";
import {
  commandTactical,
  copy,
  createTactical,
  stepTactical,
} from "../engine/simulation";
export class TacticalController {
  save: TacticalSave;
  constructor(
    public content: TacticalContent,
    save?: TacticalSave,
  ) {
    this.save = save ?? {
      schema: 2,
      rules: "2.1",
      content: "m1-tactics.2",
      state: createTactical(content, 1),
      paused: true,
      undo: [],
      settings: { speed: 1, reduced: false, idle: true, hints: true },
      read: [],
      records: {},
    };
  }
  command(command: TacticalCommand): string | undefined {
    const old = this.save.state;
    const r = commandTactical(old, command, this.content);
    if (r.error) return r.error;
    if (this.save.paused)
      this.save.undo = [...this.save.undo.slice(-9), copy(old)];
    this.save.state = r.state;
    return;
  }
  step() {
    if (this.save.paused || this.save.state.result) return;
    this.save.state = stepTactical(this.save.state, this.content);
    this.save.undo = [];
    const result = this.save.state.result;
    if (
      result?.type === "victory" &&
      (!this.save.records[this.content.id] ||
        this.save.records[this.content.id].preservation < result.preservation)
    )
      this.save.records[this.content.id] = copy(result);
  }
  pause(value: boolean) {
    if (this.save.paused === value) return;
    this.save.paused = value;
    this.save.undo = [];
  }
  undo() {
    if (!this.save.paused || !this.save.undo.length) return;
    this.save.state = this.save.undo.pop()!;
  }
  restart(seed: number) {
    this.save = {
      ...this.save,
      state: createTactical(this.content, seed),
      paused: true,
      undo: [],
    };
  }
  snapshot() {
    return copy(this.save);
  }
}
