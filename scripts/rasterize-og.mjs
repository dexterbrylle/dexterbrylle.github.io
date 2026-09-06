// Rasterize public/og-image.svg -> public/og-image.png (1200x630) for social scrapers.
// SVG is not accepted as an og:image by Facebook/X/LinkedIn/WhatsApp, so we bake the
// route-chart artwork into a PNG. We render in a real browser with the self-hosted
// Archivo font loaded so the type matches the live site (a plain SVG rasterizer would
// fall back to a default sans).
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const svg = await readFile(new URL('../public/og-image.svg', import.meta.url), 'utf8');
const font = await readFile(new URL('../public/fonts/archivo-latin.woff2', import.meta.url));

const html = `<!doctype html>
<html>
<head>
<style>
  @font-face {
    font-family: "Archivo";
    src: url(data:font/woff2;base64,${font.toString('base64')}) format("woff2");
    font-weight: 400 700;
    font-display: block;
  }
  html, body { margin: 0; padding: 0; }
  svg { display: block; width: 1200px; height: 630px; }
</style>
</head>
<body>${svg}</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('svg').screenshot({ path: new URL('../public/og-image.png', import.meta.url).pathname });
} finally {
  await browser.close();
}
console.log('Wrote public/og-image.png (1200x630)');
