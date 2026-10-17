// Real UI verification of each case's internal compartment. No fixture state injection.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
const dir = new URL(
  process.env.EVIDENCE_DIR ?? "../docs/evidence/campaign-compartments/",
  import.meta.url,
).pathname;
await mkdir(dir, { recursive: true });
const target = process.env.TARGET_URL ?? "http://127.0.0.1:4188/Immuminati/";
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
        "4188",
        "--strictPort",
      ],
      { stdio: "pipe" },
    );
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const checks = [];
try {
  for (let i = 0; i < 80; i++) {
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
    for (const id of ["m1", "m2", "m3", "m4", "m5", "m6"]) {
      if (process.env.CASE && process.env.CASE !== id) continue;
      const ctx = await browser.newContext({
          viewport,
          isMobile: device === "mobile",
          hasTouch: device === "mobile",
        }),
        p = await ctx.newPage();
      p.setDefaultTimeout(30000);
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(target);
      await p
        .locator(".t-case-cards button")
        .nth(Number(id.slice(1)) - 1)
        .click();
      await p.getByTestId("speed-toggle").click();
      await p.getByTestId("pause-toggle").click();
      await expect
        .poll(
          async () =>
            Number(await p.locator(".tactical-root").getAttribute("data-tick")),
          { timeout: 45000 },
        )
        .toBeGreaterThanOrEqual(50);
      await p.getByTestId("pause-toggle").click();
      const saved = await p.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
      const state = saved.state;
      const h =
        state.hosts.find(
          (h) => h.load > 0 && h.infection?.phase === "latent",
        ) ?? state.hosts.find((h) => h.load > 0 && h.infection);
      const cargo = state.internal.find((i) => i.load > 0);
      assert.ok(
        h || cargo,
        `${id} has an actual internal source after live play`,
      );
      await p.getByTestId("anatomy-panel").click();
      const button = h
        ? p.locator(`[data-tissue-id="${h.id}"]`)
        : p.locator(`[data-inspect-cell="${cargo.host}"]`);
      await button.scrollIntoViewIfNeeded();
      await button.click();
      const cut = p.getByTestId("cell-cutaway");
      await cut.scrollIntoViewIfNeeded();
      await expect(cut).toHaveAttribute(
        "data-compartment",
        h ? h.infection.compartment : cargo.compartment,
      );
      const displayed = Number(await cut.getAttribute("data-internal-load"));
      const expected = h
        ? h.load
        : state.internal
            .filter((i) => i.host === cargo.host)
            .reduce((n, i) => n + i.load, 0);
      assert.equal(displayed, expected);
      assert.ok(displayed > 0);
      await p.screenshot({ path: dir + `${device}-${id}-cutaway.png` });
      const healthy = state.hosts.find((h) => !h.infection && !h.apoptoticAt);
      assert.ok(healthy);
      const normal = p.locator(`[data-tissue-id="${healthy.id}"]`);
      await normal.scrollIntoViewIfNeeded();
      await normal.click();
      await expect(cut).toHaveAttribute("data-compartment", "none");
      await expect(cut).toHaveAttribute("data-internal-load", "0");
      await p.getByRole("button", { name: "關閉視窗", exact: true }).click();
      assert.deepEqual(
        (
          await p.evaluate(() =>
            JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
          )
        ).state,
        state,
      );
      assert.deepEqual(errors, []);
      checks.push({
        device,
        case: id,
        tick: state.tick,
        compartment: h ? h.infection.compartment : cargo.compartment,
        phase: h?.infection.phase ?? cargo.stage,
        load: expected,
        healthy: healthy.id,
        passed: true,
      });
      console.log("PASS", JSON.stringify(checks.at(-1)));
      await ctx.close();
      await writeFile(
        dir + "results.json",
        JSON.stringify(
          { target, date: new Date().toISOString(), checks },
          null,
          2,
        ),
      );
    }
  }
} finally {
  await browser.close();
  server?.kill();
}
