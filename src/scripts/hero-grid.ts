export {};

// The hero grid "thinks": an idea sparks on a node, branches out into possibilities,
// prunes the weak ones, then traces the one path it settled on and lands on an answer.

type Node = { x: number; y: number };
type Branch = { from: Node; to: Node; parent: number; depth: number; born: number; bend: number; leaf: boolean; lit: boolean };
type Thought = {
  root: Node; branches: Branch[]; frontier: number[]; used: Set<number>;
  maxDepth: number; nextGrow: number; resolveAt: number; path: number[];
  answer: Node | null; landed: boolean; endAt: number; seeded: boolean;
};
type Ring = { x: number; y: number; born: number; life: number; reach: number; strength: number; accent: boolean };

const STEP = 16;
const LENS = 88;
const LEVELS = 20;
const MAX_ALPHA = 0.6;
const DRAW_MS = 240;   // a new branch draws in over this long
const TRACE_MS = 110;  // the settled path is traced one branch per this long
const LINGER_MS = 1600; // the answer stays lit before the thought fades
const FADE_MS = 900;
const IGNORE = "a, button, h1, .kicker, p, input, textarea, select";

let dispose = () => {};

function init() {
  dispose();
  const element = document.querySelector<HTMLElement>(".band");
  if (!element) return;
  const band = element;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const ctx = context;
  canvas.setAttribute("aria-hidden", "true");
  const events = new AbortController();
  const { signal } = events;

  let width = 0, height = 0, columns = 0, rows = 0, offset = 0, narrow = false;
  let ink = "", accent = "", dotAlpha = 0.14, growMs = 120;
  let fade = new Float32Array(0), heat = new Float32Array(0);
  let thoughts: Thought[] = [];
  let rings: Ring[] = [];
  let time = 0, nextThought = 600, lastFrame = 0;
  let frame = 0, visible = false, dead = false;
  let pointer = { x: -1e4, y: -1e4 }, pointerIn = false, lift = 0;

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const index = (node: Node) => node.y * columns + node.x;
  const px = (column: number) => offset + column * STEP;
  const py = (row: number) => 8 + row * STEP;
  const inside = (node: Node) => node.x >= 0 && node.x < columns && node.y >= 0 && node.y < rows;
  const nearest = (x: number, y: number): Node => ({
    x: Math.max(0, Math.min(columns - 1, Math.round((x - offset) / STEP))),
    y: Math.max(0, Math.min(rows - 1, Math.round((y - 8) / STEP))),
  });
  const fadeAt = (x: number, y: number) => fade[index(nearest(x, y))] ?? 1;
  const warm = (node: Node, value: number) => { const i = index(node); if (i >= 0 && i < heat.length) heat[i] = Math.max(heat[i], value); };

  function colors() {
    const style = getComputedStyle(band);
    ink = style.getPropertyValue("--ink").trim();
    accent = style.getPropertyValue("--accent").trim();
    const alpha = /\/\s*([\d.]+)\s*\)/.exec(style.getPropertyValue("--dot"));
    dotAlpha = alpha ? Number(alpha[1]) : 0.14;
  }

  function measure() {
    const rect = band.getBoundingClientRect();
    width = band.clientWidth;
    height = band.clientHeight;
    offset = (width / 2) % STEP;
    columns = Math.ceil((width - offset) / STEP);
    rows = Math.ceil((height - 8) / STEP);
    const boxes = [...band.querySelectorAll("h1, .kicker")].map(element => {
      const box = element.getBoundingClientRect();
      return new DOMRect(box.x - rect.x - band.clientLeft, box.y - rect.y - band.clientTop, box.width, box.height);
    });
    // Everything drawn near the headline is faded so the text keeps its contrast.
    fade = new Float32Array(columns * rows);
    heat = new Float32Array(columns * rows);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = px(column), y = py(row);
        let value = 1;
        for (const box of boxes) {
          const distance = Math.hypot(Math.max(box.x - x, 0, x - box.right), Math.max(box.y - y, 0, y - box.bottom));
          const edge = Math.min(distance / 28, 1);
          value = Math.min(value, 0.25 + 0.75 * edge * edge * (3 - 2 * edge));
        }
        fade[row * columns + column] = value;
      }
    }
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colors();
    narrow = width < 760;
    growMs = narrow ? 140 : 120;
    thoughts = [];
    rings = [];
    nextThought = time + 400;
    draw();
  }

  // ---------- thinking ----------

  function spawn(root: Node, seeded: boolean) {
    const thought: Thought = {
      root, branches: [], frontier: [-1], used: new Set([index(root)]),
      maxDepth: narrow ? Math.round(rand(4, 5)) : Math.round(rand(5, 8)),
      nextGrow: time + 160, resolveAt: 0, path: [], answer: null, landed: false, endAt: Infinity, seeded,
    };
    thoughts.push(thought);
    warm(root, 1);
    ring(px(root.x), py(root.y), 34, 700, 0.5);
  }

  function seed(): Node | null {
    // Thoughts start anywhere clear of the text, preferring whichever third of the band is quietest.
    const thirds = [0, 1, 2].map(n => thoughts.filter(t => Math.floor((t.root.x / columns) * 3) === n).length);
    const quiet = Math.min(...thirds);
    const lanes = [0, 1, 2].filter(n => thirds[n] === quiet);
    for (let tries = 0; tries < 40; tries++) {
      const lane = tries < 20 ? lanes[Math.floor(Math.random() * lanes.length)] : Math.floor(Math.random() * 3);
      const node = {
        x: Math.min(columns - 1, Math.floor(rand(lane / 3, (lane + 1) / 3) * columns)),
        y: Math.floor(rand(1, rows - 1)),
      };
      const spacing = narrow ? 5 : 7;
      if (fade[index(node)] > (narrow ? 0.8 : 0.95) && thoughts.every(t => Math.hypot(t.root.x - node.x, t.root.y - node.y) > spacing)) return node;
    }
    return null;
  }

  const endOf = (thought: Thought, i: number) => (i < 0 ? thought.root : thought.branches[i].to);

  function grow(thought: Thought) {
    const next: number[] = [];
    const cap = narrow ? 34 : 72;
    for (const i of thought.frontier) {
      const depth = i < 0 ? 0 : thought.branches[i].depth;
      if (depth >= thought.maxDepth || thought.branches.length >= cap) continue;
      const from = endOf(thought, i);
      const heading = i < 0 ? rand(0, Math.PI * 2) : Math.atan2(from.y - thought.branches[i].from.y, from.x - thought.branches[i].from.x);
      // The first step fans out widely; later steps split into sub-branches around their heading,
      // and a few dead-end.
      const roll = Math.random();
      const count = depth === 0 ? 3 + Math.round(Math.random())
        : roll < 0.1 ? 0 : roll < 0.4 ? 1 : roll < 0.85 ? 2 : 3;
      for (let k = 0; k < count; k++) {
        for (let tries = 0; tries < 8; tries++) {
          const spread = count > 1 ? ((k / (count - 1)) - 0.5) * 1.6 : 0;
          const angle = depth === 0 ? heading + (k * Math.PI * 2) / count + rand(-0.4, 0.4) : heading + spread + rand(-0.35, 0.35);
          const length = rand(2, depth === 0 ? 5 : 4.5);
          const to = { x: Math.round(from.x + Math.cos(angle) * length), y: Math.round(from.y + Math.sin(angle) * length) };
          if (!inside(to) || thought.used.has(index(to)) || fade[index(to)] < (narrow ? 0.45 : 0.6)) continue;
          thought.used.add(index(to));
          thought.branches.push({ from, to, parent: i, depth: depth + 1, born: time, bend: rand(-0.35, 0.35), leaf: true, lit: false });
          if (i >= 0) thought.branches[i].leaf = false;
          next.push(thought.branches.length - 1);
          break;
        }
      }
    }
    thought.frontier = next;
    if (!next.length) resolve(thought);
  }

  function resolve(thought: Thought) {
    thought.resolveAt = time + DRAW_MS;
    const leaves = thought.branches.map((b, i) => [b, i] as const).filter(([b]) => b.leaf);
    if (!leaves.length) { thought.endAt = time + FADE_MS; return; }
    // Settle on one of the deepest ideas, then remember how it got there.
    const deepest = Math.max(...leaves.map(([b]) => b.depth));
    const choices = leaves.filter(([b]) => b.depth >= deepest - 1);
    let cursor = choices[Math.floor(Math.random() * choices.length)][1];
    thought.answer = thought.branches[cursor].to;
    while (cursor >= 0) { thought.path.unshift(cursor); cursor = thought.branches[cursor].parent; }
    thought.endAt = thought.resolveAt + thought.path.length * TRACE_MS + LINGER_MS + FADE_MS;
  }

  function update() {
    const auto = thoughts.filter(t => !t.seeded).length;
    // At least three thoughts are always in flight, started a beat apart so they overlap.
    if (time >= nextThought) {
      if (auto < (narrow ? 3 : 4)) { const node = seed(); if (node) spawn(node, false); }
      nextThought = time + (auto < 3 ? rand(250, 600) : rand(900, 1700));
    }
    for (const thought of thoughts) {
      if (!thought.resolveAt && time >= thought.nextGrow) { grow(thought); thought.nextGrow = time + growMs; }
      for (const branch of thought.branches) {
        if (!branch.lit && time - branch.born >= DRAW_MS) { branch.lit = true; warm(branch.to, 0.7); }
      }
      if (thought.answer && !thought.landed && time >= thought.resolveAt + thought.path.length * TRACE_MS) {
        thought.landed = true;
        warm(thought.answer, 1);
        ring(px(thought.answer.x), py(thought.answer.y), 72, 1100, 0.7, true);
      }
    }
    thoughts = thoughts.filter(t => time < t.endAt);
    // Background chatter: a few random dots flicker as if half-noticed.
    if (Math.random() < (narrow ? 0.04 : 0.08)) {
      const node = { x: Math.floor(rand(0, columns)), y: Math.floor(rand(0, rows)) };
      warm(node, rand(0.25, 0.5));
    }
  }

  // ---------- drawing ----------

  function curve(branch: Branch, upTo: number) {
    const ax = px(branch.from.x), ay = py(branch.from.y), bx = px(branch.to.x), by = py(branch.to.y);
    const mx = (ax + bx) / 2 - (by - ay) * branch.bend, my = (ay + by) / 2 + (bx - ax) * branch.bend;
    const at = (s: number) => [(1 - s) ** 2 * ax + 2 * (1 - s) * s * mx + s * s * bx, (1 - s) ** 2 * ay + 2 * (1 - s) * s * my + s * s * by];
    return { at, sample: (path: Path2D) => {
      path.moveTo(ax, ay);
      for (let s = 1; s <= 8; s++) { const [x, y] = at((s / 8) * upTo); path.lineTo(x, y); }
    } };
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const t = time;

    // Dots: a slow swell drifts across the grid, lifted by heat, rings and the pointer.
    const buckets = Array.from({ length: LEVELS }, () => new Path2D());
    const active = rings.map(ring => {
      const p = (t - ring.born) / ring.life;
      return { ring, p, front: ring.reach * (1 - (1 - p) ** 2), power: ring.strength * (1 - p) };
    });
    for (let row = 0; row < rows; row++) {
      const y0 = py(row);
      for (let column = 0; column < columns; column++) {
        const i = row * columns + column;
        const x0 = px(column);
        const swell = 0.5
          + 0.3 * Math.sin(x0 * 0.011 - t * 0.0005 + Math.sin(y0 * 0.018 + t * 0.00023) * 1.7)
          + 0.2 * Math.sin((x0 * 0.6 + y0) * 0.009 + t * 0.00035);
        let alpha = dotAlpha * (0.45 + 1.1 * swell);
        let radius = 1.1, x = x0, y = y0;
        if (lift > 0.01) {
          const dx = x0 - pointer.x, dy = y0 - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < LENS) {
            const k = (1 - distance / LENS) ** 2 * lift;
            alpha += k * 0.3;
            radius += k * 0.6;
            if (distance > 0.5) { x += (dx / distance) * k * 3; y += (dy / distance) * k * 3; }
          }
        }
        for (const { ring, front, power } of active) {
          const distance = Math.hypot(x0 - ring.x, y0 - ring.y);
          const k = Math.max(0, 1 - Math.abs(distance - front) / 22) * power;
          if (k > 0) { alpha += k * 0.38; radius += k * 0.7; }
        }
        const h = heat[i];
        if (h > 0) { alpha += h * 0.42; radius += h * 0.9; }
        alpha *= fade[i];
        if (alpha < 0.004) continue;
        // Quadratic buckets keep fine steps for faint dots, where banding shows.
        const level = Math.min(LEVELS - 1, Math.round(Math.sqrt(alpha / MAX_ALPHA) * (LEVELS - 1)));
        if (level === 0) continue;
        buckets[level].moveTo(x + radius, y);
        buckets[level].arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    ctx.fillStyle = ink;
    for (let level = 1; level < LEVELS; level++) {
      ctx.globalAlpha = (level / (LEVELS - 1)) ** 2 * MAX_ALPHA;
      ctx.fill(buckets[level]);
    }

    // Thoughts: faint exploring branches, then the chosen path traced and held.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = ink;
    for (const thought of thoughts) {
      const ending = Math.min(1, Math.max(0, (thought.endAt - t) / FADE_MS));
      const resolved = thought.resolveAt > 0 && t >= thought.resolveAt;
      // Rejected branches stay visible while the answer is traced, then recede.
      const settled = resolved ? Math.min(1, (t - thought.resolveAt) / 1600) : 0;
      const onPath = new Set(thought.path);
      const traced = resolved ? (t - thought.resolveAt) / TRACE_MS : -1;
      thought.branches.forEach((branch, i) => {
        const drawn = Math.min(1, (t - branch.born) / DRAW_MS);
        const { sample } = curve(branch, drawn);
        const f = fade[index(branch.to)];
        const explore = 0.32 * (1 - branch.depth * 0.06);
        let alpha = explore * (onPath.has(i) ? 1 : 1 - settled * 0.6);
        let lineWidth = 1;
        const step = thought.path.indexOf(i);
        if (step >= 0 && traced > step) { alpha = 0.3 + 0.3 * Math.min(1, traced - step); lineWidth = 1.5; }
        ctx.globalAlpha = alpha * ending * f;
        ctx.lineWidth = lineWidth;
        const path = new Path2D();
        sample(path);
        ctx.stroke(path);
      });
      // A pulse runs along the settled path toward the answer.
      if (resolved && traced < thought.path.length) {
        const step = Math.floor(traced);
        const branch = thought.branches[thought.path[step]];
        const [x, y] = curve(branch, 1).at(traced - step);
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.65 * fadeAt(x, y);
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
      if (thought.landed && thought.answer) {
        const x = px(thought.answer.x), y = py(thought.answer.y);
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9 * ending * fadeAt(x, y);
        ctx.fillRect(x - 3, y - 3, 6, 6);
      }
    }

    // Accent rings mark an answer and the origin of a click.
    for (const { ring, p, front } of active) {
      if (!ring.accent) continue;
      const f = fadeAt(ring.x, ring.y);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.55 * (1 - p) ** 2 * f;
      ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.min(front, 64), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function ring(x: number, y: number, reach: number, life: number, strength: number, isAccent = false) {
    rings.push({ x, y, born: time, life, reach, strength, accent: isAccent });
  }

  function loop(now: number) {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(now - lastFrame, 100);
    lastFrame = now;
    time += dt;
    const decay = dt / 1500;
    for (let i = 0; i < heat.length; i++) if (heat[i] > 0) heat[i] = Math.max(0, heat[i] - decay);
    lift += ((pointerIn ? 1 : 0) - lift) * Math.min(1, dt / 180);
    rings = rings.filter(r => time - r.born < r.life);
    update();
    draw();
  }

  function onPointerMove(event: PointerEvent) {
    if (!finePointer.matches) return;
    const rect = band.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left - band.clientLeft, y: event.clientY - rect.top - band.clientTop };
    pointerIn = true;
  }

  function onPointerDown(event: PointerEvent) {
    if (!frame || (event.target as Element | null)?.closest(IGNORE)) return;
    if (thoughts.filter(t => t.seeded).length >= 3) return;
    const rect = band.getBoundingClientRect();
    const x = event.clientX - rect.left - band.clientLeft, y = event.clientY - rect.top - band.clientTop;
    // A click gives it something to think about, starting where it landed.
    ring(x, y, Math.min(Math.max(width, height) * 0.4, 420), 1400, 0.9, true);
    spawn(nearest(x, y), true);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (motion.matches) {
      canvas.remove();
      band.classList.remove("grid-ready");
    } else {
      if (!canvas.isConnected) { measure(); band.prepend(canvas); band.classList.add("grid-ready"); }
      if (visible && !document.hidden) { lastFrame = performance.now(); frame = requestAnimationFrame(loop); }
    }
  }

  let resizeTimer = 0;
  const resize = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { if (!dead && canvas.isConnected) measure(); }, 150);
  });
  const theme = new MutationObserver(() => { colors(); draw(); });
  const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });

  function start() {
    if (dead) return;
    resize.observe(band);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    intersection.observe(band);
    motion.addEventListener("change", sync, { signal });
    document.addEventListener("visibilitychange", sync, { signal });
    band.addEventListener("pointermove", onPointerMove, { signal, passive: true });
    band.addEventListener("pointerleave", () => { pointerIn = false; }, { signal });
    band.addEventListener("pointerdown", onPointerDown, { signal });
    document.fonts.ready.then(() => { if (!dead && canvas.isConnected) measure(); });
    sync();
  }

  // Idle work starts after the browser has had a chance to paint the CSS grid.
  const paint = requestAnimationFrame(() => requestAnimationFrame(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 1000 });
    else setTimeout(start, 0);
  }));

  dispose = () => {
    dead = true;
    cancelAnimationFrame(paint);
    cancelAnimationFrame(frame);
    clearTimeout(resizeTimer);
    resize.disconnect(); theme.disconnect(); intersection.disconnect();
    events.abort(); canvas.remove(); band.classList.remove("grid-ready");
  };
}

init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => dispose());
window.addEventListener("pagehide", () => dispose());
window.addEventListener("pageshow", event => { if (event.persisted) init(); });
