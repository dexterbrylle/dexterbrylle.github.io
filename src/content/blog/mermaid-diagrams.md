---
title: "Visualizing System Architecture with Mermaid"
description: "A demonstration of Mermaid diagrams for technical documentation—flowcharts, sequence diagrams, and entity relationships rendered at build time."
pubDate: 2026-05-08
tags: ["tools", "documentation", "diagrams"]
---

Sometimes explaining a system is easier with a diagram. I've started using Mermaid to embed diagrams directly in Markdown—no external tools, no image exports, just code that renders.

Here's how it works on this site.

## Flowcharts

A simple deployment flow:

```mermaid
flowchart TD
    A[Developer Push] --> B{CI/CD Check}
    B -->|Pass| C[Build Site]
    B -->|Fail| D[Notify Error]
    C --> E[Deploy to Cloudflare Pages]
    E --> F[Live Site]
    D --> G[Fix & Retry]
    G --> A
```

## Sequence Diagrams

How a request flows through the stack:

```mermaid
sequenceDiagram
    participant U as User
    participant C as Cloudflare
    participant P as Cloudflare Pages
    participant A as Astro

    U->>C: HTTPS Request
    C->>P: Forward Request
    P->>A: Serve Static Files
    A-->>P: HTML/CSS/JS
    P-->>C: Response
    C-->>U: Cached Response
```

## Entity Relationships

A simplified data model:

```mermaid
erDiagram
    POST ||--o{ TAG : has
    POST {
        string title
        date pubDate
        string description
        string content
    }
    TAG {
        string name
    }
```

## Why This Matters

Diagrams that live as code have advantages:

- **Version controlled** – changes tracked in git
- **Diffable** – pull requests show what changed in a diagram
- **Editable** – no proprietary tools needed
- **Accessible** – renders as SVG with selectable text

Since this site uses Astro with `rehype-mermaid`, the diagrams render at build time. No JavaScript runs in the browser to draw them. The SVGs are static assets, same as the HTML.

This post itself is the proof of concept.
