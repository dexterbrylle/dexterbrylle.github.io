# Design system — "Charting the course"

The visual identity of dexterbrylle.com is an operational chart: a calm, legible,
plot-driven interface where everything rendered is real. This file records the
system as shipped, so future work inherits it. Values below are the source of
truth as implemented in `public/styles/global.css` and `astro.config.mjs`; the
design brief (`BUILD_HANDOFF.md`) describes intent, this file records the result.

## Palette

Light only; no dark mode. `color-scheme: light` is set at the root. All colors
are exposed as CSS custom properties on `:root`.

| Token | Value | Use |
|---|---|---|
| `--ground` | `#F1EFE9` | page background (the chart ground) |
| `--surface` | `#F7F5F0` | raised panels: empty state, code inline, Mermaid panels |
| `--ink` | `#1F2A30` | primary text, headings, rules source |
| `--muted` | `#57676E` | secondary text, labels, metadata |
| `--accent` | `#0E6160` | the route (petrol/teal): links, course line, filled waypoints |
| `--accent-hover` | `#0A4C4B` | link hover / darker route |
| `--amber` | `#8A5710` | rare waypoint marks, degraded status, empty-state marker (text-safe) |
| `--amber-mark` | `#A76B15` | large amber marks (reserved) |
| `--status-green` | `#256B3F` | Homelab operational status |
| `--status-red` | `#B03A2E` | Homelab outage status |
| `--line` | `rgba(31,42,48,.16)` | hairline rules |
| `--grid` | `rgba(31,42,48,.055)` | faint graticule lines |
| selection | `#C9DFDB` | text selection wash (ink text preserved) |

Contrast is AA across the palette on the chart ground: muted 5.1:1, accent 6.3:1,
ink 12.8:1. `--status-green` ships at `#256B3F` rather than the brief's `#2F7D4A`
so the status word stays legible on ground.

## Type

Single variable font, **Archivo** (400–700), self-hosted as
`public/fonts/archivo-latin.woff2` (OFL). No serif, no Inter, no Space Grotesk.
Fallbacks: `Arial, sans-serif`.

- Display: Home title `clamp(3.8rem, 8vw, 7.5rem)`, weight 600, `-0.065em`,
  line-height 1.03. Post title `clamp(2.8rem, 4.3vw, 4.5rem)`.
- Headings: h2 1.65rem `-0.025em`, h3 1.3rem `-0.02em`, weight 500.
- Annotations (kickers, section labels, status labels): `.7rem`, weight 500,
  `0.14em` tracking, uppercase, muted color. These are the map annotations.
- Body: 16px base, prose `1.075rem` at line-height 1.75, measure capped at 68ch.
- Mono is confined to `<code>`/`<pre>` (`ui-monospace` stack); never used for
  display or UI labels.

## Route-chart grammar

The shared grammar, applied on every page:

- **Graticule.** The `.page-shell` draws faint vertical column lines every 25%
  of the shell via `repeating-linear-gradient`, plus a right-edge hairline. It
  fades to `rgba(31,42,48,.025)` and the shell tightens to `calc(100% - 2rem)`
  below 700px.
- **Course line.** `<main>` carries a left border (the route) with `main::before`
  drawing tick marks every 4rem along it. Content is inset by `--gutter` (3rem
  desktop, 1.25rem mobile).
- **Waypoints.** Navigation renders each route as a hollow dot (`nav-point`) with
  the label; the current page fills the dot teal and colors the label. The filled
  dot carries `view-transition-name: position-marker` so it travels between pages.
  A page-level filled dot (`.intro::before` / `.page-heading::before`) marks the
  position on the course line at the heading; section-level hollow dots
  (`.section-heading::before`) annotate each section.
- **Header — legend rail.** Site mark (↗ in a teal-bordered square) left, waypoint
  nav center/right, tiny factual `dexterbrylle.com` id far right (hidden ≤1180px).
- **Footer — chart margin.** Scale bar, `↑ N` north arrow, edition line
  (`© 2026 dexterbrylle.com · Astro`), and contact links.
- **Reading progress.** On posts, a fixed `.reading-course` line runs the left
  margin; its teal fill grows with scroll.

## Motion

One subtle system, all disabled under `prefers-reduced-motion: reduce`.

- Hairlines draw: the header's accent rule animates in (`chart-draw`, 0.6s).
- The position marker travels between pages via View Transitions (group anim 0.32s).
- The reading-progress fill uses `animation-timeline: scroll()` where supported
  (`@supports`), so it degrades to a static line elsewhere.
- Reduced motion turns off all animation/transition/scroll-behavior and hides the
  reading course. Nothing hides content at first paint; every element renders
  without motion.

## Responsive

- **≤1180px**: hide the site id, tighten nav gap.
- **≤900px**: header wraps; nav goes full width; inventory and waypoint grids
  drop to two columns.
- **≤700px**: desktop nav collapses into a `<details>` mobile menu; graticule
  fades; grids go single column; gutter and type scale down. The course line and
  waypoint markers remain, scaled back.

## Composition

Map-annotation hierarchy: the page title is the single large display moment;
everything else stays measured. Section headings read as small tracked uppercase
labels. More space sits above a heading than below it. Indexes (Gear, Stack,
Certifications, Homelab) use one consistent card/row anatomy; Homelab adds a
status board with a "live telemetry — coming soon" state.

## Content & data

All human-editable content lives in JSON under `src/data/`:
`site.json` (identity, nav, contact, footer, waypoints, per-page copy),
`profile.json`, `stack.json`, `gear.json`, `certifications.json`,
`homelab.json`. Adding a page is one nav entry plus a small Astro page rendering
a JSON list. Notes are Markdown in `src/content/blog/` (collection `blog`)
presented at `/notes/`; `/blog/*` serves a noindex meta-refresh redirect to
`/notes/*` for old links. Zero client-side JavaScript on the reading surface.
Mermaid renders to inline SVG at build; each diagram is wrapped in a `.diagram`
panel (see `rehypeMermaidPanels` in `astro.config.mjs`) and renders at its native
pixel width, scrolling within the panel when the column is narrower.
