import { defineConfig } from "astro/config";
import rehypeMermaid from "rehype-mermaid";

export default defineConfig({
  site: "https://dexterbrylle.com",
  output: "static",
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["mermaid"],
    },
    rehypePlugins: [
      [
        rehypeMermaid,
        {
          mermaidConfig: {
            fontFamily: "Georgia, 'Times New Roman', serif",
            theme: "base",
            themeVariables: {
              primaryColor: "#f6f0df",
              primaryTextColor: "#2e2a25",
              primaryBorderColor: "#7f342a",
              lineColor: "#7f342a",
              secondaryColor: "#f0e6db",
              tertiaryColor: "#faf8f3",
              background: "#faf8f3",
              mainBkg: "#f6f0df",
              secondBkg: "#f0e6db",
              textColor: "#2e2a25",
              fontFamily: "Georgia, 'Times New Roman', serif",
            },
          },
          strategy: "inline-svg",
        },
      ],
    ],
  },
});
