# dexterbrylle.com

Personal notebook and projects built with [Astro](https://astro.build).

**Live:** https://dexterbrylle.com

---

## What This Is

A fast, minimal personal site featuring:

- **Homepage** — Intro, recent notes, and personal projects
- **Notes** — Markdown writing with Mermaid diagram support
- **Building** — Fillo, Eave, and space for future projects and experiments
- **Profile** — Bio, career, and contact information
- **Homelab** — Infrastructure experiments and an inventory awaiting documentation

Built as a static site. Small scripts handle theme switching, navigation, and article contents. Mermaid diagrams render to SVG at build time. The design ("Hairline", see `DESIGN.md`) uses Geist and Geist Mono, one sunflower accent, hairline rules, light and dark themes, and CSS-only view transitions.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Astro 7 (Node 24, see `.nvmrc`) |
| Content | Markdown + Content Collections |
| Styling | Plain CSS with CSS variables |
| Diagrams | Mermaid (server-side rendered) |
| Host | Cloudflare Pages |

---

## Writing

Blog posts live in `src/content/blog/`. They're Markdown files with YAML frontmatter:

```markdown
---
title: "Post Title"
description: "A short summary of the note."
pubDate: 2026-10-13
tags: ["software"]
---

Your content here.
```

Optionally set `seoTitle` for a more specific search title while keeping the visible note heading. Set `updatedDate` to a real revision date. Otherwise Article `dateModified` uses the last Git commit touching the note, with `pubDate` as a fallback when Git history is unavailable. Sitemap `lastmod` uses Git dates and is omitted without history. Builds never substitute the current time.

Mermaid diagrams work inline:

````markdown
```mermaid
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
```
````

---

## Projects

Project entries live in `src/content/projects/`. Each Markdown file becomes a page at `/building/<filename>/` and appears in the project index. The first two entries, sorted by `order`, also appear on the homepage.

```markdown
---
title: "Project name"
description: "What it does and who it helps."
status: "Experiment"
order: 3
tags: ["Web"]
links:
  - label: "Visit the project"
    href: "https://example.com/"
---

Write about the project here.
```

Optionally add `seoTitle` for a more specific search title while keeping the visible project name.

Statuses are `Live`, `Coming soon`, `Experiment`, and `Paused`. Optionally add an `icon` path and a `preview` object with `src` and `alt` fields. Put images in `public/images/projects/`; use a path such as `/images/projects/example.webp` in frontmatter.

Notes remain in `src/content/blog/` and publish at `/notes/<filename>/`. The existing `/blog/` URLs redirect to Notes. To publish either kind of entry, add the Markdown file and push to `main`.

For local development and builds on a machine with Google Chrome but no bundled Playwright browser:

```sh
MERMAID_BROWSER_CHANNEL=chrome npm run dev
MERMAID_BROWSER_CHANNEL=chrome npm run build
```

Geist and Geist Mono are self-hosted, so the site makes no Google Fonts requests. Fenced code blocks with a language label, such as `js`, `ts`, `json`, or `sh`, get syntax highlighting in both themes. Mermaid labels use Geist at their natural size; diagram articles use the available width without widening the prose. On smaller screens, focus a diagram and use the arrow keys to pan.

To verify typography, highlighting, and diagram layout against a running local server:

```sh
MERMAID_BROWSER_CHANNEL=chrome VERIFY_URL=http://127.0.0.1:4321 node scripts/verify-reading.mjs
MERMAID_BROWSER_CHANNEL=chrome VERIFY_URL=http://127.0.0.1:4321 node scripts/verify-seo.mjs
```

Notes marked `unlisted: true` still build and receive social images, but stay out of lists, RSS, the sitemap and search. Listed notes are also available at `/rss.xml`, linked in every page's head and on the notes index. Each build creates 1200×630 PNG social images at `/og/notes/<slug>.png` and `/og/building/<slug>.png`, plus the site-wide `/og-image.png` fallback. All use the self-hosted Geist fonts and the Hairline palette.

Cloudflare applies `public/_redirects` and `public/_headers` from the built artifact. The deleted gear, stack, and certifications routes permanently redirect to Profile; legacy blog URLs permanently redirect to Notes. Astro preview does not emulate these edge rules. Confirm their status codes, destinations, and cache headers on a Pages preview deployment.

`verify-seo.mjs` reads every built HTML file, including `404.html`, and checks metadata, social PNGs, schema types and references, exact sitemap membership, RSS, headings, images, links, and mobile overflow. `verify-reading.mjs` writes screenshots to `artifacts/reading/` by default. Keep the repository and all build/QA output on `/Volumes/Codex` on this machine.

---

## Deployment

Cloudflare Pages builds and deploys pushes to `main` directly through its Git integration with `dexterbrylle/dexterbrylle.github.io`. GitHub Actions is not required.

Deployment URL: https://dexterbrylle.pages.dev/

Expected Pages build settings, to be checked against the dashboard:

| Setting | Value |
|---------|-------|
| Production branch | `main` |
| Framework preset | Astro |
| Build command | `npx playwright install chromium && npm run build` |
| Build output directory | `dist` |
| Root directory | Repository root |
| Environment variable | `NODE_VERSION=24` |

Cloudflare installs npm dependencies before the build command. Chromium is required to render Mermaid diagrams and social images. The site uses Astro's static output and does not need a Cloudflare SSR adapter.

To finish the custom domain migration, add `dexterbrylle.com` through the Pages project's custom domains settings and apply the DNS change Cloudflare requests. Verify HTTPS and the diagram pages on the custom domain before unpublishing the old site in GitHub's repository Settings → Pages.

---

## Structure

```
├── src/
│   ├── content/blog/       # Notes
│   ├── content/projects/   # Projects and experiments
│   ├── data/               # Navigation, profile, and inventories
│   ├── layouts/            # Astro layouts
│   └── pages/              # Routes
├── public/                 # Static assets and project images
└── dist/                   # Build output
```

---

## License

MIT
