import { readFile, readdir, mkdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Build-only browser rendering. No image-generation code ships to reading pages.
export async function rasterizeOg(dir) {
  const svg = await readFile(new URL('../public/og-image.svg', import.meta.url), 'utf8');
  const sans = await readFile(new URL('../public/fonts/geist-latin-wght-normal.woff2', import.meta.url));
  const mono = await readFile(new URL('../public/fonts/geist-mono-latin-wght-normal.woff2', import.meta.url));
  const styles = `
    @font-face { font-family: Geist; src: url(data:font/woff2;base64,${sans.toString('base64')}) format('woff2'); font-weight: 100 900; }
    @font-face { font-family: 'Geist Mono'; src: url(data:font/woff2;base64,${mono.toString('base64')}) format('woff2'); font-weight: 100 900; }
    * { box-sizing: border-box; } html, body { margin: 0; width: 1200px; height: 630px; }
    body { background: #f5f2ea; color: #1f1f28; font-family: Geist; }
    svg { display: block; width: 1200px; height: 630px; }
    .card { height: 630px; padding: 42px 72px; display: flex; flex-direction: column; }
    header { display: flex; gap: 18px; align-items: center; font-size: 24px; font-weight: 600; }
    .tile { background: #ffe278; border-radius: 6px; padding: 0 10px; font-size: 38px; letter-spacing: -1.2px; }
    .content { flex: 1; display: flex; flex-direction: column; justify-content: center; border-block: 1px solid #d6d2c7; margin-block: 30px; padding-block: 20px; }
    .label, footer { font: 20px 'Geist Mono'; color: #54546d; }
    h1 { margin: 14px 0 18px; font-size: 60px; line-height: 1.08; font-weight: 600; letter-spacing: -1.8px; }
    p { margin: 0; font-size: 26px; line-height: 1.4; color: #54546d; }
    footer { display: flex; justify-content: space-between; }
  `;
  const browser = await chromium.launch(process.env.MERMAID_BROWSER_CHANNEL ? { channel: process.env.MERMAID_BROWSER_CHANNEL } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const render = async (body) => {
      await page.setContent(`<!doctype html><html><head><style>${styles}</style></head><body>${body}</body></html>`);
      await page.evaluate(async () => {
        await document.fonts.load('600 60px Geist');
        await document.fonts.load('20px "Geist Mono"');
        await document.fonts.ready;
      });
    };
    let count = 0;
    for (const section of ['notes', 'building']) {
      const files = await readdir(new URL(`${section}/`, dir), { recursive: true });
      await mkdir(new URL(`og/${section}/`, dir), { recursive: true });
      for (const file of files.filter((file) => file.endsWith('/index.html'))) {
        const html = await readFile(new URL(`${section}/${file}`, dir), 'utf8');
        const data = await page.evaluate((html) => {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          return { title: doc.querySelector('h1').textContent, description: doc.querySelector('meta[name="description"]').content };
        }, html);
        await render('<div class="card"><header><span class="tile">dbm.</span>Dexter Brylle</header><div class="content"><span class="label"></span><h1></h1><p></p></div><footer><span>notes · building · profile</span><span>dexterbrylle.com</span></footer></div>');
        await page.evaluate(({ data, section }) => {
          document.querySelector('.label').textContent = section === 'notes' ? 'notes / working notebook' : 'building / personal projects';
          document.querySelector('h1').textContent = data.title;
          document.querySelector('p').textContent = data.description;
        }, { data, section });
        const fits = await page.evaluate(() => document.querySelector('.card').scrollHeight <= 630);
        if (!fits) throw new Error(`OG image content overflows: ${section}/${file}`);
        const slug = file.replace(/\/index\.html$/, '');
        await page.screenshot({ path: fileURLToPath(new URL(`og/${section}/${slug}.png`, dir)) });
        count++;
      }
    }
    // The fallback must remain the site-wide artwork after rendering each card.
    await render(svg);
    await page.screenshot({ path: fileURLToPath(new URL('og-image.png', dir)) });
    console.log(`Generated ${count} page OG images and the site fallback (1200×630).`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await rasterizeOg(new URL('../dist/', import.meta.url));
}
