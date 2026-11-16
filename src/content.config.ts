import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()),
    // Unlisted notes still build but stay out of lists, feeds, the sitemap and search.
    unlisted: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "**/[^_]*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(["Live", "Coming soon", "Experiment", "Paused"]),
    order: z.number().default(0),
    tags: z.array(z.string()),
    icon: z.string().optional(),
    preview: z.object({ src: z.string(), alt: z.string() }).optional(),
    links: z.array(z.object({ label: z.string(), href: z.url() })),
  }),
});

export const collections = { blog, projects };
