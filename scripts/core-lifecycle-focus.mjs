/** Real new-game TB failure branch; no injected authority state. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL("../docs/evidence/core-lifecycle/", import.meta.url)
  .pathname;
await mkdir(dir + "raw-focus", { recursive: true });
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: dir + "raw-focus", size: { width: 390, height: 844 } },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const click = (l) => l.evaluate((el) => el.click());
  await page.clock.install({ time: new Date("2030-01-01") });
  await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
  await page.goto(
    process.env.TARGET_URL ?? "http://127.0.0.1:24865/Immuminati/",
  );
  await page.clock.runFor(200);
  await click(page.locator(".t-case-cards button").nth(2));
  await click(page.locator(".t-deploy-custom summary"));
  await page.getByRole("combobox", { name: "部署防區" }).selectOption("c");
  await click(page.locator('[data-deploy="dendritic"]'));
  await click(page.getByTestId("deployment-confirm"));
  const read = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
    );
  const host = (await read()).state.cells.find(
    (u) => u.kind === "macrophage",
  ).id;
  await click(page.locator(`.t-roster [data-cell-id="${host}"]`));
  await page.clock.runFor(1600);
  await page.screenshot({ path: dir + "mobile-tb-untreated-start.png" });
  await click(page.getByTestId("pause-toggle"));
  let grown,
    rupture,
    peak,
    elapsed = 0;
  const timeline = [];
  for (let i = 0; i < 500; i++) {
    const tick = +(await page
      .locator(".tactical-root")
      .getAttribute("data-tick"));
    // Near the next bacterial division use ordinary RAF playback to capture the actual motion.
    const raw = await read(),
      u = raw.state.cells.find((u) => u.id === host);
    const near = u?.replicateAt && u.replicateAt - tick < 8;
    if (near) await page.clock.runFor(250);
    else await page.clock.fastForward(1000);
    if (i % 25 === 0) console.log("TB failure branch", tick);
    if (i % 8 !== 0 && !near) continue;
    await click(page.getByTestId("pause-toggle"));
    const s = (await read()).state;
    const load = s.internal
      .filter((p) => p.host === host)
      .reduce((n, p) => n + p.load, 0);
    if (load > 0) peak = Math.max(peak ?? 0, load);
    timeline.push({
      tick: s.tick,
      load,
      health: s.health,
      hosts: s.cells.map((u) => u.id),
    });
    if (!grown && s.events.some((e) => e.type === "grow" && e.actor === host)) {
      grown = s.tick;
      await page.screenshot({ path: dir + "mobile-tb-growing-selected.png" });
      await click(page.getByTestId("inspect-selected"));
      await page.clock.runFor(300);
      assert.ok(await page.getByTestId("intracellular-status").count());
      await page.screenshot({ path: dir + "mobile-tb-growing-cutaway.png" });
      await click(page.getByRole("button", { name: "關閉視窗", exact: true }));
    }
    const event = s.events.find(
      (e) =>
        e.type === "damage" && e.actor === host && e.message.includes("破裂"),
    );
    if (event) {
      rupture = event;
      elapsed = s.tick;
      await page.clock.runFor(900);
      await page.screenshot({ path: dir + "mobile-tb-rupture.png" });
      break;
    }
    assert.ok(!s.result, "rupture must be observed before defeat");
    await click(page.getByTestId("pause-toggle"));
  }
  assert.ok(grown);
  assert.ok(rupture);
  assert.ok(peak > 6);
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "tb-failure-branch.json",
    JSON.stringify(
      {
        grown,
        peak,
        rupture,
        elapsed,
        timeline,
        errors,
        method:
          "Visible fresh TB deployment, no Th1, normal motion near divisions. No state injection.",
      },
      null,
      2,
    ),
  );
  const video = page.video();
  await context.close();
  await video.saveAs(dir + "mobile-tb-failure-raw.webm");
} finally {
  await browser.close();
}
