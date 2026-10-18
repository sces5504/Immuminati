import { configureM1 } from "./deployment-helpers.mjs";
import { chromium, expect } from "@playwright/test";
import { OrthographicCamera, Vector3 } from "three";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/anatomy/",
  import.meta.url,
).pathname;
await mkdir(dir, { recursive: true });
const target = process.env.TARGET_URL ?? "http://127.0.0.1:4182/Immuminati/";
const server = process.env.TARGET_URL
  ? undefined
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4182",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
let browser;
const results = [];
const record = (value) => {
  results.push(value);
  console.log("PASS", value.device, value.check);
};
try {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(target)).ok) break;
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
    ["mobile", { width: 390, height: 844 }],
  ]) {
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    const ctx = await browser.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      recordVideo: {
        dir: dir + "raw-anatomy",
        size: device === "desktop" ? { width: 960, height: 666 } : viewport,
      },
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(30000);
    const errors = [],
      failures = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) failures.push([r.status(), r.url()]);
    });
    const saved = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    await page.goto(target);
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await configureM1(page);
    await page.waitForTimeout(1200);
    const initial = await saved();
    assert.equal(initial.rules, "3.2");
    assert.equal(initial.state.hosts.length, 32);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await expect(page.getByTestId("space-caption")).toContainText(
      "肺泡腔 · 細胞外",
    );
    await page.screenshot({ path: dir + device + "-tissue-field.png" });
    // Independently project the anatomical cell positions and click the actual canvas, not a DOM label.
    const box = await page.locator("canvas").boundingBox(),
      aspect = box.width / box.height;
    const h = aspect < 0.9 ? 45 : aspect < 1.4 ? 37 : 31;
    const camera = new OrthographicCamera(
      (-h * aspect) / 2,
      (h * aspect) / 2,
      h / 2,
      -h / 2,
      0.1,
      160,
    );
    camera.position.set(Math.sin(0.48) * 44, 34, Math.cos(0.48) * 44);
    camera.lookAt(0, 0.5, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    let picked;
    for (const host of initial.state.hosts.filter((h) => h.wall)) {
      const v = new Vector3(host.position.x, 1.65, host.position.z).project(
        camera,
      );
      const point = {
        x: box.x + (v.x * 0.5 + 0.5) * box.width,
        y: box.y + (-v.y * 0.5 + 0.5) * box.height,
      };
      if (
        !(await page.evaluate(
          (p) => document.elementFromPoint(p.x, p.y)?.tagName === "CANVAS",
          point,
        ))
      )
        continue;
      await page.mouse.click(point.x, point.y);
      const selected = await page
        .locator(".tactical-root")
        .getAttribute("data-selected");
      if (selected?.startsWith("h")) {
        picked = selected;
        break;
      }
    }
    assert.ok(picked, `${device}: tissue model must be selectable on canvas`);
    await expect(page.getByTestId("inspect-selected")).toBeVisible();
    await page.screenshot({ path: dir + device + "-selected-epithelium.png" });
    await page.getByTestId("inspect-selected").click();
    const dialog = page.getByRole("dialog", { name: "人體組織與細胞剖視" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("cell-cutaway")).toHaveAttribute(
      "data-internal-load",
      "0",
    );
    assert.equal(await dialog.locator("[data-tissue-id]").count(), 32);
    await page.getByTestId("cell-cutaway").scrollIntoViewIfNeeded();
    await page.screenshot({ path: dir + device + "-healthy-cutaway.png" });
    const pauseState = await saved();
    await page.waitForTimeout(500);
    assert.deepEqual((await saved()).state, pauseState.state);
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await expect(page.locator(".tactical-root")).toHaveAttribute(
      "data-paused",
      "true",
    );
    record({
      device,
      check:
        "all M1 host cells present; 3D epithelium selection, healthy cutaway and safe pause",
      passed: true,
    });
    // Real play: observe engulfed live cargo, pause to inspect, then resume until killing completes.
    await page
      .locator(`[data-cell-id="${(await saved()).state.cells[0].id}"]`)
      .click();
    await page.getByTestId("pause-toggle").click();
    await page.waitForFunction(
      () =>
        Number(document.querySelector(".tactical-root").dataset.internalLoad) >
        0,
    );
    await page.getByTestId("anatomy-panel").click();
    const live = await saved();
    assert.ok(live.state.internal.length > 0);
    assert.ok(live.state.internal.every((p) => p.compartment === "phagosome"));
    const carrier = live.state.internal[0].host;
    await page.locator(`[data-inspect-cell="${carrier}"]`).click();
    await expect(page.getByTestId("cell-cutaway")).toHaveAttribute(
      "data-compartment",
      "phagosome",
    );
    assert.ok(
      Number(
        await page
          .getByTestId("cell-cutaway")
          .getAttribute("data-internal-load"),
      ) > 0,
    );
    await page.getByTestId("cell-cutaway").scrollIntoViewIfNeeded();
    await page.screenshot({ path: dir + device + "-phagosome-processing.png" });
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    if (!(await saved()).state.immunity.autoSeek)
      await page.getByTestId("autoseek").click();
    await page.getByTestId("speed-toggle").click();
    await page.getByTestId("pause-toggle").click();
    await page.waitForTimeout(2600);
    await page.getByTestId("anatomy-panel").click();
    const processed = await saved();
    assert.ok(
      processed.state.events.some((e) => e.message.includes("吞噬體完成殺菌")),
    );
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    record({
      device,
      check:
        "actual M1 ingestion transfers live load to phagosome; inspection reads authority; later killing is a separate event",
      passed: true,
    });
    // Export/reload preserves host IDs, region health and current intracellular cargo.
    await page.getByRole("button", { name: "設定與存檔", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /匯出/ }).click();
    const download = await downloadPromise;
    await download.saveAs(dir + device + "-save.json");
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    const persisted = await saved();
    await page.reload();
    await page.getByRole("button", { name: "繼續防線 →", exact: true }).click();
    assert.deepEqual((await saved()).state, persisted.state);
    await page.getByRole("button", { name: "設定與存檔", exact: true }).click();
    await page
      .locator('input[type="file"]')
      .setInputFiles(dir + device + "-save.json");
    await page.getByRole("button", { name: "繼續防線 →", exact: true }).click();
    assert.deepEqual((await saved()).state, persisted.state);
    record({
      device,
      check:
        "export, reload and actual file import preserve tissue identities, damage and intracellular state",
      passed: true,
    });
    // The same anatomy and inspector work in the disposable infection specimen bench.
    await page.getByTestId("immune-panel").click();
    await page
      .getByRole("button", { name: "進入 NK／CD8 機制演練", exact: true })
      .click();
    await page.getByTestId("anatomy-panel").click();
    const infected = page
      .locator("[data-tissue-id]")
      .filter({ hasText: "細胞質內感染" })
      .first();
    await infected.click();
    await expect(page.getByTestId("cell-cutaway")).toHaveAttribute(
      "data-compartment",
      "cytosol",
    );
    await page.getByTestId("cell-cutaway").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: dir + device + "-infected-host-cutaway.png",
    });
    await page.getByRole("button", { name: "關閉視窗", exact: true }).click();
    await page
      .getByRole("button", { name: "結束演練，返回 M1", exact: true })
      .click();
    assert.deepEqual((await saved()).state, persisted.state);
    record({
      device,
      check:
        "same host anatomy/cutaway in infection practice; cytosolic specimen distinct from phagosome; M1 save unchanged",
      passed: true,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
    record({
      device,
      check: "portrait layout, runtime and subpath assets",
      passed: true,
    });
    const video = page.video();
    await ctx.close();
    await video.saveAs(dir + device + "-anatomy.webm");
    console.log("PASS anatomy", device);
  }
  await writeFile(
    dir + "anatomy-results.json",
    JSON.stringify(
      {
        browser: browser.version(),
        results,
        limitations:
          "Headless Chromium/SwiftShader; mobile touch emulation, not physical Safari/iPhone. Anatomy is a teaching abstraction, not a full organ or viral life cycle.",
      },
      null,
      2,
    ),
  );
  await rm(dir + "raw-anatomy", { recursive: true, force: true });
} finally {
  await browser?.close();
  server?.kill();
}
