import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4176",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const evidence = new URL("../docs/evidence/", import.meta.url).pathname;
try {
  const url = "http://127.0.0.1:4176/Immuminati/#animation-lab";
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1000, height: 1000 },
    recordVideo: {
      dir: evidence + "raw-animation",
      size: { width: 1000, height: 1000 },
    },
  });
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "播放清除分支" }).click();
  await page.waitForTimeout(500);
  const d1 = await page
    .locator(".pseudopod-left")
    .evaluate((el) => getComputedStyle(el).d);
  await page.waitForTimeout(300);
  const d2 = await page
    .locator(".pseudopod-left")
    .evaluate((el) => getComputedStyle(el).d);
  assert.notEqual(d1, d2);
  await page.screenshot({ path: evidence + "animation-wrap.png" });
  await expect(page.getByTestId("lab-result")).toHaveText(
    "已清除；沒有活的胞內來源。",
  );
  await expect(page.locator(".intracellular-badge")).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "播放胞內存活分支" }).click();
  await expect(page.getByTestId("lab-result")).toContainText(
    "胞內存活 3 負荷",
    { timeout: 6000 },
  );
  await expect(page.locator(".intracellular-badge")).toHaveText("胞內存活");
  await page.screenshot({ path: evidence + "animation-survival.png" });
  await page.waitForTimeout(1500);
  const video = page.video();
  await context.close();
  await video.saveAs(evidence + "engulf-branches.webm");
  await writeFile(
    evidence + "animation-results.json",
    JSON.stringify(
      {
        passed: true,
        browser: browser.version(),
        fixture:
          "Development-only abstract population; not a playable M2 or an assertion of M1 intracellular biology",
        checks: [
          "CSS d-path changes during pseudopod wrapping",
          "clearance leaves no intracellular survival badge",
          "survival keeps load 3 in a phagosome and visible host badge",
        ],
        viewport: [1000, 1000],
      },
      null,
      2,
    ),
  );
  await rm(evidence + "raw-animation", { recursive: true, force: true });
  console.log(
    "PASS wrapping, clearance and intracellular survival visual branches",
  );
} finally {
  await browser?.close();
  server.kill();
}
