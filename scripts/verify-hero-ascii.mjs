// Browser checks for the home hero ASCII video (src/scripts/hero-ascii.ts).
//   npm run build && npm run preview
//   MERMAID_BROWSER_CHANNEL=chrome VERIFY_URL=http://127.0.0.1:4321 node scripts/verify-hero-ascii.mjs
// Screenshots and report.json go to artifacts/hero-ascii/ (not committed).
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const output = new URL('../artifacts/hero-ascii/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const browser = await chromium.launch(process.env.MERMAID_BROWSER_CHANNEL ? { channel: process.env.MERMAID_BROWSER_CHANNEL } : {});
const report = { sizes: {}, runs: [] };
const errors = [];
const VIDEO = /\/video\/hero\.(webm|mp4)$/;

// Times every frame callback the page schedules, so render cost can be read back.
function timing() {
  window.heroCost = [];
  const wrap = callback => function (...args) {
    const start = performance.now();
    try { return callback.apply(this, args); } finally { window.heroCost.push(performance.now() - start); }
  };
  const vfc = HTMLVideoElement.prototype.requestVideoFrameCallback;
  if (vfc) HTMLVideoElement.prototype.requestVideoFrameCallback = function (callback) { return vfc.call(this, wrap(callback)); };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => raf(wrap(callback));
}

/** Canvas facts: inked pixel share, max alpha, alpha behind the h1, dominant ink colour, accent pixels. */
async function canvasFacts(page) {
  return page.evaluate(() => {
    const band = document.querySelector('.band');
    const canvas = band.querySelector('canvas');
    if (!canvas) return null;
    const { data, width, height } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / band.clientWidth;
    const bandBox = band.getBoundingClientRect();
    const h1 = band.querySelector('h1').getBoundingClientRect();
    const hx0 = Math.floor((h1.left - bandBox.left) * scale), hx1 = Math.ceil((h1.right - bandBox.left) * scale);
    const hy0 = Math.floor((h1.top - bandBox.top) * scale), hy1 = Math.ceil((h1.bottom - bandBox.top) * scale);
    let inked = 0, maxAlpha = 0, h1Alpha = 0, accent = 0;
    const colours = new Map();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4, a = data[p + 3];
      if (!a) continue;
      inked++;
      if (a > maxAlpha) maxAlpha = a;
      if (x >= hx0 && x < hx1 && y >= hy0 && y < hy1 && a > h1Alpha) h1Alpha = a;
      // Near-transparent edge pixels un-premultiply to arbitrary colours, so only count solid ones.
      if (a > 40 && data[p] > 230 && data[p + 1] > 200 && data[p + 2] < 160) accent++;
      else if (a > 40) { const key = `${data[p]},${data[p + 1]},${data[p + 2]}`; colours.set(key, (colours.get(key) || 0) + 1); }
    }
    const dominant = [...colours].sort((a, b) => b[1] - a[1])[0]?.[0];
    const style = getComputedStyle(band);
    return {
      inkedShare: inked / (width * height), maxAlpha: maxAlpha / 255, h1Alpha: h1Alpha / 255, accent, dominant,
      ink: style.getPropertyValue('--ink').trim(), bg: style.getPropertyValue('--bg').trim(),
      video: !!band.querySelector('video'), ready: band.classList.contains('grid-ready'),
    };
  });
}

const hex = value => value.match(/\w\w/g).map(h => parseInt(h, 16));
const luminance = rgb => {
  const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);

