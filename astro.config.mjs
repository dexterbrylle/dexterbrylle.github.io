import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import rehypeMermaid from "rehype-mermaid";
import { unified } from "@astrojs/markdown-remark";
import homelab from "./src/data/homelab.json" with { type: "json" };
import { hairlineLight, hairlineDark } from "./src/lib/shiki-themes.mjs";

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

export default defineConfig({
  integrations: [sitemap({ filter: (page) => {
    const pathname = new URL(page).pathname;
    return !pathname.startsWith("/blog/")
      && pathname !== "/404/"
      && pathname !== "/404.html"
      && !(pathname === "/homelab/" && homelab.items.length === 0);
  } })],
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
