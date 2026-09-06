// DOM/CSS measurement probe — design QA without vision. Prints compact facts per route/width.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const site = JSON.parse(await readFile(new URL('../src/data/site.json', import.meta.url)));
const routes = ['/', ...site.nav.slice(1).map(({ path }) => path), '/notes/building-with-intent/'];
const lum = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return ((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })).newPage();
    console.log(`\n=== width ${width} ===`);
    for (const route of routes) {
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const m = await page.evaluate(() => {
        const gs = (el, p) => el && getComputedStyle(el)[p];
        const first = (sel, p) => { const el = document.querySelector(sel); return gs(el, p); };
        const rect = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), top: Math.round(r.top + scrollY), h: Math.round(r.height) }; };
        const shell = document.querySelector('.page-shell').getBoundingClientRect();
        const header = document.querySelector('.site-header');
        const h1 = document.querySelector('h1');
        const h1r = h1.getBoundingClientRect();
        const body = document.body;
        const h2 = document.querySelector('h2, .section-heading h2');
        const postMeta = document.querySelector('.post-meta time') || document.querySelector('time');
        const navLinks = [...document.querySelectorAll('header nav a')];
        return {
          page: Math.round(document.documentElement.scrollHeight),
          shell: { x: Math.round(shell.x), w: Math.round(shell.width) },
          headerH: Math.round(header.getBoundingClientRect().height),
          h1: { y: Math.round(h1r.top), size: gs(h1, 'fontSize'), wt: gs(h1, 'fontWeight'), lh: gs(h1, 'lineHeight'), ls: gs(h1, 'letterSpacing') },
          h2size: h2 ? gs(h2, 'fontSize') : null,
          bodySize: first('.profile, .entry, .page-heading > p, .inventory-card p', 'fontSize'),
          bodyColor: first('.profile, .entry, .page-heading > p, .inventory-card p', 'color'),
          muted: gs(document.querySelector('.kicker, .post-meta, .item-list li'), 'color'),
          ground: gs(document.querySelector('.intro, .page-shell'), 'backgroundColor') || gs(document.body, 'backgroundColor'),
          surface: gs(document.querySelector('.empty-state, .inventory-card, .item-list'), 'backgroundColor'),
          accent: gs(document.querySelector('nav a[aria-current]'), 'color') || gs(document.querySelector('a'), 'color'),
          navN: navLinks.length,
          postMeta: postMeta ? { size: gs(postMeta, 'fontSize'), gap: gs(postMeta.closest('.post-meta, .entry-header'), 'gap') } : null,
          proseLh: first('.prose p', 'lineHeight'),
          empty: document.querySelector('.empty-state') ? document.querySelector('.empty-state h2, .empty-state h3')?.textContent.trim().slice(0, 40) : null,
          statusUnknown: document.querySelector('.status-label')?.textContent.trim() ?? null,
        };
      });
      console.log(`\n${route}`);
      console.log(' ' + JSON.stringify(m).replaceAll('"', '').replaceAll(',', ' · '));
      if (m.bodyColor && m.ground && m.bodyColor.startsWith('#') && m.ground.startsWith('#')) console.log(`  body-vs-ground contrast: ${contrast(m.bodyColor, m.ground)}`);
      if (m.muted && m.ground && m.muted.startsWith('#') && m.ground.startsWith('#')) console.log(`  muted-vs-ground contrast: ${contrast(m.muted, m.ground)}`);
    }
    await (await browser.contexts().at(-1)).close();
  }
} finally { await browser.close(); }
