import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { modifiedDate } from '../src/lib/content-dates.mjs';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const origin = 'https://dexterbrylle.com';
const files = await readdir('dist', { recursive: true });
const routes = files.filter((file) => file.endsWith('.html'))
  .map((file) => `/${file.replace(/index\.html$/, '')}`);
const site = JSON.parse(await readFile('src/data/site.json', 'utf8'));
const profile = JSON.parse(await readFile('src/data/profile.json', 'utf8'));
const homelab = JSON.parse(await readFile('src/data/homelab.json', 'utf8'));
const robots = await readFile('dist/robots.txt', 'utf8');
assert.match(robots, /^Allow: \/$/m);
const sitemapPath = new URL(robots.match(/^Sitemap: (.+)$/m)[1]).pathname;
const index = await readFile(`dist${sitemapPath}`, 'utf8');
const sitemapUrls = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const listed = new Map();
for (const url of sitemapUrls) {
  const xml = await readFile(`dist${new URL(url).pathname}`, 'utf8');
  for (const match of xml.matchAll(/<url>(.*?)<\/url>/g)) {
    const loc = match[1].match(/<loc>(.*?)<\/loc>/)[1];
    const lastmod = match[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
    if (lastmod) assert.ok(Number.isFinite(Date.parse(lastmod)), `Invalid lastmod: ${loc}`);
    listed.set(loc, lastmod);
  }
}
const redirects = await readFile('dist/_redirects', 'utf8');
assert.equal(redirects, await readFile('public/_redirects', 'utf8'));
const rules = redirects.trim().split('\n').map((line) => line.trim().split(/\s+/));
for (const route of ['gear', 'stack', 'certifications', 'blog']) {
  for (const suffix of ['', '/']) {
    const rule = rules.find(([from]) => from === `/${route}${suffix}`);
    assert.deepEqual(rule, [`/${route}${suffix}`, route === 'blog' ? '/notes/' : '/about/', '301']);
  }
}
for (const suffix of ['', '/']) assert.deepEqual(rules.find(([from]) => from === `/blog/:slug${suffix}`), [`/blog/:slug${suffix}`, '/notes/:slug/', '301']);
assert.equal(files.some((file) => file.startsWith('blog/')), false, 'No meta-refresh artifacts');
const headers = await readFile('dist/_headers', 'utf8');
for (const path of ['/fonts/*', '/images/*', '/_astro/*']) assert.ok(headers.includes(path));
assert.match(headers, /max-age=31536000, immutable/);
assert.match(headers, /s-maxage=300/);

// Property names and value types used by this graph, checked against schema.org's
// WebSite, Person, WebPage, Article, BreadcrumbList, ListItem and MobileApplication.
const allowed = {
  WebSite: ['url', 'name', 'description'],
  Person: ['name', 'givenName', 'familyName', 'jobTitle', 'url', 'knowsAbout', 'sameAs'],
  WebPage: ['url', 'name', 'description', 'inLanguage', 'breadcrumb', 'mainEntity', 'isPartOf', 'about'],
  Article: ['headline', 'description', 'url', 'image', 'datePublished', 'dateModified', 'keywords', 'inLanguage', 'wordCount', 'author', 'mainEntityOfPage'],
  BreadcrumbList: ['itemListElement'],
  ListItem: ['position', 'name', 'item'],
  MobileApplication: ['name', 'description', 'operatingSystem', 'installUrl'],
};
function validateGraph(schema) {
  assert.equal(schema['@context'], 'https://schema.org');
  const graph = schema['@graph'];
  const ids = new Set(graph.map((node) => node['@id']));
  assert.equal(ids.size, graph.length, 'Unique schema IDs');
  const validate = (node) => {
    if (node['@type']) {
      assert.ok(allowed[node['@type']], `Unknown schema type: ${node['@type']}`);
      for (const [key, value] of Object.entries(node)) {
        assert.ok(key === '@type' || key === '@id' || allowed[node['@type']].includes(key), `Invalid ${node['@type']}.${key}`);
        assert.notEqual(value, null);
        if (['url', 'image', 'installUrl', 'item', '@id'].includes(key)) assert.equal(new URL(value).protocol, 'https:');
        if (['datePublished', 'dateModified'].includes(key)) assert.ok(Number.isFinite(Date.parse(value)));
        if (['position', 'wordCount'].includes(key)) assert.ok(Number.isInteger(value) && value > 0);
        if (['sameAs', 'knowsAbout', 'keywords'].includes(key)) {
          assert.ok(Array.isArray(value) && value.length > 0);
          assert.ok(value.every((item) => typeof item === 'string' && item.length > 0));
        }
        if (Array.isArray(value)) value.filter((item) => typeof item === 'object').forEach(validate);
        else if (typeof value === 'object') validate(value);
      }
    } else {
      assert.deepEqual(Object.keys(node), ['@id']);
      assert.ok(ids.has(node['@id']), `Unresolved schema reference: ${node['@id']}`);
    }
  };
  graph.forEach(validate);
  return graph;
}
const browser = await chromium.launch(process.env.MERMAID_BROWSER_CHANNEL ? { channel: process.env.MERMAID_BROWSER_CHANNEL } : {});
const titles = new Set();
const descriptions = new Set();
let indexable = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const route of routes) {
    const html = await readFile(`dist${route.endsWith('/') ? `${route}index.html` : route}`, 'utf8');
    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)];
    assert.equal(blocks.length, 1, `Built JSON-LD: ${route}`);
    const graph = validateGraph(JSON.parse(blocks[0][1]));
    assert.doesNotMatch(html, /http-equiv="refresh"/i);
    const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    assert.ok([200, ...(route === '/404.html' ? [404] : [])].includes(response.status()), route);
    const facts = await page.evaluate(() => {
      const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content;
      return {
        title: document.title, description: meta('description'), robots: meta('robots'),
        canonical: document.querySelector('link[rel="canonical"]')?.href,
        og: meta('og:url'), image: meta('og:image'), imageAlt: meta('og:image:alt'),
        width: meta('og:image:width'), height: meta('og:image:height'), type: meta('og:type'),
        twitter: meta('twitter:card'), twitterImage: meta('twitter:image'), twitterAlt: meta('twitter:image:alt'),
        h1: document.querySelectorAll('h1').length,
        headings: [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')].map((node) => Number(node.tagName.slice(1))),
        images: [...document.images].every((image) => image.hasAttribute('alt') && image.hasAttribute('width') && image.hasAttribute('height') && image.naturalWidth > 0),
        diagrams: document.querySelectorAll('.prose .diagram > svg').length,
        links: [...document.querySelectorAll('a[href^="/"]')].map((link) => link.getAttribute('href')),
        unnamed: [...document.querySelectorAll('a')].filter((link) => link.getAttribute('aria-hidden') !== 'true' && !(link.getAttribute('aria-label') || link.textContent.replace(/[→←↗↓\s]/g, '') || link.querySelector('img[alt]:not([alt=""])'))).length,
        rss: document.querySelector('link[rel="alternate"][type="application/rss+xml"]')?.getAttribute('href'),
      };
    });
    assert.equal(facts.canonical, `${origin}${route}`);
    assert.equal(facts.og, facts.canonical);
    assert.equal(facts.h1, 1);
    facts.headings.forEach((level, i) => assert.ok(level <= (facts.headings[i - 1] ?? 0) + 1, `Skipped heading: ${route}`));
    assert.ok(facts.title && facts.description, route);
    assert.ok(!titles.has(facts.title), `Duplicate title: ${route}`);
    assert.ok(!descriptions.has(facts.description), `Duplicate description: ${route}`);
    titles.add(facts.title); descriptions.add(facts.description);
    assert.ok(facts.images, `Image alt, dimensions and source: ${route}`);
    assert.equal(facts.unnamed, 0, `Link names: ${route}`);
    assert.equal(facts.rss, '/rss.xml');
    assert.equal(facts.twitter, 'summary_large_image');
    assert.equal(facts.twitterImage, facts.image);
    assert.ok(facts.imageAlt && facts.twitterAlt);
    assert.equal(facts.width, '1200'); assert.equal(facts.height, '630');
    assert.equal(new URL(facts.image).origin, origin);
    const png = await readFile(`dist${new URL(facts.image).pathname}`);
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
    assert.equal((await page.request.get(`${base}${new URL(facts.image).pathname}`)).status(), 200);
    const indexablePage = !facts.robots.includes('noindex');
    assert.equal(listed.has(facts.canonical), indexablePage, `Sitemap indexability: ${route}`);
    if (indexablePage) indexable++;
    if (route === '/404.html' || (route === '/homelab/' && !homelab.items.length)) assert.match(facts.robots, /noindex/);
    for (const href of new Set(facts.links)) {
      assert.doesNotMatch(href, /^\/(gear|stack|certifications|blog)(\/|$)/);
      assert.equal((await page.request.get(new URL(href, base).href)).status(), 200, `Broken link: ${route} -> ${href}`);
    }
    const person = graph.find((node) => node['@type'] === 'Person');
    assert.deepEqual(person.knowsAbout, profile.tools.flatMap((tool) => tool.items.split(', ')));
    assert.deepEqual(person.sameAs, site.contact.filter((link) => link.href.startsWith('https:')).map((link) => link.href));
    const note = route.startsWith('/notes/') && route !== '/notes/';
    const project = route.startsWith('/building/') && route !== '/building/';
    assert.equal(facts.type, note ? 'article' : 'website');
    if (note || project) {
      const section = note ? 'notes' : 'building';
      const slug = route.split('/')[2];
      assert.equal(facts.image, `${origin}/og/${section}/${slug}.png`);
      const crumbs = graph.find((node) => node['@type'] === 'BreadcrumbList');
      assert.deepEqual(crumbs.itemListElement.map((item) => item.item), [`${origin}/`, `${origin}/${section}/`, facts.canonical]);
      assert.deepEqual(crumbs.itemListElement.map((item) => item.position), [1, 2, 3]);
      const gitDate = modifiedDate(`src/content/${note ? 'blog' : 'projects'}/${slug}.md`);
      if (gitDate && indexablePage) assert.equal(Date.parse(listed.get(facts.canonical)), Date.parse(gitDate), `Git lastmod: ${route}`);
    }
    if (note) {
      const article = graph.find((node) => node['@type'] === 'Article');
      assert.equal(article.url, facts.canonical); assert.equal(article.image, facts.image);
      assert.equal(article.inLanguage, 'en');
      assert.ok(article.datePublished && article.dateModified && article.author['@id']);
      assert.ok(article.keywords.length && article.wordCount > 0);
      // Notes can be drafted and last edited before their frontmatter publication date.
      // Preserve both real dates instead of forcing them into an invented chronology.
      assert.ok(await page.locator('.entry-header a[href="/about/"]').count());
    }
    if (project) {
      const app = graph.find((node) => node['@type'] === 'MobileApplication');
      assert.equal(app.name, await page.locator('h1').textContent());
      assert.equal(app.description, facts.description); assert.equal(app.operatingSystem, 'iOS');
      assert.equal(new URL(app.installUrl).hostname, 'apps.apple.com');
      assert.ok(await page.locator(`a[href="${app.installUrl}"]`).count());
    }
    if (route === '/notes/mermaid-diagrams/') assert.equal(facts.diagrams, 3);
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow: ${route} at ${width}`);
    }
  }
  assert.equal(listed.size, indexable, 'Exact sitemap membership');
  const feedResponse = await page.request.get(`${base}/rss.xml`);
  assert.equal(feedResponse.status(), 200);
  assert.match(feedResponse.headers()['content-type'], /xml/);
  const feed = await feedResponse.text();
  const feedLinks = await page.evaluate((feed) => {
    const xml = new DOMParser().parseFromString(feed, 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Invalid RSS XML');
    return [...xml.querySelectorAll('item > link')].map((node) => node.textContent);
  }, feed);
  assert.deepEqual(new Set(feedLinks), new Set(routes.filter((route) => route.startsWith('/notes/') && route !== '/notes/' && listed.has(`${origin}${route}`)).map((route) => `${origin}${route}`)));
  await page.goto(`${base}/notes/`);
  assert.equal(await page.locator('main a[href="/rss.xml"]').count(), 1);
  console.log(`SEO verification passed: ${routes.length} HTML routes, ${indexable} indexable pages; redirects, cache configuration, metadata, PNG dimensions, RSS, schema types/properties/references, headings, links, images, sitemap dates and mobile overflow checked.`);
  console.log('Cloudflare _redirects and _headers are checked as built artifacts. Astro preview does not apply edge rules; confirm deployed HTTP responses after merge.');
} finally {
  await browser.close();
}
