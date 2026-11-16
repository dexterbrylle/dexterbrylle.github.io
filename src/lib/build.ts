// One id per build, used to version the static stylesheets in public/styles so a deploy
// never pairs new HTML with a browser-cached old stylesheet.
export const BUILD_ID = Date.now().toString(36);
