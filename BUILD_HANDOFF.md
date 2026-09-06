You are a senior front-end designer-engineer. Redesign the Astro 5 personal website in `/Volumes/Codex/Projects/dexterbrylle.com` — replacing its current quiet "paper notebook" look with a new, production-grade visual identity and information architecture, per the confirmed spec below. Replace the old visual world entirely; do not preserve or "polish" the current notebook styling. Build fully, verify visually, and stop when done. If anything here conflicts with the live code, follow the spec.

## Read first
- `PRODUCT.md` — product truth, the two audiences, principles, honesty rules. Binding.
- The current pages under `src/` — to extract real content. Never invent facts; reuse only what is already on the site.
- `astro.config.mjs`, `src/content.config.ts`, `package.json` — to understand the build and content schema.

## Identity to build: "Charting the course"
Dexter is an SRE who navigates complex production systems calmly. The site is the operational chart he uses: precise, legible, quiet. Everything plotted on it is real.

### Palette (starter tokens — tune only to fix accessibility)
Light "chart ground," not cream, no paper texture:
- ground `#F1EFE9`; raised surface `#F7F5F0`
- primary ink `#1F2A30` (deep slate charcoal); muted ink `#57676E`
- route accent (petrol/teal) `#0E6160`; hover/darker `#0A4C4B`
- waypoint amber, used rarely for marks only: `#8A5710` (text-safe) / `#A76B15` (large marks)
- status green `#2F7D4A`; outage red `#B03A2E` (Homelab board only)
- hairline rules `rgba(31,42,48,.16)`; faint graticule grid `rgba(31,42,48,.055)`

### Type
- Display + UI/labels: a clean, slightly technical grotesque — anchor **Archivo** (400–700). Waypoint/section annotations set small, tracked uppercase. Do not default to Inter, Space Grotesk, or mono-everywhere.
- Body: a legible grotesque (Archivo at reading sizes, or a tuned companion). Prose measure ≈65–72ch, line-height ≈1.7.
- Real mono only inside fenced code / `<code>`.

### Signature grammar (consistent across every page)
- A faint graticule (hairline column grid + margin tick marks) behind content; scale down or fade on small screens.
- A thin course line that connects sections / indicates position.
- Nav rendered as route waypoints; the current page is the filled waypoint; Home carries a small "you are here" origin marker.
- Header = legend rail: site mark ("Dexter Brylle") left, waypoint nav center/right, a tiny factual id right (e.g., `dexterbrylle.com`).
- Footer = chart margin: scale bar, north arrow, edition line (`© 2026 dexterbrylle.com · Astro`), contact links.
- One subtle motion system: hairlines draw, a position marker travels between pages, reading progress fills the course line on Notes posts. Honor `prefers-reduced-motion` (disable all motion). Nothing hides content at first paint.

### Anti-goals (never violate)
- No copied visual style or voice from bryllim.com; no dark stat tiles, viewer counters, badges, or gamification.
- No invented facts, metrics, testimonials, or products. Reuse only content already on the site. Never surface "13+ years" / "95% reduction" as Home stat tiles.
- Nothing that resurrects the retired notebook world (ruled-paper lines, cream + oxblood + Georgia serif).
- No client-side JS on the reading surface; static Astro. Keep Mermaid building to inline SVG — restyle its `astro.config.mjs` themeVariables to this palette.

## Information architecture
| Nav label | Path | Purpose |
|---|---|---|
| Home | `/` | Origin + recent Notes + waypoint teasers |
| Profile | `/about/` | Reworded About; keep the existing URL so old links hold |
| Notes | `/notes/` + `/notes/[slug]/` | The writing log (renamed from Blog/Scribbles) |
| Gear | `/gear/` | Equipment the user will supply |
| Stack | `/stack/` | Toolchain (derive from About Skills) |
| Certifications | `/certifications/` | Verified credentials the user will supply |
| Homelab | `/homelab/` | Status board, "live telemetry — coming soon" |

Everything a human edits lives in JSON — nav, identity, contact, and each list page's items. Adding a page = one nav entry + a small Astro page that renders a JSON list.

