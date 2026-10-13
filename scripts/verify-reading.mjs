import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createMarkdownProcessor} from '@astrojs/markdown-remark';
import config from '../astro.config.mjs';

const base = process.env.VERIFY_URL || 'http://127.0.0.1:4321';
const output = process.env.VERIFY_OUTPUT || '/tmp/dexter-reading-qa';
await mkdir(output, {recursive: true});
const processor = await createMarkdownProcessor(config.markdown);
const fixture = await processor.render([
  '```ts',
  '// A real highlighted Markdown code block.',
  'const greeting: string = "Hello, Dexter";',
  'export function greet(name: string) {',
  '  return `${greeting}, ${name}`;',
  '}',
  '```',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[Author writes Markdown] --> B[Validate content schema]',
  '  B --> C[Highlight fenced code] --> D[Render Mermaid diagrams]',
  '  D --> E[Build static website] --> F[Publish final assets]',
  '```',
].join('\n'));
const browser = await chromium.launch(process.env.MERMAID_BROWSER_CHANNEL ? {channel: process.env.MERMAID_BROWSER_CHANNEL} : {});
const report = [];
const errors = [];
try {
  const page = await browser.newPage({colorScheme: 'light', reducedMotion: 'reduce'});
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`${request.url()} ${request.failure()?.errorText}`));
  for (const width of [1440, 390, 1920, 320, 768]) {
    await page.setViewportSize({width, height: 1000});
    for (const route of ['/', '/notes/mermaid-diagrams/']) {
      const response = await page.goto(`${base}${route}`, {waitUntil: 'networkidle'});
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      const fonts = await page.evaluate(() => ({
        family: getComputedStyle(document.body).fontFamily,
        loaded: [...document.fonts].some(font => font.family === 'IBM Plex Sans' && font.status === 'loaded'),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.match(fonts.family, /^"IBM Plex Sans"/);
      assert.equal(fonts.loaded, true, 'self-hosted Sans font actually loaded');
      assert.equal(fonts.overflow, false, `page overflow ${width} ${route}`);
      if (route === '/') {
        if (width === 1440 || width === 390) await page.screenshot({path: `${output}/home-${width}.png`, fullPage: true});
        continue;
      }
      assert.equal(await page.locator('.diagram > svg').count(), 3);
      assert.equal(await page.locator('.contents-rail details').getAttribute('open'), null);
      await page.locator('.contents-rail summary').click();
      await page.locator('.contents-rail a').first().click();
      assert.equal(await page.locator('.contents-rail details').getAttribute('open'), null, 'contents closes after selection');
      await page.evaluate(() => window.scrollTo(0, 0));
      const diagrams = await page.locator('.diagram').evaluateAll(panels => panels.map(panel => {
        const svg = panel.querySelector('svg');
        const scale = svg.getScreenCTM().a;
        return {
          panel: panel.clientWidth,
          overflow: panel.scrollWidth - panel.clientWidth,
          scale,
          textSizes: [...new Set([...svg.querySelectorAll('text, .nodeLabel, .edgeLabel, foreignObject p, foreignObject span')].map(label => parseFloat(getComputedStyle(label).fontSize) * scale))],
          families: [...new Set([...svg.querySelectorAll('text, .nodeLabel, .edgeLabel, foreignObject p, foreignObject span')].map(label => getComputedStyle(label).fontFamily))],
        };
      }));
      for (const diagram of diagrams) {
        assert.ok(Math.abs(diagram.scale - 1) < 0.01, 'diagram keeps natural label scale');
        assert.ok(diagram.textSizes.every(size => size >= 13.9), 'labels are at least 14px');
        assert.ok(diagram.families.every(family => family.includes('IBM Plex Sans')), 'Plex diagram labels');
      }
      if (width >= 1440) assert.ok(diagrams.every(diagram => diagram.overflow <= 1), 'existing diagrams do not scroll on desktop');
      if (width === 1440 || width === 390) {
        await page.screenshot({path: `${output}/diagrams-${width}.png`, fullPage: true});
        await page.locator('.diagram').nth(1).screenshot({path: `${output}/sequence-${width}.png`});
      }
      await page.locator('.prose').evaluate((element, html) => element.insertAdjacentHTML('beforeend', html), fixture.code);
      await page.evaluate(() => document.fonts.ready);
      const code = page.locator('.astro-code');
      assert.equal(await code.count(), 1);
      assert.equal(await code.getAttribute('data-language'), 'ts');
      const colors = [];
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
        const facts = await code.evaluate(element => ({
          font: getComputedStyle(element.querySelector('code')).fontFamily,
          fontLoaded: [...document.fonts].some(font => font.family === 'IBM Plex Mono' && font.status === 'loaded'),
          filter: getComputedStyle(element).filter,
          colors: [...new Set([...element.querySelectorAll('span[style]')].map(span => getComputedStyle(span).color))],
          background: getComputedStyle(element).backgroundColor,
        }));
        assert.match(facts.font, /^"IBM Plex Mono"/);
        assert.equal(facts.fontLoaded, true, 'self-hosted Mono font actually loaded');
        assert.equal(facts.filter, 'none');
        assert.ok(facts.colors.length >= 3, `real ${theme} syntax colors`);
        assert.equal(facts.background, theme === 'dark' ? 'rgb(13, 17, 23)' : 'rgb(255, 255, 255)');
        const luminance = color => color.match(/\d+/g).slice(0, 3).map(Number).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
        const background = luminance(facts.background);
        for (const color of facts.colors) {
          const foreground = luminance(color);
          assert.ok((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05) >= 4.5, `readable ${theme} code color ${color}`);
        }
        colors.push(facts.colors);
        if (width === 1440) await code.screenshot({path: `${output}/code-${theme}.png`});
      }
      assert.notDeepEqual(colors[0], colors[1], 'syntax colors switch with the theme');
      const wide = page.locator('.diagram').last();
      const wideFacts = await wide.evaluate(panel => ({overflow: panel.scrollWidth - panel.clientWidth, scale: panel.querySelector('svg').getScreenCTM().a}));
      assert.ok(Math.abs(wideFacts.scale - 1) < 0.01, 'wide fixture is never zoomed out');
      if (width === 1920) assert.ok(wideFacts.overflow <= 1, 'wide fixture uses the extra viewport width');
      if (width === 1440) await wide.screenshot({path: `${output}/wide-diagram.png`});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'only the diagram may scroll');
      if (width === 390) {
        await wide.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => [...document.querySelectorAll('.diagram')].at(-1).scrollLeft > 0);
        assert.ok(await wide.evaluate(panel => panel.scrollLeft) > 0, 'keyboard panning');
      }
      report.push({width, diagrams, wide: wideFacts});
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({report, errors}, null, 2));
  console.log('PASS: Plex fonts loaded; real code highlighting in both themes; native-size Mermaid labels; desktop diagrams fit; wide diagrams use viewport space; mobile keyboard panning; no page overflow.');
} finally {
  await browser.close();
}
