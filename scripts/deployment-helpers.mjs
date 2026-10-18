/** Use the visible new-game UI; no authority injection for deployment. */
export async function configureM1(page) {
  if (!(await page.getByTestId("deployment-panel").count())) return;
  await page.locator(".t-deploy-custom summary").click();
  for (const [kind, region] of [
    ["macrophage", "a"],
    ["neutrophil", "b"],
    ["dendritic", "c"],
  ]) {
    await page.getByRole("combobox", { name: "部署防區" }).selectOption(region);
    await page.locator(`[data-deploy="${kind}"]`).click();
  }
  await page.getByTestId("deployment-confirm").click();
}
export async function configureCase(page) {
  if (!(await page.getByTestId("deployment-panel").count())) return;
  const id = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("immuminati:tactics:v2")).state.scenario,
  );
  await page.locator("[data-kit]").first().click();
  await page.locator(".t-deploy-custom summary").click();
  const [kind, region] = {
    m1: ["dendritic", "c"],
    m2: ["dendritic", "a"],
    m3: ["macrophage", "b"],
    m4: ["cytotoxicT", "b"],
    m5: ["th17", "a"],
    m6: ["cytotoxicT", "b"],
  }[id];
  await page.getByRole("combobox", { name: "部署防區" }).selectOption(region);
  await page.locator(`[data-deploy="${kind}"]`).click();
  await page.getByTestId("deployment-confirm").click();
}
