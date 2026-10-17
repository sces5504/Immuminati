import { existsSync } from "node:fs";
const { chromium } = await import("@playwright/test");
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const server = spawn(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "preview",
  "--host",
  "127.0.0.1",
  "--port",
  "4177",
  "--strictPort",
]);
let browser;
const results = [];
try {
  const url = "http://127.0.0.1:4177/Immuminati/";
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath: existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const ctx = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      reducedMotion: "reduce",
    }),
    p = await ctx.newPage();
  await p.goto(url);
  await p.getByRole("button", { name: "開始 M1 肺部防禦" }).click();
  await p.getByRole("button", { name: "4×", exact: true }).click();
  await p.getByRole("button", { name: "▶ 恢復模擬" }).click();
  await p.waitForTimeout(1400);
  const other = await ctx.newPage();
  await other.goto("about:blank");
  await other.bringToFront();
  await p.waitForTimeout(250);
  const visibility = await p.evaluate(() => document.visibilityState);
  if (visibility === "hidden") {
    await p.bringToFront();
    await p.getByRole("button", { name: "▶ 恢復模擬" }).waitFor();
    const step = await p.evaluate(
      () => JSON.parse(localStorage.getItem("immuminati:rts:v3")).state.step,
    );
    await p.waitForTimeout(700);
    assert.equal(
      await p.evaluate(
        () => JSON.parse(localStorage.getItem("immuminati:rts:v3")).state.step,
      ),
      step,
    );
    results.push({
      name: "actual browser tab background and return stays paused; no offline catch-up",
      passed: true,
      visibility,
    });
  } else {
    results.push({
      name: "tab visibility",
      status: "unsupported",
      limitation: "headless browser did not expose hidden tab state",
    });
  }
  if (visibility !== "hidden") {
    await p.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
      delete document.hidden;
    });
    await p.getByRole("button", { name: "▶ 恢復模擬" }).waitFor();
    const frozen = await p.evaluate(() =>
      localStorage.getItem("immuminati:rts:v3"),
    );
    await p.waitForTimeout(650);
    assert.equal(
      await p.evaluate(() => localStorage.getItem("immuminati:rts:v3")),
      frozen,
    );
    results.push({
      name: "controlled visibility event safely pauses/saves; no time catch-up",
      passed: true,
      method: "controlled document.hidden, not actual OS background",
    });
  }
  await other.close();
  await p.getByRole("button", { name: "存檔／設定" }).click();
  await p.getByRole("dialog").getByRole("combobox").selectOption("reduced");
  const select = await p.getByRole("dialog").getByRole("combobox").inputValue();
  assert.equal(select, "reduced");
  const last = p.getByRole("dialog").getByRole("link");
  await last.focus();
  await p.keyboard.press("Tab");
  assert.equal(
    await p.evaluate(() => document.activeElement?.textContent),
    "返回戰場",
  );
  await p.keyboard.press("Escape");
  assert.equal(await p.getByRole("dialog").count(), 0);
  results.push({
    name: "reduced motion, keyboard focus wrap and Escape",
    passed: true,
  });
  const undersized = await p.locator("button:visible").evaluateAll((nodes) =>
    nodes
      .filter((n) => {
        const r = n.getBoundingClientRect();
        return r.height < 43.9 || r.width < 43.9;
      })
      .map((n) => n.textContent),
  );
  assert.deepEqual(undersized, []);
  results.push({
    name: "visible primary button targets at least 44px",
    passed: true,
  });
  // Same saved session must survive opening an encyclopedia from the menu.
  await p.getByRole("button", { name: "存檔／設定" }).click();
  await p.getByRole("button", { name: "立即儲存" }).click();
  const saved = await p.evaluate(() =>
    localStorage.getItem("immuminati:rts:v3"),
  );
  await p.reload();
  await p.getByRole("button", { name: "百科", exact: true }).click();
  assert.equal(
    await p.evaluate(() => localStorage.getItem("immuminati:rts:v3")),
    saved,
  );
  results.push({
    name: "menu encyclopedia never overwrites existing continuation",
    passed: true,
  });
  await writeFile(
    "docs/evidence/rts/extra-results.json",
    JSON.stringify({ browser: browser.version(), results }, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser?.close();
  server.kill();
}
