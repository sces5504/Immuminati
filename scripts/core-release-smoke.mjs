/** Public-release check: real deployment, no authority-state injection. */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
const target =
  process.env.TARGET_URL ?? "https://sces5504.github.io/Immuminati/";
const dir = new URL("../docs/evidence/main-release/", import.meta.url).pathname;
await mkdir(dir, { recursive: true });
const hash = (b) => createHash("sha256").update(b).digest("hex");
const html = await (await fetch(target, { cache: "no-store" })).text();
const local = await readFile(
  new URL("../dist/index.html", import.meta.url),
  "utf8",
);
const references = (s) =>
  [...s.matchAll(/(?:src|href)="([^\"]+\.(?:js|css|svg))"/g)]
    .map((m) => m[1])
    .sort();
assert.deepEqual(
  references(html),
  references(local),
  "Pages must serve the expected production build before testing",
);
const assets = [];
for (const path of [
  ...references(local),
  ...(JSON.parse(
    await readFile(
      new URL("../public/assets/tripo/manifest.json", import.meta.url),
      "utf8",
    ),
  ).assets?.map?.((x) => x.url) ?? []),
]) {
  if (!path) continue;
  const url = new URL(path, new URL(target)),
    r = await fetch(url),
    body = Buffer.from(await r.arrayBuffer());
  assert.equal(r.status, 200);
  const localPath = path.replace(/^\/Immuminati\//, "");
  const expected = await readFile(
    new URL("../dist/" + localPath, import.meta.url),
  );
  assert.equal(hash(body), hash(expected));
  assets.push({
    url: url.href,
    status: r.status,
    bytes: body.length,
    sha256: hash(body),
  });
}
// GLBs are included independently of manifest shape.
const { readdir } = await import("node:fs/promises");
for (const name of (
  await readdir(new URL("../public/assets/tripo/", import.meta.url))
).filter((n) => n.endsWith(".glb"))) {
  const url = new URL("assets/tripo/" + name, target),
    r = await fetch(url),
    body = Buffer.from(await r.arrayBuffer());
  assert.equal(r.status, 200);
  assert.equal(
    hash(body),
    hash(
      await readFile(
        new URL("../public/assets/tripo/" + name, import.meta.url),
      ),
    ),
  );
  assets.push({
    url: url.href,
    status: r.status,
    bytes: body.length,
    sha256: hash(body),
  });
}
await writeFile(
  dir + "public-assets.json",
  JSON.stringify(
    { target, checkedAt: new Date().toISOString(), assets },
    null,
    2,
  ),
);
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const results = [];
try {
  for (const device of ["desktop", "mobile"]) {
    const context = await browser.newContext(
      device === "mobile"
        ? {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          }
        : { viewport: { width: 1280, height: 800 } },
    );
    const page = await context.newPage(),
      errors = [],
      bad = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) bad.push({ url: r.url(), status: r.status() });
    });
    await page.clock.install({ time: new Date("2030-01-01") });
    await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
    await page.goto(target);
    await page.clock.runFor(200);
    const click = (l) => l.evaluate((el) => el.click());
    await click(page.locator(".t-case-cards button").nth(2));
    await click(page.locator(".t-deploy-custom summary"));
    await page.getByRole("combobox", { name: "部署防區" }).selectOption("c");
    await click(page.locator('[data-deploy="dendritic"]'));
    await click(page.getByTestId("deployment-confirm"));
    const scene = page.getByTestId("tactical-scene");
    for (let n = 0; n < 100; n++) {
      await page.clock.runFor(150);
      await new Promise((r) => setTimeout(r, 60));
      if (+(await scene.getAttribute("data-art-assets")) >= 6) break;
    }
    const art = await scene.evaluate((el) => ({ ...el.dataset }));
    assert.equal(art.artMode, "tripo");
    assert.ok(+art.artAssets >= 6, JSON.stringify(art));
    const read = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("immuminati:tactics:v2")),
      );
    const first = await read(),
      host = first.state.cells.find((c) => c.kind === "macrophage").id;
    const load = (s) =>
      s.internal.filter((c) => c.host === host).reduce((n, c) => n + c.load, 0);
    const baseline = load(first.state);
    await click(page.getByTestId("pause-toggle"));
    for (let n = 0; n < 50; n++) {
      await page.clock.fastForward(1000);
      if ((await read()).state.tick >= 80) break;
    }
    await click(page.getByTestId("pause-toggle"));
    const grown = await read();
    assert.ok(grown.state.tick >= 75);
    assert.ok(load(grown.state) > baseline);
    assert.ok(
      grown.state.events.some((e) => e.type === "grow" && e.actor === host),
      "Actual intracellular division event",
    );
    await click(page.locator(`.t-roster [data-cell-id="${host}"]`));
    await page.clock.runFor(500);
    await page.screenshot({ path: dir + `public-${device}-tb.png` });
    const beforeHome = (await read()).state;
    await click(page.getByRole("button", { name: "回主頁", exact: true }));
    assert.equal((await read()).paused, true);
    assert.deepEqual((await read()).state, beforeHome);
    await click(page.getByRole("button", { name: "繼續防線 →" }));
    assert.deepEqual((await read()).state, beforeHome);
    assert.deepEqual(errors, []);
    assert.deepEqual(bad, []);
    results.push({
      device,
      tick: grown.state.tick,
      initialInternal: baseline,
      liveInternal: load(grown.state),
      art,
      errors,
      bad,
      homeResumePreserved: true,
    });
    console.log("PUBLIC PASS", device, JSON.stringify(results.at(-1)));
    await context.close();
  }
  await writeFile(
    dir + "public-smoke.json",
    JSON.stringify(
      {
        target,
        checkedAt: new Date().toISOString(),
        method:
          "Visible fresh TB deployments, real engine steps, no state injection. Public asset bytes match local main build.",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
