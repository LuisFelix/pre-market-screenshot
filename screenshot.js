// screenshot.js — screenshots a TradingView screener while signed in.
// Put this file in the root of your repo.
//
// Reuses YOUR existing TradingView login via cookies stored as GitHub secrets.
//   Preferred: TV_COOKIES = the full "cookie:" request header copied from DevTools
//   Fallback:  TV_SESSIONID + TV_SESSIONID_SIGN
const { chromium } = require('playwright');

const TARGET_URL = 'https://www.tradingview.com/screener/uCcZpdpx/';

const stamp = new Date()
  .toLocaleString('sv-SE', { timeZone: 'America/New_York' })
  .replace(' ', '_').replace(/:/g, '').slice(0, 15); // e.g. 2026-11-06_0900

// Strip spaces, newlines and accidental surrounding quotes from pasted secrets
const clean = (v) => (v || '').trim().replace(/^["']|["']$/g, '');

function buildCookies() {
  const toCookie = (name, value) => ({
    name, value, domain: '.tradingview.com', path: '/', secure: true, sameSite: 'Lax',
  });

  const header = clean(process.env.TV_COOKIES).replace(/^cookie:\s*/i, '');
  if (header) {
    return header.split(';').map((p) => p.trim()).filter(Boolean).map((pair) => {
      const i = pair.indexOf('=');
      return toCookie(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    });
  }

  const sid = clean(process.env.TV_SESSIONID);
  const sign = clean(process.env.TV_SESSIONID_SIGN);
  if (sid && sign) return [toCookie('sessionid', sid), toCookie('sessionid_sign', sign)];
  return [];
}

(async () => {
  const cookies = buildCookies();
  if (!cookies.length) {
    console.error('No cookies found. Add a TV_COOKIES secret (or TV_SESSIONID + TV_SESSIONID_SIGN).');
    process.exit(1);
  }
  console.log('Loaded cookies:', cookies.map((c) => c.name).join(', '));
  if (!cookies.some((c) => c.name === 'sessionid')) {
    console.warn('WARNING: no "sessionid" cookie in the secret — you will not be signed in.');
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    timezoneId: 'America/New_York',
    locale: 'en-US',
    // Look like normal Chrome instead of "HeadlessChrome"
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  });
  await context.addCookies(cookies);

  const page = await context.newPage();
  try {
    const res = await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // A saved screener is private: TradingView returns 404 when you're not signed in as its owner
    if (res && res.status() === 404) {
      throw new Error(
        'Got 404 — TradingView does not see you as signed in. ' +
        'Your cookie secret is wrong or expired; copy it again (see instructions).'
      );
    }

    // TradingView keeps a live websocket open, so "networkidle" never fires —
    // wait for the screener table, then give the numbers time to fill in.
    await page.waitForSelector('table', { timeout: 45000 });
    await page.waitForTimeout(8000);

    // Dismiss cookie banner / popups that could cover the table
    await page.getByRole('button', { name: "Don't allow" }).click({ timeout: 3000 }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

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
