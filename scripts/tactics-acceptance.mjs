import { chromium, expect as baseExpect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile, rm } from "node:fs/promises";
import assert from "node:assert/strict";
const expect = baseExpect.configure({ timeout: 15000 });
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/tactics/",
  import.meta.url,
).pathname;
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
let browser;
let activePage;
const results = [];
const record = (name, detail) => {
  results.push({ name, passed: true, detail });
  console.log("PASS", name, detail ?? "");
};
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
  const key = "immuminati:tactics:v2";
  const save = (page) =>
    page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key);
  const toggle = async (page, desired) => {
    if (await page.getByTestId("tactical-result").count()) return;
    if (
      (await page.locator(".tactical-root").getAttribute("data-paused")) !==
      desired
    ) {
      try {
        await page.getByTestId("pause-toggle").click({ timeout: 5000 });
      } catch (e) {
        // A software renderer can acknowledge an already-applied click late.
        const applied =
          (await page.locator(".tactical-root").getAttribute("data-paused")) ===
          desired;
        if (!applied && !(await page.getByTestId("tactical-result").count()))
          throw e;
      }
    }
  };
  const pause = (page) => toggle(page, "true");
  const resume = (page) => toggle(page, "false");
  const selectColony = async (page, id) => {
    const cell = await page
      .locator(".tactical-root")
      .getAttribute("data-selected");
    if (cell?.startsWith("u")) await page.keyboard.press("Escape");
    await page.locator(`[data-colony="${id}"]`).click();
  };
  const modes =
    process.env.DEVICE === "mobile"
      ? [true]
      : process.env.DEVICE === "desktop"
        ? [false]
        : [false, true];
  for (const mobile of modes) {
    const name = mobile ? "mobile" : "desktop";
    const ctx = await browser.newContext({
      viewport: mobile
        ? { width: 360, height: 800 }
        : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
      recordVideo: {
        dir: dir + "raw-tactics",
        size: mobile
          ? { width: 360, height: 800 }
          : { width: 960, height: 666 },
      },
    });
    await ctx.addInitScript(() =>
      localStorage.setItem("immuminati:save:v1", "legacy-backup"),
    );
    const page = await ctx.newPage(),
      errors = [],
      httpErrors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400)
        httpErrors.push({ url: r.url(), status: r.status() });
    });
    page.setDefaultTimeout(20000);
    activePage = page;
    await page.goto(url, { waitUntil: "networkidle" });
    await expect(page.locator(".t-scene-error")).toHaveCount(0);
    await expect(page.locator(".t-case-cards button")).toHaveCount(6);
    await page.waitForTimeout(600);
    await page.screenshot({ path: dir + name + "-home.png" });
    await page.getByRole("button", { name: "開始 M1", exact: true }).click();
    await expect(page.locator(".t-colony-label")).toHaveCount(3);
    assert.equal((await save(page)).paused, true);
    await page.screenshot({ path: dir + name + "-field.png" });
    console.log("CHECK", name, "idle capture");
    const still = (await save(page)).state;
    const before = await page.screenshot({
      clip: await page.locator("canvas").boundingBox(),
    });
    await page.waitForTimeout(700);
    const after = await page.screenshot({
      clip: await page.locator("canvas").boundingBox(),
    });
    assert.notDeepEqual(before, after);
    assert.deepEqual((await save(page)).state, still);
    record(name + ": independent 3D idle without rule mutation");
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const targetSizes = await page
      .locator(
        ".t-colony-label,.t-roster>button,.t-pause,.t-field-tools>button",
      )
      .evaluateAll((es) =>
        es.map((e) => ({
          w: e.getBoundingClientRect().width,
          h: e.getBoundingClientRect().height,
        })),
      );
    assert(
      targetSizes.every((p) => p.w >= 43.99 && p.h >= 43.99),
      JSON.stringify(targetSizes),
    );
    record(name + ": 44px primary controls and no horizontal overflow");
    // First defense: two local opsonizations plus a reinforcement for C.
    console.log("CHECK", name, "mark two groups");
    for (const region of ["a", "b"]) {
      const p = (await save(page)).state.colonies.find(
        (p) => p.region === region,
      );
      await selectColony(page, p.id);
      await page.getByTestId("apply-mark").evaluate((el) => {
        el.click();
        el.click();
      });
    }
    assert.equal((await save(page)).state.energy, 3);
    assert.equal((await save(page)).state.support, 4);
    await page.getByRole("button", { name: "開啟募集增援" }).click();
    await page.getByRole("combobox", { name: "增援防區" }).selectOption("c");
    await page.locator('[data-recruit="neutrophil"]').click();
    assert.equal((await save(page)).state.arrivals.length, 1);
    await page.getByRole("button", { name: "撤銷暫停指令" }).click();
    assert.equal((await save(page)).state.energy, 3);
    assert.equal((await save(page)).state.arrivals.length, 0);
    await page.locator('[data-recruit="neutrophil"]').click();
    await page.getByRole("button", { name: "關閉增援面板" }).click();
    record(
      name +
        ": marking, duplicate input, delayed recruitment and planning undo",
    );
    // Camera changes are view-only; canvas hit-testing selects a cell without a DOM unit chip.
    console.log("CHECK", name, "camera/pointer");
    const authority = (await save(page)).state;
    await page.getByRole("button", { name: "旋轉鏡頭" }).click();
    await page.getByRole("button", { name: "放大戰場" }).click();
    await page.getByRole("button", { name: "重設鏡頭" }).click();
    assert.deepEqual((await save(page)).state, authority);
    // Real mouse/touch gestures must move a projected landmark with the drag,
    // at every quarter-turn and at both tested zooms. No test-only scene hook.
    const cdp = mobile ? await ctx.newCDPSession(page) : null;
    const marker = () =>
      page.locator('[data-world-label="u1"]').evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        return { x: m.m41, y: m.m42 };
      });
    const drag = async (dx, dy) => {
      const point = await page.locator("canvas").evaluate((canvas) => {
        const r = canvas.getBoundingClientRect();
        for (const fy of [0.45, 0.55, 0.35, 0.65])
          for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
            const x = r.x + r.width * fx,
              y = r.y + r.height * fy;
            if (
              document.elementFromPoint(x, y) === canvas &&
              document.elementFromPoint(x + 24, y + 18) === canvas
            )
              return { x, y };
          }
        throw new Error("No unobstructed canvas gesture location");
      });
      if (cdp) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ ...point, id: 1 }],
        });
        for (let n = 1; n <= 3; n++)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              { x: point.x + (dx * n) / 3, y: point.y + (dy * n) / 3, id: 1 },
            ],
          });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
      } else {
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + dx, point.y + dy, { steps: 3 });
        await page.mouse.up();
      }
    };
    const dragResults = [];
    const selectedBeforeDrag = await page
      .locator(".tactical-root")
      .getAttribute("data-selected");
    for (const zoomed of [false, true])
      for (let quarter = 0; quarter < 4; quarter++) {
        console.log("CHECK", name, "drag", { quarter, zoomed });
        await page.getByRole("button", { name: "重設鏡頭" }).click();
        for (let n = 0; n < quarter * 4; n++)
          await page.getByRole("button", { name: "旋轉鏡頭" }).click();
        if (zoomed)
          await page.getByRole("button", { name: "放大戰場" }).click();
        const start = await marker();
        await drag(24, 18);
        const end = await marker();
        const delta = { x: end.x - start.x, y: end.y - start.y };
        assert(
          Math.abs(delta.x - 24) < 2 && Math.abs(delta.y - 18) < 2,
          JSON.stringify({ name, zoomed, quarter, delta }),
        );
        await drag(-24, -18);
        const back = await marker();
        assert(Math.hypot(back.x - start.x, back.y - start.y) < 2);
        dragResults.push({ quarter, zoomed, delta });
      }
    await cdp?.detach();
    assert.deepEqual((await save(page)).state, authority);
    assert.equal(
      await page.locator(".tactical-root").getAttribute("data-selected"),
      selectedBeforeDrag,
    );
    await page.getByRole("button", { name: "重設鏡頭" }).click();
    record(
      name +
        ": grab-map drag follows mouse/touch across rotation and zoom without issuing orders",
      dragResults,
    );
    const unitLabel = page.locator('[data-world-label="u1"]');
    const box = await unitLabel.boundingBox();
    if (mobile)
      await page.touchscreen.tap(
        box.x + box.width / 2,
        box.y + box.height / 2 + 32,
      );
    else
      await page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height / 2 + 32,
      );
    await expect(page.locator(".tactical-root")).toHaveAttribute(
      "data-selected",
      "u1",
    );
    // Use stable roster hit targets to issue explicit physical movement and then a legal attack.
    await page.locator('[data-cell-id="u1"]').click();
    const original = (await save(page)).state.cells[0].position;
    await page.getByRole("button", { name: "防區深部肺泡" }).click();
    assert((await save(page)).state.cells[0].path.length > 1);
    await page.getByRole("button", { name: "撤銷暫停指令" }).click();
    assert.deepEqual((await save(page)).state.cells[0].position, original);
    await page.keyboard.press("Escape");
    record(
      name +
        ": camera independent of rules, pointer picking, spatial order and undo",
    );
    console.log("CHECK", name, "settings and simulation");
    await page.getByRole("button", { name: "設定與存檔" }).click();
    await page.getByRole("combobox", { name: "行動速度" }).selectOption("2");
    await page.getByRole("button", { name: "關閉視窗" }).click();
    await resume(page);
    await page.waitForTimeout(1800);
    await pause(page);
    assert((await save(page)).state.tick > 0);
    assert((await save(page)).state.events.some((e) => e.type === "engulf"));
    await page.screenshot({ path: dir + name + "-engulf.png" });
    let iterations = 0;
    await resume(page);
    while (iterations++ < 90) {
      if (iterations % 10 === 0)
        console.log(
          "CHECK",
          name,
          "combat",
          iterations,
          (await save(page)).state.tick,
        );
      await page.waitForTimeout(2600);
      if (await page.getByTestId("tactical-result").count()) break;
      await pause(page);
      if (await page.getByTestId("tactical-result").count()) break;
      let state = (await save(page)).state;
      for (const p of [...state.colonies].sort((a, b) => b.load - a.load)) {
        state = (await save(page)).state;
        const current = state.colonies.find((v) => v.id === p.id);
        if (
          current &&
          current.markedUntil <= state.tick &&
          current.load >= 5 &&
          state.energy > 0 &&
          state.support > 0
        ) {
          await selectColony(page, p.id);
          await page.getByTestId("apply-mark").click();
        }
      }
      state = (await save(page)).state;
      for (const u of state.cells.filter((u) => u.kind !== "dendritic"))
        if (!state.colonies.some((p) => p.region === u.region)) {
          const target = state.colonies[0];
          if (target) {
            await page.locator(`[data-cell-id="${u.id}"]`).click();
            await page.locator(`[data-colony="${target.id}"]`).click();
            state = (await save(page)).state;
          }
        }
      await page.keyboard.press("Escape");
      state = (await save(page)).state;
      if (!state.colonies.length && !state.internal.length && state.wave < 2)
        await page.getByRole("button", { name: /提前迎擊下一波/ }).click();
      await resume(page);
    }
    await expect(page.getByTestId("tactical-result")).toBeVisible({
      timeout: 10000,
    });
    const final = (await save(page)).state;
    assert.equal(final.result.type, "victory");
    await page.screenshot({ path: dir + name + "-result.png" });
    record(name + ": real UI completes three-wave tactical M1", final.result);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("immuminati:save:v1")),
      "legacy-backup",
    );
    await page.reload();
    await page.getByRole("button", { name: "繼續防線 →" }).click();
    assert.deepEqual((await save(page)).state, final);
    record(name + ": stable reload and legacy save retained");
    // Controlled pressure fixture: keep the real UI, then issue actual commands
    // to recruit and deploy into a crowded region without replaying a battle.
    const crowded = structuredClone(await save(page));
    crowded.state = structuredClone(authority);
    crowded.state.arrivals = [];
    crowded.state.energy = 8;
    crowded.undo = [];
    crowded.paused = true;
    for (let i = 0; i < 27; i++)
      crowded.state.cells.push({
        ...structuredClone(crowded.state.cells[0]),
        id: `u${crowded.state.serial++}`,
        region: "b",
        position: { x: 10 + (i % 6) * 0.4, z: -6 + Math.floor(i / 6) * 0.4 },
        path: [],
        order: { type: "guard", point: { x: 10, z: -6 } },
      });
    await page.getByRole("button", { name: "設定與存檔" }).click();
    await page.getByLabel("新版存檔檔案").setInputFiles({
      name: "crowded-controlled.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(crowded)),
    });
    await page.getByRole("button", { name: "繼續防線 →" }).click();
    assert.equal((await save(page)).state.cells.length, 30);
    await page.locator('[data-cell-id="u1"]').click();
    await page.getByRole("button", { name: "防區深部肺泡" }).click();
    assert.equal((await save(page)).state.cells[0].region, "b");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "開啟募集增援" }).click();
    await page.getByRole("combobox", { name: "增援防區" }).selectOption("b");
    await expect(page.locator('[data-recruit="neutrophil"]')).toBeEnabled();
    await page.locator('[data-recruit="neutrophil"]').click();
    assert.equal((await save(page)).state.arrivals.length, 1);
    assert.equal((await save(page)).state.energy, 5);
    assert(
      !(await page
        .locator(".tactical-root")
        .innerText()
        .then((t) => t.includes("容量已滿"))),
    );
    await page.getByRole("button", { name: "關閉增援面板" }).click();
    await page.screenshot({ path: dir + name + "-crowded-controlled.png" });
    const crowdedState = (await save(page)).state;
    await page.reload();
    await page.getByRole("button", { name: "繼續防線 →" }).click();
    assert.deepEqual((await save(page)).state, crowdedState);
    record(
      name +
        ": controlled 30-cell fixture supports crowded deployment, recruitment and reload",
    );

    assert.deepEqual(errors, []);
    assert.deepEqual(httpErrors, []);
    record(name + ": WebGL, assets and page console", {
      pageErrors: errors.length,
      httpErrors: httpErrors.length,
    });
    const video = page.video();
    await ctx.close();
    await video.saveAs(dir + name + "-m1.webm");
  }
  // Isolated persistence and browser lifecycle checks, without rendering-based rule hooks.
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(url);
  await page.getByRole("button", { name: "開始 M1", exact: true }).click();
  const p = (await save(page)).state.colonies[0];
  await selectColony(page, p.id);
  await page.getByTestId("apply-mark").click();
  await page.reload();
  await page.getByRole("button", { name: "繼續防線 →" }).click();
  await page.getByRole("button", { name: "撤銷暫停指令" }).click();
  assert.equal((await save(page)).state.energy, 5);
  record("reload preserves paused plan undo");
  await resume(page);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "開啟百科", exact: true }).click();
  assert.equal((await save(page)).paused, true);
  await page.getByRole("searchbox", { name: "搜尋百科" }).fill("Th1");
  await page.getByRole("button", { name: "Th1", exact: true }).click();
  await expect(page.locator(".entry-detail h3")).toHaveText("Th1");
  await page.keyboard.press("Escape");
  record("encyclopedia pauses real time and supports search/return");
  await resume(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });
  assert.equal((await save(page)).paused, true);
  record("hidden page safely pauses instead of catching up damage");
  await page.getByRole("button", { name: "設定與存檔" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出存檔", exact: true }).click();
  await (await download).saveAs(dir + "save-v2.json");
  const before = await page.evaluate((key) => localStorage.getItem(key), key);
  await page.getByLabel("新版存檔檔案").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  assert.equal(
    await page.evaluate((key) => localStorage.getItem(key), key),
    before,
  );
  await page.getByLabel("新版存檔檔案").setInputFiles(dir + "save-v2.json");
  assert.equal((await save(page)).paused, true);
  record("versioned export/import and invalid import preservation");
  await ctx.close();
  await writeFile(
    dir +
      (process.env.DEVICE
        ? `${process.env.DEVICE}-results.json`
        : "browser-results.json"),
    JSON.stringify(
      {
        browser: browser.version(),
        url,
        viewports: Object.fromEntries(
          modes.map((mobile) => [
            mobile ? "mobile" : "desktop",
            mobile ? [360, 800] : [1440, 1000],
          ]),
        ),
        renderer:
          "Headless Chromium WebGL / SwiftShader; not physical mobile GPU",
        results,
      },
      null,
      2,
    ),
  );
  await rm(dir + "raw-tactics", { recursive: true, force: true });
  await rm(dir + "failure.txt", { force: true });
  console.log("Completed tactical browser acceptance");
} catch (e) {
  if (activePage && !activePage.isClosed()) {
    console.error(
      "STATE",
      JSON.stringify(
        await activePage.evaluate(() => ({
          selected: document.querySelector(".tactical-root")?.dataset,
          save: localStorage.getItem("immuminati:tactics:v2"),
        })),
      ),
    );
    await activePage
      .screenshot({ path: dir + "failure.png", timeout: 5000 })
      .catch(() => {});
  }
  await writeFile(dir + "failure.txt", e.stack ?? String(e));
  throw e;
} finally {
  await browser?.close();
  server?.kill();
}
