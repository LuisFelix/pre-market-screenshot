// screenshot.js — logs in, then screenshots a page.
// Put this file in the root of your repo.
const { chromium } = require('playwright');
const fs = require('fs');

// ---- EDIT THESE FOR YOUR SITE ---------------------------------------------
const LOGIN_URL  = 'https://example.com/login';
const TARGET_URL = 'https://example.com/dashboard';
// CSS selectors for the login form. Right-click a field > Inspect to find them.
const USER_FIELD   = 'input[name="username"]';   // or 'input[type="email"]', '#email', ...
const PASS_FIELD   = 'input[name="password"]';   // or 'input[type="password"]'
const SUBMIT_BTN   = 'button[type="submit"]';
// Something that only appears AFTER a successful login (proves you're in):
const LOGGED_IN_MARKER = 'text=Log out';
// ---------------------------------------------------------------------------

const stamp = new Date()
  .toLocaleString('sv-SE', { timeZone: 'America/New_York' })
  .replace(' ', '_').replace(/:/g, '').slice(0, 15); // e.g. 2026-11-06_0900

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Log in
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await page.fill(USER_FIELD, process.env.SITE_USER);
    await page.fill(PASS_FIELD, process.env.SITE_PASS);
    await page.click(SUBMIT_BTN);
    await page.waitForSelector(LOGGED_IN_MARKER, { timeout: 30000 });

    // 2. Go to the page and screenshot it
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000); // let charts/widgets finish rendering
    await page.screenshot({ path: `screenshot_${stamp}.png`, fullPage: true });
    console.log(`Saved screenshot_${stamp}.png`);
  } catch (err) {
    // Save what the browser saw, so you can tell why it failed
    await page.screenshot({ path: `FAILED_${stamp}.png`, fullPage: true }).catch(() => {});
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();