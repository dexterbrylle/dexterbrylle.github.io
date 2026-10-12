import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import rehypeMermaid from "rehype-mermaid";
import certifications from "./src/data/certifications.json" with { type: "json" };
import homelab from "./src/data/homelab.json" with { type: "json" };

// rehype-mermaid emits <svg width="100%" style="max-width:<natural>px"> per diagram,
// so a full-column CSS stretch both upscales small diagrams and squeezes wide ones.
// Render each at its native pixel size and let the .diagram panel scroll when the
// column is narrower, keeping diagram text at design size on every viewport.
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
            properties: { class: "diagram" },
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
      && !(pathname === "/certifications/" && certifications.items.length === 0)
      && !(pathname === "/homelab/" && homelab.items.length === 0);
  } })],
  site: "https://dexterbrylle.com",
  output: "static",
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
      theme: "github-light",
    },
    rehypePlugins: [
      [rehypeMermaid, {
        ...(process.env.MERMAID_BROWSER_CHANNEL ? { launchOptions: { channel: process.env.MERMAID_BROWSER_CHANNEL } } : {}),
        mermaidConfig: {
          fontFamily: "system-ui, sans-serif",
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
            fontFamily: "system-ui, sans-serif",
          },
        },
        strategy: "inline-svg",
      }],
      rehypeMermaidPanels,
    ],
  },
});
