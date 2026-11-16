import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel: 'chrome'});
try {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, recordVideo: {dir: 'artifacts/hero-grid/raw-video', size: {width: 1440, height: 1000}}});
  await context.addInitScript(() => {
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.canvas.closest('.band') && !window.firstFailure) window.firstFailure = performance.now();
      return stroke.apply(this, args);
    };
  });
  const page = await context.newPage();
  await page.goto(process.env.VERIFY_URL || 'http://127.0.0.1:4321');
  await page.waitForFunction(() => window.firstFailure);
  const start = await page.evaluate(() => window.firstFailure / 1000 - 0.4);
  await page.waitForTimeout(4700);
  const video = page.video();
  await context.close();
  await writeFile('artifacts/hero-grid/video.json', JSON.stringify({path: await video.path(), start}));
} finally { await browser.close(); }
