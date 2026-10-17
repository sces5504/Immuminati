import { existsSync } from "node:fs";
if (
  !process.env.PLAYWRIGHT_BROWSERS_PATH &&
  existsSync("/tmp/immuminati-playwright")
)
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/tmp/immuminati-playwright";
const { chromium } = await import("@playwright/test");
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "docs/evidence/rts";
await mkdir(dir, { recursive: true });
const url = process.env.BASE_URL ?? "http://127.0.0.1:4175/Immuminati/";
const server = process.env.BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--host",
        "127.0.0.1",
        "--port",
        "4175",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
let activePage;
const key = "immuminati:rts:v3",
  results = [];
let browser;
const record = (name, data = {}) => {
  results.push({ name, passed: true, ...data });
  console.log("PASS", name, JSON.stringify(data));
};
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ??
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  for (const mobile of [false, true]) {
    const name = mobile ? "mobile-touch-emulation" : "desktop",
      ctx = await browser.newContext({
        viewport: mobile
          ? { width: 360, height: 800 }
          : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
        deviceScaleFactor: 1,
        recordVideo: {
          dir: `${dir}/raw-browser`,
          size: mobile
            ? { width: 360, height: 800 }
            : { width: 1440, height: 1000 },
        },
      });
    const p = await ctx.newPage();
    activePage = p;
    const errors = [],
      bad = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("response", (r) => {
      if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
    });
    await p.addInitScript(() => {
      localStorage.setItem("immuminati:save:v1", "old-v1-sentinel");
      localStorage.setItem("immuminati:tactics:v2", "old-v2-sentinel");
    });
    await p.goto(url);
    await p.getByRole("button", { name: "開始 M1 肺部防禦" }).click();
    await p.getByRole("button", { name: "關閉提示" }).click();
    await p.waitForTimeout(5000);
    await p.screenshot({ path: `${dir}/${name}-field.png`, fullPage: true });
    const tap = (x, y) =>
      mobile ? p.touchscreen.tap(x, y) : p.mouse.click(x, y);
    const mapTap = async (fx, fy) => {
      const map = p.getByTestId("world");
      await map.scrollIntoViewIfNeeded();
      await p.waitForTimeout(150);
      const box = await map.boundingBox();
      const opts = { position: { x: box.width * fx, y: box.height * fy } };
      if (mobile) await map.tap(opts);
      else await map.click(opts);
    };
    const get = () =>
      p.evaluate((k) => JSON.parse(localStorage.getItem(k)), key);
    await p.getByRole("button", { name: "細胞名單", exact: true }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: /巨噬細胞 u1/ })
      .click();
    await p.getByRole("button", { name: "移動到此", exact: true }).click();
    await p.getByTestId("world").scrollIntoViewIfNeeded();
    const landmark = p.getByTestId("landmark");
    let before = await landmark.boundingBox();
    const w = await p.getByTestId("world").boundingBox();
    async function drag(dx, dy) {
      const x = w.x + w.width * 0.43,
        y = w.y + w.height * 0.52;
      if (mobile) {
        const cdp = await ctx.newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + dx, y: y + dy }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await cdp.detach();
      } else {
        await p.mouse.move(x, y);
        await p.mouse.down();
        await p.mouse.move(x + dx, y + dy, { steps: 12 });
        await p.mouse.up();
      }
      await p.waitForTimeout(200);
    }
    await drag(80, 40);
    let after = await landmark.boundingBox();
    assert(Math.abs(after.x - before.x - 80) < 2);
    assert(Math.abs(after.y - before.y - 40) < 2);
    assert.equal((await get()).plans.length, 0);
    await drag(-80, -40);
    after = await landmark.boundingBox();
    assert(Math.abs(after.x - before.x) < 2);
    await p.getByRole("button", { name: "放大", exact: true }).click();
    before = await landmark.boundingBox();
    await drag(80, 40);
    after = await landmark.boundingBox();
    assert(Math.abs(after.x - before.x - 80) < 2);
    await p.getByRole("button", { name: "重設鏡頭" }).click();
    await p.getByRole("button", { name: "取消位置指令" }).click();
    record(`${name}: positive drag, reverse, zoom, no accidental orders`);
    await p.getByRole("button", { name: "移動到此", exact: true }).click();
    await p.getByTestId("world").scrollIntoViewIfNeeded();
    const direct = await p.getByTestId("world").boundingBox();
    await tap(direct.x + direct.width * 0.5, direct.y + direct.height * 0.42);
    await p.getByRole("button", { name: "▶ 恢復模擬" }).click();
    await p.waitForTimeout(2200);
    await p.getByRole("button", { name: "Ⅱ 暫停規劃" }).click();
    const moved = await get();
    assert(moved.state.units[0].x > 370);
    record(`${name}: direct move order`, { position: moved.state.units[0] });
    // Actual pointer hit test must select the independent logical pathogen.
    await p.getByRole("button", { name: "細胞名單", exact: true }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: /^病原 p4 / })
      .click();
    await p.getByRole("button", { name: "補體調理 · 18" }).click();
    await p.getByRole("button", { name: "募集嗜中性球 · 15" }).click();
    const world = await p.getByTestId("world").boundingBox();
    await mapTap(0.67, 0.5);
    assert.equal((await get()).plans.length, 2);
    await p.getByRole("button", { name: "撤銷", exact: true }).last().click();
    assert.equal((await get()).plans.length, 1);
    await p.getByRole("button", { name: "募集嗜中性球 · 15" }).click();
    await mapTap(0.67, 0.5);
    await p.getByRole("button", { name: "訊號視圖", exact: true }).click();
    await p.getByRole("button", { name: "4×", exact: true }).click();
    await p.getByRole("button", { name: "▶ 恢復模擬" }).click();
    await p.waitForFunction(
      (k) => {
        const s = JSON.parse(localStorage.getItem(k))?.state;
        return (
          s?.events.some((e) => e.type === "arrival") &&
          s.events.some((e) => e.type === "wrap")
        );
      },
      key,
      { timeout: 35000 },
    );
    await p.getByRole("button", { name: "Ⅱ 暫停規劃" }).click();
    const playing = await get();
    assert(playing.state.step > 70);
    assert(playing.state.events.some((e) => e.type === "arrival"));
    assert(playing.state.events.some((e) => e.type === "wrap"));
    assert(playing.state.field.some((v) => v > 0));
    await p.screenshot({ path: `${dir}/${name}-signals.png`, fullPage: true });
    record(`${name}: real AI, opsonization, recruitment and field`, {
      step: playing.state.step,
    });
    await p.getByRole("button", { name: "淋巴結", exact: true }).click();
    await p.getByRole("button", { name: "支援反應準備 · 22" }).click();
    await p.screenshot({ path: `${dir}/${name}-node.png`, fullPage: true });
    await p.getByRole("button", { name: "返回戰場" }).click();
    await p.getByRole("button", { name: "百科", exact: true }).click();
    await p.getByPlaceholder("例如：調理、M2、CXCL8").fill("CXCL8");
    assert(await p.getByRole("heading", { name: "CXCL8／發炎" }).count());
    await p.getByRole("button", { name: "返回戰場" }).click();
    // Save/export/import through actual UI, no engine state mutation.
    await p.getByRole("button", { name: "存檔／設定" }).click();
    const dl = p.waitForEvent("download");
    await p.getByRole("button", { name: "匯出 JSON" }).click();
    const download = await dl;
    await download.saveAs(`${dir}/${name}-save.json`);
    const saved = JSON.parse(
      await readFile(`${dir}/${name}-save.json`, "utf8"),
    );
    await p.getByRole("button", { name: "返回戰場" }).click();
    await p.reload();
    await p.getByRole("button", { name: "本機續玩" }).click();
    assert.equal((await get()).state.step, saved.state.step);
    await p.getByRole("button", { name: "存檔／設定" }).click();
    await p.locator("input[type=file]").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schema":2}'),
    });
    await p.getByRole("status").filter({ hasText: "匯入失敗" }).waitFor();
    assert.equal((await get()).state.step, saved.state.step);
    await p
      .locator("input[type=file]")
      .setInputFiles(`${dir}/${name}-save.json`);
    await p.getByRole("status").filter({ hasText: "驗證成功" }).waitFor();
    assert.equal((await get()).state.step, saved.state.step);
    assert.equal(
      await p.evaluate(() => localStorage.getItem("immuminati:save:v1")),
      "old-v1-sentinel",
    );
    assert.equal(
      await p.evaluate(() => localStorage.getItem("immuminati:tactics:v2")),
      "old-v2-sentinel",
    );
    record(`${name}: export, reload, import validation, legacy preserved`);
    if (await p.getByRole("button", { name: "關閉提示" }).count())
      await p.getByRole("button", { name: "關閉提示" }).click();
    await p.getByRole("button", { name: "▶ 恢復模擬" }).click();
    await p.getByTestId("result").waitFor({ timeout: 55000 });
    const final = await get();
    assert.equal(final.state.result.outcome, "won");
    assert(final.state.events.some((e) => e.type === "antibody"));
    assert(final.state.events.some((e) => e.type === "clear"));
    await p.getByTestId("result").scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${dir}/${name}-result.png`, fullPage: true });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(bad, []);
    record(`${name}: full playable M1 victory`, {
      result: final.state.result,
      tissue: final.state.tissue,
      events: final.state.events.length,
      errors,
      bad,
      viewport: await p.viewportSize(),
      browser: browser.version(),
    });
    // Controlled dense fixture, explicitly separate from the normal M1 playthrough.
    const dense = structuredClone(final);
    dense.state.step = 0;
    dense.state.serial = 2000;
    dense.state.events = [];
    dense.state.processed = [];
    dense.state.result = undefined;
    dense.state.sourceClosed = false;
    dense.state.node = { phase: "antigen", until: 0, supported: false };
    dense.state.stats = { cleared: 0, recruited: 0, captures: 0 };
    dense.state.damage = { pathogen: 0, inflammation: 0, bystander: 0 };
    dense.state.tissue = 100;
    dense.state.recruits = [];
    dense.state.resources = 150;
    dense.state.field.fill(0);
    dense.nextCommand = 1;
    dense.plans = [];
    dense.state.units = Array.from({ length: 30 }, (_, i) => ({
      id: `u${100 + i}`,
      kind: "neutrophil",
      visualId: "cell.neutrophil.v1",
      x: 600 + (i % 6),
      y: 300 + Math.floor(i / 6),
      action: "patrol",
      since: 0,
      until: 0,
      life: 650,
      signal: false,
    }));
    dense.state.pathogens = Array.from({ length: 30 }, (_, i) => ({
      id: `p${200 + i}`,
      visualId: "pathogen.spn.v1",
      x: 618 + (i % 6),
      y: 300 + Math.floor(i / 6),
      load: 4,
      opsonin: "complement",
      opsAt: 0,
      compartment: "external",
      survives: false,
      born: 0,
      heading: 0,
      antigen: "spn:surface-protein-A",
    }));
    await p.locator("input[type=file]").setInputFiles({
      name: "controlled-dense-30.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(dense)),
    });
    await p.getByRole("status").filter({ hasText: "驗證成功" }).waitFor();
    await p.getByRole("button", { name: "細胞名單", exact: true }).click();
    assert.equal(
      await p.getByRole("dialog").locator(".unit-list button strong").count(),
      30,
    );
    await p
      .getByRole("dialog")
      .getByRole("button", { name: /嗜中性球 u129 / })
      .click();
    assert((await p.locator(".selection").textContent()).includes("u129"));
    await p.screenshot({ path: `${dir}/${name}-dense30.png`, fullPage: true });
    await p.getByRole("button", { name: "▶ 恢復模擬" }).click();
    await p.waitForFunction(
      (k) => JSON.parse(localStorage.getItem(k)).state.stats.cleared > 60,
      key,
      { timeout: 25000 },
    );
    await p.getByRole("button", { name: "Ⅱ 暫停規劃" }).click();
    record(
      `${name}: controlled 30-group focus, roster selection and contact actions`,
    );
    await p.addStyleTag({ content: ":root{font-size:20px}" });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    record(`${name}: 20px root text without horizontal overflow`);
    const video = p.video();
    await ctx.close();
    await video.saveAs(`${dir}/${name}-playthrough.webm`);
  }
  await writeFile(
    `${dir}/${process.env.BASE_URL ? "live-" : ""}browser-results.json`,
    JSON.stringify(
      { url, recordedAt: new Date().toISOString(), results },
      null,
      2,
    ),
  );
} catch (error) {
  await activePage
    ?.screenshot({ path: `${dir}/failure.png`, fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
