export {};

// The hidden station video is classified into theme-aware, device-aligned blocks.

const VIDEO = [["/video/hero.webm", "video/webm"], ["/video/hero.mp4", "video/mp4"]] as const;
const POSTER = "/video/hero-poster.webp";
/** Where the subject sits in the source frame; cover-cropping keeps it in view. */
const FOCUS_X = 0.72, FOCUS_Y = 0.5;
const FADE_FLOOR = 0.12, FADE_FEATHER = 24, ALPHA_LEVELS = 8;
const RIPPLE_SPEED = 0.35, RIPPLE_LIFE = 900, RIPPLE_BAND = 24, RIPPLE_MAX = 4;
const FRAME_MS = 1000 / 24;
const IGNORE = "a, button, h1, .kicker, p";

type Ripple = { x: number; y: number; start: number };
type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

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
  if (!context || !samplerContext) return;
  const ctx = context, sample = samplerContext;
  canvas.ariaHidden = "true";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const connection = "connection" in navigator ? navigator.connection : null;
  const saveData = typeof connection === "object" && connection !== null && "saveData" in connection && connection.saveData === true;
  const animated = !motion.matches && !saveData;
  const events = new AbortController();
  const { signal } = events;

  let width = 0, height = 0, dpr = 1, cellW = 8, cellH = 8, cellWD = 16, cellHD = 16, columns = 0, rows = 0;
  let ink = "", accent = "", dark = false, base = 0.35;
  let bucketAlphas: number[] = [];
  let alphaLevel = new Uint8Array(0);
  let texels = new Uint8Array(0);
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

  function colours() {
    const style = getComputedStyle(band);
    ink = style.getPropertyValue("--ink").trim();
    accent = style.getPropertyValue("--accent").trim();
    dark = document.documentElement.dataset.theme === "dark";
    base = width < 760 ? 0.55 : 0.35;
    bucketAlphas = [];
    for (const alpha of [base * 0.3, base * 0.65, base, base, 1, 0.18]) {
      for (let fade = 0; fade < ALPHA_LEVELS; fade++) {
        bucketAlphas.push(alpha * (FADE_FLOOR + (1 - FADE_FLOOR) * fade / (ALPHA_LEVELS - 1)));
      }
    }
  }

  function measure() {
    width = band.clientWidth;
    height = band.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    const small = width < 760;
    cellWD = Math.round((small ? 6 : 8) * dpr);
    cellHD = cellWD;
    cellW = cellWD / dpr;
    cellH = cellHD / dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    columns = Math.ceil(canvas.width / cellWD);
    rows = Math.ceil(canvas.height / cellHD);
    sampler.width = 160;
    sampler.height = 90;
    sample.imageSmoothingEnabled = false;
    texels = new Uint8Array(columns * rows);
    fades();
    colours();
  }

  // ---------- sampling ----------

  /** Read one texel per art pixel, then cover-crop with the existing subject focus. */
  function read(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
    if (!sourceWidth || !sourceHeight || !columns) return false;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const w = width / scale, h = height / scale;
    const sx = Math.min(Math.max(FOCUS_X * sourceWidth - w / 2, 0), sourceWidth - w);
    const sy = Math.min(Math.max(FOCUS_Y * sourceHeight - h / 2, 0), sourceHeight - h);
    sample.clearRect(0, 0, 160, 90);
    sample.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, 160, 90);
    const data = sample.getImageData(0, 0, 160, 90).data;
    for (let row = 0, i = 0; row < rows; row++) {
      const y = Math.min(89, Math.floor((sy + (row + 0.5) * cellH / scale) / sourceHeight * 90));
      for (let column = 0; column < columns; column++, i++) {
        const x = Math.min(159, Math.floor((sx + (column + 0.5) * cellW / scale) / sourceWidth * 160));
        const p = (y * 160 + x) * 4;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        // Broad thresholds tolerate the 4:2:0 H.264 fallback's chroma rounding.
        texels[i] = r > 185 && g > 165 && b < 165 && r - b > 65 ? 5
          : r > 210 && g > 210 && b > 210 ? 4
          : r > 140 ? 3 : r > 76 ? 2 : r > 22 ? 1 : 0;
      }
    }
    return true;
  }

  function readCurrent() {
    if (video && video.readyState >= 2 && read(video, video.videoWidth, video.videoHeight)) return true;
    return poster ? read(poster, poster.naturalWidth, poster.naturalHeight) : false;
  }

  // ---------- drawing ----------

  function draw(now = performance.now()) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    while (ripples.length && now - ripples[0].start > RIPPLE_LIFE) ripples.shift();
    const rings = ripples.map(r => ({ ...r, radius: (now - r.start) * RIPPLE_SPEED }));
    const paths = Array.from({ length: bucketAlphas.length }, () => new Path2D());
    const used = new Set<number>();
    for (let row = 0, i = 0; row < rows; row++) {
      const cy = (row + 0.5) * cellH;
      for (let column = 0; column < columns; column++, i++) {
        const kind = texels[i];
        if (!kind) continue;
        const cx = (column + 0.5) * cellW;
        const ring = rings.some(r => Math.abs(Math.hypot(cx - r.x, cy - r.y) - r.radius) <= RIPPLE_BAND / 2);
        let bucket = kind === 5 ? 4 : kind === 4 ? 3 : dark ? kind - 1 : 3 - kind;
        if (ring && kind <= 3) bucket = kind === 1 ? 5 : Math.min(2, bucket + 1);
        const index = bucket * ALPHA_LEVELS + alphaLevel[i];
        paths[index].rect(column * cellWD, row * cellHD, cellWD, cellHD);
        used.add(index);
      }
    }
    for (const index of used) {
      ctx.fillStyle = index >= 4 * ALPHA_LEVELS ? accent : ink;
      ctx.globalAlpha = bucketAlphas[index];
      ctx.fill(paths[index]);
    }
    // Origins remain solid blocks; they share a single fill regardless of ring count.
    if (rings.length) {
      const origins = new Path2D();
      for (const ring of rings) origins.rect(Math.floor(ring.x / cellW) * cellWD, Math.floor(ring.y / cellH) * cellHD, cellWD, cellHD);
      ctx.fillStyle = accent;
      ctx.globalAlpha = 1;
      ctx.fill(origins);
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
      // An observer can sync an already-playing video without another playing event.
      if (playing) startFrames();
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

  /** Video failed or autoplay is blocked: keep the poster as a static pixel frame. */
  function fallBack() {
    releaseVideo();
    if (poster && read(poster, poster.naturalWidth, poster.naturalHeight)) draw();
  }

  function createVideo() {
    const element: VideoWithFrames = document.createElement("video");
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
    colours();
    draw();
  });
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  });

  async function start() {
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
