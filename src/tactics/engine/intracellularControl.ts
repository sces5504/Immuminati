import type { Cell, TacticalContent, TacticalState } from "../domain/model";
/** IFN-γ is one component of TB control, not a universally sterilizing treatment. */
export function intracellularControl(
  s: TacticalState,
  u: Cell,
  c: TacticalContent,
) {
  const activated = s.immunity.signals[u.region].ifng >= 20;
  const cognateHelp =
    c.mechanics !== "containment" ||
    s.cells.some(
      (t) =>
        ["th1", "helperT"].includes(t.kind) &&
        t.activation === "effector" &&
        t.antigen === (c.pathogen.antigen ?? `${c.pathogen.id}:protein`) &&
        Math.hypot(t.position.x - u.position.x, t.position.z - u.position.z) <
          6,
    );
  const contained = (s.campaign?.containment[u.region] ?? 0) >= 60;
  return {
    activated: activated && cognateHelp,
    contained,
    controlled: (activated && cognateHelp) || contained,
  };
}
