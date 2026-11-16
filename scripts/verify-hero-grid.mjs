import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const output = new URL('../artifacts/hero-grid/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.MERMAID_BROWSER_CHANNEL || 'chrome' });
const report = [];
const errors = [];
try {
  for (const [width, height] of [[1440, 1000], [375, 812]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
    await context.addInitScript(() => {
      window.heroQA = { frames: [], shifts: 0 };
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.heroQA.shifts += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
      const proto = CanvasRenderingContext2D.prototype;
      const clear = proto.clearRect, fill = proto.fillRect, stroke = proto.stroke, move = proto.moveTo;
      proto.clearRect = function (...args) {
        if (this.canvas.closest('.band')) window.heroQA.frames.push({ time: performance.now(), marks: [], cross: null });
        return clear.apply(this, args);
      };
      proto.fillRect = function (...args) {
        if (this.canvas.closest('.band')) window.heroQA.frames.at(-1)?.marks.push({ x: args[0] + args[2] / 2, y: args[1] + args[3] / 2, size: args[2], color: this.fillStyle, alpha: this.globalAlpha });
        return fill.apply(this, args);
      };
      proto.moveTo = function (x, y) {
        if (this.canvas.closest('.band')) {
          const frame = window.heroQA.frames.at(-1);
          frame.crossNode ||= { x: x + 3, y: y + 3 };
        }
        return move.call(this, x, y);
      };
      proto.stroke = function (...args) {
        if (this.canvas.closest('.band')) window.heroQA.frames.at(-1).cross = true;
        return stroke.apply(this, args);
      };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base);
    await page.waitForSelector('.band.grid-ready canvas');
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${output}/after-${width}-${theme}.png` });
      const facts = await page.evaluate(() => {
        const canvas = document.querySelector('.band canvas');
        const band = canvas.parentElement;
        return { count: band.querySelectorAll('canvas').length, width: band.clientWidth, pixelWidth: canvas.width, pointer: getComputedStyle(canvas).pointerEvents, aria: canvas.getAttribute('aria-hidden'), frame: window.heroQA.frames.at(-1), ink: getComputedStyle(band).getPropertyValue('--ink').trim() };
      });
      assert.equal(facts.count, 1);
      assert.equal(facts.pixelWidth, facts.width * 2);
      assert.equal(facts.pointer, 'none');
      assert.equal(facts.aria, 'true');
      assert.equal(facts.frame.marks.filter(mark => mark.alpha > 0.5).length <= (width < 760 ? 4 : 8), true);
      assert.ok(facts.frame.marks.every(mark => Math.abs(((mark.x - facts.width / 2) % 16)) < 0.01 && mark.y % 16 === 8), 'all packets align to CSS grid');
      report.push({ width, theme, ink: facts.ink, canvasPixels: facts.pixelWidth });
    }
    // Observe a complete natural failure/recovery cycle, without changing production timing.
    await page.waitForFunction(() => window.heroQA.frames.some(frame => frame.cross), { timeout: 15000 });
    await page.screenshot({ path: `${output}/failure-${width}.png` });
    await page.waitForFunction(() => window.heroQA.frames.some(frame => frame.marks.some(mark => mark.color === '#ffe278')), { timeout: 6000 });
    await page.screenshot({ path: `${output}/recovery-${width}.png` });
    const cycle = await page.evaluate(() => {
      const frames = window.heroQA.frames;
      const failed = frames.filter(frame => frame.cross);
      const yellow = frames.filter(frame => frame.marks.some(mark => mark.color === '#ffe278'));
      const active = frames.filter(frame => frame.marks.length);
      const changes = active.filter((frame, i) => i && JSON.stringify(frame.marks) !== JSON.stringify(active[i - 1].marks));
      const blocked = failed[0].crossNode;
      const approach = frames.filter(frame => frame.time >= failed[0].time - 1000 && frame.time <= yellow[0].time);
      const tracks = Array.from({ length: innerWidth < 760 ? 4 : 8 }, (_, index) => approach.map(frame => frame.marks[index * 4]).filter(Boolean));
      const detours = tracks.filter(track => {
        const near = track.filter(node => Math.abs(node.x - blocked.x) <= 96 && Math.abs(node.y - blocked.y) <= 96);
        return near.some(node => node.x === blocked.x && node.y !== blocked.y)
          && near.some(node => node.y === blocked.y && node.x !== blocked.x);
      }).length;
      const blockedVisits = failed.flatMap(frame => frame.marks.filter((_, index) => index % 4 === 0)).filter(node => node.x === blocked.x && node.y === blocked.y).length;
      return { detours, blockedVisits, failedFrames: failed.length, yellowFrames: yellow.length, maxYellow: Math.max(...yellow.map(frame => frame.marks.filter(mark => mark.color === '#ffe278').length)), duration: yellow[0].time - failed[0].time, minFrame: Math.min(...frames.slice(4).map((frame, i) => frame.time - frames[i + 3].time)), changes: changes.length, shifts: window.heroQA.shifts };
    });
    assert.ok(cycle.detours > 0, 'a packet visibly detours beside the failed node');
    assert.equal(cycle.blockedVisits, 0, 'packets never enter the failed node');
    assert.equal(cycle.maxYellow, 1, 'one recovery element');
    assert.ok(cycle.duration >= 2900 && cycle.duration < 4300, 'recovery after 3–4 seconds');
    assert.equal(cycle.shifts, 0);
    report.push({ width, cycle });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.band canvas').count(), 0);
    const staticCount = await page.evaluate(() => window.heroQA.frames.length);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.heroQA.frames.length), staticCount);
    await page.screenshot({ path: `${output}/reduced-${width}.png` });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForSelector('.band canvas');
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    // Real footer switch must update the cached canvas while paused.
    await page.locator('[data-mode="light"]').click();
    await page.waitForTimeout(500);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const before = await cdp.send('Performance.getMetrics');
    const paused = await page.evaluate(() => window.heroQA.frames.length);
    await page.waitForTimeout(1500);
    const after = await cdp.send('Performance.getMetrics');
    assert.equal(await page.evaluate(() => window.heroQA.frames.length), paused, 'no offscreen draws');
    const metric = (metrics, name) => metrics.metrics.find(metric => metric.name === name).value;
    report.push({ width, offscreenDraws: 0, offscreenTaskSeconds: metric(after, 'TaskDuration') - metric(before, 'TaskDuration') });
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(count => window.heroQA.frames.length > count, paused));
    // Exercise Astro lifecycle hooks even though this site currently uses cross-document transitions.
    await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
    assert.equal(await page.locator('.band canvas').count(), 0);
    await page.evaluate(() => { document.dispatchEvent(new Event('astro:page-load')); document.dispatchEvent(new Event('astro:page-load')); });
    await page.waitForSelector('.band canvas');
    assert.equal(await page.locator('.band canvas').count(), 1);
    await page.goto(`${base}/notes/`);
    assert.equal(await page.locator('.band canvas').count(), 0);
    await page.goBack();
    await page.waitForSelector('.band canvas');
    assert.equal(await page.locator('.band canvas').count(), 1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.band canvas').count(), 0, 'no animation on reduced-motion load');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({ report, errors }, null, 2));
  console.log('PASS: desktop/mobile themes, grid alignment, failure/recovery, single accent, CLS 0, reduced motion, footer theme switch, offscreen pause, navigation cleanup, no console errors.');
} finally {
  await browser.close();
}
