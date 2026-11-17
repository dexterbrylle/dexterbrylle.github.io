export {};

const SOURCE = "/images/hero/portrait.png";
const RAMP = " .:-=+*#%@";
const IGNORE = "a, button, h1, .kicker, p";
const RIPPLE_LIFE = 900;
type Cell = { x: number; y: number; glyph: number; colour: number; fade: number };
type Ripple = { x: number; y: number; start: number };
let dispose = () => {};

function init() {
  dispose();
  const element = document.querySelector<HTMLElement>(".band");
  if (!element) return;
  const band = element;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const ctx = context;
  canvas.ariaHidden = "true";
  const events = new AbortController();
  const { signal } = events;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = "connection" in navigator ? navigator.connection : null;
  const saveData = typeof connection === "object" && connection !== null && "saveData" in connection && connection.saveData === true;
  const source = new Image();
  const sampler = new OffscreenCanvas(1, 1);
  const sampleContext = sampler.getContext("2d", { willReadFrequently: true });
  if (!sampleContext) return;
  const sample = sampleContext;
  const atlas = new OffscreenCanvas(1, 1);
  const atlasContext = atlas.getContext("2d");
  if (!atlasContext) return;
  const glyphs = atlasContext;
  let width = 0, height = 0, dpr = 1, cellW = 1, cellH = 1, left = 0, top = 0;
  let cells: Cell[] = [], ripples: Ripple[] = [];
  let accent = "", base = 0.9;
  let frame = 0, resizeTimer = 0, dead = false, visible = true;

  function measure() {
    width = band.clientWidth;
    height = band.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const small = width < 760;
    cellW = Math.round((small ? 4 : 5.5) * dpr);
    cellH = Math.round((small ? 7 : 9) * dpr);
    const side = height * 1.08 * dpr;
    const columns = Math.round(side / cellW), rows = Math.round(side / cellH);
    left = Math.round(width * (small ? 0.72 : 0.77) * dpr - columns * cellW * 0.515);
    top = Math.round(height * dpr * 0.5 - rows * cellH * 0.565);
    const style = getComputedStyle(band);
    const ink = style.getPropertyValue("--ink").trim();
    const mono = style.getPropertyValue("--mono").trim() || "monospace";
    accent = style.getPropertyValue("--accent").trim();
    base = small ? 0.75 : 0.65;
    const colours = [ink, "#ff463c", "#3ed36c", "#397fe8"];
    atlas.width = cellW * RAMP.length;
    atlas.height = cellH * colours.length;
    glyphs.font = `400 ${Math.round(cellH * 0.95)}px ${mono}`;
    glyphs.textAlign = "center";
    glyphs.textBaseline = "middle";
    for (let colour = 0; colour < colours.length; colour++) {
      glyphs.fillStyle = colours[colour];
      for (let glyph = 1; glyph < RAMP.length; glyph++) {
        glyphs.fillText(RAMP[glyph], (glyph + 0.5) * cellW, (colour + 0.5) * cellH);
      }
    }
    const rect = band.getBoundingClientRect();
    const boxes = [...band.querySelectorAll("h1, .kicker")].flatMap(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].map(box => new DOMRect(box.x - rect.x - band.clientLeft, box.y - rect.y - band.clientTop, box.width, box.height));
    });
    sampler.width = columns;
    sampler.height = rows;
    sample.imageSmoothingEnabled = true;
    sample.imageSmoothingQuality = "high";
    sample.drawImage(source, 0, 0, columns, rows);
    const data = sample.getImageData(0, 0, columns, rows).data;
    cells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
      const p = (y * columns + x) * 4;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      if (data[p + 3] < 32) continue;
      const colour = r > g * 1.4 && r > b * 1.4 ? 1
        : g > r * 1.5 && g > b * 1.2 ? 2
        : b > r * 1.3 && b > g * 1.2 ? 3 : 0;
      const luma = (r * 54 + g * 183 + b * 19) / 256;
      // Lift the dark armour into visible glyph density without filling its transparent background.
      const density = Math.min(1, luma / (colour ? 160 : 110)) ** 0.6;
      const glyph = Math.min(RAMP.length - 1, 2 + Math.round(density * 7));
      const cx = (left + (x + 0.5) * cellW) / dpr, cy = (top + (y + 0.5) * cellH) / dpr;
      let fade = 1;
      for (const box of boxes) {
        const distance = Math.hypot(Math.max(box.x - cx, 0, cx - box.right), Math.max(box.y - cy, 0, cy - box.bottom));
        const edge = Math.min(distance / 24, 1);
        fade = Math.min(fade, 0.12 + 0.88 * edge * edge * (3 - 2 * edge));
      }
      cells.push({ x, y, glyph, colour, fade: fade * data[p + 3] / 255 });
    }
    draw();
  }

  function draw(now = performance.now()) {
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ripples = ripples.filter(r => now - r.start < RIPPLE_LIFE);
    for (const cell of cells) {
      const x = left + cell.x * cellW, y = top + cell.y * cellH;
      const hit = ripples.some(r => Math.abs(Math.hypot((x + cellW / 2) / dpr - r.x, (y + cellH / 2) / dpr - r.y) - (now - r.start) * 0.35) < 12);
      const glyph = Math.min(RAMP.length - 1, cell.glyph + (hit ? 2 : 0));
      ctx.globalAlpha = Math.min(1, base + (hit ? 0.2 : 0)) * cell.fade;
      ctx.drawImage(atlas, glyph * cellW, cell.colour * cellH, cellW, cellH, x, y, cellW, cellH);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = accent;
    for (const ripple of ripples) {
      const x = Math.floor((ripple.x * dpr - left) / cellW) * cellW + left;
      const y = Math.floor((ripple.y * dpr - top) / cellH) * cellH + top;
      ctx.fillRect(x, y, Math.min(cellW, cellH), Math.min(cellW, cellH));
    }
  }

  function loop(now: number) {
    frame = 0;
    if (dead || !visible || document.hidden || motion.matches || saveData) return;
    draw(now);
    if (ripples.length) frame = requestAnimationFrame(loop);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (motion.matches || document.hidden || !visible) {
      ripples = [];
      draw();
    } else if (ripples.length) frame = requestAnimationFrame(loop);
  }

  band.addEventListener("pointerdown", event => {
    if (motion.matches || saveData || !(event.target instanceof Element) || event.target.closest(IGNORE)) return;
    const rect = band.getBoundingClientRect();
    ripples.push({ x: event.clientX - rect.left - band.clientLeft, y: event.clientY - rect.top - band.clientTop, start: performance.now() });
    if (ripples.length > 4) ripples.shift();
    if (!frame) frame = requestAnimationFrame(loop);
  }, { passive: true, signal });

  const resize = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { if (!dead) measure(); }, 150);
  });
  const theme = new MutationObserver(() => measure());
  const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  document.addEventListener("visibilitychange", sync, { signal });
  motion.addEventListener("change", sync, { signal });
  source.decoding = "async";
  source.src = SOURCE;
  void source.decode().then(async () => {
    await document.fonts.ready;
    const mono = getComputedStyle(band).getPropertyValue("--mono").trim() || "monospace";
    await document.fonts.load(`400 10px ${mono}`, RAMP);
    if (dead) return;
    band.prepend(canvas);
    measure();
    band.classList.add("grid-ready");
    resize.observe(band);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    intersection.observe(band);
  }).catch(() => {});

  dispose = () => {
    dead = true;
    events.abort();
    cancelAnimationFrame(frame);
    clearTimeout(resizeTimer);
    resize.disconnect();
    theme.disconnect();
    intersection.disconnect();
    canvas.remove();
    band.classList.remove("grid-ready");
  };
}

init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => dispose());
window.addEventListener("pagehide", () => dispose());
window.addEventListener("pageshow", event => { if (event.persisted) init(); });
