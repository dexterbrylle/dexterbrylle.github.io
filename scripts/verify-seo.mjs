import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const origin = 'https://dexterbrylle.com';
const files = await readdir('dist', { recursive: true });
const routes = files.filter((file) => file === 'index.html' || file.endsWith('/index.html'))
  .map((file) => `/${file.replace(/index\.html$/, '')}`);
const robots = await readFile('dist/robots.txt', 'utf8');
const sitemapPath = new URL(robots.match(/^Sitemap: (.+)$/m)[1]).pathname;
const index = await readFile(`dist${sitemapPath}`, 'utf8');
const sitemapUrls = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const listed = new Set();
for (const url of sitemapUrls) {
  const xml = await readFile(`dist${new URL(url).pathname}`, 'utf8');
  for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) listed.add(match[1]);
}
const browser = await chromium.launch(process.env.MERMAID_BROWSER_CHANNEL ? { channel: process.env.MERMAID_BROWSER_CHANNEL } : {});
const titles = new Set();
const descriptions = new Set();
let indexable = 0;
try {
  const page = await browser.newPage();
  for (const route of routes) {
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, route);
    // Legacy routes immediately refresh to their canonical destination.
    if (route.startsWith('/blog/')) {
      const html = await readFile(`dist${route}index.html`, 'utf8');
      assert.match(html, /content="noindex"/);
      assert.equal(listed.has(`${origin}${route}`), false);
      continue;
    }
    const facts = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      robots: document.querySelector('meta[name="robots"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      og: document.querySelector('meta[property="og:url"]')?.content,
      h1: document.querySelectorAll('h1').length,
      graph: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'],
      images: [...document.images].every((image) => image.hasAttribute('alt')),
      diagrams: document.querySelectorAll('.prose .diagram > svg').length,
      links: [...document.querySelectorAll('a[href^="/"]')].map((link) => link.getAttribute('href')),
    }));
    assert.equal(facts.canonical, `${origin}${route}`);
    assert.equal(facts.og, facts.canonical);
    assert.equal(facts.h1, 1);
    assert.ok(facts.title && facts.description, route);
    assert.ok(!titles.has(facts.title), `Duplicate title: ${route}`);
    assert.ok(!descriptions.has(facts.description), `Duplicate description: ${route}`);
    titles.add(facts.title);
    descriptions.add(facts.description);
    assert.ok(facts.images, `Missing image alt: ${route}`);
    const indexablePage = !facts.robots.includes('noindex');
    assert.equal(listed.has(facts.canonical), indexablePage, `Sitemap indexability: ${route}`);
    if (indexablePage) indexable++;
    for (const href of new Set(facts.links)) {
      const target = new URL(href, base);
      const result = await page.request.get(target.href);
      assert.equal(result.status(), 200, `Broken internal link: ${route} -> ${href}`);
    }
    if (route.startsWith('/notes/') && route !== '/notes/') {
      const article = facts.graph.find((node) => node['@type'] === 'Article');
      assert.equal(article.url, facts.canonical);
      assert.ok(article.datePublished && article.author['@id']);
      assert.ok(await page.locator('.entry-header a[href="/about/"]').count());
    }
    if (route === '/notes/mermaid-diagrams/') assert.equal(facts.diagrams, 3, 'Mermaid diagrams rendered');
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow: ${route} at ${width}`);
    }
  }
  assert.equal(listed.size, indexable, 'No unexpected URLs in sitemap');
  console.log(`SEO verification passed: ${routes.length} routes, ${indexable} indexable pages; sitemap discovery, metadata, rendered schema, internal links, and mobile overflow checked.`);
} finally {
  await browser.close();
}
