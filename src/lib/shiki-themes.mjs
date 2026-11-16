// Code colors drawn from the site palette. Every token clears 4.5:1 on its code surface
// (#ece8de light, #2a2a37 dark).
const scopes = (c) => [
  { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: c.comment, fontStyle: "italic" } },
  { scope: ["keyword", "storage", "storage.type", "storage.modifier", "keyword.operator.new", "keyword.control"], settings: { foreground: c.keyword } },
  { scope: ["string", "string.quoted", "string.template", "punctuation.definition.string", "markup.inline.raw"], settings: { foreground: c.string } },
  { scope: ["entity.name.function", "support.function", "meta.function-call", "entity.name.command", "support.function.builtin"], settings: { foreground: c.fn } },
  { scope: ["constant", "constant.numeric", "constant.language", "variable.other.constant", "support.constant"], settings: { foreground: c.constant } },
  { scope: ["entity.name.type", "support.type", "entity.name.class", "entity.other.inherited-class", "entity.name.tag"], settings: { foreground: c.fn } },
  { scope: ["variable.parameter", "variable.other.option", "entity.other.attribute-name"], settings: { foreground: c.constant } },
  { scope: ["punctuation", "meta.brace", "keyword.operator"], settings: { foreground: c.punctuation } },
  { scope: ["markup.heading", "markup.bold"], settings: { foreground: c.keyword, fontStyle: "bold" } },
];

export const hairlineLight = {
  name: "hairline-light",
  type: "light",
  colors: { "editor.background": "#ece8de", "editor.foreground": "#1f1f28" },
  tokenColors: scopes({
    comment: "#54546d",
    keyword: "#a0522d",
    string: "#6b5a1e",
    fn: "#315e4d",
    constant: "#8a3b5c",
    punctuation: "#54546d",
  }),
};

export const hairlineDark = {
  name: "hairline-dark",
  type: "dark",
  colors: { "editor.background": "#2a2a37", "editor.foreground": "#dcd7ba" },
  tokenColors: scopes({
    comment: "#9a9886",
    keyword: "#e08a63",
    string: "#d9c27a",
    fn: "#9cc5ae",
    constant: "#d7a3be",
    punctuation: "#9a9886",
  }),
};
