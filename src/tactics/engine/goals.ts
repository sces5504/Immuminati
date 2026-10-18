import type { TacticalContent, TacticalState } from "../domain/model";
export function victoryCondition(s: TacticalState, c: TacticalContent) {
  if (
    c.mechanics === "retroviral" ||
    s.wave !== c.waves.length - 1 ||
    Object.values(s.health).some((n) => n <= 0)
  )
    return false;
  if (c.mechanics === "containment")
    return (
      (s.campaign?.stable ?? 0) >= 100 &&
      Object.values(s.health).every((n) => n >= 45)
    );
  return (
    s.colonies.every((p) => p.load === 0) &&
    s.internal.every((p) => p.load === 0) &&
    s.hosts.every((h) => h.load === 0)
  );
}
export function limitedCondition(s: TacticalState, c: TacticalContent) {
  return (
    c.mechanics === "retroviral" && Object.values(s.health).every((n) => n <= 0)
  );
}
