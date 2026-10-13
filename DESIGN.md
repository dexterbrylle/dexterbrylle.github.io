# Design system

The website takes its visual cues from html-doc's minimal theme: off-white paper, rounded sans-serif text, quiet metadata, thin rules, and compact document lists. Notes and personal projects share the homepage. The author biography and inventories remain available through navigation.

## Palette

| Token | Value | Use |
|---|---|---|
| `--ground` | `#fafaf9` | Page background |
| `--surface` | `#f5f5f4` | Code and diagram panels |
| `--ink` | `#111111` | Body text and headings |
| `--muted` | `#595959` | Dates, tags, descriptions |
| `--accent` | `#111111` | Links and focus |
| `--accent-hover` | `#000000` | Link hover |
| `--line` | `#d6d3d1` | Dividers |

Monochrome light and dark themes. Light keeps the original off-white paper; dark uses #151515 ground, #202020 panels, #f5f5f4 ink, and #b5b5b5 secondary text. Selection reverses ink and ground. Every page load follows system appearance, including live system changes. The footer toggle switches the current page without saving an override. Links have no underlines; keyboard focus retains a visible outline. Directional links carry a circle that morphs into a spiral on hover or keyboard focus. Reduced motion uses instant feedback.

All images and SVGs start in grayscale. Hovering an image, its link, or its containing project, gear item, figure, or diagram reveals the original colors. Keyboard focus produces the same reveal; standalone project covers are focusable. Color transitions last 240ms and become instant with reduced motion. Inline line icons keep their authored monochrome colors. Dark diagrams preserve inversion for readability while their grayscale value responds to interaction.

The footer contains the copyright, contact links, and theme toggle. On phones the copyright sits above the contact row, with the toggle at the right.

## Typography and layout

Text, headings, controls, and diagram labels use self-hosted IBM Plex Sans. Inline code and fenced blocks use self-hosted IBM Plex Mono. Sans has normal and italic variable faces covering weights 400–700; Mono has regular, semibold, and regular italic faces. Latin WOFF2 files and their OFL licenses live in `public/fonts/`; `public/styles/fonts.css` declares them with `font-display: swap`. Only normal Sans is preloaded globally. Base text is 18px (112.5% of the browser default) with 1.65 line height. Supporting text stays at 14–15px. Homepage headings scale from 36px to 52px; page and article titles scale from 36px to 44px. Writing titles are 22.5px, and prose section headings are 28px. Article prose uses 1.75 line height and a maximum measure of 70ch, inside an 820px reading column. Headings remain sentence case rather than shrinking into metadata.

The page is at most 1160px wide. Wide screens use 40px outer gutters, with 20px gutters on phones. Arrival sections have generous top spacing and writing rows have 30px vertical breathing room. Writing index rows place the title and description on the left, dates and tags on the right. Homepage notes keep metadata beneath the title, beside a narrower Building column with app icons and project summaries. At 760px and below, Notes and Building stack, writing rows become a single column, and navigation becomes a menu.

## Projects and navigation

Home, Notes, Building, and Profile are the primary navigation. Gear, Stack, Certifications, and Homelab live under More on desktop; the mobile menu lists every destination. Both disclosures close on outside clicks and Escape, with Escape returning focus to the summary when focus is inside.

Building uses a two-column gallery of official product previews, followed by app icons, project names, plain-text statuses, descriptions, and detail links. Project pages use an 820px reading column with product links, an image, and Markdown prose. Preview images use 12px corners; 48px app icons use 10px corners. Project previews reveal their original colors on interaction in both themes. Status is an authored label, not live telemetry.

Gear uses image links with category, name, and description beneath them. Hover reveals color without turning the image away. Selecting an image still opens the viewer; its focused or hovered image shows the original colors.

Project content lives in `src/content/projects/`, independently of notes. Entries support optional icons and preview images so an experiment can ship as text alone. Adding a project needs no component changes. Links remain free of underlines in every state. Note and project titles reserve space for a circle-to-spiral cue that appears on hover or keyboard focus. Its opacity changes in 150ms and its path morphs in 300ms. Keyboard focus keeps the outline; reduced motion shows the spiral immediately without animation. Image color reveals remain independent of the title cue.

## Articles

Astro's rendered Markdown headings supply the contents navigation. Posts without section headings omit the rail. Longer posts use a 220px contents column and a 48px gap beside the prose. The rail stays 24px below the viewport top and has its own scroll area if its contents exceed the viewport. Scroll tracking marks the current section and keeps its link visible.

On mobile the contents becomes a sticky disclosure above the article. Articles with diagrams use this disclosure on desktop too, freeing the full width for diagrams. Choosing a section closes the disclosure. Section headings have 80px scroll margin.

Diagrams render to inline SVG at build time, after loading the same local Plex fonts used by the page. Prose stays centered at 70ch, while diagrams can extend into the available viewport width, leaving 40px gutters on desktop and 20px on phones. Small diagrams stay at their natural width. SVGs retain a 1:1 scale, with padding on the panel rather than inside the SVG, so labels never shrink to fit. Panels scroll only when the actual diagram exceeds the available space; they are focusable for keyboard panning.

Fenced code uses Shiki's `github-light-default` and `github-dark-default` themes. Both token palettes are generated at build time and selected through the current `data-theme`. Code keeps its syntax colors without a grayscale filter or monochrome overrides. Unknown or unlabeled languages remain readable plain text. Code colors are a deliberate exception to the image-only color reveal.

## 404 easter egg

Unknown paths use `src/pages/404.astro`, which builds to the root `404.html` for GitHub Pages. The page is excluded from indexing and the sitemap. It keeps the site header and footer, with links back to Home, Notes, and Building.

The supplied Admiral Ackbar ASCII GIF sits on a black stage, followed by a separate five-line ASCII "IT'S A TRAP!" banner in Plex Mono. The banner types across in a 4.4-second loop with a readable hold. Both animations play automatically without a playback button. Reduced motion and JavaScript-free browsing start with a still WebP frame and the complete banner. Playback suspends when the stage is offscreen or the tab is hidden.

## Runtime

Article navigation uses a small Astro script. Other reading content is static. Mermaid uses the neutral palette. For local machines without bundled Playwright Chromium, set `MERMAID_BROWSER_CHANNEL=chrome` when building or starting development. Normal CI continues to use its installed Chromium. `scripts/verify-reading.mjs` checks font loading, actual Markdown syntax highlighting and contrast, native diagram scale, wide diagrams, keyboard panning, and responsive widths against a running preview.
