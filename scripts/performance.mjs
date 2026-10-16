import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import os from "node:os";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4177",
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
const samples = [];
try {
  const url = "http://127.0.0.1:4177/Immuminati/";
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 360, height: 800 }
        : { width: 1440, height: 1100 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    await page.goto(url);
    await page.getByRole("button", { name: "進入莢膜防線" }).click();
    const measure = async (label) => {
      const data = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const times = [];
            let previous = performance.now();
            const start = previous;
            function tick(t) {
              times.push(t - previous);
              previous = t;
              if (t - start < 2000) requestAnimationFrame(tick);
              else {
                times.shift();
                times.sort((a, b) => a - b);
                resolve({
                  samples: times.length,
                  median: times[Math.floor(times.length * 0.5)],
                  p95: times[Math.floor(times.length * 0.95)],
                  max: times.at(-1),
                  mean: times.reduce((a, b) => a + b, 0) / times.length,
                });
              }
            }
            requestAnimationFrame(tick);
          }),
      );
      samples.push({
        viewport: mobile ? "360x800 touch emulation" : "1440x1100 desktop",
        phase: label,
        units: 3,
        extracellularGroups: 3,
        ...data,
      });
    };
    await measure("idle");
    await page.locator('[data-unit="u1"]').click();
    await page.getByRole("button", { name: "◕ 主動吞噬" }).click();
    await measure("engulf + clearance; one foreground clip");
    await context.close();
  }
  await writeFile(
    "docs/evidence/performance.json",
    JSON.stringify(
      {
        browser: browser.version(),
        os: os.platform(),
        cpu: os.cpus()[0].model,
        logicalCpus: os.availableParallelism(),
        method:
          "2s requestAnimationFrame callback intervals in headless Chromium, no video recording. Callback cadence does not prove physical device GPU rendering performance.",
        samples,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(samples));
} finally {
  await browser?.close();
  server.kill();
}
