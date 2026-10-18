/** Reopen actual recorded outcomes for stable, fully entered report screenshots.
 * These are replayed recorded saves, NOT additional playthroughs or forged victories.
 */
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL("../docs/evidence/core-lifecycle/", import.meta.url)
  .pathname;
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const rows = [];
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1024, height: 768 }],
    ["mobile", { width: 360, height: 800 }],
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date("2030-01-01") });
    await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
    await page.goto(process.env.TARGET_URL ?? "http://127.0.0.1:24866/");
    const click = (l) => l.evaluate((el) => el.click());
    for (const id of ["m1", "m2", "m3", "m4", "m5", "m6"]) {
      const raw = await readFile(dir + `${device}-${id}-final.json`, "utf8"),
        recorded = JSON.parse(raw).state;
      await click(
        page.getByRole("button", { name: "設定與存檔", exact: true }),
      );
      await page.getByLabel("新版存檔檔案").setInputFiles({
        name: "recorded-playthrough.json",
        mimeType: "application/json",
        buffer: Buffer.from(raw),
      });
      await click(page.getByRole("button", { name: "繼續防線 →" }));
      for (let i = 0; i < 15; i++) {
        await page.clock.runFor(150);
        await new Promise((r) => setTimeout(r, 30));
      }
      assert.equal(await page.getByTestId("tactical-result").count(), 1);
      const restored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
      assert.deepEqual(restored.state, recorded);
      const bounds = await page.getByTestId("tactical-result").evaluate((e) => {
        const r = e.getBoundingClientRect();
        return {
          top: r.top,
          bottom: r.bottom,
          viewport: innerHeight,
          overflow: e.scrollWidth > e.clientWidth + 1,
          opacity: getComputedStyle(e).opacity,
        };
      });
      assert.ok(
        bounds.top >= 0 &&
          bounds.bottom <= viewport.height &&
          !bounds.overflow &&
          bounds.opacity === "1",
        JSON.stringify(bounds),
      );
      await page.screenshot({
        path: dir + `${device}-${id}-report.png`,
        animations: "disabled",
      });
      rows.push({
        device,
        id,
        bounds,
        method:
          "Native UI import of recorded successful playthrough; no authority editing; report animation allowed to finish.",
      });
    }
    if (device === "mobile") {
      const oldText = await readFile(
        new URL(
          "../docs/evidence/campaign-final/mobile-m6/mobile-m6-final.json",
          import.meta.url,
        ),
        "utf8",
      );
      const old = JSON.parse(oldText);
      await click(
        page.getByRole("button", { name: "設定與存檔", exact: true }),
      );
      await page
        .getByLabel("新版存檔檔案")
        .setInputFiles({
          name: "actual-3.0-hiv-save.json",
          mimeType: "application/json",
          buffer: Buffer.from(oldText),
        });
      await click(page.getByRole("button", { name: "繼續防線 →" }));
      await page.clock.runFor(400);
      const migrated = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
      assert.equal(migrated.rules, "3.2");
      assert.equal(migrated.paused, true);
      assert.equal(migrated.state.result, undefined);
      assert.equal(migrated.state.tick, old.state.tick);
      assert.deepEqual(migrated.state.health, old.state.health);
      const backup = await page.evaluate(
        (text) =>
          Object.keys(localStorage).some(
            (k) =>
              k.startsWith("immuminati:tactics:import-pre-3.2:") &&
              localStorage.getItem(k) === text,
          ),
        oldText,
      );
      assert.equal(backup, true);
      await page.screenshot({
        path: dir + "mobile-hiv-real-legacy-resume.png",
        animations: "disabled",
      });
      await click(page.getByTestId("pause-toggle"));
      await page.clock.runFor(500);
      await click(page.getByTestId("pause-toggle"));
      assert.ok(
        +(await page.locator(".tactical-root").getAttribute("data-tick")) >
          old.state.tick,
      );
      rows.push({
        device,
        id: "m6-legacy",
        source: "Actual archived rules3.0 save, 81.4-second low-CD4 ending",
        rules: migrated.rules,
        tick: migrated.state.tick,
        healthPreserved: true,
        originalBackedUp: backup,
        safelyPaused: true,
        canResume: true,
      });
    }
    await context.close();
  }
  await writeFile(dir + "report-replays.json", JSON.stringify(rows, null, 2));
} finally {
  await browser.close();
}
