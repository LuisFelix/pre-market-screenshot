// screenshot.js — screenshots a TradingView screener while signed in.
// Put this file in the root of your repo.
//
// Instead of typing a password (TradingView shows a CAPTCHA to cloud servers),
// this reuses YOUR existing login by loading your two session cookies,
// stored as GitHub secrets TV_SESSIONID and TV_SESSIONID_SIGN.
const { chromium } = require('playwright');

const TARGET_URL = 'https://www.tradingview.com/screener/uCcZpdpx/';

const stamp = new Date()
  .toLocaleString('sv-SE', { timeZone: 'America/New_York' })
  .replace(' ', '_').replace(/:/g, '').slice(0, 15); // e.g. 2026-11-06_0900

(async () => {
  const { TV_SESSIONID, TV_SESSIONID_SIGN } = process.env;
  if (!TV_SESSIONID || !TV_SESSIONID_SIGN) {
    console.error('Missing TV_SESSIONID / TV_SESSIONID_SIGN secrets');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    timezoneId: 'America/New_York',
    locale: 'en-US',
  });

  const cookie = (name, value) => ({
    name, value, domain: '.tradingview.com', path: '/',
    httpOnly: true, secure: true, sameSite: 'Lax',
  });
  await context.addCookies([
    cookie('sessionid', TV_SESSIONID),
    cookie('sessionid_sign', TV_SESSIONID_SIGN),
  ]);

  const page = await context.newPage();
  try {
    // TradingView keeps a live websocket open, so "networkidle" never fires —
    // wait for the screener table instead, then give the numbers time to fill in.
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('table', { timeout: 45000 });
    await page.waitForTimeout(8000);

    // Close any popups/banners that might cover the table
    await page.keyboard.press('Escape').catch(() => {});

    // Warn if the session didn't take (guest pages show a "Sign in" link)
    const guest = await page.getByText('Sign in', { exact: true }).first().isVisible().catch(() => false);
    if (guest) console.warn('WARNING: looks signed out — your session cookies may have expired.');

    await page.screenshot({ path: `screenshot_${stamp}.png`, fullPage: true });
    console.log(`Saved screenshot_${stamp}.png`);
  } catch (err) {
    await page.screenshot({ path: `FAILED_${stamp}.png`, fullPage: true }).catch(() => {});
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
