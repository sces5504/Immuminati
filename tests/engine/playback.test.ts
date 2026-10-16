import { it, expect, vi } from "vitest";
import { content } from "../../src/content/game";
import { createBattle, resolveEndTurn } from "../../src/engine/battle";
import { Playback, eventMap } from "../../src/presentation/playback";
it("normal, accelerated, reduced and repeated skip only display the same submitted result", () => {
  vi.useFakeTimers();
  const before = createBattle("m1", 1, content);
  const resolution = resolveEndTurn(before, content);
  for (const [speed, reduced, skip] of [
    [1, false, false],
    [4, false, false],
    [1, true, false],
    [1, false, true],
  ] as const) {
    const show = vi.fn(),
      done = vi.fn();
    const p = new Playback(before, show, done);
    p.speed = speed;
    p.reduced = reduced;
    p.play(before, resolution.frames, resolution.state);
    if (skip) {
      p.skip();
      p.skip();
    }
    vi.runAllTimers();
    expect(show.mock.lastCall![0].state).toEqual(resolution.state);
    expect(done).toHaveBeenCalledTimes(1);
    expect(resolution.frames.every((f) => eventMap[f.event.type])).toBe(true);
    p.cancel();
  }
  vi.useRealTimers();
});
it("cancel cleans up timers without firing completion callbacks", () => {
  vi.useFakeTimers();
  const before = createBattle("m1", 1, content);
  const resolution = resolveEndTurn(before, content);
  const show = vi.fn(),
    done = vi.fn();
  const p = new Playback(before, show, done);
  p.play(before, resolution.frames, resolution.state);
  p.cancel();
  vi.runAllTimers();
  expect(done).not.toHaveBeenCalled();
  vi.useRealTimers();
});
