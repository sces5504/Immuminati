/** Labelled visual fixtures only, not gameplay balance or progression evidence. */
import { chromium, expect } from "@playwright/test";
async function configureM1(page) {
  if (!(await page.getByTestId("deployment-panel").count())) return;
  await page.locator(".t-deploy-custom summary").evaluate((el) => el.click());
  for (const [kind, region] of [
    ["macrophage", "a"],
    ["neutrophil", "b"],
    ["dendritic", "c"],
  ]) {
    await page.getByRole("combobox", { name: "部署防區" }).selectOption(region);
    await page.locator(`[data-deploy="${kind}"]`).evaluate((el) => el.click());
  }
  await page.getByTestId("deployment-confirm").evaluate((el) => el.click());
}
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = new URL(
  "../docs/evidence/tripo-expansion/coverage/",
  import.meta.url,
).pathname;
await mkdir(dir + "raw", { recursive: true });
const browser = await chromium.launch({
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: dir + "raw", size: { width: 1024, height: 712 } },
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(60000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:24862/Immuminati/");
  await p
    .getByRole("button", { name: "開始 M1", exact: true })
    .evaluate((el) => el.click());
  await configureM1(p);
  console.log("DEPLOYED", new Date().toISOString());
  const read = () =>
    p.evaluate(() => JSON.parse(localStorage.getItem("immuminati:tactics:v2")));
  const fixture = await read();
  const kinds = [
    "macrophage",
    "neutrophil",
    "dendritic",
    "helperT",
    "cytotoxicT",
    "bcell",
    "plasma",
    "nk",
    "th1",
    "tfh",
    "th17",
    "pdc",
    "ilc3",
    "treg",
  ];
  const centers = [
    { x: -10, z: -7 },
    { x: 10, z: -6 },
    { x: 0, z: 8 },
  ];
  const template = fixture.state.cells[0];
  fixture.state.cells = kinds.map((kind, i) => {
    const c = centers[i % 3],
      slot = Math.floor(i / 3),
      position = {
        x: c.x + ((slot % 3) - 1) * 3.8,
        z: c.z + (Math.floor(slot / 3) - 0.5) * 4,
      };
    return {
      ...structuredClone(template),
      id: "u" + (900 + i),
      kind,
      region: ["a", "b", "c"][i % 3],
      position,
      path: [],
      order: { type: "guard", point: { ...position } },
    };
  });
  fixture.state.serial = 2000;
  fixture.undo = [];
  fixture.paused = true;
  fixture.state.immunity.antibodies = 2;
  await p
    .getByRole("button", { name: "設定與存檔", exact: true })
    .evaluate((el) => el.click());
  await p.getByLabel("新版存檔檔案").setInputFiles({
    name: "art-only-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await p
    .getByRole("button", { name: "繼續防線 →" })
    .evaluate((el) => el.click());
  await expect(p.getByTestId("tactical-scene")).toHaveAttribute(
    "data-art-cells",
    "14",
    { timeout: 60000 },
  );
  assert.deepEqual(
    (await read()).state.cells.map((c) => c.kind),
    kinds,
  );
  console.log("ALL14 LOADED", new Date().toISOString());
  await p.screenshot({ path: dir + "all14-immune-fixture.png" });
  await p.getByTestId("antibody-tool").evaluate((el) => el.click());
  await expect(p.getByRole("region", { name: "B 細胞與抗體" })).toHaveCount(0);
  await p
    .locator("[data-colony]")
    .first()
    .evaluate((el) => el.click());
  assert.equal((await read()).state.immunity.antibodies, 1);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: dir + "green-antibody-attached-fixture.png" });
  await p.getByTestId("colony-antibody").evaluate((el) => el.click());
  assert.equal((await read()).state.immunity.antibodies, 1);
  const saved = await read();
  await p
    .getByRole("button", { name: "設定與存檔", exact: true })
    .evaluate((el) => el.click());
  await p.getByRole("checkbox", { name: "降低動態效果", exact: true }).check();
  await p
    .getByRole("button", { name: "關閉視窗", exact: true })
    .evaluate((el) => el.click());
  assert.deepEqual((await read()).state, saved.state);
  assert.deepEqual(errors, []);
  await writeFile(
    dir + "results.json",
    JSON.stringify(
      {
        fixture: true,
        notGameplayProof: true,
        kinds,
        antibodyStockBefore: 2,
        antibodyStockAfter: 1,
        repeatedCharge: false,
        reducedMotionPreservesAuthority: true,
        errors,
        date: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  const video = p.video();
  await ctx.close();
  await video.saveAs(dir + "coverage-raw.webm");
  console.log(
    "PASS 14 immune variants, green antibody fixture and reduced motion",
  );
} finally {
  await browser.close();
}
