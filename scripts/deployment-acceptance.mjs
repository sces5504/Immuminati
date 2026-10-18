import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { configureM1 } from "./deployment-helpers.mjs";
const dir = process.env.EVIDENCE_DIR ?? "docs/evidence/deployment-v31/";
await mkdir(dir, { recursive: true });
const target = process.env.TARGET_URL ?? "http://127.0.0.1:4191/Immuminati/";
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
        "4191",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
for (let i = 0; i < 80; i++) {
  try {
    if ((await fetch(target)).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const checks = [];
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
    ["narrow", { width: 360, height: 800 }],
  ]) {
    if (process.env.DEVICE && device !== process.env.DEVICE) continue;
    const ctx = await browser.newContext({
      viewport,
      hasTouch: device !== "desktop",
      isMobile: device !== "desktop",
      recordVideo: { dir: dir + "/raw", size: viewport },
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20000);
    const errors = [],
      bad = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) bad.push(r.url());
    });
    await page.goto(target);
    await expect(page.locator(".t-landing-facts")).toContainText(
      "運用免疫知識 · 直觀看見結果",
    );
    await page.screenshot({ path: `${dir}/${device}-home.png` });
    const read = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    for (let i = 0; i < 6; i++) {
      console.log("CHECK", device, "case", i + 1);
      await page.locator(".t-case-cards button").nth(i).click();
      await expect(page.getByTestId("deployment-panel")).toBeVisible();
      const before = await read();
      assert.equal(before.state.cells.length, i === 2 ? 1 : 0);
      await page.getByTestId("deployment-panel").evaluate((e) => {
        e.tabIndex = -1;
        e.focus();
      });
      await page.keyboard.press("Space");
      await page.waitForTimeout(250);
      assert.deepEqual(await read(), before);
      await expect(page.getByTestId("deployment-confirm")).toBeDisabled();
      await page.locator("[data-kit]").first().click();
      assert.ok((await read()).state.cells.length > (i === 2 ? 1 : 0));
      const layout = await page
        .getByTestId("deployment-panel")
        .evaluate((e) => ({
          width: e.getBoundingClientRect().width,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
      assert.equal(layout.overflow, false);
      await page.screenshot({
        path: `${dir}/${device}-m${i + 1}-deployment.png`,
      });
      // A draft can be left and resumed without a random replacement team or time advance.
      const draft = await read();
      await page
        .getByRole("button", { name: "儲存並回主頁", exact: true })
        .click();
      await page.getByRole("button", { name: "繼續防線 →" }).click();
      assert.deepEqual((await read()).state, draft.state);
      await page.getByTestId("deployment-confirm").click();
      await expect(page.getByTestId("deployment-panel")).toHaveCount(0);
      await expect(page.getByTestId("skip-effects")).toHaveCount(0);
      assert.equal((await read()).paused, true);
      await page.getByRole("button", { name: "回主頁", exact: true }).click();
    }
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await configureM1(page);
    await page.locator(".t-roster>button[data-cell-id]").first().click();
    const before = await read(),
      selected = await page
        .locator(".tactical-root")
        .getAttribute("data-selected");
    const scene = page.getByTestId("tactical-scene");
    const zoom = async () =>
      Number(await scene.getAttribute("data-camera-zoom"));
    const startZoom = await zoom();
    const client = await ctx.newCDPSession(page);
    const box = await scene.boundingBox(),
      cx = viewport.width / 2,
      cy = box.y + box.height * 0.53;
    const points = (d, offset = 0) => [
      {
        x: cx - d / 2 + offset,
        y: cy,
        id: 1,
        radiusX: 1,
        radiusY: 1,
        force: 1,
      },
      {
        x: cx + d / 2 + offset,
        y: cy,
        id: 2,
        radiusX: 1,
        radiusY: 1,
        force: 1,
      },
    ];
    const touch = async (type, touchPoints) => {
      await client.send("Input.dispatchTouchEvent", { type, touchPoints });
      await page.waitForTimeout(50);
    };
    await touch("touchStart", points(80));
    await touch("touchMove", points(150));
    const expanded = await zoom();
    assert.ok(expanded > startZoom + 0.15, `${expanded}/${startZoom}`);
    await touch("touchMove", points(240));
    assert.equal(await zoom(), 1.7);
    await page.screenshot({ path: `${dir}/${device}-pinch-out.png` });
    await touch("touchEnd", [points(240)[0]]);
    const oneZoom = await zoom();
    await touch("touchMove", [{ ...points(240)[0], x: cx - 50, y: cy + 60 }]);
    assert.equal(await zoom(), oneZoom);
    await touch("touchEnd", []);
    await touch("touchStart", points(220));
    await touch("touchMove", points(65));
    await touch("touchEnd", []);
    assert.equal(await zoom(), 0.75);
    await page.screenshot({ path: `${dir}/${device}-pinch-in.png` });
    // Begin on an actual clickable world label: capture transfer must not cancel pinch.
    await page.getByRole("button", { name: "重設鏡頭" }).click();
    const lb = await page.locator(".t-cell-label").first().boundingBox();
    const labelPair = (d) => [
      { x: lb.x + lb.width / 2, y: lb.y + lb.height / 2, id: 1 },
      { x: lb.x + lb.width / 2 + d, y: lb.y + lb.height / 2, id: 2 },
    ];
    await touch("touchStart", labelPair(45));
    await touch("touchMove", labelPair(85));
    assert.ok((await zoom()) > 1.2);
    await touch("touchEnd", []);
    assert.equal(
      await page.locator(".tactical-root").getAttribute("data-selected"),
      selected,
    );
    // Cancellation, third finger and a new gesture must not leave captured input stuck.
    await touch("touchStart", points(80));
    await touch("touchMove", [...points(110), { x: cx, y: cy + 60, id: 3 }]);
    await touch("touchCancel", []);
    await touch("touchStart", points(80));
    await touch("touchMove", points(120));
    await touch("touchEnd", []);
    assert.ok((await zoom()) > 0.75);
    assert.deepEqual((await read()).state, before.state);
    assert.equal(
      await page.locator(".tactical-root").getAttribute("data-selected"),
      selected,
    );
    assert.equal(await page.evaluate(() => visualViewport.scale), 1);
    // Normal selection after a cancelled pinch, then same-direction one-finger drag.
    await page.getByRole("button", { name: "重設鏡頭" }).click();
    await page.locator(".t-roster>button[data-cell-id]").nth(1).click();
    const marker = () =>
      page
        .locator(".t-cell-label")
        .first()
        .evaluate((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y };
        });
    const a = await marker();
    await touch("touchStart", [{ x: cx, y: cy, id: 1 }]);
    await touch("touchMove", [{ x: cx + 40, y: cy + 25, id: 1 }]);
    await touch("touchEnd", []);
    const b = await marker();
    assert.ok(b.x > a.x + 15 && b.y > a.y + 8, JSON.stringify({ a, b }));
    assert.deepEqual((await read()).state, before.state);
    // Quick canvas release must not place a move order; tapping a unit still works.
    await page.getByRole("button", { name: "重設鏡頭" }).click();
    await page.locator(".t-roster>button[data-cell-id]").first().click();
    await page.getByRole("button", { name: "回主頁", exact: true }).click();
    assert.deepEqual(errors, []);
    assert.deepEqual(bad, []);
    checks.push({
      device,
      passed: true,
      checks: [
        "six empty openings and knowledge kits",
        "draft persists and resumes",
        "deployment blocks Space/time",
        "custom M1 deployment",
        "skip removed and copy updated",
        "native CDP two-finger spread/pinch clamps",
        "one-finger release never issues command",
        "cancel/third-finger recover",
        "pinch beginning on world-label capture remains responsive",
        "pinch leaves authority/selection/page scale unchanged",
        "single-finger same-direction drag preserved",
      ],
      errors,
      bad,
    });
    const video = page.video();
    await ctx.close();
    await video.saveAs(`${dir}/${device}-deployment-gestures.webm`);
    console.log("PASS", device);
  }
  await writeFile(
    dir + `/browser-results-${process.env.DEVICE ?? "all"}.json`,
    JSON.stringify({ date: new Date().toISOString(), checks }, null, 2),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser.close();
  server?.kill();
}
