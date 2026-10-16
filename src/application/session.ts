import type { Command, Content, Session, Progress } from "../domain/model";
import { createBattle, resolveCommand, clone } from "../engine/battle";
export function newSession(id: string, seed: number, c: Content): Session {
  const state = createBattle(id, seed, c);
  return {
    state,
    turnStart: clone(state),
    commands: [],
    events: [],
    turnEventIndex: 0,
  };
}
export function dispatch(session: Session, command: Command, c: Content) {
  const resolution = resolveCommand(session.state, command, c);
  if (resolution.error) return { session, resolution };
  const events = [...session.events, ...resolution.frames.map((f) => f.event)];
  const next: Session =
    command.type === "endTurn"
      ? {
          state: resolution.state,
          turnStart: clone(resolution.state),
          commands: [],
          events,
          turnEventIndex: events.length,
        }
      : {
          ...session,
          state: resolution.state,
          commands: [...session.commands, command],
          events,
        };
  return { session: next, resolution };
}
export function undo(session: Session, c: Content): Session {
  if (!session.commands.length || session.state.outcome) return session;
  const commands = session.commands.slice(0, -1);
  let state = clone(session.turnStart);
  const events = session.events.slice(0, session.turnEventIndex);
  for (const command of commands) {
    const r = resolveCommand(state, command, c);
    if (r.error) throw new Error(r.error);
    state = r.state;
    events.push(...r.frames.map((f) => f.event));
  }
  return { ...session, state, events, commands };
}
export function recordResult(progress: Progress, session: Session): Progress {
  const result = session.state.outcome;
  if (result?.type !== "victory") return progress;
  const old = progress.records[session.state.scenario];
  if (old && old.preservation >= result.preservation) return progress;
  return {
    ...progress,
    records: { ...progress.records, [session.state.scenario]: result },
  };
}
