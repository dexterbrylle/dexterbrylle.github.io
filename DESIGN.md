# Design system

The website takes its visual cues from html-doc's minimal theme: off-white paper, rounded sans-serif text, quiet metadata, thin rules, and compact document lists. Writing leads the homepage. The author biography and inventories remain available through navigation.

## Palette

| Token | Value | Use |
|---|---|---|
| `--ground` | `#fafaf9` | Page background |
| `--surface` | `#f5f5f4` | Code and diagram panels |
| `--ink` | `#1c1917` | Body text and headings |
| `--muted` | `#706963` | Dates, tags, descriptions |
| `--accent` | `#2563eb` | Links and focus |
| `--accent-hover` | `#1d4ed8` | Link hover |
| `--line` | `#d6d3d1` | Dividers |

Light theme. Selection uses `#dbeafe` with the normal ink color.

## Typography and layout

Text uses SF Pro Rounded when installed, then ui-rounded and the platform sans-serif. Code uses IBM Plex Mono when installed, then the platform monospace. Base text is 15px with 1.65 line height. Homepage headings are 30px; article titles are 26px. Article prose uses 1.75 line height and a maximum measure of 72ch.

The page is at most 1000px wide. Writing rows place the title and description on the left, dates and tags on the right. At 760px and below the rows become a single column and navigation becomes a menu.

## Articles

Astro's rendered Markdown headings supply the contents navigation. Posts without section headings omit the rail. Longer posts use a 208px contents column and a 48px gap beside the prose. The rail stays 24px below the viewport top and has its own scroll area if its contents exceed the viewport. Scroll tracking marks the current section and keeps its link visible.

On mobile the contents becomes a sticky disclosure above the article. Choosing a section closes the disclosure. Section headings have 80px scroll margin. Diagrams render at build time; their panels scroll horizontally when needed.

## Runtime

Article navigation uses a small Astro script. Other reading content is static. Mermaid uses the neutral palette. For local machines without bundled Playwright Chromium, set `MERMAID_BROWSER_CHANNEL=chrome` when building or starting development. Normal CI continues to use its installed Chromium.
