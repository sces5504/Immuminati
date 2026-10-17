import { spawn } from "node:child_process";
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/immune-expansion/",
  import.meta.url,
).pathname;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
let server;
const target = process.env.TARGET_URL ?? "http://127.0.0.1:4179/Immuminati/";
if (!process.env.TARGET_URL) {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4179",
      "--strictPort",
    ],
    { stdio: "pipe" },
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(target)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    server.kill();
    await browser.close();
    throw new Error("Production preview did not start on 4179");
  }
}
const checks = [];
const saved = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
  );
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    const ctx = await browser.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      recordVideo: { dir: dir + "raw-immune", size: viewport },
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    const failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push([r.status(), r.url()]);
    });
    await page.goto(target);
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: dir + device + "-anatomy.png" });
    const initial = structuredClone(await saved(page));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const controlSizes = await page
      .locator(".t-strategy-tools button")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { text: n.textContent, width: r.width, height: r.height };
        }),
      );
    for (const control of controlSizes)
      assert.ok(
        control.width >= 44 && control.height >= 44,
        `${device} ${JSON.stringify(control)}`,
      );
    console.log("CHECK", device, "tutorial");
    await page.getByTestId("tutorial-start").click();
    const next = async (index) => {
      console.log("STEP", device, index);
      await expect(page.locator(".t-tutorial")).toHaveAttribute(
        "data-tutorial-step",
        String(index),
      );
      await page.locator(".t-tutorial footer button").last().click();
    };
    await next(0);
    await page.locator('[data-cell-id="u1"]').click();
    await next(1);
    await page
      .getByRole("button", { name: "防區深部肺泡", exact: true })
      .click();
    await next(2);
    await page.getByTestId("autoseek").click();
    await next(3);
    await page.getByTestId("mark-tool").click();
    await page.locator("[data-colony]").first().click();
    await next(4);
    await page.getByTestId("recruit-tool").click();
    await page.locator('[data-recruit="neutrophil"]').click();
    await next(5);
    await page.getByTestId("pause-toggle").click();
    await expect(page.locator(".t-tutorial footer button").last()).toBeEnabled({
      timeout: 30000,
    });
    await page.screenshot({ path: dir + device + "-tutorial.png" });
    await next(6);
    await page.getByTestId("speed-toggle").click();
    await next(7);
    await page.getByTestId("immune-panel").click();
    await expect(
      page.getByRole("dialog", { name: "免疫反應與機制" }),
    ).toBeVisible();
    await page.screenshot({ path: dir + device + "-mechanisms.png" });
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await next(8);
    await next(9);
    await expect(page.locator(".t-tutorial")).toHaveCount(0);
    await expect(page.locator(".tactical-root")).toHaveAttribute(
      "data-paused",
      "true",
    );
    checks.push({
      device,
      check:
        "10-step tutorial driven by actual selection, movement, auto seek, opsonization, recruitment, phagocytosis, speed and mechanism panel",
      passed: true,
    });
    console.log("CHECK", device, "adaptive strategy");
    await page.locator(".t-brand").click();
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    if ((await saved(page)).settings.speed !== 2)
      await page.getByTestId("speed-toggle").click();
    await page.getByTestId("autoseek").click();
    await page.getByTestId("recruit-tool").click();
    for (const kind of ["helperT", "bcell"]) {
      await page.locator(`[data-recruit="${kind}"]`).scrollIntoViewIfNeeded();
      await page.locator(`[data-recruit="${kind}"]`).click();
    }
    await page
      .getByRole("button", { name: "關閉增援面板", exact: true })
      .click();
    await page.getByTestId("pause-toggle").click();
    await expect(page.getByTestId("tactical-result")).toBeVisible({
      timeout: 180000,
    });
    const final = await saved(page);
    assert.equal(final.state.result.type, "victory");
    assert.ok(final.state.cells.some((u) => u.kind === "plasma"));
    assert.ok(final.state.events.some((e) => e.type === "antibody"));
    await page.screenshot({ path: dir + device + "-adaptive-result.png" });
    checks.push({
      device,
      check:
        "real UI adaptive-support strategy completes M1; DC -> CD4 T -> B -> plasma -> antibodies",
      result: final.state.result,
      passed: true,
    });
    const beforePractice = structuredClone(final.state);
    await page.getByTestId("immune-panel").click();
    await page
      .getByRole("button", { name: "進入 NK／CD8 機制演練", exact: true })
      .click();
    const rawMain = await page.evaluate(() =>
      localStorage.getItem("immuminati:tactics:v2"),
    );
    await page.screenshot({ path: dir + device + "-practice-start.png" });
    await page.getByTestId("pause-toggle").click();
    await expect(
      page.locator("[data-host]").filter({ hasText: "凋亡" }),
    ).toHaveCount(2, { timeout: 30000 });
    await page.screenshot({ path: dir + device + "-cytotoxic-result.png" });
    assert.equal(
      await page.evaluate(() => localStorage.getItem("immuminati:tactics:v2")),
      rawMain,
    );
    await expect(
      page.locator("[data-host]").filter({ hasText: "健康宿主" }),
    ).toHaveCount(1);
    await expect(
      page.locator("[data-host]").filter({ hasText: "不相符抗原" }),
    ).toHaveCount(1);
    await page
      .getByRole("button", { name: "結束演練，返回 M1", exact: true })
      .click();
    assert.deepEqual((await saved(page)).state, beforePractice);
    checks.push({
      device,
      check:
        "NK/CD8 kill only eligible hosts; healthy and mismatched hosts survive; M1 save unchanged through practice",
      passed: true,
    });
    await page.reload();
    await page.getByRole("button", { name: "繼續防線 →", exact: true }).click();
    assert.deepEqual((await saved(page)).state, beforePractice);
    await page.locator(".t-brand").click(); // Stop active pagehide autosave before injecting an old-format fixture.
    const legacy = {
      ...initial,
      rules: "2.1",
      content: "m1-tactics.2",
      undo: [],
    };
    delete legacy.state.immunity;
    delete legacy.state.hosts;
    const legacyText = JSON.stringify(legacy);
    await page.evaluate((text) => {
      localStorage.setItem("immuminati:tactics:v2", text);
      localStorage.removeItem("immuminati:tactics:pre-2.3");
    }, legacyText);
    await page.reload();
    await page.getByRole("button", { name: "繼續防線 →", exact: true }).click();
    assert.equal((await saved(page)).rules, "2.3");
    assert.equal((await saved(page)).state.immunity.autoSeek, false);
    assert.equal(
      await page.evaluate(() =>
        localStorage.getItem("immuminati:tactics:pre-2.3"),
      ),
      legacyText,
    );
    checks.push({
      device,
      check:
        "real pre-2.3 save migration preserves original text backup and starts new immunity explicitly inactive",
      passed: true,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failed, []);
    checks.push({
      device,
      check: "reload, portrait layout, assets and runtime errors",
      passed: true,
    });
    const video = page.video();
    await ctx.close();
    await video.saveAs(dir + device + "-immune-playthrough.webm");
  }
  await writeFile(
    dir + "immune-results.json",
    JSON.stringify(
      {
        browser: browser.version(),
        checks,
        limitations:
          "Headless Chromium / SwiftShader; portrait touch emulation, not physical phone or GPU performance certification.",
      },
      null,
      2,
    ),
  );
  await rm(dir + "raw-immune", { recursive: true, force: true });
  console.log("PASS immune expansion", checks.length);
} finally {
  await browser.close();
  server?.kill();
}
