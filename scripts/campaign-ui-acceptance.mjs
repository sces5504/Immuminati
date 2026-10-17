import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/campaign-ui/",
  import.meta.url,
).pathname;
await mkdir(dir, { recursive: true });
const target = process.env.TARGET_URL ?? "http://127.0.0.1:4187/Immuminati/";
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
const b = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const checks = [];
try {
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(target)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  for (const [device, viewport] of [
    ["desktop", { width: 1280, height: 900 }],
    ["mobile", { width: 360, height: 800 }],
  ]) {
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    const ctx = await b.newContext({
      viewport,
      isMobile: device === "mobile",
      hasTouch: device === "mobile",
      recordVideo: { dir, size: viewport },
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(30000);
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(target);
    await p.getByRole("button", { name: "開始 M1", exact: true }).click();
    const read = () =>
      p.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    const original = await read();
    const fixture = structuredClone(original);
    fixture.state.immunity.antibodies = 3;
    await p.getByRole("button", { name: "設定與存檔" }).click();
    await p
      .getByLabel("新版存檔檔案")
      .setInputFiles({
        name: "stock-fixture.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixture)),
      });
    await p.getByRole("button", { name: "繼續防線 →" }).click();
    await p.getByTestId("antibody-tool").click();
    await expect(p.getByRole("region", { name: "B 細胞與抗體" })).toHaveCount(
      0,
    );
    const targetId = fixture.state.colonies[0].id;
    await p.locator(`[data-colony="${targetId}"]`).click();
    let saved = await read();
    assert.equal(saved.state.immunity.antibodies, 2);
    assert.equal(saved.state.energy, fixture.state.energy);
    assert.equal(saved.state.colonies[0].load, fixture.state.colonies[0].load);
    assert.equal(saved.state.events.at(-1).opsonin, "antibody");
    await p.screenshot({ path: dir + device + "-antibody-flight.png" });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: dir + device + "-antibody-attached.png" });
    await p.getByTestId("colony-antibody").click();
    assert.equal((await read()).state.immunity.antibodies, 2);
    await p.getByTestId("skip-effects").click();
    assert.deepEqual((await read()).state, saved.state);
    await p.getByTestId("antibody-explain").click();
    await expect(p.getByRole("region", { name: "B 細胞與抗體" })).toBeVisible();
    await p.getByRole("button", { name: "關閉抗體面板" }).click();
    // An empty inter-wave scene is a layout fixture, never evidence of winning a level.
    const inter = structuredClone(original);
    inter.state.colonies = [];
    inter.state.internal = [];
    await p.getByRole("button", { name: "設定與存檔" }).click();
    await p
      .getByLabel("新版存檔檔案")
      .setInputFiles({
        name: "inter-wave-layout.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(inter)),
      });
    await p.getByRole("button", { name: "繼續防線 →" }).click();
    const next = await p.locator(".t-next-wave").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        b = el.querySelector("b").getBoundingClientRect();
      return {
        fits:
          el.scrollWidth <= el.clientWidth + 1 &&
          b.right <= r.right &&
          b.left >= r.left,
        width: r.width,
        height: r.height,
      };
    });
    assert.ok(next.fits && next.height >= 44, JSON.stringify(next));
    const help = await p
      .getByRole("button", { name: "? 操作提示", exact: true })
      .evaluate((el) => {
        const r = el.getBoundingClientRect(),
          s = el.querySelector("span").getBoundingClientRect();
        return {
          fits: s.left >= r.left && s.right <= r.right,
          w: r.width,
          h: r.height,
        };
      });
    assert.ok(help.fits && help.h >= 44, JSON.stringify(help));
    await p.screenshot({ path: dir + device + "-overflow-fixed.png" });
    await p.getByRole("button", { name: "回主頁", exact: true }).click();
    assert.equal((await read()).paused, true);
    assert.deepEqual((await read()).state, inter.state);
    assert.deepEqual(errors, []);
    checks.push({
      device,
      passed: true,
      next,
      help,
      errors,
      checks: [
        "stock tool targets directly",
        "one antibody charge; independent energy and living load",
        "duplicate rejected",
        "cosmetic skip never changes state",
        "independent explanation entry",
        "next wave reward and right-side help stay in bounds",
        "home saves and pauses",
      ],
    });
    const v = p.video();
    await ctx.close();
    await v.saveAs(dir + device + "-controls.webm");
  }
  await writeFile(
    dir + "results.json",
    JSON.stringify({ date: new Date().toISOString(), checks }, null, 2),
  );
  console.log("PASS", JSON.stringify(checks));
} finally {
  await b.close();
  server?.kill();
}
