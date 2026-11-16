export {};

type Node = { x: number; y: number };
type Packet = { node: Node; path: Node[]; trail: Node[] };

let dispose = () => {};

function init() {
  dispose();
  const element = document.querySelector<HTMLElement>(".band");
  if (!element) return;
  const band = element;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;
  const ctx = context;
  canvas.ariaHidden = "true";
  const grid = new OffscreenCanvas(1, 1);
  const gridContext = grid.getContext("2d");
  if (!gridContext) return;
  const dots = gridContext;
  const events = new AbortController();
  let width = 0, height = 0, columns = 0, rows = 0, offset = 0;
  let ink = "", accent = "", tick = 150;
  let boxes: DOMRect[] = [];
  let packets: Packet[] = [];
  let failure: { node: Node; until: number } | null = null;
  let time = 0, nextFailure = 7000, lastFrame = 0, lastTick = 0;
  let frame = 0, visible = false, dead = false;
  const same = (a: Node, b: Node) => a.x === b.x && a.y === b.y;
  const randomNode = (): Node => ({ x: Math.floor(Math.random() * columns), y: Math.floor(Math.random() * rows) });

  function route(start: Node, end: Node): Node[] {
    // Breadth-first search preserves grid steps and routes around the failed node.
    const queue = [start];
    const parents = new Map<string, Node | null>([[`${start.x},${start.y}`, null]]);
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      if (same(node, end)) {
        const path: Node[] = [];
        let cursor: Node | null | undefined = node;
        while (cursor && !same(cursor, start)) {
          path.unshift(cursor);
          cursor = parents.get(`${cursor.x},${cursor.y}`);
        }
        return path;
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { x: node.x + dx, y: node.y + dy };
        const key = `${next.x},${next.y}`;
        if (next.x < 0 || next.x >= columns || next.y < 0 || next.y >= rows
          || parents.has(key) || (failure && same(next, failure.node))) continue;
        parents.set(key, node);
        queue.push(next);
      }
    }
    return [];
  }

  function measure() {
    const rect = band.getBoundingClientRect();
    width = band.clientWidth;
    height = band.clientHeight;
    offset = (width / 2) % 16;
    columns = Math.ceil((width - offset) / 16);
    rows = Math.ceil((height - 8) / 16);
    boxes = [...band.querySelectorAll("h1, .kicker")].map(element => {
      const box = element.getBoundingClientRect();
      return new DOMRect(box.x - rect.x - band.clientLeft, box.y - rect.y - band.clientTop, box.width, box.height);
    });
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = grid.width = Math.round(width * dpr);
    canvas.height = grid.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dots.setTransform(dpr, 0, 0, dpr, 0, 0);
    const style = getComputedStyle(band);
    ink = style.getPropertyValue("--ink").trim();
    accent = style.getPropertyValue("--accent").trim();
    const dot = style.getPropertyValue("--dot").trim();
    for (let x = offset; x < width; x += 16) {
      for (let y = 8; y < height; y += 16) {
        const gradient = dots.createRadialGradient(x, y, 1, x, y, 1.2);
        gradient.addColorStop(0, dot);
        gradient.addColorStop(1, "transparent");
        dots.fillStyle = gradient;
        dots.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    tick = width < 760 ? 190 : 150;
    packets = Array.from({ length: width < 760 ? 4 : 8 }, () => ({ node: randomNode(), path: [], trail: [] }));
    failure = null;
    nextFailure = time + 6000 + Math.random() * 3000;
    draw();
  }

  function opacity(x: number, y: number) {
    let fade = 1;
    for (const box of boxes) {
      const distance = Math.hypot(Math.max(box.x - x, 0, x - box.right), Math.max(box.y - y, 0, y - box.bottom));
      const edge = Math.min(distance / 24, 1);
      fade = Math.min(fade, 0.25 + 0.75 * edge * edge * (3 - 2 * edge));
    }
    return fade;
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.drawImage(grid, 0, 0, width, height);
    ctx.fillStyle = ink;
    for (const packet of packets) {
      [packet.node, ...packet.trail].forEach((node, index) => {
        const x = offset + node.x * 16, y = 8 + node.y * 16;
        ctx.globalAlpha = [0.55, 0.3, 0.16, 0.07][index] * opacity(x, y);
        ctx.fillRect(x - 2, y - 2, 4, 4);
      });
    }
    if (failure) {
      const x = offset + failure.node.x * 16, y = 8 + failure.node.y * 16;
      const recovering = time >= failure.until;
      ctx.globalAlpha = (recovering ? 0.8 : 0.32) * opacity(x, y);
      if (recovering) {
        ctx.fillStyle = accent;
        ctx.fillRect(x - 3, y - 3, 6, 6);
      } else {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
        ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3);
        ctx.stroke();
      }
    }
  }

  function advance() {
    if (failure && time > failure.until + 300) failure = null;
    if (!failure && time >= nextFailure) {
      const candidate = packets.flatMap(packet => packet.path.slice(2, -1).slice(0, 4)).find(node =>
        node.x > 0 && node.x < columns - 1 && node.y > 0 && node.y < rows - 1
        && packets.every(packet => !same(packet.node, node)));
      if (candidate) {
        failure = { node: candidate, until: time + 3000 + Math.random() * 1000 };
        for (const packet of packets) {
          const end = packet.path.at(-1);
          if (end) packet.path = route(packet.node, end);
        }
      }
      nextFailure = time + 6000 + Math.random() * 3000;
    }
    for (const packet of packets) {
      if (!packet.path.length) packet.path = route(packet.node, randomNode());
      const next = packet.path.shift();
      if (next) {
        packet.trail = [packet.node, ...packet.trail].slice(0, 3);
        packet.node = next;
      }
    }
  }

  function loop(now: number) {
    frame = requestAnimationFrame(loop);
    if (now - lastFrame < 1000 / 30) return;
    time += Math.min(now - lastFrame, 100);
    lastFrame = now;
    if (time - lastTick >= tick) { advance(); lastTick = time; }
    draw();
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
  const resize = new ResizeObserver(measure);
  const theme = new MutationObserver(measure);
  const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  function start() {
    if (dead) return;
    resize.observe(band);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    intersection.observe(band);
    motion.addEventListener("change", sync, { signal: events.signal });
    document.addEventListener("visibilitychange", sync, { signal: events.signal });
    document.fonts.ready.then(() => { if (!dead) measure(); });
    sync();
  }
  // Idle work starts after the browser has had an opportunity to paint the CSS grid.
  const paint = requestAnimationFrame(() => requestAnimationFrame(() => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 1000 });
    else setTimeout(start, 0);
  }));
  dispose = () => {
    dead = true;
    cancelAnimationFrame(paint);
    cancelAnimationFrame(frame);
    resize.disconnect(); theme.disconnect(); intersection.disconnect();
    events.abort(); canvas.remove(); band.classList.remove("grid-ready");
  };
}

init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => dispose());
window.addEventListener("pagehide", () => dispose());
window.addEventListener("pageshow", event => { if (event.persisted) init(); });
