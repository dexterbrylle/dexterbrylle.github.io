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
    rehypePlugins: [rehypeMermaid],
  },
});
