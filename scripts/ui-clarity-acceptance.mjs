import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/ui-clarity/",
  import.meta.url,
).pathname;
await mkdir(dir, { recursive: true });
const url = process.env.TARGET_URL ?? "http://127.0.0.1:4184/Immuminati/";
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
        "4184",
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
    headless: true,
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
    ],
  });
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 360, height: 800 }],
  ]) {
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    const ctx = await browser.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      recordVideo: {
        dir: dir + "raw-ui",
        size: device === "mobile" ? viewport : { width: 960, height: 666 },
      },
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    const bad = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) bad.push(r.status() + " " + r.url());
    });
    const save = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    const record = (check) => {
      checks.push({ device, check, passed: true });
      console.log("PASS", device, check);
    };
    await page.goto(url);
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await page.waitForTimeout(1200);
    assert.equal((await save()).state.immunity.autoSeek, true);
    await expect(page.locator(".t-world-labels")).toHaveClass(/is-minimal/);
    await expect(page.getByTestId("objective-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const labels = await page.locator(".t-field-label").evaluateAll((es) =>
      es.map((e) => ({
        w: e.getBoundingClientRect().width,
        h: e.getBoundingClientRect().height,
        text: getComputedStyle(e.querySelector("span")).display,
      })),
    );
    assert.ok(
      labels.every(
        (b) =>
          Math.abs(b.w - 44) < 0.1 &&
          Math.abs(b.h - 44) < 0.1 &&
          b.text === "none",
      ),
      JSON.stringify(labels),
    );
    const emptyDock = await page.locator(".t-dock-main").boundingBox();
    assert.ok(emptyDock.height <= 85, JSON.stringify(emptyDock));
    const help = await page
      .getByRole("button", { name: "? 操作提示", exact: true })
      .boundingBox();
    assert.ok(help.x > viewport.width / 2);
    const colonyTargets = await page
      .locator("[data-colony]")
      .evaluateAll((es) =>
        es.map((el) => {
          const b = el.getBoundingClientRect();
          const hit = document.elementFromPoint(
            b.x + b.width / 2,
            b.y + b.height / 2,
          );
          return {
            id: el.dataset.colony,
            accessible: !!hit && el.contains(hit),
          };
        }),
      );
    assert.ok(
      colonyTargets.every((p) => p.accessible),
      JSON.stringify(colonyTargets),
    );
    await page.screenshot({ path: dir + device + "-quiet-field.png" });
    record(
      "new game seeks by default; compact objective, right-side help and minimal 44px map targets",
    );
    await page.getByTestId("objective-toggle").click();
    await expect(page.locator(".t-objective-body")).toBeVisible();
    await page.screenshot({ path: dir + device + "-objective-expanded.png" });
    await page.getByTestId("objective-toggle").click();
    const before = await save();
    await page.getByTestId("recruit-tool").click();
    await expect(
      page.getByRole("region", { name: "募集增援", exact: true }),
    ).toBeVisible();
    // First outside tap is consumed: no movement, selection or resource use underneath.
    if (device === "mobile")
      await page.touchscreen.tap(20, viewport.height / 2);
    else await page.mouse.click(20, viewport.height / 2);
    await expect(
      page.getByRole("region", { name: "募集增援", exact: true }),
    ).toHaveCount(0);
    assert.deepEqual((await save()).state, before.state);
    await page.getByTestId("recruit-tool").click();
    await page.getByRole("button", { name: "設定與存檔" }).click();
    await expect(
      page.getByRole("region", { name: "募集增援", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    assert.deepEqual((await save()).state, before.state);
    record(
      "outside tap dismisses recruitment without issuing a command or spending resources",
    );
    await page.getByTestId("antibody-tool").click();
    await expect(
      page.getByRole("region", { name: "B 細胞與抗體" }),
    ).toBeVisible();
    await expect(page.getByTestId("antibody-target")).toBeDisabled();
    await expect(page.getByTestId("antibody-stock")).toContainText(
      "現有抗體：0",
    );
    await expect(
      page.getByRole("region", { name: "B 細胞與抗體" }),
    ).toContainText("漿細胞");
    await page.screenshot({ path: dir + device + "-b-antibody.png" });
    if (device === "mobile")
      await page.touchscreen.tap(20, viewport.height / 2);
    else await page.mouse.click(20, viewport.height / 2);
    await expect(
      page.getByRole("region", { name: "B 細胞與抗體" }),
    ).toHaveCount(0);
    await page.getByTestId("mark-tool").click();
    await page.locator("[data-colony]").first().click();
    const marked = await save();
    assert.equal(marked.state.energy, before.state.energy - 1);
    assert.equal(marked.state.immunity.antibodies, 0);
    const target = marked.state.colonies[0];
    assert.ok(target.complementUntil > 0);
    assert.equal(target.antibodyUntil, 0);
    await expect(page.getByTestId("apply-mark")).toBeDisabled();
    await expect(page.getByTestId("colony-antibody")).toBeVisible();
    record(
      "independent C3b and B/antibody entries; absent antibody stock cannot be used; C3b charges only once",
    );
    await page.getByRole("button", { name: "撤銷暫停指令" }).click();
    assert.deepEqual((await save()).state, before.state);
    await page.keyboard.press("Escape");
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: "旋轉鏡頭", exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: dir + device + "-vessel-angle-" + i + ".png",
      });
    }
    await page.getByRole("button", { name: "重設鏡頭", exact: true }).click();
    record(
      "three rendered camera angles captured for conforming vessel inspection",
    );
    await page.getByRole("button", { name: "設定與存檔" }).click();
    await page.getByLabel("顯示完整地圖標籤").check();
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await expect(page.locator(".t-world-labels")).not.toHaveClass(/is-minimal/);
    await page.reload();
    await page.getByRole("button", { name: "繼續防線 →", exact: true }).click();
    assert.equal((await save()).settings.labels, true);
    assert.equal((await save()).state.immunity.autoSeek, true);
    await page.getByRole("button", { name: "設定與存檔" }).click();
    await page.getByLabel("顯示完整地圖標籤").uncheck();
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await page.getByTestId("speed-toggle").click();
    await page.getByTestId("pause-toggle").click();
    await page.waitForTimeout(6000);
    await page.getByTestId("pause-toggle").click();
    await page.screenshot({ path: dir + device + "-action.png" });
    assert.ok((await save()).state.events.some((e) => e.type === "engulf"));
    record(
      "label choice persists through reload; autonomous movement and phagocytosis continue at 2x",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(bad, []);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    record("no runtime or asset errors and no horizontal overflow");
    const video = page.video();
    await ctx.close();
    await video.saveAs(dir + device + "-ui-clarity.webm");
  }
  await writeFile(
    dir +
      "ui-results" +
      (process.env.DEVICE ? "-" + process.env.DEVICE : "") +
      ".json",
    JSON.stringify({ url, browser: browser.version(), checks }, null, 2),
  );
} finally {
  await browser?.close();
  server?.kill();
  await rm(dir + "raw-ui", { recursive: true, force: true });
}
