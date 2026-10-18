/** Real new-game TB failure branch; no injected authority state. */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL("../docs/evidence/core-lifecycle/", import.meta.url)
  .pathname;
await mkdir(dir + "raw-focus", { recursive: true });
const inspectionOnly = process.env.INSPECTION_ONLY === "1";
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
    errors = [],
    bad = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push({ status: r.status(), url: r.url() });
  });
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
  const beforeCompare = (await read()).state;
  for (const mode of ["original", "tripo"]) {
    await click(page.getByRole("button", { name: "設定與存檔", exact: true }));
    await click(page.getByTestId("art-toggle"));
    await click(page.getByRole("button", { name: "關閉視窗", exact: true }));
    for (let k = 0; k < 80; k++) {
      await page.clock.runFor(150);
      await new Promise((r) => setTimeout(r, 40));
      if (
        (await page
          .getByTestId("tactical-scene")
          .getAttribute("data-art-mode")) === mode
      )
        break;
    }
    assert.equal(
      await page.getByTestId("tactical-scene").getAttribute("data-art-mode"),
      mode,
    );
    assert.deepEqual((await read()).state, beforeCompare);
  }
  const pauseBox = await page.getByTestId("pause-toggle").boundingBox();
  await page.mouse.move(
    pauseBox.x + pauseBox.width / 2,
    pauseBox.y + pauseBox.height / 2,
  );
  await page.clock.runFor(160);
  const pauseContrast = await page.getByTestId("pause-toggle").evaluate((e) => {
    const style = getComputedStyle(e);
    return {
      background: style.backgroundColor,
      color: style.color,
      text: e.textContent,
      hover: e.matches(":hover"),
    };
  });
  assert.ok(pauseContrast.text.includes("開始行動"));
  if (pauseContrast.hover)
    assert.equal(pauseContrast.background, "rgb(211, 237, 240)");
  await page.mouse.move(1, 1);
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
      const cutaway = await page
        .getByTestId("intracellular-status")
        .boundingBox();
      assert.ok(
        cutaway.y >= 0 && cutaway.y + cutaway.height <= 844,
        "Local inspection opens on the selected intracellular source",
      );
      await page.screenshot({ path: dir + "mobile-tb-growing-cutaway.png" });
      await writeFile(
        dir + "mobile-tb-growth-save.json",
        JSON.stringify(await read(), null, 2),
      );
      await click(page.getByRole("button", { name: "關閉視窗", exact: true }));
      if (inspectionOnly) break;
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
  if (!inspectionOnly) assert.ok(rupture);
  assert.ok(peak > 6);
  assert.deepEqual(errors, []);
  assert.deepEqual(bad, []);
  await writeFile(
    dir + (inspectionOnly ? "tb-inspection.json" : "tb-failure-branch.json"),
    JSON.stringify(
      {
        inspectionOnly,
        pauseContrast,
        grown,
        peak,
        rupture,
        elapsed,
        timeline,
        errors,
        bad,
        method:
          "Visible fresh TB deployment, no Th1, normal motion near divisions. No state injection.",
      },
      null,
      2,
    ),
  );
  const video = page.video();
  await context.close();
  await video.saveAs(
    dir +
      (inspectionOnly
        ? "mobile-tb-inspection-raw.webm"
        : "mobile-tb-failure-raw.webm"),
  );
} finally {
  await browser.close();
}
