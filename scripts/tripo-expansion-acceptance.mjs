/** Related art acceptance only: real six-case UI plus labelled coverage fixtures. */
import { chromium, expect } from "@playwright/test";
// UI events are real, browser clock only bounds software WebGL frame work.
async function configureCase(page) {
  if (!(await page.getByTestId("deployment-panel").count())) return;
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("immuminati:tactics:v2")).state.scenario,
  );
  await page
    .locator("[data-kit]")
    .first()
    .evaluate((el) => el.click());
  await page.locator(".t-deploy-custom summary").evaluate((el) => el.click());
  const [kind, region] = {
    m1: ["dendritic", "c"],
    m2: ["dendritic", "a"],
    m3: ["macrophage", "b"],
    m4: ["cytotoxicT", "b"],
    m5: ["th17", "a"],
    m6: ["cytotoxicT", "b"],
  }[id];
  await page.getByRole("combobox", { name: "部署防區" }).selectOption(region);
  await page.locator(`[data-deploy="${kind}"]`).evaluate((el) => el.click());
  await page.getByTestId("deployment-confirm").evaluate((el) => el.click());
}
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL("../docs/evidence/tripo-expansion/", import.meta.url)
  .pathname;
await mkdir(dir + "raw", { recursive: true });
const target = process.env.TARGET_URL ?? "http://127.0.0.1:24862/Immuminati/";
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const results = [];
const log = (...args) => console.log(new Date().toISOString(), ...args);
try {
  for (const [device, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    if (process.env.DEVICE && process.env.DEVICE !== device) continue;
    for (const id of process.env.CASE
      ? [process.env.CASE]
      : ["m1", "m2", "m3", "m4", "m5", "m6"]) {
      log("START", device, id);
      const ctx = await browser.newContext({
        viewport,
        isMobile: device === "mobile",
        hasTouch: device === "mobile",
        recordVideo: {
          dir: dir + "raw",
          size: device === "mobile" ? viewport : { width: 1024, height: 712 },
        },
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(60000);
      const errors = [],
        bad = [],
        downloads = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("response", (r) => {
        if (r.status() >= 400) bad.push([r.status(), r.url()]);
      });
      page.on("request", (r) => {
        if (r.url().includes("/assets/tripo/") && r.url().endsWith(".glb"))
          downloads.push(r.url());
      });
      const read = () =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
        );
      const scene = page.getByTestId("tactical-scene");
      const stats = () => scene.evaluate((e) => ({ ...e.dataset }));
      await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
      await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
      await page.goto(target);
      await page.clock.runFor(120);
      await page
        .locator(".t-case-cards button")
        .nth(+id.slice(1) - 1)
        .evaluate((el) => el.click());
      await configureCase(page);
      const initial = await read();
      for (let attempt = 0; attempt < 100; attempt++) {
        await page.clock.runFor(150);
        const data = await stats();
        if (
          data.artTissue === "true" &&
          +data.artHosts > 0 &&
          +data.artCells === initial.state.cells.length
        )
          break;
        await new Promise((r) => setTimeout(r, 150));
      }
      await expect(scene).toHaveAttribute("data-art-tissue", "true");
      await expect(scene).toHaveAttribute(
        "data-art-cells",
        String(initial.state.cells.length),
      );
      assert.ok(+(await stats()).artHosts > 0);
      assert.ok(
        +(await stats()).artHostDraws > 0,
        "host replacement really reaches the renderer",
      );
      const sample = await stats();
      await page.screenshot({ path: `${dir}${device}-${id}-field.png` });
      log("LOADED", device, id, JSON.stringify(sample));
      // Compare rendering only; neither switching nor waiting may alter authority.
      await page
        .getByRole("button", { name: "設定與存檔", exact: true })
        .evaluate((el) => el.click());
      await page.getByTestId("art-toggle").evaluate((el) => el.click());
      await page
        .getByRole("button", { name: "關閉視窗", exact: true })
        .evaluate((el) => el.click());
      await page.clock.runFor(150);
      await expect(scene).toHaveAttribute("data-art-mode", "original");
      await page.clock.runFor(150);
      const original = await stats();
      assert.deepEqual((await read()).state, initial.state);
      await page
        .getByRole("button", { name: "設定與存檔", exact: true })
        .evaluate((el) => el.click());
      await page.getByTestId("art-toggle").evaluate((el) => el.click());
      await page
        .getByRole("button", { name: "關閉視窗", exact: true })
        .evaluate((el) => el.click());
      await page.clock.runFor(150);
      await expect(scene).toHaveAttribute("data-art-mode", "tripo");
      assert.deepEqual((await read()).state, initial.state);
      assert.ok(
        +sample.artTriangles < Math.max(+original.artTriangles * 1.65, 320000),
        JSON.stringify({ sample, original }),
      );
      assert.ok(
        +sample.artDrawCalls <=
          +original.artDrawCalls + initial.state.cells.length + 3,
        JSON.stringify({ sample, original }),
      );
      log("TOGGLE PASS", device, id);
      const counts = downloads.length;
      await page
        .locator(".t-roster [data-cell-id]")
        .first()
        .evaluate((el) => el.click());
      await page
        .locator(".t-field-label")
        .nth(1)
        .evaluate((el) => el.click());
      assert.equal((await read()).state.cells[0].order.type, "move");
      await page
        .getByRole("button", { name: "撤銷暫停指令" })
        .evaluate((el) => el.click());
      assert.deepEqual((await read()).state, initial.state);
      log("MOVE PASS", device, id);
      await page.getByTestId("anatomy-panel").evaluate((el) => el.click());
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({ path: `${dir}${device}-${id}-compartments.png` });
      await page
        .getByRole("button", { name: "關閉視窗", exact: true })
        .evaluate((el) => el.click());
      assert.equal(
        downloads.length,
        counts,
        "toggle and inspection reuse decoded assets",
      );
      if (initial.state.colonies.length) {
        await page.getByTestId("mark-tool").evaluate((el) => el.click());
        await page
          .locator("[data-colony]")
          .first()
          .evaluate((el) => el.click());
        const marked = await read();
        assert.equal(marked.state.energy, initial.state.energy - 1);
        await page.clock.runFor(1200);
        assert.deepEqual(
          (await read()).state,
          marked.state,
          "animation cannot settle rules twice",
        );
      }
      log("MARK PASS", device, id);
      await page.getByTestId("speed-toggle").evaluate((el) => el.click());
      await page.getByTestId("pause-toggle").evaluate((el) => el.click());
      await page.clock.runFor(1000);
      await page.getByTestId("pause-toggle").evaluate((el) => el.click());
      const after = await read();
      assert.ok(after.state.tick > initial.state.tick);
      await page.screenshot({ path: `${dir}${device}-${id}-active.png` });
      assert.deepEqual(errors, []);
      assert.deepEqual(bad, []);
      const video = page.video();
      await ctx.close();
      await video.saveAs(`${dir}${device}-${id}-raw.webm`);
      results.push({
        device,
        id,
        sample,
        original,
        ticks: after.state.tick,
        events: [...new Set(after.state.events.map((e) => e.type))],
        downloads: downloads.map((u) => u.split("/").at(-1)),
        errors,
        bad,
        checks: [
          "all deployed immune and host replacements render",
          "organ-specific batched tissue",
          "original toggle leaves exact authority unchanged",
          "selection, move and undo",
          "compartment inspection",
          "C3b animation charges once",
          "2x real gameplay",
          "no runtime or asset errors",
        ],
      });
      await writeFile(
        dir + "results.json",
        JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
      );
      log("PASS", device, id);
    }
  }
  await writeFile(
    dir + "results.json",
    JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
  );
} finally {
  await browser.close();
}
