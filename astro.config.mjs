import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { readdirSync, readFileSync } from "node:fs";
import { modifiedDate } from "./src/lib/content-dates.mjs";
import { rasterizeOg } from "./scripts/rasterize-og.mjs";
import rehypeMermaid from "rehype-mermaid";
import { unified } from "@astrojs/markdown-remark";
import homelab from "./src/data/homelab.json" with { type: "json" };
import { hairlineLight, hairlineDark } from "./src/lib/shiki-themes.mjs";

// Notes marked `unlisted: true` in frontmatter stay out of the sitemap.
const notesDir = new URL("./src/content/blog/", import.meta.url);
const unlistedNotes = readdirSync(notesDir)
  .filter((file) => file.endsWith(".md") && /^unlisted:\s*true\s*$/m.test(readFileSync(new URL(file, notesDir), "utf8").split("---")[1] ?? ""))
  .map((file) => `/notes/${file.replace(/\.md$/, "")}/`);

// Preserve the SVG's natural dimensions so wider panels never shrink its labels.
function rehypeMermaidPanels() {
  const isMermaid = (node) =>
    node?.type === "element" &&
    node.tagName === "svg" &&
    String(node.properties?.id ?? "").startsWith("mermaid-");
  const natural = (node) => {
    const style = String(node.properties?.style ?? "");
    const match = style.match(/max-width:\s*([\d.]+)px/);
    return match ? parseFloat(match[1]) : null;
  };
  return (tree) => {
    const walk = (parent) => {
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i];
        if (!node || node.type !== "element") continue;
        if (isMermaid(node)) {
          const width = natural(node);
          if (width) {
            node.properties.width = width;
            node.properties.style = String(node.properties.style ?? "").replace(
              /max-width:\s*[\d.]+px;?/, "",
            );
          }
          parent.children[i] = {
            type: "element",
            tagName: "div",
            properties: {
              class: "diagram",
              ...(width ? { style: `--diagram-width: ${width}px` } : {}),
              tabIndex: 0,
              role: "region",
              ariaLabel: "Diagram",
            },
            children: [node],
          };
        } else if (node.children) {
          walk(node);
        }
      }
    };
    walk(tree);
  };
}

const routeSources = new Map([
  ["/", ["src/pages/index.astro", "src/data/site.json", "src/content/blog", "src/content/projects"]],
  ["/about/", ["src/pages/about.astro", "src/data/profile.json"]],
  ["/notes/", ["src/pages/notes/index.astro", "src/data/site.json", "src/content/blog"]],
  ["/building/", ["src/pages/building/index.astro", "src/data/site.json", "src/content/projects"]],
  ...(homelab.items.length ? [["/homelab/", ["src/pages/homelab.astro", "src/data/homelab.json"]]] : []),
]);
for (const [collection, section] of [["blog", "notes"], ["projects", "building"]]) {
  for (const file of readdirSync(`src/content/${collection}`).filter((file) => file.endsWith(".md") && !file.startsWith("_"))) {
    routeSources.set(`/${section}/${file.replace(/\.md$/, "")}/`, [`src/content/${collection}/${file}`]);
  }
}

export default defineConfig({
  integrations: [
    sitemap({
      filter: (page) => routeSources.has(new URL(page).pathname) && !unlistedNotes.includes(new URL(page).pathname),
      serialize: (item) => {
        const paths = routeSources.get(new URL(item.url).pathname);
        const lastmod = paths && modifiedDate(...paths);
        return lastmod ? { ...item, lastmod } : item;
      },
    }),
    { name: "hairline-og", hooks: { "astro:build:done": async ({ dir }) => { await rasterizeOg(dir); } } },
  ],
  site: "https://dexterbrylle.com",
  output: "static",
  // Keep v6 whitespace handling between inline elements (v7 defaults to "jsx").
  compressHTML: true,
  markdown: {
    // Keep the unified pipeline so rehype-mermaid and the panel plugin still run.
    processor: unified(),
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    shikiConfig: {
      themes: { light: hairlineLight, dark: hairlineDark },
      defaultColor: false,
    },
    rehypePlugins: [
      [rehypeMermaid, {
        css: new URL("./public/styles/fonts.css", import.meta.url),
        ...(process.env.MERMAID_BROWSER_CHANNEL ? { launchOptions: { channel: process.env.MERMAID_BROWSER_CHANNEL } } : {}),
        mermaidConfig: {
          fontFamily: "Geist, sans-serif",
          theme: "base",
          themeVariables: {
            primaryColor: "#F5F2EA",
            primaryTextColor: "#1F1F28",
            primaryBorderColor: "#1F1F28",
            lineColor: "#54546D",
            secondaryColor: "#ECE8DE",
            tertiaryColor: "#FAF8F3",
            background: "#FAF8F3",
            mainBkg: "#F5F2EA",
            secondBkg: "#ECE8DE",
            textColor: "#1F1F28",
            fontFamily: "Geist, sans-serif",
          },
        },
        strategy: "inline-svg",
      }],
      rehypeMermaidPanels,
    ],
  },
});
