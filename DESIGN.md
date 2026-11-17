# Design system — Hairline

Warm paper, Kanagawa sumi-ink black, one sunflower highlighter, thin rules. The site reads like a well-kept engineering notebook: labels sit in a narrow left gutter in mono, content sits in a reading column, and sections are separated by 1px lines instead of boxes or shadows. The canvas this came from is "dexterbrylle.com redesign" (Home v2 board).

## Rules

1. **Two typefaces, fixed jobs.** Geist for anything read; Geist Mono for labels, dates, navigation, metadata and code. No third face.
2. **One accent, and it means "you can act on this."** Sunflower yellow (`#ffe278`, the Eave yellow) is a highlighter, never a text color: it fills behind link text on hover, marks the current nav item and contents entry, and backs the `dbm.` mark. Text on it is always ink.
3. **Labels in a gutter, text in a column.** 160px mono label, 48px gap, reading text capped at 680px (~70ch).
4. **Hairlines, not containers.** Sections divide with one 1px rule. The only fills are media frames and code panels.
5. **Dates are ISO** (`2026-11-05`), mono, tabular, right-aligned in lists.
6. **One decoration.** The dotted band behind the home hero. Nothing else is ornamental.

## Tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f5f2ea` | `#1f1f28` | Page |
| `--surface` | `#ece8de` | `#2a2a37` | Code, media frames |
| `--ink` | `#1f1f28` (sumiInk3) | `#dcd7ba` (fujiWhite) | Headings, titles |
| `--text` | `#2a2a37` | `#c8c4ad` | Body |
| `--muted` | `#54546d` (6.6:1) | `#9a9886` (5.6:1) | Labels, dates, descriptions |
| `--line` | `#d6d2c7` | `#363646` | Rules |
| `--accent` | `#ffe278` | `#ffe278` | Highlighter fill, logo tile |
| `--on-accent` | `#1f1f28` | `#1f1f28` | Text on the highlighter |
| `--focus` | `#1f1f28` | `#ffe278` | Focus outline |
| `--dot` | ink at 16% | ink at 12% | Hero band dots |

Links rest with a 1px underline at 30% ink, offset 3px; on hover a sunflower highlighter swipes in behind the text (background-size, 260ms) and the underline fades. Focus is a 2px outline in `--focus`. Theme follows the system; the footer switch (system / light / dark) stores an override in `localStorage`.

## Type

| Role | Spec |
|---|---|
| Display (home hero) | Geist 600, clamp(34px → 60px), line-height 1.05, −3% tracking |
| Page / article title | Geist 600, 40–44px, −2.5% |
| Prose heading | Geist 600, 24px |
| Body | Geist 400, 17px / 1.6; prose 1.7 |
| Small | Geist 15px, muted |
| Label | Geist Mono 13px, lowercase |
| Meta | Geist Mono 12px |
| Code | Geist Mono 13.5px / 1.65 |

Fonts are self-hosted latin subsets in `public/fonts/` (SIL OFL), declared in `public/styles/fonts.css`. Arrows are inline SVG (`src/components/Arrow.astro`) so they match regardless of font subset.

## Layout

- Page max 1120px, gutters `clamp(20px, 5vw, 40px)`.
- `.row` = label gutter + body. Below 760px the label sits above the body.
- Home: dotted hero band → three-up strip (identity · intro · field note loop) → `01 / building` cards (Fillo, Eave, Homelab) → `02 / notes` → "Say hello."
- Navigation: lowercase mono `notes · building · homelab · profile`. The current item sits on a sunflower marker. On phones everything collapses into `menu +`. `html` reserves the scrollbar gutter so the header never shifts between short and long pages.
- Logo: `dbm.` in ink on a sunflower tile beside "Dexter Brylle"; it tilts 3° on hover. The favicon is the same mark, outlined from Geist, on a rounded sunflower square.

## Articles

The left gutter holds a back link and a sticky contents rail; the active section gets a clay hairline. On phones the rail becomes a sticky disclosure. Code blocks use custom Shiki themes built from the palette (`src/lib/shiki-themes.mjs`); every token clears 4.5:1 on its panel, and the language shows in a header strip from `data-language`. Mermaid renders to inline SVG at build with the palette as `themeVariables`; diagrams wider than the column spill into the right page margin instead of scrolling on desktop, and pan by keyboard on phones.

## Motion

Read-mode site, so motion explains state and continuity; one authored moment (`public/styles/motion.css`).

- **Focal:** on the home page the highlighter runs the field-note loop once — design, build, observe — and stays on observe; refine's dashed outline draws in last.
- **Continuity:** cross-document view transitions, cross-fade only (no translate). The header is frozen; the nav marker (`view-transition-name: nav-marker`) glides to the new section; a note title carries from the list into the article. Theme switching cross-fades through `startViewTransition`.
- **Feedback:** the highlighter swipe on links; the More/menu panel drops in (180ms).
- **Reduced motion:** no animations or transitions; highlights and states change instantly, and the loop shows its final state.

### Hero thinking grid

The home band is a live 16px dot grid drawn on canvas (`src/scripts/hero-grid.ts`). It aligns with the CSS `--dot` grid and replaces it once ready (`.grid-ready`). The grid visualises thinking: ideas spark, branch into possibilities, prune and settle on an answer.

- **Swell:** two slow sine fields drift across the grid. Each dot varies between about 0.45× and 1.55× of the `--dot` alpha, and a few random dots flicker as background chatter.
- **Thoughts:** at least three are always in flight (up to four on desktop), started a beat apart. Each seed lands in the least busy third of the band, clear of the text.
  - A seed sparks a small ring.
  - It fans out in 3–4 directions, then each tip splits into zero to three curved sub-branches every 120ms (140ms on phones), down to a depth of 5–8 (4–5 on phones).
  - When growth stops, it picks one of the deepest ideas and traces the path back from the root with a travelling pulse. Rejected branches recede over 1.6s.
  - The answer lands as a sunflower block and ring, holds, then the whole thought fades.
- **Pointer:** on fine pointers, dots within 88px of the cursor lift and push out by up to 3px. Pressing empty space sends a sunflower ring and seeds a thought there, with at most three at a time. Links, buttons, the h1, kicker and paragraphs never start one.
- **Text:** every mark fades to 25% within the headline and kicker, with a 28px feather. Branches avoid the faded zone.

Dots are batched into twenty quadratic alpha buckets, one Path2D fill each. DPR is capped at 2, resize is debounced by 150ms, theme changes repaint with fresh tokens, and the loop pauses offscreen or in hidden tabs. At 4× CPU throttle a frame costs about 0.5ms at 375px and 2.2ms (p95 2.9ms) at 1440px. Reduced motion removes the canvas and keeps the static CSS grid. Navigation disposes the canvas, observers and listeners.

## Verification

`scripts/verify-reading.mjs` checks font loading, code contrast in both themes, Mermaid scale and fit, contents behaviour and overflow. Run with `MERMAID_BROWSER_CHANNEL=chrome` on machines without Playwright's bundled Chromium. `scripts/verify-design.mjs` still asserts an earlier design (Archivo, `.mobile-menu`, `.reading-course`) and needs rewriting before it is useful again.
