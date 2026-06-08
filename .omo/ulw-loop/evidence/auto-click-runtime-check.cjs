const { chromium } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const logs = [];
  const requests = [];
  page.on("console", (msg) => logs.push({ type: msg.type(), text: msg.text() }));
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/v1/")) requests.push({ method: req.method(), url });
  });
  page.on("response", async (res) => {
    const url = res.url();
    if (url.includes("/v1/")) {
      let body = "";
      try { body = (await res.text()).slice(0, 500); } catch {}
      requests.push({ response: res.status(), url, body });
    }
  });
  await page.goto("http://127.0.0.1:32110/sourcing/admin.html", { waitUntil: "networkidle", timeout: 30000 });
  const button = page.getByTestId("auto-collection-start");
  await button.scrollIntoViewIfNeeded();
  const before = {
    text: await button.textContent(),
    disabled: await button.isDisabled(),
    visible: await button.isVisible(),
    autoPanel: await page.locator('text=자동 카테고리 순회').first().isVisible().catch(() => false),
  };
  await button.click({ timeout: 10000 });
  await page.waitForTimeout(3000);
  const after = {
    buttonText: await button.textContent().catch(e => "ERR:" + e.message),
    disabled: await button.isDisabled().catch(e => "ERR:" + e.message),
    statusText: await page.locator('[data-testid="auto-collection-status"]').textContent().catch(e => null),
    bodySnippet: (await page.locator('body').innerText()).slice(0, 2500),
  };
  console.log(JSON.stringify({ before, after, requests, logs }, null, 2));
  await browser.close();
})().catch((err) => { console.error(err); process.exit(1); });
