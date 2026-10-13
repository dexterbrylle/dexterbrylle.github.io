import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()),
  }),
});

const projects = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(["Live", "Coming soon", "Experiment", "Paused"]),
    order: z.number().default(0),
    tags: z.array(z.string()),
    icon: z.string().optional(),
    preview: z.object({ src: z.string(), alt: z.string() }).optional(),
    links: z.array(z.object({ label: z.string(), href: z.string().url() })),
  }),
});

export const collections = { blog, projects };
