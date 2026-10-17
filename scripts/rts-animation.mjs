import { existsSync } from "node:fs";
if (
  !process.env.PLAYWRIGHT_BROWSERS_PATH &&
  existsSync("/tmp/immuminati-playwright")
)
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/tmp/immuminati-playwright";
const { chromium } = await import("@playwright/test");
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "docs/evidence/rts";
await mkdir(dir, { recursive: true });
const url = process.env.BASE_URL ?? "http://127.0.0.1:4176/Immuminati/";
const server = process.env.BASE_URL
  ? null
  : spawn(process.execPath, [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4176",
      "--strictPort",
    ]);
let browser;
const results = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ??
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    recordVideo: {
      dir: `${dir}/raw-animation`,
      size: { width: 1280, height: 1000 },
    },
  });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${url}#visual-lab`);
  const before = await p
    .locator('[data-unit="u1"] path')
    .first()
    .getAttribute("d");
  await p.waitForTimeout(5200);
  const after = await p
    .locator('[data-unit="u1"] path')
    .first()
    .getAttribute("d");
  assert.notEqual(before, after);
  const first = await p
      .locator('[data-unit="u1"] path')
      .first()
      .getAttribute("d"),
    second = await p.locator('[data-unit="u2"] path').first().getAttribute("d");
  assert.notEqual(first, second);
  results.push("independent idle membrane phases >5 seconds");
  const stateA = await p.getByTestId("authority").textContent();
  await p.getByRole("button", { name: "切換替換外觀 A" }).click();
  assert.equal(await p.getByTestId("authority").textContent(), stateA);
  assert(await p.locator('[data-art-adapter="example"]').count());
  await p.screenshot({
    path: `${dir}/replacement-provider.png`,
    fullPage: true,
  });
  await p.getByRole("button", { name: "切換替換外觀 B" }).click();
  results.push(
    "provider replacement leaves authoritative state and events unchanged",
  );
  await p.getByRole("button", { name: "接觸 → 包覆 → 吞入 → 清除" }).click();
  const phases = new Set();
  for (let i = 0; i < 40; i++) {
    const phase = await p.getByTestId("phase").textContent();
    for (const a of ["contact", "wrap", "ingest", "digest", "cooldown"])
      if (phase.includes(a) && !phases.has(a)) {
        phases.add(a);
        await p.screenshot({
          path: `${dir}/animation-${a}.png`,
          fullPage: true,
        });
      }
    await p.getByRole("button", { name: "單步", exact: true }).click();
  }
  for (const a of ["contact", "wrap", "ingest", "digest", "cooldown"])
    assert(phases.has(a));
  const clear = JSON.parse(await p.getByTestId("authority").textContent());
  assert(clear.events.some((e) => e.type === "clear"));
  results.push(
    "contact → continuous membrane wrap → moving internal vesicle → digest → clear",
  );
  // Normal time playback captures the entire action, rather than only stage screenshots.
  await p.getByRole("button", { name: "接觸 → 包覆 → 吞入 → 清除" }).click();
  await p.getByRole("button", { name: "播放", exact: true }).click();
  await p.waitForTimeout(9000);
  await p.getByRole("button", { name: "停止", exact: true }).click();
  await p.getByRole("button", { name: "胞內存活示範" }).click();
  await p.getByRole("button", { name: "播放", exact: true }).click();
  await p.waitForTimeout(9000);
  await p.getByRole("button", { name: "停止", exact: true }).click();
  assert((await p.getByTestId("phase").textContent()).includes("survive"));
  await p.screenshot({ path: `${dir}/animation-survival.png`, fullPage: true });
  const alive = JSON.parse(await p.getByTestId("authority").textContent());
  assert(
    alive.pathogens.some((b) => b.compartment === "internal" && b.load > 0),
  );
  assert.equal(alive.stats.cleared, 0);
  results.push(
    "controlled intracellular survival retains viable cargo; not M1 common course",
  );
  // Same controlled scenario at identical steps, normal versus reduced display.
  async function replay(motion) {
    await p.getByLabel("預覽動態", { exact: true }).selectOption(motion);
    await p.getByRole("button", { name: "接觸 → 包覆 → 吞入 → 清除" }).click();
    for (let i = 0; i < 40; i++)
      await p.getByRole("button", { name: "單步", exact: true }).click();
    return await p.getByTestId("authority").textContent();
  }
  const normal = await replay("normal"),
    reduced = await replay("reduced"),
    skip = await replay("skip");
  assert.equal(normal, reduced);
  assert.equal(normal, skip);
  results.push(
    "normal/reduced/skip display exact same authoritative state and events",
  );
  const perf = [];
  for (const speed of ["1", "4"]) {
    await p.getByLabel("預覽速度").selectOption(speed);
    await p.getByRole("button", { name: "播放", exact: true }).click();
    const frame = await p.evaluate(
      () =>
        new Promise((resolve) => {
          const intervals = [];
          let prev = performance.now(),
            start = prev;
          function tick(now) {
            intervals.push(now - prev);
            prev = now;
            if (now - start < 2500) requestAnimationFrame(tick);
            else {
              intervals.sort((a, b) => a - b);
              resolve({
                frames: intervals.length,
                seconds: (now - start) / 1000,
                p50: intervals[Math.floor(intervals.length * 0.5)],
                p95: intervals[Math.floor(intervals.length * 0.95)],
              });
            }
          }
          requestAnimationFrame(tick);
        }),
    );
    perf.push({ speed, ...frame });
    await p.getByRole("button", { name: "停止", exact: true }).click();
  }
  assert.deepEqual(errors, []);
  await writeFile(
    `${dir}/animation-results.json`,
    JSON.stringify(
      {
        browser: browser.version(),
        viewport: { width: 1280, height: 1000 },
        rendering: "headless Chromium, SVG/CPU; not physical phone",
        results,
        perf,
        errors,
      },
      null,
      2,
    ),
  );
  const video = p.video();
  await ctx.close();
  await video.saveAs(`${dir}/controlled-animation.webm`);
  console.log(JSON.stringify({ results, perf }, null, 2));
} finally {
  await browser?.close();
  server?.kill();
}
