import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
const evidence = new URL("../docs/evidence/", import.meta.url).pathname;
await mkdir(evidence, { recursive: true });
const url = process.env.BASE_URL ?? "http://127.0.0.1:4175/Immuminati/";
const server = process.env.BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4175",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
const results = [];
let browser;
const record = (name, detail) => {
  results.push({ name, status: "passed", detail });
  console.log("PASS", name, detail ?? "");
};
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    if (i === 79) throw new Error("Preview did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const state = async (page) =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("immuminati:save:v1")).session.state,
    );
  const saved = async (page) =>
    page.evaluate(() => localStorage.getItem("immuminati:save:v1"));
  const wait = async (page) => {
    await expect(page.locator(".battlefield")).not.toHaveClass(/is-playing/, {
      timeout: 45000,
    });
  };
  const click = async (page, loc, { skip = false } = {}) => {
    await loc.click();
    if (skip) {
      const skipButton = page
        .locator(".field-toolbar")
        .getByRole("button", { name: "跳過動畫 »" });
      await skipButton.click();
    }
    await wait(page);
  };
  const start = async (page) => {
    await page.goto(url);
    await page
      .getByRole("button", { name: /進入莢膜防線|開始新的 M1/ })
      .first()
      .click();
    await wait(page);
  };
  const selectPath = async (page, id) =>
    page.locator(`[data-pathogen="${id}"]`).click();
  const selectUnit = async (page, id) =>
    page.locator(`[data-unit="${id}"]`).click();
  const opso = async (page, id, skip = false) => {
    await selectPath(page, id);
    await click(page, page.getByRole("button", { name: "Y 施加調理" }), {
      skip,
    });
  };
  const end = async (page, skip = false) =>
    click(page, page.getByRole("button", { name: "結束回合", exact: false }), {
      skip,
    });
  const viewportChecks = async (page, label) => {
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "horizontal overflow",
    );
    const targets = await page
      .locator(".unit-anchor,.pathogen-anchor,.end-turn,.primary")
      .evaluateAll((els) =>
        els
          .filter((e) => e.getBoundingClientRect().width)
          .map((e) => ({
            label: e.getAttribute("aria-label") || e.textContent,
            w: e.getBoundingClientRect().width,
            h: e.getBoundingClientRect().height,
          })),
      );
    assert(
      targets.every((v) => v.w >= 44 && v.h >= 44),
      JSON.stringify(targets),
    );
    record(`${label}: layout and main hit targets`, targets.length);
  };
  for (const mobile of [false, true]) {
    const label = mobile ? "mobile" : "desktop";
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 360, height: 800 }
        : { width: 1440, height: 1100 },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
      recordVideo: {
        dir: evidence + "raw-browser",
        size: mobile
          ? { width: 360, height: 800 }
          : { width: 1440, height: 1100 },
      },
    });
    const page = await context.newPage();
    const errors = [],
      failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push([r.status(), r.url()]);
    });
    await page.goto(url);
    await page.screenshot({
      path: evidence + `${label}-home.png`,
      fullPage: true,
    });
    assert.equal(await page.locator(".scenario-card").count(), 6);
    await page.locator(".scenario-card").last().click();
    await expect(page.getByRole("dialog")).not.toContainText(
      /必敗|無法通關|特殊模式/,
    );
    await page.getByRole("button", { name: "關閉視窗" }).click();
    await start(page);
    const unchanged = await saved(page);
    const transform1 = await page
      .locator('[data-unit="u1"] .unit-idle')
      .evaluate((el) => getComputedStyle(el).transform);
    const membrane1 = await page
      .locator('[data-unit="u1"] .membrane')
      .evaluate((el) => getComputedStyle(el).transform);
    await page.waitForTimeout(1300);
    const transform2 = await page
      .locator('[data-unit="u1"] .unit-idle')
      .evaluate((el) => getComputedStyle(el).transform);
    const membrane2 = await page
      .locator('[data-unit="u1"] .membrane')
      .evaluate((el) => getComputedStyle(el).transform);
    assert.notEqual(transform1, transform2);
    assert.notEqual(membrane1, membrane2);
    assert.equal(await saved(page), unchanged);
    const phases = await page
      .locator(".unit-anchor .unit-idle")
      .evaluateAll((els) =>
        els.map((el) => getComputedStyle(el).animationDelay),
      );
    assert.equal(new Set(phases).size, 3);
    record(
      `${label}: independent idle, local deformation, no rule mutation`,
      phases,
    );
    await selectUnit(page, "u1");
    if (mobile) await page.locator('[data-unit="u1"]').tap();
    await page.waitForTimeout(150);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);
    await page.screenshot({
      path: evidence + `${label}-field.png`,
      fullPage: true,
    });
    await viewportChecks(page, label);
    if (mobile) await page.getByLabel("動畫速度").selectOption("2");
    // Field recording: idle -> recruit -> mark -> resolution -> active engulf -> move -> victory.
    await page.getByRole("button", { name: "選取微血管側" }).click();
    await click(
      page,
      page.locator(".recruit-button").filter({ hasText: "嗜中性球" }),
    );
    await opso(page, "p2");
    await opso(page, "p1");
    assert.equal((await state(page)).ap, 0);
    await page.locator('[data-testid="battlefield"]').scrollIntoViewIfNeeded();
    await end(page);
    record(
      `${label}: AP, recruitment and first complete resolution`,
      (await state(page)).turn,
    );
    await opso(page, "p3");
    await selectUnit(page, "u1");
    await page.getByRole("button", { name: "◕ 主動吞噬" }).click();
    await page.locator('[data-testid="battlefield"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(mobile ? 350 : 700);
    await page.screenshot({
      path: evidence + `${label}-engulf.png`,
      fullPage: true,
    });
    await wait(page);
    await page.getByRole("button", { name: "✥ 調度至相鄰區域" }).click();
    await page
      .locator(".target-buttons")
      .getByRole("button", { name: "肺泡深部" })
      .click();
    await page.locator('[data-testid="battlefield"]').scrollIntoViewIfNeeded();
    await wait(page);
    assert.equal(
      (await state(page)).units.find((u) => u.id === "u1").region,
      "b",
    );
    await end(page);
    await end(page);
    await expect(page.getByTestId("result")).toBeVisible();
    assert.equal((await state(page)).outcome.type, "victory");
    await page.getByTestId("result").scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: evidence + `${label}-result.png`,
      fullPage: true,
    });
    record(`${label}: full M1 victory via UI`, (await state(page)).outcome);
    // Encyclopedia, focus and local reload at the same /Immuminati/ path.
    await page.getByRole("button", { name: /百科/ }).first().click();
    await page.getByRole("searchbox", { name: "搜尋百科" }).fill("Th1");
    await page
      .locator(".entry-list")
      .getByRole("button", { name: "Th1", exact: true })
      .click();
    await expect(page.locator(".entry-detail h3")).toHaveText("Th1");
    await page.keyboard.press("Escape");
    const final = await state(page);
    await page.reload();
    await page.getByRole("button", { name: "查看上次結算" }).click();
    assert.deepEqual(await state(page), final);
    record(`${label}: encyclopedia search, Escape and reload persistence`);
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    record(`${label}: subpath assets and console`, {
      pageErrors: errors.length,
      httpErrors: failed.length,
    });
    const video = page.video();
    await context.close();
    await video.saveAs(evidence + `${label}-m1.webm`);
  }
  // Compare browser playback modes against identical UI command sequences.
  const modeResults = [];
  for (const mode of ["normal", "accelerated", "skip", "reduced", "hidden"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 960 },
      reducedMotion: mode === "reduced" ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    await start(page);
    if (mode === "accelerated")
      await page.getByLabel("動畫速度").selectOption("4");
    await opso(page, "p1", mode === "skip");
    await selectUnit(page, "u1");
    await page.getByRole("button", { name: "◕ 主動吞噬" }).click();
    // Fast duplicate input at the DOM boundary cannot create a second submission.
    await page.getByRole("button", { name: "◕ 主動吞噬" }).evaluate((el) => {
      el.click();
      el.click();
    });
    if (mode === "hidden")
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: true,
        });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "hidden", {
          configurable: true,
          value: false,
        });
      });
    else if (mode === "skip")
      await page
        .locator(".field-toolbar")
        .getByRole("button", { name: "跳過動畫 »" })
        .click();
    await wait(page);
    await end(page, mode === "skip");
    const data = JSON.parse(await saved(page));
    modeResults.push({
      mode,
      state: data.session.state,
      events: data.session.events,
    });
    await context.close();
  }
  for (const result of modeResults)
    assert.deepEqual(
      { state: result.state, events: result.events },
      { state: modeResults[0].state, events: modeResults[0].events },
    );
  record(
    "normal / accelerated / skip / reduced / synthetic hidden playback match exactly",
    modeResults.map((r) => r.mode),
  );
  // Save portability and corruption rejection, stable undo after reload, interrupted animations.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
  });
  const page = await context.newPage();
  await start(page);
  await opso(page, "p1", true);
  const expected = await state(page);
  await page.reload();
  await page.getByRole("button", { name: "繼續回合 1" }).click();
  await page.getByRole("button", { name: "↶ 撤銷指令" }).click();
  assert.equal((await state(page)).ap, 4);
  assert.equal((await state(page)).opsonins, 6);
  record("undo survives reload and restores AP / supply / history");
  await opso(page, "p1", true);
  await page.getByRole("button", { name: "設定與存檔" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "↓ 匯出存檔" }).click();
  const downloaded = await downloadEvent;
  await downloaded.saveAs(evidence + "save-roundtrip.json");
  const raw = await saved(page);
  await page.getByLabel("匯入存檔檔案").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  assert.equal(await saved(page), raw);
  await page
    .getByLabel("匯入存檔檔案")
    .setInputFiles(evidence + "save-roundtrip.json");
  await page.getByRole("button", { name: "繼續回合 1" }).click();
  assert.deepEqual(await state(page), expected);
  record("export / import roundtrip; malformed import preserves current save");
  await page.getByRole("button", { name: "選取微血管側" }).click();
  await page.locator(".recruit-button").filter({ hasText: "嗜中性球" }).click();
  const committed = await state(page);
  await page.reload();
  await page.getByRole("button", { name: "繼續回合 1" }).click();
  assert.deepEqual(await state(page), committed);
  await wait(page);
  record("reload mid-animation resumes committed state without another charge");
  await page.getByRole("button", { name: "紀錄 ↗", exact: true }).click();
  await expect(page.locator(".log-entry")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    localStorage.setItem = () => {
      throw new Error("quota");
    };
  }); // Shadow instance methods are not reliable on Storage; separately tested below.
  await context.close();
  const storageContext = await browser.newContext();
  await storageContext.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error("quota");
    };
  });
  const storagePage = await storageContext.newPage();
  await start(storagePage);
  await expect(storagePage.locator(".panel-footer")).toContainText(
    "本機儲存失敗",
  );
  await opso(storagePage, "p1", true);
  await expect(storagePage.locator(".command-bar")).toContainText("3");
  record(
    "storage failure keeps gameplay available and displays export guidance",
  );
  await storageContext.close();
  // Intracellular presentation contract sample: test-only content injected through Vite dev module is unnecessary;
  // production M1 cannot generate that biology. Inspect the dedicated clip in a source-driven harness instead.
  record(
    "scope",
    "M2–M6 are explicitly unavailable. Intracellular rule branch is covered by unit tests, not claimed as a playable M2.",
  );
  await rm(evidence + "raw-browser", { recursive: true, force: true });
  await rm(evidence + "browser-failure.txt", { force: true });
  await writeFile(
    evidence + "browser-results.json",
    JSON.stringify(
      {
        environment: {
          browser: browser.version(),
          platform: process.platform,
          node: process.version,
          desktop: [1440, 1100],
          mobile: [360, 800],
          mobileType:
            "Chromium touch/viewport emulation; not physical hardware",
          base: url,
        },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Completed ${results.length} browser checks`);
} catch (e) {
  await writeFile(evidence + "browser-failure.txt", String(e.stack));
  throw e;
} finally {
  await browser?.close();
  server?.kill();
}
