import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL("../docs/evidence/tactics/", import.meta.url).pathname;
await mkdir(dir, { recursive: true });
let browser;
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
try {
  const url = "http://127.0.0.1:4176/Immuminati/#animation-lab";
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1040, height: 900 },
    recordVideo: {
      dir: dir + "raw-animation",
      size: { width: 1040, height: 900 },
    },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "播放清除分支" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: dir + "engulf-wrap.png" });
  await expect(page.getByTestId("lab-result")).toHaveText(
    "已清除；沒有活的胞內來源。",
    { timeout: 15000 },
  );
  const cleared = await page.screenshot({
    clip: await page.locator("canvas").boundingBox(),
  });
  await page.getByRole("button", { name: "播放胞內存活分支" }).click();
  await expect(page.getByTestId("lab-result")).toContainText(
    "胞內存活 3 負荷",
    { timeout: 15000 },
  );
  await page.screenshot({ path: dir + "engulf-survival.png" });
  const survived = await page.screenshot({
    clip: await page.locator("canvas").boundingBox(),
  });
  assert.notDeepEqual(cleared, survived);
  assert.deepEqual(errors, []);
  await page.waitForTimeout(500);
  const video = page.video();
  await ctx.close();
  await video.saveAs(dir + "engulf-branches.webm");
  await rm(dir + "raw-animation", { recursive: true, force: true });
  await writeFile(
    dir + "animation-results.json",
    JSON.stringify(
      {
        passed: true,
        browser: browser.version(),
        fixture:
          "Abstract dev-only sample, not M1 intracellular behavior or a complete M2",
        checks: [
          "3D contact, pseudopod wrapping and ingestion recording",
          "clearance has no intracellular load",
          "survival retains phagosomal load 3 and a distinct visible vacuole",
          "no runtime errors",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS 3D engulfment, clearance and intracellular survival fixture",
  );
} finally {
  await browser?.close();
  server.kill();
}
