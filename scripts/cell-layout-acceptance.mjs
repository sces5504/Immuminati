import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const dir = new URL("../docs/evidence/cell-layout/", import.meta.url).pathname;
await mkdir(dir, { recursive: true });
const url = process.env.TARGET_URL ?? "http://127.0.0.1:4187/Immuminati/";
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
        "4187",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
let browser;
const checks = [];
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
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    const context = await browser.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const read = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    const record = (check) => {
      checks.push({ device, check });
      console.log("PASS", device, check);
    };
    await page.goto(url);
    const names = [
      "肺炎鏈球菌",
      "鼠傷寒沙門氏菌",
      "結核分枝桿菌",
      "A 型流感病毒",
      "白色念珠菌",
      "HIV",
    ];
    for (let i = 0; i < names.length; i++) {
      if (process.env.SPACING_ONLY) break;
      await page.locator(".t-case-cards button").nth(i).click();
      await page.locator("[data-kit]").first().click();
      await page.getByTestId("deployment-confirm").click();
      await page.locator("[data-colony]").first().click();
      await expect(page.locator(".t-selection-info h2")).toHaveText(names[i]);
      await expect(page.locator(".t-selection-info > small")).toContainText(
        "感染負荷",
      );
      const heading = await page
        .locator(".t-selection-info h2")
        .evaluate((e) => ({ width: e.clientWidth, textWidth: e.scrollWidth }));
      assert.ok(
        heading.textWidth <= heading.width + 1,
        `${names[i]} heading overflows`,
      );
      record(`M${i + 1} selection identifies ${names[i]} and retains burden`);
      if (i === 0)
        await page.screenshot({ path: `${dir}/${device}-pathogen-name.png` });
      await page.getByRole("button", { name: "回主頁", exact: true }).click();
    }
    // Actual UI orders send two immune cells to the same authority position.
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await page.locator(".t-deploy-custom summary").click();
    await page.getByRole("combobox", { name: "部署防區" }).selectOption("c");
    for (let i = 0; i < 2; i++)
      await page.locator('[data-deploy="macrophage"]').click();
    await page.getByTestId("deployment-confirm").click();
    await page.getByTestId("autoseek").click();
    const ids = (await read()).state.cells.map((c) => c.id);
    for (const id of ids) {
      await page.locator(`.t-roster [data-cell-id="${id}"]`).click();
      await page
        .getByRole("button", { name: "防區肺泡壁前緣", exact: true })
        .click();
    }
    await page.getByTestId("pause-toggle").click();
    await expect
      .poll(
        async () => {
          const state = (await read()).state;
          return (
            state.tick > 15 && state.cells.every((c) => c.path.length === 0)
          );
        },
        { timeout: 20000 },
      )
      .toBe(true);
    await page.getByTestId("pause-toggle").click();
    await page.waitForTimeout(1200);
    const before = (await read()).state;
    assert.deepEqual(before.cells[0].position, before.cells[1].position);
    const points = await Promise.all(
      ids.map((id) => page.locator(`[data-world-label="${id}"]`).boundingBox()),
    );
    assert.ok(
      Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) > 24,
      "coincident immune cells remain visually separable",
    );
    for (const id of ids) {
      await page.locator(`[data-world-label="${id}"]`).click();
      await expect(page.locator(".tactical-root")).toHaveAttribute(
        "data-selected",
        id,
      );
    }
    await page.getByTestId("speed-toggle").click();
    assert.deepEqual(
      (await read()).state,
      before,
      "layout and selection never mutate paused authority",
    );
    await page.screenshot({ path: `${dir}/${device}-separated-cells.png` });
    record(
      "coincident cells spread, remain selectable, and preserve authority at 1x/2x",
    );
    assert.deepEqual(errors, []);
    await context.close();
  }
  await writeFile(
    `${dir}/${process.env.SPACING_ONLY ? "spacing-final" : "results"}.json`,
    JSON.stringify(
      { checks, scope: "pathogen selection and visual cell spacing only" },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