async function open(options = {}, setup) {
  const context = await browser.newContext({ deviceScaleFactor: 2, ...options });
  await context.addInitScript(timing);
  if (setup) await setup(context);
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => { if (VIDEO.test(new URL(request.url()).pathname)) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(`${options.label}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' && !(options.allowBlocked && /ERR_FAILED|Failed to load resource/.test(message.text()))) errors.push(`${options.label}: ${message.text()}`);
  });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.band.grid-ready canvas', { timeout: 8000 });
  return { context, page, requests };
}

async function setTheme(page, theme) {
  await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
  await page.waitForTimeout(150);
}

async function emptySpot(page) {
  return page.evaluate(() => {
    const box = document.querySelector('.band').getBoundingClientRect();
    return { x: box.left + box.width * 0.88, y: box.top + 18 };
  });
}

try {
  for (const [width, height] of [[375, 812], [1440, 900]]) {
    const label = `${width}`;
    const { context, page, requests } = await open({ viewport: { width, height }, label, colorScheme: 'light' });
    await page.waitForFunction(() => { const v = document.querySelector('.band video'); return v && !v.paused && v.currentTime > 2.5; }, null, { timeout: 10000 });
    const videoFacts = await page.evaluate(() => {
      const v = document.querySelector('.band video');
      const box = v.getBoundingClientRect();
      return { aria: v.getAttribute('aria-hidden'), tabIndex: v.tabIndex, muted: v.muted, loop: v.loop, size: [box.width, box.height], opacity: getComputedStyle(v).opacity, src: v.currentSrc, canvasPointer: getComputedStyle(document.querySelector('.band canvas')).pointerEvents };
    });
    assert.equal(videoFacts.aria, 'true');
    assert.equal(videoFacts.tabIndex, -1);
    assert.equal(videoFacts.opacity, '0');
    assert.equal(videoFacts.canvasPointer, 'none');
    assert.ok(requests.length > 0, 'video requested when motion is allowed');

    const themes = {};
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${output}${width}-${theme}-playing.png` });
      const facts = await canvasFacts(page);
      assert.ok(facts.inkedShare > 0.015, `${width} ${theme}: ASCII covers enough of the band (${facts.inkedShare})`);
      // Canvas readback is un-premultiplied, so allow a couple of levels of rounding.
      assert.ok(facts.dominant.split(',').every((c, i) => Math.abs(c - hex(facts.ink)[i]) <= 3), `${width} ${theme}: glyphs drawn in --ink (${facts.dominant} vs ${facts.ink})`);
      assert.ok(Math.abs(facts.maxAlpha - (width < 760 ? 0.55 : 0.35)) < 0.03, `${width} ${theme}: base alpha ${facts.maxAlpha}`);
      // Worst case behind the headline: a glyph pixel at the highest alpha found under the h1 box.
      const ink = hex(facts.ink), bg = hex(facts.bg);
      const plain = contrast(ink, bg), worst = contrast(ink, mix(bg, ink, facts.h1Alpha));
      assert.ok(worst >= 4.5 * 2, `${width} ${theme}: h1 contrast stays high (${worst.toFixed(2)})`);
      themes[theme] = { ink: facts.ink, dominant: facts.dominant, inkedShare: +facts.inkedShare.toFixed(3), maxAlpha: +facts.maxAlpha.toFixed(3), h1MaxAlpha: +facts.h1Alpha.toFixed(3), h1Contrast: +plain.toFixed(2), h1ContrastWorst: +worst.toFixed(2) };

      // Ripple from an empty spot, captured ~300ms in.
      await page.waitForTimeout(1000);
      const spot = await emptySpot(page);
      await page.mouse.move(spot.x, spot.y);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(300);
      const ripple = await canvasFacts(page);
      await page.screenshot({ path: `${output}${width}-${theme}-ripple.png` });
      assert.ok(ripple.accent > 0, `${width} ${theme}: ripple origin shows the accent square`);
    }
    assert.notEqual(themes.light.dominant, themes.dark.dominant, 'glyphs recolor on theme change');

    // Pressing the h1 starts no ripple, and its text can still be selected.
    await page.waitForTimeout(1000);
    const h1 = await page.locator('h1').boundingBox();
    await page.mouse.move(h1.x + 20, h1.y + h1.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(120);
    assert.equal((await canvasFacts(page)).accent, 0, 'h1 press starts no ripple');
    await page.locator('h1').click({ clickCount: 3 });
    const selected = await page.evaluate(() => getSelection().toString());
    assert.ok(selected.includes('reliable'), 'h1 text selectable');
    await page.evaluate(() => getSelection().removeAllRanges());

    // Per-frame main-thread cost at 4x CPU throttle, light theme.
    await setTheme(page, 'light');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => { window.heroCost = []; });
    await page.waitForTimeout(4000);
    const throttled = await page.evaluate(() => window.heroCost.slice());
    // Include a ripple, which adds per-cell distance checks.
    await page.evaluate(() => { window.heroCost = []; });
    const spot = await emptySpot(page);
    await page.mouse.click(spot.x - 100, spot.y + 40);
    await page.waitForTimeout(900);
    const rippling = await page.evaluate(() => window.heroCost.slice());
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const stats = values => {
      const sorted = [...values].sort((a, b) => a - b);
      const at = q => +sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))].toFixed(2);
      return { frames: sorted.length, median: at(0.5), p95: at(0.95), max: +sorted.at(-1).toFixed(2) };
    };
    const cost = { throttled4x: stats(throttled), throttled4xWithRipple: stats(rippling) };
    const cells = await page.evaluate(() => { const c = document.querySelector('.band canvas'); return { canvas: [c.width, c.height] }; });

    // Offscreen and hidden-tab pause.
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const offscreen = await page.evaluate(async () => {
      const v = document.querySelector('.band video');
      window.heroCost = [];
      await new Promise(r => setTimeout(r, 800));
      return { paused: v.paused, frames: window.heroCost.length };
    });
    assert.equal(offscreen.paused, true, 'video pauses offscreen');
    assert.equal(offscreen.frames, 0, 'no frames drawn offscreen');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => !document.querySelector('.band video').paused, null, { timeout: 3000 });

    // Cleanup across Astro lifecycle events.
    await page.evaluate(() => document.dispatchEvent(new Event('astro:before-swap')));
    assert.equal(await page.locator('.band canvas, .band video').count(), 0, 'dispose removes canvas and video');
    await page.evaluate(() => document.dispatchEvent(new Event('astro:page-load')));
    await page.waitForSelector('.band.grid-ready canvas');
    await page.waitForSelector('.band video');
    assert.equal(await page.locator('.band canvas').count(), 1);
    assert.equal(await page.locator('.band video').count(), 1);

    report.runs.push({ width, video: videoFacts.src, themes, cost, cells, offscreen });
    await context.close();

    // Reduced motion: static frame, no video request, no ripple.
    for (const [name, opts, setup] of [
      ['reduced-motion', { reducedMotion: 'reduce' }],
      ['save-data', {}, context => context.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true } }))],
    ]) {
      const run = await open({ viewport: { width, height }, label: `${width} ${name}`, ...opts }, setup);
      await run.page.waitForTimeout(1500);
      const facts = await canvasFacts(run.page);
      assert.ok(facts.inkedShare > 0.015, `${name}: static ASCII frame drawn`);
      assert.equal(facts.video, false, `${name}: no video element`);
      assert.deepEqual(run.requests, [], `${name}: no video request`);
      const spot = await emptySpot(run.page);
      await run.page.mouse.click(spot.x, spot.y);
      await run.page.waitForTimeout(300);
      assert.equal((await canvasFacts(run.page)).accent, 0, `${name}: no ripple`);
      const frames = await run.page.evaluate(() => window.heroCost.length);
      await run.page.screenshot({ path: `${output}${width}-${name}.png` });
      report.runs.push({ width, mode: name, inkedShare: +facts.inkedShare.toFixed(3), videoRequests: 0, frameCallbacksAfterLoad: frames });
      await run.context.close();
    }

    // Video blocked, and autoplay refused: poster fallback, ripples still work.
    for (const [name, setup] of [
      ['video-blocked', context => context.route(VIDEO, route => route.abort())],
      ['autoplay-blocked', context => context.addInitScript(() => {
        HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
      })],
    ]) {
      const run = await open({ viewport: { width, height }, label: `${width} ${name}`, allowBlocked: true }, setup);
      await run.page.waitForTimeout(1500);
      const facts = await canvasFacts(run.page);
      assert.ok(facts.inkedShare > 0.015, `${name}: poster renders as ASCII`);
      assert.equal(facts.video, false, `${name}: video released`);
      const spot = await emptySpot(run.page);
      await run.page.mouse.click(spot.x, spot.y);
      await run.page.waitForTimeout(300);
      assert.ok((await canvasFacts(run.page)).accent > 0, `${name}: ripple works over the still frame`);
      await run.page.screenshot({ path: `${output}${width}-${name}.png` });
      await run.page.waitForTimeout(800);
      assert.equal((await canvasFacts(run.page)).accent, 0, `${name}: ripple ends`);
      report.runs.push({ width, mode: name, inkedShare: +facts.inkedShare.toFixed(3) });
      await run.context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}report.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log('PASS: playback, themes, glyph colour, h1 contrast, ripple, h1 ignore + selection, 4x-throttled cost, offscreen pause, cleanup, reduced motion, save-data, blocked video, blocked autoplay, no console errors.');
} finally {
  await browser.close();
}
