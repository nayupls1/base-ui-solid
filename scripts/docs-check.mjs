// Headless smoke test for the docs site. Usage: node scripts/docs-check.mjs <baseUrl> [slug...]
// Never opens a visible window (headless Chromium).
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3010';
const slugs = process.argv.slice(3);
const shotDir = process.env.SHOT_DIR ?? '/tmp/docs-shots';
import fs from 'node:fs';
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    errors.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}\n${err.stack}`));

const list = slugs.length ? slugs : ['accordion'];
for (const slug of list) {
  errors.length = 0;
  await page.goto(`${base}/solid/components/${slug}`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(2500);
  const h1 = await page.locator('main h1').first().textContent().catch(() => null);
  const demos = await page.locator('.DemoRoot').count();
  const refs = await page.locator('.ReferenceAccordionRoot').count();
  await page.screenshot({ path: `${shotDir}/${slug}.png`, fullPage: false });
  console.log(`${slug}: h1=${JSON.stringify(h1)} demos=${demos} referenceTables=${refs}`);
  for (const e of errors) console.log('  ' + e.slice(0, 600));
}
await browser.close();
