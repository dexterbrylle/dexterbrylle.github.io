import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import ts from 'typescript';

const target = 'src/pages/notes/[...slug].astro';
const sources = {
  before: execFileSync('git', ['show', `HEAD:${target}`], { encoding: 'utf8' }),
  after: await readFile(target, 'utf8'),
};
const browser = await chromium.launch({ channel: process.env.VERIFY_BROWSER_CHANNEL || 'chrome' });
try {
  for (const [version, source] of Object.entries(sources)) {
    const script = source.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, 'Article must contain its contents-navigation script');
    const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022 });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.setContent(`<aside class="contents-rail"><details open><nav>${[1, 2, 3, 4].map(i => `<a href="#section-${i}">Section ${i}</a>`).join('')}</nav></details></aside>${[1, 2, 3, 4].map(i => `<h2 id="section-${i}">Section ${i}</h2><div style="height:900px"></div>`).join('')}`);
    await page.evaluate(() => {
      window.geometryReads = 0;
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (...args) {
        window.geometryReads++;
        return original.apply(this, args);
      };
    });
    await page.addScriptTag({ content: code });
    const reads = await page.evaluate(async () => {
      window.geometryReads = 0;
      for (let i = 0; i < 100; i++) window.dispatchEvent(new Event('scroll'));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.geometryReads;
    });
    await page.evaluate(async () => {
      document.querySelector('#section-4').scrollIntoView();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    assert.equal(await page.locator('.contents-rail a[aria-current]').getAttribute('href'), '#section-4');
    if (version === 'after') assert.equal(reads, 4, 'Scroll burst must measure four headings only once per frame');
    console.log(`${version}: ${reads} geometry reads / 100-event burst; script ${Buffer.byteLength(code)} B (${gzipSync(code).length} B gzip); last section tracking passes`);
    await page.close();
  }
  for (const asset of ['public/styles/global.css', 'public/styles/motion.css']) {
    let before;
    try { before = execFileSync('git', ['show', `HEAD:${asset}`], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { before = Buffer.alloc(0); }
    const after = await readFile(asset);
    console.log(`${asset}: ${before.length} → ${after.length} B; gzip ${gzipSync(before).length} → ${gzipSync(after).length} B`);
  }
} finally {
  await browser.close();
}
