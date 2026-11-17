export {};

// Home hero: a looping grayscale video rendered live as Geist Mono ASCII on the
// band canvas. The <video> is never shown; each frame is sampled at one pixel
// per character cell, mapped to a 10-step ramp and drawn from a glyph atlas.

const RAMP = " .:-=+*#%@";
const VIDEO = [["/video/hero.webm", "video/webm"], ["/video/hero.mp4", "video/mp4"]] as const;
const POSTER = "/video/hero-poster.webp";
/** Where the subject sits in the source frame; cover-cropping keeps it in view. */
const FOCUS_X = 0.72, FOCUS_Y = 0.5;
const FADE_FLOOR = 0.12, FADE_FEATHER = 24, ALPHA_LEVELS = 8;
const RIPPLE_SPEED = 0.35, RIPPLE_LIFE = 900, RIPPLE_BAND = 24, RIPPLE_SHIFT = 6, RIPPLE_MAX = 4;
const FRAME_MS = 1000 / 24;
const IGNORE = "a, button, h1, .kicker, p";

type Ripple = { x: number; y: number; start: number };
type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Luminance byte -> ramp index, with a mild black lift, gamma and contrast. */
const LEVEL = new Uint8Array(256);
for (let v = 0; v < 256; v++) {
  let l = Math.max(0, (v / 255 - 0.03) / 0.97) ** 0.9;
  l = Math.min(1, Math.max(0, 0.5 + (l - 0.5) * 1.1));
  LEVEL[v] = Math.min(RAMP.length - 1, Math.floor(l * RAMP.length));
}

let dispose = () => {};

