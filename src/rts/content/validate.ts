import type { Scenario } from "../domain/types";
export function validateScenario(c: Scenario) {
  if (
    !c.id ||
    !c.version ||
    c.dt <= 0 ||
    c.dt > 0.25 ||
    c.width <= 100 ||
    c.height <= 100 ||
    c.tissueBottom > c.height - 35 ||
    c.tissueBottom < 100
  )
    throw new Error("Invalid scenario dimensions/clock");
  if (
    c.sourceSteps.some(
      (n, i) =>
        !Number.isInteger(n) || n < 1 || (i > 0 && n <= c.sourceSteps[i - 1]),
    ) ||
    c.sourceClose < Math.max(0, ...c.sourceSteps)
  )
    throw new Error("Invalid infection source timeline");
  if (
    c.growth < 1 ||
    c.signalDiffusion < 0 ||
    c.signalDiffusion > 0.25 ||
    c.signalDecay < 0 ||
    c.signalDecay > 1 ||
    c.signalStrength < 0
  )
    throw new Error("Invalid growth or signal stability");
  if (
    c.initial.some(
      (p) => p.x < 35 || p.x > c.width - 35 || p.y < 35 || p.y > c.tissueBottom,
    ) ||
    c.foci.some(
      (p) => p.x < 35 || p.x > c.width - 35 || p.y < 35 || p.y > c.tissueBottom,
    )
  )
    throw new Error("Invalid initial traversable position");
  if (
    Object.values(c.stages).some((n) => n <= 0 || !Number.isInteger(n)) ||
    Object.values(c.costs).some((n) => n < 0) ||
    c.stars[0] < 0 ||
    c.stars[1] < c.stars[0] ||
    c.stars[1] > 100
  )
    throw new Error("Invalid reaction delay, cost or stars");
  return c;
}
