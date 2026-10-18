import type {
  TacticalCommand,
  TacticalContent,
  TacticalSave,
  TacticalState,
} from "../domain/model";
import {
  commandTactical,
  copy,
  createDeployment,
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
      rules: "3.1",
      content: "campaign.2",
      state: createDeployment(content, 1),
      paused: true,
      undo: [],
      settings: {
        speed: 1,
        reduced: false,
        idle: true,
        hints: true,
        labels: false,
      },
      read: [],
      records: {},
      revealed: [],
    };
  }
  command(command: TacticalCommand): string | undefined {
    const old = this.save.state;
    const r = commandTactical(old, command, this.content);
    if (r.error) return r.error;
    if (this.save.paused && command.type !== "begin")
      this.save.undo = [...this.save.undo.slice(-9), copy(old)];
    if (command.type === "begin") this.save.undo = [];
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
    if (!value && this.save.state.preparation) return;
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
      state: createDeployment(this.content, seed),
      paused: true,
      undo: [],
    };
  }
  acknowledgeResult() {
    if (
      this.content.id === "m6" &&
      this.save.state.result?.type === "limited" &&
      !this.save.revealed.includes("m6")
    )
      this.save.revealed.push("m6");
  }
  snapshot() {
    return copy(this.save);
  }
}
