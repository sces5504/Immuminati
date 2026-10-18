import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { configureM1 } from "./deployment-helpers.mjs";

const dir = new URL("../docs/evidence/tripo-samples/", import.meta.url)
  .pathname;
await mkdir(dir, { recursive: true });
const url = "http://127.0.0.1:24861/Immuminati/";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "24861",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const results = [];
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    if (process.env.DEVICE && device !== process.env.DEVICE) continue;
    const start = Date.now();
    const context = await browser.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      recordVideo: {
        dir: dir + "raw",
        size: device === "mobile" ? viewport : { width: 1024, height: 712 },
      },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(35000);
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/assets/tripo/"))
        requests.push(request.url());
    });
    const read = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    const scene = page.getByTestId("tactical-scene");
    const stats = () =>
      scene.evaluate((e) => ({
        assets: e.dataset.artAssets,
        cells: e.dataset.artCells,
        triangles: +e.dataset.artTriangles,
        drawCalls: +e.dataset.artDrawCalls,
      }));
    await page.goto(url);
    await expect(page.getByTestId("art-toggle")).toBeVisible();
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await configureM1(page);
    await expect(scene).toHaveAttribute("data-art-assets", "3", {
      timeout: 60000,
    });
    await expect(scene).toHaveAttribute("data-art-cells", "2");
    await page.waitForTimeout(900);
    const authority = (await read()).state;
    const sample = await stats();
    await page.screenshot({ path: `${dir}/${device}-sample.png` });
    await page.getByRole("button", { name: "設定與存檔", exact: true }).click();
    await page.getByTestId("art-toggle").click();
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await expect(scene).toHaveAttribute("data-art-mode", "original");
    await page.waitForTimeout(700);
    const original = await stats();
    assert.equal(original.cells, "0");
    assert.deepEqual((await read()).state, authority);
    await page.screenshot({ path: `${dir}/${device}-original.png` });
    await page.getByRole("button", { name: "設定與存檔", exact: true }).click();
    await page.getByTestId("art-toggle").click();
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await expect(scene).toHaveAttribute("data-art-cells", "2");
    assert.equal(
      requests.length,
      3,
      "three downloads shared by all instances and toggles",
    );
    assert.ok(
      sample.triangles < original.triangles * 1.6,
      "sample geometry remains within 60% of scene baseline",
    );
    assert.ok(
      sample.drawCalls <= original.drawCalls + 3,
      "batched tissue adds bounded draw calls",
    );
    // Selection and movement use existing visible UI; no direct state mutation.
    const actor = authority.cells.find((c) => c.kind === "macrophage");
    await page.locator(`[data-cell-id="${actor.id}"]`).click();
    await expect(page.locator(".tactical-root")).toHaveAttribute(
      "data-selected",
      actor.id,
    );
    await page
      .getByRole("button", { name: "防區肺泡入口", exact: true })
      .click();
    await page.getByTestId("mark-tool").click();
    await page.locator("[data-colony]").first().click();
    const actionStart = (Date.now() - start) / 1000;
    await page.getByTestId("pause-toggle").click();
    await expect
      .poll(
        async () =>
          (await read()).state.events.some((e) => e.type === "engulf"),
        { timeout: 30000 },
      )
      .toBe(true);
    await page.waitForTimeout(1600);
    await page.getByTestId("pause-toggle").click();
    const paused = (await read()).state;
    await page.getByTestId("speed-toggle").click();
    assert.deepEqual((await read()).state, paused);
    await page.getByRole("button", { name: "設定與存檔", exact: true }).click();
    await page
      .getByRole("checkbox", { name: "降低動態效果", exact: true })
      .check();
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    assert.deepEqual((await read()).state, paused);
    await page.screenshot({ path: `${dir}/${device}-after-engulf.png` });
    assert.deepEqual(errors, []);
    const video = page.video();
    await context.close();
    await video.saveAs(`${dir}/${device}-raw.webm`);
    results.push({
      device,
      sample,
      original,
      requests: requests.length,
      actionStart,
      checks: [
        "real GLB render with independent cells and terrain-fitted batched tissue",
        "toggle retains exact paused authority",
        "selection, move, C3b, engulf, pause, 2x and reduced motion",
        "no runtime errors",
      ],
    });
    console.log("PASS", device, JSON.stringify({ sample, original }));
  }
  // Offline/broken asset regression: gameplay stays usable with original models.
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/assets/tripo/*.glb", (route) => route.abort("failed"));
  await page.goto(url);
  await page.getByRole("button", { name: "開始 M1", exact: true }).click();
  await configureM1(page);
  await expect(page.getByTestId("tactical-scene")).toHaveAttribute(
    "data-art-assets",
    "0",
  );
  await expect(page.getByTestId("tactical-scene")).toHaveAttribute(
    "data-art-cells",
    "0",
  );
  const id = await page
    .locator(".t-roster [data-cell-id]")
    .first()
    .getAttribute("data-cell-id");
  await page.locator(`[data-cell-id="${id}"]`).click();
  await expect(page.locator(".tactical-root")).toHaveAttribute(
    "data-selected",
    id,
  );
  await page.screenshot({ path: `${dir}/mobile-fallback.png` });
  assert.deepEqual(errors, []);
  results.push({
    device: "mobile",
    checks: [
      "all three assets unavailable: originals render and remain selectable without runtime error",
    ],
  });
  await context.close();
  await writeFile(`${dir}/results.json`, JSON.stringify(results, null, 2));
  console.log("PASS asset failure fallback");
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
