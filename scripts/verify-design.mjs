import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const output = process.env.VERIFY_OUTPUT || '/tmp/dexter-chart-qa';
const site = JSON.parse(await readFile(new URL('../src/data/site.json', import.meta.url)));
const routes = [...site.nav.map(({ path }) => path), '/notes/mermaid-diagrams/', '/notes/building-with-intent/', '/notes/first-note/', '/notes/security-as-craft/'];
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = [];
const failures = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', (request) => errors.push(`${request.url()} ${request.failure()?.errorText}`));
    for (const route of routes) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await page.evaluate(() => document.fonts.ready);
      const facts = await page.evaluate(() => ({
        title: document.title,
        headings: document.querySelectorAll('h1').length,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        og: document.querySelector('meta[property="og:url"]')?.content,
        scripts: [...document.scripts].filter((script) => script.type !== 'application/ld+json').length,
        graph: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'],
        font: document.fonts.check('500 16px Archivo'),
        svgs: document.querySelectorAll('.prose .diagram > svg').length,
        links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
        active: [...document.querySelectorAll('nav a[aria-current]')].filter((a) => a.checkVisibility()).map((a) => a.textContent.trim()),
      }));
      assert.equal(facts.headings, 1, `${route} one h1`);
      assert.equal(facts.overflow, false, `${route} no overflow at ${width}`);
      assert.equal(facts.canonical, `https://${site.site.domain}${route}`);
      assert.equal(facts.og, facts.canonical);
      assert.equal(facts.scripts, 0, `${route} static reading surface`);
      assert.equal(facts.font, true, 'Archivo loaded');
      for (const href of new Set(facts.links)) {
        await access(resolve('dist', `.${href.split('#')[0]}`, 'index.html'));
      }
      if (route === '/notes/mermaid-diagrams/') assert.equal(facts.svgs, 3, 'three inline Mermaid diagrams');
      if (route.startsWith('/notes/') && route !== '/notes/') {
        const article = facts.graph.find((node) => node['@type'] === 'Article');
        assert.ok(article.datePublished, 'article publish date');
        assert.equal(article.url, facts.canonical);
      }
      const name = route === '/' ? 'home' : route.replaceAll('/', '-').replace(/^-|-$/g, '');
      await page.screenshot({ path: `${output}/${name}-${width}-viewport.png` });
      await page.screenshot({ path: `${output}/${name}-${width}-full.png`, fullPage: true });
      report.push({ route, width, title: facts.title, overflow: facts.overflow, svgCount: facts.svgs, active: facts.active });
    }
    if (width === 390) {
      await page.goto(base);
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').textContent(), site.labels.skip);
      await page.keyboard.press('Enter');
      assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
      await page.locator('.mobile-menu summary').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('.mobile-menu nav a').count(), 7);
      await page.locator('.mobile-menu nav a[href="/stack/"]').click();
      await page.waitForURL('**/stack/');
      assert.equal(await page.locator('h1').textContent(), 'Stack');
      assert.equal(await page.locator('.mobile-menu').getAttribute('open'), null);
      await page.locator('.mobile-menu summary').click();
      await page.screenshot({ path: `${output}/menu-390.png` });
    }
    for (const route of ['/blog/', ...routes.filter((route) => route.startsWith('/notes/') && route !== '/notes/').map((route) => route.replace('/notes/', '/blog/'))]) {
      await page.goto(`${base}${route}`);
      await page.waitForURL(`${base}${route.replace('/blog/', '/notes/')}`);
    }
    failures.push(...errors);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${base}/notes/mermaid-diagrams/`);
  const supportsScroll = await page.evaluate(() => CSS.supports('animation-timeline: scroll()'));
  if (supportsScroll) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.reading-course span')).transform === 'matrix(1, 0, 0, 1, 0, 0)');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.reading-course').isVisible(), false);
  assert.equal(await page.evaluate(() => document.getAnimations().length), 0, 'reduced motion disables animations');
  for (const width of [320, 700, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/stack/', '/notes/mermaid-diagrams/']) {
      await page.goto(`${base}${route}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${route}`);
    }
  }
  const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
  for (const route of routes) assert.ok(sitemap.includes(`https://${site.site.domain}${route}`), `sitemap ${route}`);
  assert.equal(sitemap.includes('/blog/'), false);
  assert.deepEqual(failures, [], 'no browser errors or failed resources');
  await writeFile(`${output}/report.json`, JSON.stringify({ pages: report, browserErrors: failures, checks: ['internal links', 'canonical / OG / Article', 'inline SVG', 'zero client JS', 'Archivo', 'keyboard menu / skip link', 'legacy redirects', 'reading progress', 'reduced motion', '320 / 700 / 768 / 1024 widths', 'sitemap'] }, null, 2));
  console.log(`PASS: ${report.length} page/viewport checks, links, metadata, diagrams, keyboard navigation, redirects, motion, sitemap. Screenshots: ${output}`);
} finally {
  await browser.close();
}