### Data files to create
- `src/data/site.json` — `site` (name, domain, role line, one-line statement, email), `nav` (ordered `{label, path}` for Home, Profile, Notes, Gear, Stack, Certifications, Homelab), `contact` (github / linkedin / email), `footer`, `waypoints` (one honest descriptor line per page, for teasers).
- `src/data/gear.json`, `src/data/stack.json`, `src/data/certifications.json`, `src/data/homelab.json` — item lists the user will fill and extend.

### Content sources (real, present on the site today)
- **Home:** name / role / one-line builder statement / contact from current `index.astro`; render the latest ~4 posts from the blog content collection as the Notes teaser. No fabricated content.
- **Profile (`/about`):** keep the Summary, Career narrative, "open to…" contact line from `about.astro`. Move the six-category Skills block out to Stack (dedupe). Nav shows "Profile"; the URL stays `/about`.
- **Notes:** rename the writing destination to Notes at `/notes/`. Reuse the four existing Markdown posts verbatim (title / description / pubDate / tags, schema in `src/content.config.ts`). Routes: index `/notes/`, post `/notes/<slug>/`. You may keep the content dir `src/content/blog` (collection name `blog`) and present a `/notes/` interface over it. Keep canonical/OG/JSON-LD plumbing correct for the new URLs.
- **Stack (`/stack`):** build from the six About skill categories and their tools (Cloud & Orchestration, Observability & Monitoring, DevOps & Automation, Languages & AI, Security, Operating Systems). Present as labeled columns/blocks of scannable entries — not a word cloud.
- **Gear / Certifications / Homelab:** the user will supply real items. Ship fully-designed, JSON-driven pages with honest labeled placeholder entries (e.g., "add your items to `src/data/gear.json`"). Homelab presents as a status board: render real inventory from JSON (may start sparse), plus a clearly labeled "live telemetry — coming soon" state, structured so a future status source can be dropped in.

## Page composition (map-annotation style)
Section headings read as map annotations: small tracked uppercase labels, with a route numeral only where honest (e.g., `01 · course`, `02 · log`). Calm hierarchy — the page title is the one large display moment; everything else stays measured. More space above a heading than below.

- **Home first viewport:** origin marker + name + role line ("Site Reliability Engineer — course: observability · cloud · security") + the builder statement + a small contact row. A recruiter must grasp who this is, what he does, and how to reach him in one glance.
- **Home below:** recent Notes (dated as route points, real data), then a compact waypoint strip linking Gear / Stack / Certifications / Homelab with one honest line each.
- **Notes post:** measure-perfect reading column; entry header = title + date/position line; prose, code, blockquotes in the chart grammar; Mermaid diagrams re-themed to the palette.
- **Indexes (Gear / Stack / Certs / Homelab):** scannable annotated rows or cards with one consistent label + annotation anatomy.

## Craft floor
- Semantic landmarks, `aria-label`s, visible focus states, relative units. Body text contrast ≥ AA on the chart ground (AAA where practical).
- No horizontal page scroll. Grids reflow fluidly; the route row collapses to a compact menu below ≈700px; graticule fades on small screens.
- One spacing rhythm site-wide. Delete unused CSS from the old design (do not leave retired styles behind).
- Update `BaseLayout.astro` SEO (title/description per page, canonical, OG/Twitter, JSON-LD) for the new pages without inventing identity claims beyond current copy.
- `astro check` and `astro build` must pass; sitemap regenerates automatically with the new routes.

## Verify before finishing
Run the dev server (or `astro build` + preview). Capture and inspect the first viewport and full pages at desktop ≈1440 and mobile ≈390 for at least: Home, one Notes post, and Stack. Fix everything the captures reveal (overflow, layout, contrast, type) in one batched pass, then confirm. "It compiles" is not done — you are the QA.

## Deliver
- The implemented redesign per this spec. Commit only when the user asks.
- A concise `DESIGN.md` recording the system you shipped — palette values, type scale, the route-chart grammar (graticule, course line, waypoints, chart-margin footer), motion + reduced-motion rules, and responsive rules — so future work inherits the system. Record what you built, not this brief.
