import type { TacticalState, TacticalEvent, Vec } from "../domain/model";
export function emit(
  s: TacticalState,
  type: TacticalEvent["type"],
  position: Vec,
  message: string,
  amount = 0,
  extra: Partial<TacticalEvent> = {},
) {
  s.events.push({
    id: ++s.eventId,
    tick: s.tick,
    type,
    position: { ...position },
    message,
    amount,
    ...extra,
  });
  if (s.events.length > 400) s.events.shift();
}