function init() {
  dispose();
  const element = document.querySelector<HTMLElement>(".band");
  if (!element) return;
  const band = element;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const sampler = new OffscreenCanvas(1, 1);
  const samplerContext = sampler.getContext("2d", { willReadFrequently: true });
  const atlas = new OffscreenCanvas(1, 1);
  const atlasContext = atlas.getContext("2d");
  if (!context || !samplerContext || !atlasContext) return;
  const ctx = context, sample = samplerContext, glyphs = atlasContext;
  canvas.ariaHidden = "true";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  const animated = !motion.matches && !saveData;
  const events = new AbortController();
  const { signal } = events;

  let width = 0, height = 0, dpr = 1, cellW = 9, cellH = 16, cellWD = 18, cellHD = 32, columns = 0, rows = 0;
  let ink = "", accent = "";
  let alphaLevel = new Uint8Array(0);
  let luma = new Uint8Array(0);
  let poster: HTMLImageElement | null = null;
  let video: VideoWithFrames | null = null;
  let playing = false, visible = true, dead = false, ready = false;
  let frameHandle = 0, videoHandle = 0, rippleHandle = 0, resizeTimer = 0, lastFrame = 0;
  const ripples: Ripple[] = [];

  // ---------- measuring ----------

  function fades() {
    const rect = band.getBoundingClientRect();
    const boxes = [...band.querySelectorAll("h1, .kicker")].map(node => {
      const box = node.getBoundingClientRect();
      return new DOMRect(box.x - rect.x - band.clientLeft, box.y - rect.y - band.clientTop, box.width, box.height);
    });
    alphaLevel = new Uint8Array(columns * rows);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = (column + 0.5) * cellW, y = (row + 0.5) * cellH;
        let fade = 1;
        for (const box of boxes) {
          const distance = Math.hypot(Math.max(box.x - x, 0, x - box.right), Math.max(box.y - y, 0, y - box.bottom));
          const edge = Math.min(distance / FADE_FEATHER, 1);
          fade = Math.min(fade, FADE_FLOOR + (1 - FADE_FLOOR) * edge * edge * (3 - 2 * edge));
        }
        alphaLevel[row * columns + column] = Math.round(((fade - FADE_FLOOR) / (1 - FADE_FLOOR)) * (ALPHA_LEVELS - 1));
      }
    }
  }

  /** One row of the 10 ramp glyphs per alpha level, in --ink, at device resolution. */
  function paintAtlas() {
    const style = getComputedStyle(band);
    ink = style.getPropertyValue("--ink").trim();
    accent = style.getPropertyValue("--accent").trim();
    const mono = style.getPropertyValue("--mono").trim() || "monospace";
    const base = width < 760 ? 0.55 : 0.35;
    atlas.width = cellWD * RAMP.length;
    atlas.height = cellHD * ALPHA_LEVELS;
    glyphs.clearRect(0, 0, atlas.width, atlas.height);
    glyphs.font = `400 ${Math.round(cellHD * 0.8)}px ${mono}`;
    glyphs.textAlign = "center";
    glyphs.textBaseline = "middle";
    glyphs.fillStyle = ink;
    for (let level = 0; level < ALPHA_LEVELS; level++) {
      glyphs.globalAlpha = base * (FADE_FLOOR + (1 - FADE_FLOOR) * (level / (ALPHA_LEVELS - 1)));
      for (let i = 1; i < RAMP.length; i++) glyphs.fillText(RAMP[i], (i + 0.5) * cellWD, (level + 0.5) * cellHD);
    }
  }

  function measure() {
    width = band.clientWidth;
    height = band.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const small = width < 760;
    cellWD = Math.round((small ? 7 : 9) * dpr);
    cellHD = Math.round((small ? 12 : 16) * dpr);
    cellW = cellWD / dpr;
    cellH = cellHD / dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    columns = Math.ceil(canvas.width / cellWD);
    rows = Math.ceil(canvas.height / cellHD);
    sampler.width = columns;
    sampler.height = rows;
    sample.imageSmoothingEnabled = true;
    sample.imageSmoothingQuality = "high";
    luma = new Uint8Array(columns * rows);
    fades();
    paintAtlas();
  }

  // ---------- sampling ----------

  /** Draw the source into the cell-sized sampler with object-fit: cover, then read luminance. */
  function read(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
    if (!sourceWidth || !sourceHeight || !columns) return false;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const w = width / scale, h = height / scale;
    const sx = Math.min(Math.max(FOCUS_X * sourceWidth - w / 2, 0), sourceWidth - w);
    const sy = Math.min(Math.max(FOCUS_Y * sourceHeight - h / 2, 0), sourceHeight - h);
    // The sampler grid covers whole cells, which can run a fraction past the band edge.
    const cw = (columns * cellW) / scale, ch = (rows * cellH) / scale;
    sample.clearRect(0, 0, columns, rows);
    sample.drawImage(source, sx, sy, cw, ch, 0, 0, columns, rows);
    const data = sample.getImageData(0, 0, columns, rows).data;
    for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
      luma[i] = (data[p] * 54 + data[p + 1] * 183 + data[p + 2] * 19) >> 8;
    }
    return true;
  }

  function readCurrent() {
    if (video && video.readyState >= 2 && read(video, video.videoWidth, video.videoHeight)) return true;
    return poster ? read(poster, poster.naturalWidth, poster.naturalHeight) : false;
  }

  /** Bilinear luminance at a band-space point, for ripple displacement. */
  function lumaAt(x: number, y: number) {
    const gx = Math.min(Math.max(x / cellW - 0.5, 0), columns - 1);
    const gy = Math.min(Math.max(y / cellH - 0.5, 0), rows - 1);
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const x1 = Math.min(x0 + 1, columns - 1), y1 = Math.min(y0 + 1, rows - 1);
    const fx = gx - x0, fy = gy - y0;
    const top = luma[y0 * columns + x0] * (1 - fx) + luma[y0 * columns + x1] * fx;
    const bottom = luma[y1 * columns + x0] * (1 - fx) + luma[y1 * columns + x1] * fx;
    return Math.round(top * (1 - fy) + bottom * fy);
  }

  // ---------- drawing ----------

  function draw(now = performance.now()) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    while (ripples.length && now - ripples[0].start > RIPPLE_LIFE) ripples.shift();
    const rings = ripples.map(r => ({ ...r, radius: (now - r.start) * RIPPLE_SPEED, life: (now - r.start) / RIPPLE_LIFE }));

    for (const ring of rings) {
      // The tap origin gets one sunflower square behind its glyph.
      const column = Math.floor(ring.x / cellW), row = Math.floor(ring.y / cellH);
      const side = Math.min(cellWD, cellHD);
      ctx.globalAlpha = 0.9 * (1 - ring.life);
      ctx.fillStyle = accent;
      ctx.fillRect(column * cellWD, row * cellHD + (cellHD - side) / 2, side, side);
    }
    ctx.globalAlpha = 1;

    const half = RIPPLE_BAND / 2;
    for (let row = 0, i = 0; row < rows; row++) {
      const y = row * cellHD, cy = (row + 0.5) * cellH;
      for (let column = 0; column < columns; column++, i++) {
        let level = LEVEL[luma[i]];
        if (rings.length) {
          const cx = (column + 0.5) * cellW;
          for (const ring of rings) {
            const dx = cx - ring.x, dy = cy - ring.y;
            const distance = Math.hypot(dx, dy);
            const off = Math.abs(distance - ring.radius);
            if (off > half) continue;
            const push = distance > 0 ? RIPPLE_SHIFT / distance : 0;
            level = LEVEL[lumaAt(cx + dx * push, cy + dy * push)] + (off < half / 2 ? 3 : 2);
            break;
          }
          if (level > RAMP.length - 1) level = RAMP.length - 1;
        }
        if (!level) continue;
        ctx.drawImage(atlas, level * cellWD, alphaLevel[i] * cellHD, cellWD, cellHD, column * cellWD, y, cellWD, cellHD);
      }
    }
    if (!ready) {
      ready = true;
      band.classList.add("grid-ready");
    }
  }

  function render(now?: number) {
    if (readCurrent()) draw(now);
  }

  // ---------- scheduling ----------

  function onVideoFrame() {
    if (!video || !playing) return;
    render();
    videoHandle = video.requestVideoFrameCallback!(onVideoFrame);
  }

  function onAnimationFrame(now: number) {
    frameHandle = requestAnimationFrame(onAnimationFrame);
    if (now - lastFrame < FRAME_MS - 1) return;
    lastFrame = now;
    render(now);
  }

  function stopFrames() {
    cancelAnimationFrame(frameHandle);
    frameHandle = 0;
    if (video && videoHandle) video.cancelVideoFrameCallback?.(videoHandle);
    videoHandle = 0;
  }

  /** Ripples over a still frame need their own short loop. */
  function rippleLoop(now: number) {
    rippleHandle = 0;
    draw(now);
    if (ripples.length && !playing) rippleHandle = requestAnimationFrame(rippleLoop);
  }

  function sync() {
    stopFrames();
    if (!video || dead) return;
    if (visible && !document.hidden) {
      video.play().catch((error: DOMException) => {
        // AbortError just means a pause() interrupted play(); anything else (autoplay blocked) falls back.
        if (error.name !== "AbortError") fallBack();
      });
    } else {
      video.pause();
    }
  }

  function startFrames() {
    stopFrames();
    if (!video || !playing) return;
    if (video.requestVideoFrameCallback) videoHandle = video.requestVideoFrameCallback(onVideoFrame);
    else frameHandle = requestAnimationFrame(onAnimationFrame);
  }

  function releaseVideo() {
    if (!video) return;
    stopFrames();
    const element = video;
    video = null;
    playing = false;
    element.pause();
    element.querySelectorAll("source").forEach(source => source.remove());
    element.removeAttribute("src");
    element.load();
    element.remove();
  }

  /** Video failed or autoplay is blocked: keep the poster as a static ASCII frame. */
  function fallBack() {
    releaseVideo();
    if (poster && read(poster, poster.naturalWidth, poster.naturalHeight)) draw();
  }

  function createVideo() {
    const element = document.createElement("video") as VideoWithFrames;
    element.muted = true;
    element.defaultMuted = true;
    element.loop = true;
    element.playsInline = true;
    element.autoplay = true;
    element.preload = "metadata";
    element.setAttribute("muted", "");
    element.setAttribute("playsinline", "");
    element.setAttribute("aria-hidden", "true");
    element.setAttribute("tabindex", "-1");
    element.setAttribute("disablepictureinpicture", "");
    element.setAttribute("disableremoteplayback", "");
    for (const [src, type] of VIDEO) {
      const source = document.createElement("source");
      source.src = src;
      source.type = type;
      element.append(source);
    }
    // Each failing <source> fires its own error; only the last one means nothing can play.
    element.lastElementChild!.addEventListener("error", () => fallBack(), { signal });
    element.addEventListener("error", () => fallBack(), { signal });
    element.addEventListener("playing", () => { playing = true; startFrames(); }, { signal });
    element.addEventListener("pause", () => { playing = false; stopFrames(); }, { signal });
    band.append(element);
    video = element;
    sync();
  }

  // ---------- interaction ----------

  function onPointerDown(event: PointerEvent) {
    if (!(event.target instanceof Element) || event.target.closest(IGNORE)) return;
    const rect = band.getBoundingClientRect();
    ripples.push({ x: event.clientX - rect.left - band.clientLeft, y: event.clientY - rect.top - band.clientTop, start: performance.now() });
    if (ripples.length > RIPPLE_MAX) ripples.shift();
    if (!playing && !rippleHandle) rippleHandle = requestAnimationFrame(rippleLoop);
  }

  // ---------- lifecycle ----------

  const resize = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (dead) return;
      measure();
      render();
    }, 150);
  });
  const theme = new MutationObserver(() => {
    paintAtlas();
    draw();
  });
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  });

  async function start() {
    if (dead) return;
    const mono = getComputedStyle(band).getPropertyValue("--mono").trim() || "monospace";
    await document.fonts.load(`400 13px ${mono}`, RAMP).catch(() => {});
    if (dead) return;
    band.prepend(canvas);
    measure();
    const image = new Image();
    image.decoding = "async";
    image.src = POSTER;
    try { await image.decode(); poster = image; } catch { poster = null; }
    if (dead) return;
    if (poster) render();
    resize.observe(band);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    motion.addEventListener("change", () => init(), { signal });
    if (!animated) return;
    band.addEventListener("pointerdown", onPointerDown, { passive: true, signal });
    intersection.observe(band);
    document.addEventListener("visibilitychange", sync, { signal });
    createVideo();
  }

  // Start once the browser has painted the CSS dots and has a moment to spare.
  const paint = requestAnimationFrame(() => requestAnimationFrame(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => void start(), { timeout: 1000 });
    else setTimeout(() => void start(), 0);
  }));

  dispose = () => {
    dead = true;
    cancelAnimationFrame(paint);
    cancelAnimationFrame(rippleHandle);
    clearTimeout(resizeTimer);
    releaseVideo();
    resize.disconnect();
    theme.disconnect();
    intersection.disconnect();
    events.abort();
    canvas.remove();
    band.classList.remove("grid-ready");
  };
}

init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => dispose());
window.addEventListener("pagehide", () => dispose());
window.addEventListener("pageshow", event => { if (event.persisted) init(); });
