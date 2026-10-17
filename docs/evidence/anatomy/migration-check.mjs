// Recheck an actual archived 2.2 save against the current production build.
// Run after npm run build; PLAYWRIGHT_BROWSERS_PATH may be required in cloud.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const root = new URL("../../../", import.meta.url).pathname;
const evidence = new URL("./", import.meta.url).pathname;
const original = await readFile(
  root + "docs/evidence/immune-regression/save-v2.json",
  "utf8",
);
const old = JSON.parse(original);
assert.equal(old.rules, "2.2");
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4184",
    "--strictPort",
  ],
  { cwd: root, stdio: "pipe" },
);
let browser;
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4184/Immuminati/")).ok) break;
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
    viewport: { width: 1440, height: 1000 },
  });
  await ctx.addInitScript((text) => {
    if (!localStorage.getItem("immuminati:tactics:v2"))
      localStorage.setItem("immuminati:tactics:v2", text);
  }, original);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4184/Immuminati/");
  await page.getByRole("button", { name: "繼續防線 →", exact: true }).click();
  const current = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
  );
  assert.equal(current.rules, "2.3");
  assert.equal(current.state.hosts.length, 32);
  for (const key of [
    "tick",
    "cells",
    "colonies",
    "internal",
    "arrivals",
    "energy",
    "support",
    "wave",
    "nextWaveAt",
    "health",
    "immunity",
    "events",
    "seed",
    "rng",
  ])
    assert.deepEqual(current.state[key], old.state[key], key);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("immuminati:tactics:pre-2.3"),
    ),
    original,
  );
  await page.getByTestId("anatomy-panel").click();
  assert.equal(await page.locator("[data-tissue-id]").count(), 32);
  await page.locator("[data-tissue-id]").first().click();
  await page.screenshot({ path: evidence + "desktop-migrated-2.2.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    evidence + "migration-results.json",
    JSON.stringify(
      {
        source: "942529389658ef0f89b6964e65fe3d525c7aecf4",
        fixture: "docs/evidence/immune-regression/save-v2.json",
        fixtureSha256: createHash("sha256").update(original).digest("hex"),
        originalRules: old.rules,
        originalTick: old.state.tick,
        newRules: current.rules,
        tissueCells: current.state.hosts.length,
        preserved: [
          "time",
          "cells",
          "orders/paths",
          "colonies",
          "internal sources",
          "arrivals",
          "energy",
          "support",
          "waves",
          "health",
          "immunity",
          "events",
          "RNG",
        ],
        exactOriginalBackup: true,
        browser: browser.version(),
        passed: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS actual archived 2.2 browser migration and exact original backup",
  );
} finally {
  await browser?.close();
  server.kill();
}
