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

### Hero grid

The home band illustrates routing around failure on its existing 16px dot grid. Eight ink packets move one cell every 150ms with three fading trail dots; phones below 760px use four packets at 190ms. Every 6–9s a node on a packet's route becomes a quiet ink cross. Packets take grid-aligned detours until it recovers after 3–4s with one 300ms sunflower blink. The blink is the only accent in this illustration. It carries no telemetry or labels.

The canvas reads theme tokens and preserves the CSS grid's center-top alignment. Marks fade to a quarter of their usual opacity within the headline and kicker bounds, with a 24px feather. The grid is cached, rendering is capped at 30fps and 2× pixel density, and animation pauses offscreen or in hidden tabs. It starts after first paint and cleans up on navigation. Reduced motion, including live preference changes, leaves the static CSS dots; no JavaScript also retains that grid.

## Verification

`scripts/verify-reading.mjs` checks font loading, code contrast in both themes, Mermaid scale and fit, contents behaviour and overflow. Run with `MERMAID_BROWSER_CHANNEL=chrome` on machines without Playwright's bundled Chromium. `scripts/verify-design.mjs` still asserts an earlier design (Archivo, `.mobile-menu`, `.reading-course`) and needs rewriting before it is useful again.
