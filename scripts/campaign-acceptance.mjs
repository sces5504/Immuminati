import { configureCase } from "./deployment-helpers.mjs";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile, rm, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/campaign/",
  import.meta.url,
).pathname;
await mkdir(dir, { recursive: true });
const target = process.env.TARGET_URL ?? "http://127.0.0.1:4186/Immuminati/";
const server = process.env.TARGET_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4186",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const checks = [];
const log = async (...args) => {
  const line = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  console.log(line);
  await appendFile(
    dir + "progress.log",
    new Date().toISOString() + " " + line + "\n",
  );
};
const plans = {
  m1: [[0, "neutrophil", "a"]],
  m2: [
    [0, "neutrophil", "b"],
    [100, "macrophage", "b"],
    [260, "neutrophil", "c"],
  ],
  m3: [
    [0, "th1", "a"],
    [180, "macrophage", "a"],
  ],
  m4: [
    [0, "macrophage", "a"],
    [160, "pdc", "a"],
    [300, "helperT", "c"],
    [450, "bcell", "c"],
  ],
  m5: [
    [0, "neutrophil", "b"],
    [150, "neutrophil", "a"],
    [300, "neutrophil", "c"],
  ],
  m6: [
    [0, "pdc", "a"],
    [150, "pdc", "a"],
  ],
};
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(target)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const [device, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 360, height: 800 }],
  ]) {
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    for (const id of process.env.CASE
      ? [process.env.CASE]
      : Object.keys(plans)) {
      const ctx = await browser.newContext({
        viewport,
        isMobile: device === "mobile",
        hasTouch: device === "mobile",
        recordVideo: { dir: dir + "raw", size: viewport },
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(30000);
      const errors = [],
        bad = [];
      page.on("pageerror", (e) => {
        errors.push(e.message);
        void log("PAGEERROR", device, id, e.stack);
      });
      page.on("response", (r) => {
        if (r.status() >= 400) bad.push([r.status(), r.url()]);
      });
      await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
      // Pause the empty document before navigation: no live RAF can race the clock handoff.
      await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
      await page.goto(target);
      await page.clock.runFor(200);
      await page
        .locator(".t-case-cards button")
        .nth(Number(id.slice(1)) - 1)
        .click();
      await page.clock.runFor(200);
      await configureCase(page);
      const read = () =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
        );
      await page.waitForTimeout(500);
      await expect(page.locator(".t-scene-error")).toHaveCount(0);
      assert.equal((await read()).state.scenario, id);
      assert.equal((await read()).state.immunity.autoSeek, true);
      const original = await read();
      await page.screenshot({ path: dir + `${device}-${id}-start.png` });
      // Exercise real selection / manual movement / undo before the timed defense.
      await page.locator(".t-roster>button[data-cell-id]").first().click();
      await page.locator(".t-field-label").nth(1).click();
      assert.equal((await read()).state.cells[0].order.type, "move");
      await page.getByRole("button", { name: "撤銷暫停指令" }).click();
      assert.deepEqual((await read()).state, original.state);
      await page.keyboard.press("Escape");
      await page.getByTestId("antibody-tool").click();
      const panel = page.getByRole("region", { name: "B 細胞與抗體" });
      await expect(panel).toBeVisible();
      const fit = await panel.evaluate((e) => {
        const r = e.getBoundingClientRect();
        return {
          scroll: e.scrollHeight <= e.clientHeight + 1,
          visible: r.top >= 0 && r.bottom <= innerHeight,
          buttons: [...e.querySelectorAll("button")].map((b) => ({
            h: b.getBoundingClientRect().height,
            w: b.getBoundingClientRect().width,
            overflow: b.scrollWidth > b.clientWidth + 1,
          })),
          helper: e
            .querySelector(".t-antibody-recruit span")
            .getBoundingClientRect().height,
        };
      });
      assert.ok(
        fit.scroll &&
          fit.visible &&
          fit.helper < 22 &&
          !fit.buttons.some((b) => b.overflow || b.h < 43.9),
        JSON.stringify(fit),
      );
      await page.screenshot({
        path: dir + `${device}-${id}-antibody-panel.png`,
      });
      await page.getByRole("button", { name: "關閉抗體面板" }).click();
      await page.getByTestId("anatomy-panel").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({ path: dir + `${device}-${id}-anatomy.png` });
      await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
      await page.getByTestId("speed-toggle").click();
      // Controlled browser clock drives the actual production RAF controller. No rule state injection.
      // The document has used the paused clock since bootstrap.
      const tick = async () =>
        Number(await page.locator(".tactical-root").getAttribute("data-tick"));
      const click = async (locator) => locator.evaluate((el) => el.click());
      const pause = async (value) => {
        const root = page.locator(".tactical-root"),
          want = String(value);
        if ((await root.getAttribute("data-paused")) !== want)
          await click(page.getByTestId("pause-toggle"));
        await expect(root).toHaveAttribute("data-paused", want);
      };
      const recruit = async (kind, region) => {
        await click(page.getByTestId("recruit-tool"));
        await page
          .getByRole("combobox", { name: "增援防區" })
          .selectOption(region);
        const button = page.locator(`[data-recruit="${kind}"]`);
        if (await button.isEnabled()) {
          await click(button);
        }
        await click(page.getByRole("button", { name: "關閉增援面板" }));
      };
      const done = new Set();
      let nextMark = 0,
        savedMid = false,
        previous = 0;
      for (
        let n = 0;
        n < (id === "m6" ? 1000 : 180) &&
        !(await page.getByTestId("tactical-result").count());
        n++
      ) {
        await pause(true);
        const now = await tick();
        if (now >= nextMark) {
          const save = await read();
          const p = save.state.colonies.find(
            (p) => (p.complementUntil ?? 0) <= now && p.load > 0,
          );
          if (p && save.state.support > 0 && save.state.energy > 0) {
            await click(page.getByTestId("mark-tool"));
            await click(page.locator(`[data-colony="${p.id}"]`));
            await page.keyboard.press("Escape");
          }
          nextMark = now + 50;
        }
        for (const [index, [at, kind, region]] of plans[id].entries())
          if (now >= at && !done.has(index)) {
            await recruit(kind, region);
            done.add(index);
          }
        await pause(false);
        // HIV now runs to actual tissue exhaustion. Drive the same production
        // fixed steps without rendering every intermediate frame in this long case;
        // normal-play animation is covered separately and all result assertions stay.
        if (id === "m6") await page.clock.fastForward(1000);
        else await page.clock.runFor(1000);
        if (n % 15 === 0) await log("PROGRESS", device, id, await tick());
        if (!savedMid && (await tick()) >= 110) {
          await click(page.getByTestId("pause-toggle"));
          await page.screenshot({ path: dir + `${device}-${id}-action.png` });
          const state = (await read()).state;
          await click(
            page.getByRole("button", { name: "回主頁", exact: true }),
          );
          assert.equal((await read()).paused, true);
          assert.deepEqual((await read()).state, state);
          await click(page.getByRole("button", { name: "繼續防線 →" }));
          assert.deepEqual((await read()).state, state);
          savedMid = true;
        }
        if (n > 5 && (await tick()) === previous)
          throw new Error(
            "Browser fixed step stopped: " +
              JSON.stringify(
                await page.evaluate(() => ({
                  visibility: document.visibilityState,
                  paused: document
                    .querySelector(".tactical-root")
                    .getAttribute("data-paused"),
                  saved: JSON.parse(
                    localStorage.getItem("immuminati:tactics:v2"),
                  ).paused,
                  now: performance.now(),
                })),
              ),
          );
        previous = await tick();
      }
      await expect(page.getByTestId("tactical-result")).toBeVisible();
      const final = await read();
      assert.equal(
        final.state.result.type,
        id === "m6" ? "limited" : "victory",
      );
      if (id === "m3") {
        assert.ok(final.state.internal.reduce((n, p) => n + p.load, 0) > 0);
        assert.ok(final.state.campaign.stable >= 100);
      }
      if (id === "m6") {
        assert.equal(final.state.result.stars, 0);
        assert.ok(Object.values(final.state.health).every((n) => n === 0));
        await expect(page.getByTestId("hiv-explanation")).toContainText("ART");
      }
      await page.screenshot({ path: dir + `${device}-${id}-result.png` });
      await writeFile(
        dir + `${device}-${id}-final.json`,
        JSON.stringify(final, null, 2),
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(bad, []);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      checks.push({
        device,
        case: id,
        passed: true,
        result: final.state.result,
        fit,
        events: [...new Set(final.state.events.map((e) => e.type))],
        errors,
        bad,
      });
      const video = page.video();
      await ctx.close();
      await video.saveAs(dir + `${device}-${id}-play.webm`);
      await log("PASS", device, id, final.state.result);
      await writeFile(
        dir + `results-${device}-${id}.json`,
        JSON.stringify(
          {
            target,
            browser: browser.version(),
            checks: checks.filter((c) => c.case === id && c.device === device),
          },
          null,
          2,
        ),
      );
    }
  }
  await writeFile(
    dir + "results.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        target,
        browser: browser.version(),
        checks,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    dir + "failure.json",
    JSON.stringify(
      { message: error.message, stack: error.stack, checks },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
  server?.kill();
  await rm(dir + "raw", { recursive: true, force: true });
}
