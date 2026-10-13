import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import rehypeMermaid from "rehype-mermaid";
import certifications from "./src/data/certifications.json" with { type: "json" };
import homelab from "./src/data/homelab.json" with { type: "json" };

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
      && !(pathname === "/certifications/" && certifications.items.length === 0)
      && !(pathname === "/homelab/" && homelab.items.length === 0);
  } })],
  site: "https://dexterbrylle.com",
  output: "static",
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    shikiConfig: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
    },
    rehypePlugins: [
      [rehypeMermaid, {
        css: new URL("./public/styles/fonts.css", import.meta.url),
        ...(process.env.MERMAID_BROWSER_CHANNEL ? { launchOptions: { channel: process.env.MERMAID_BROWSER_CHANNEL } } : {}),
        mermaidConfig: {
          fontFamily: "IBM Plex Sans, sans-serif",
          theme: "base",
          themeVariables: {
            primaryColor: "#F5F5F4",
            primaryTextColor: "#1C1917",
            primaryBorderColor: "#78716C",
            lineColor: "#78716C",
            secondaryColor: "#E7E5E4",
            tertiaryColor: "#FAFAF9",
            background: "#FAFAF9",
            mainBkg: "#F5F5F4",
            secondBkg: "#E7E5E4",
            textColor: "#1C1917",
            fontFamily: "IBM Plex Sans, sans-serif",
          },
        },
        strategy: "inline-svg",
      }],
      rehypeMermaidPanels,
    ],
  },
});
