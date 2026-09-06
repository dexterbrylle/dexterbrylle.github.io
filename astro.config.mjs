import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import rehypeMermaid from "rehype-mermaid";

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
  integrations: [sitemap({ filter: (page) => !new URL(page).pathname.startsWith("/blog/") })],
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
        mermaidConfig: {
          fontFamily: "Archivo, Arial, sans-serif",
          theme: "base",
          themeVariables: {
            primaryColor: "#F7F5F0",
            primaryTextColor: "#1F2A30",
            primaryBorderColor: "#0E6160",
            lineColor: "#0E6160",
            secondaryColor: "#E1E9E5",
            tertiaryColor: "#F1EFE9",
            background: "#F1EFE9",
            mainBkg: "#F7F5F0",
            secondBkg: "#E1E9E5",
            textColor: "#1F2A30",
            fontFamily: "Archivo, Arial, sans-serif",
          },
        },
        strategy: "inline-svg",
      }],
      rehypeMermaidPanels,
    ],
  },
});
