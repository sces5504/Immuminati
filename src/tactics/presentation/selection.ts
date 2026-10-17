export interface PickCandidate {
  type: "cell" | "colony" | "host";
  id: string;
  d: number;
}
/** Tissue is inspectable scenery; it must not steal an existing tactical touch target. */
export function chooseEntity<T extends PickCandidate>(
  candidates: T[],
  moving = false,
): T | undefined {
  const nearest = [...candidates].sort((a, b) => a.d - b.d);
  return (
    nearest.find((p) => p.type !== "host" && p.d < 28) ??
    (moving ? undefined : nearest.find((p) => p.type === "host" && p.d < 22))
  );
}
