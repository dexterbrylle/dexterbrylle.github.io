# Design system

The website takes its visual cues from html-doc's minimal theme: off-white paper, rounded sans-serif text, quiet metadata, thin rules, and compact document lists. Writing leads the homepage. The author biography and inventories remain available through navigation.

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

Monochrome light and dark themes. Light keeps the original off-white paper; dark uses #151515 ground, #202020 panels, #f5f5f4 ink, and #b5b5b5 secondary text. Selection reverses ink and ground. Every page load follows system appearance, including live system changes. The header toggle switches the current page without saving an override. Links have no underlines; keyboard focus retains a visible outline. Directional links carry a circle that morphs into a spiral on hover or keyboard focus. Reduced motion uses instant feedback.

## Typography and layout

Text uses SF Pro Rounded when installed, then ui-rounded and the platform sans-serif. Code uses IBM Plex Mono when installed, then the platform monospace. Base text is 18px (112.5% of the browser default) with 1.65 line height. Supporting text stays at 14–15px. Homepage headings scale from 36px to 52px; page and article titles scale from 36px to 44px. Writing titles are 22.5px, and prose section headings are 28px. Article prose uses 1.75 line height and a maximum measure of 70ch, inside an 820px reading column. Headings remain sentence case rather than shrinking into metadata.

The page is at most 1160px wide. Wide screens use 40px outer gutters, with 20px gutters on phones. Arrival sections have generous top spacing and writing rows have 30px vertical breathing room. Writing rows place the title and description on the left, dates and tags on the right. At 760px and below the rows become a single column and navigation becomes a menu.

## Articles

Astro's rendered Markdown headings supply the contents navigation. Posts without section headings omit the rail. Longer posts use a 220px contents column and a 48px gap beside the prose. The rail stays 24px below the viewport top and has its own scroll area if its contents exceed the viewport. Scroll tracking marks the current section and keeps its link visible.

On mobile the contents becomes a sticky disclosure above the article. Choosing a section closes the disclosure. Section headings have 80px scroll margin. Diagrams render at build time; their panels scroll horizontally when needed.

## Runtime

Article navigation uses a small Astro script. Other reading content is static. Mermaid uses the neutral palette. For local machines without bundled Playwright Chromium, set `MERMAID_BROWSER_CHANNEL=chrome` when building or starting development. Normal CI continues to use its installed Chromium.
