# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two co-primary audiences, evenly weighted (owner-confirmed):

1. **Recruiters, hiring managers, and potential collaborators** evaluating Dexter for roles in site reliability, cloud infrastructure, or security. They land on the profile and need role, experience, capabilities, and a contact path, fast.
2. **Engineering peers and technical readers** who read the writing archive for working notes on systems, security, and software craft.

Both are technically sophisticated and time-poor. The site must read as credible and trustworthy in the first viewport and reward a skim.

## Product Purpose

dexterbrylle.com is the professional home of Dexter Brylle, a software and security engineer working in SRE. It serves two equal jobs (owner-confirmed): **(a)** establish credibility and availability for SRE / cloud-infrastructure / security opportunities, and **(b)** host an occasional, low-pressure technical notebook. Success means a visitor — recruiter or peer — quickly grasps who he is and what he's done, trusts the person behind the page, and can reach out.

## Positioning

A practicing SRE who leads as a **builder-first engineer** (owner-confirmed): dependable software, practical systems, security treated as craft. The differentiating combination a neighboring resume site could not truthfully copy is breadth plus depth lived in production: enterprise reliability work (observability, multi-cloud GCP/Azure/AWS, AI-driven release verification) *and* security liaison ownership *and* a deliberate writing voice — held together by an identity that is broader than any one title.

## Operating Context

- Day job: Site Reliability Engineer in the banking/financial sector, owning enterprise observability (Dynatrace) and internal AI-assisted release-verification platforms; serves as security liaison for production releases. Prior: Technical Lead / Senior Backend Engineer on consumer fitness platforms (multi-cloud, Blue-Green deploys, SAST/DAST programs). Detail lives on the About page and should be treated as the current factual record.
- Writing practice: short, working-note essays on software, systems, and security craft. Cadence is low and voluntary — the site must impose no upkeep burden per post.
- Authoring flow: posts are Markdown files with YAML frontmatter under `src/content/blog/`; publishing is a push to `main`. Mermaid diagrams are authored as code and render at build time.
- Contact: `hi@dexterbrylle.com`, GitHub, and LinkedIn are the stated channels; the About page states openness to SRE, cloud-infrastructure, and security-architecture opportunities.

## Capabilities and Constraints

- Static Astro 5 site: zero client-side JavaScript on the reading surface; plain CSS with custom properties; Markdown content collections.
- Routes: Home (intro + latest four posts), About (summary / career / skills / contact), Writing index, and individual posts.
- Mermaid diagrams render to inline SVG at build (no runtime dependency).
- Hosting: GitHub Pages origin behind Cloudflare custom domain `dexterbrylle.com` (`CNAME` in repo); `robots.txt` and generated `sitemap.xml` present.
- Deploy: GitHub Actions on pushes to `main` runs `astro check && astro build`, then uploads; feature branches run CI without deploying.
- SEO surface already implemented: canonical, Open Graph, Twitter Card, and a JSON-LD `@graph` (WebSite / Person / WebPage / Article).
- **Documented decision gap:** the JSON-LD `Person` `jobTitle` and most `<title>`/meta descriptions currently read "Site Reliability Engineer … 13+ Years" — a narrower resume framing than the owner-confirmed broad-builder identity. Whether and how to reconcile those surfaces is an open decision for later surface work, not resolved during init.

## Brand Commitments

- Public name **Dexter Brylle** — the site mark, headings, titles, domain, GitHub, and LinkedIn all use it. Full name "Dexter Brylle Matos" appears only in the JSON-LD Person record (givenName "Dexter Brylle", familyName "Matos").
- Identity framing: **software/security engineer, builder first** — SRE is the current role, not the whole identity (owner-confirmed; supersedes the SRE-specialist framing in current SEO copy as the truth future work should lead with).
- Voice in writing: quiet, deliberate, craft-oriented; skeptical of bloat and ornament ("Building with Intent," "Security as Craft," "First Note" are consistent signals).
- Binding references the owner made explicit: none external.

## Evidence on Hand

Real, present, and usable:

- Four blog posts in `src/content/blog/` (May 2026): `first-note`, `security-as-craft`, `building-with-intent`, `mermaid-diagrams`.
- Authored profile and career copy on Home and About, including a six-category skills list (cloud/orchestration; observability; DevOps/automation; languages/AI; security; OS) and contact rows.
- SEO assets: `public/og-image.svg`, `public/favicon.svg`, `public/robots.txt`, sitemap integration, and the JSON-LD block in `BaseLayout.astro`.
- Deploy pipeline at `.github/workflows/deploy.yml`.

Verified absences — do not fabricate:

- **No downloadable CV.** Git history shows `public/dexter-matos-cv-2026.pdf` was added (commit `a4c8db3`) then deleted (commit `1262a96`) when About was reworked; the README still advertises a "downloadable CV" that no longer exists. No testimonials, case studies, press mentions, client logos, or download asset are linked anywhere.
- Quantified resume claims (e.g., "95% reduction in production incidents," "13+ years") are the owner's own copy on the About page — preserve as his claims, never amplify, and never add new invented benchmarks or third-party endorsements.

## Product Principles

1. **Credibility in seconds.** A recruiter or peer should grasp who he is, what he has built, and how to reach him within one glance — no scrolling through decoration to find substance.
2. **Builder-first identity.** Lead with the person who builds dependable software and practical systems; any specific role contextualizes rather than boxes him in.
3. **Writing stays low-pressure.** The blog must make adding a post nearly zero-effort (write Markdown, render, ship) and must never present cadence as a promise.
4. **Craft over ornament.** In prose and in the interface, restraint is the aesthetic of record; the reading surface argues for the same values the essays do.
5. **Two audiences, one artifact.** Career credibility and the notebook are equal pillars; neither framing is allowed to quietly subordinate the other.

## Accessibility & Inclusion

No product-specific audience requirement was established. The current implementation already uses semantic landmarks, `aria-label`s, relative units, and a responsive layout at small viewports; keep that baseline and preserve text-on-paper contrast in any future change.
