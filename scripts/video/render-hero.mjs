#!/usr/bin/env node
// Procedurally renders the home-hero source video: a slowly rotating globe of
// network nodes that loses one node and heals once per loop.
//
// Pixels are computed in plain JS and piped as raw 8-bit gray frames to ffmpeg.
// No dependencies beyond Node 24 and an ffmpeg binary on PATH.
//
//   npm run video:hero
//
// Outputs (gitignored):
//   assets-src/hero.mp4          H.264 yuv420p, CRF 20, no audio, +faststart
//   assets-src/hero-preview.gif  480 wide, 12fps, for quick review
//
// Every time-varying term is a periodic function of the loop phase
// p = frame / FRAMES in [0, 1), so frame FRAMES renders identically to frame 0.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------------------

/** Frame size, rate and loop length. 24fps x 10s = 240 frames. */
export const WIDTH = 960;
export const HEIGHT = 540;
export const FPS = 24;
export const SECONDS = 10;
export const FRAMES = FPS * SECONDS;

/** PRNG seed for node placement and arc pairing. Same seed -> identical video. */
export const SEED = 0x5e7e1e55;

/** Sphere centre as a fraction of width / height, radius as a fraction of height.
 *  The subject sits in the right ~45% so the headline on the left stays clear. */
export const SPHERE_CX = 0.72;
export const SPHERE_CY = 0.5;
export const SPHERE_R = 0.38;

/** Rotation axis lean in the picture plane (degrees, clockwise from vertical). */
export const TILT_DEG = 15;
/** Extra tip of the axis toward the viewer (degrees) so the north cap shows a little. */
export const TIP_DEG = 10;

/** Number of fixed nodes on the surface, and great-circle arcs between node pairs. */
export const NODE_COUNT = 24;
export const ARC_COUNT = 6;
/** Arcs attached to the node that fails (taken from ARC_COUNT). */
export const FAIL_NODE_ARCS = 2;
/** Pulse speed per arc, in whole trips per loop (integers keep the loop seamless). */
export const PULSE_TRIPS = [1, 2, 1, 3, 2, 1];

/** Node and arc sizes as angles on the unit sphere (radians).
 *  At R = 205px: node core ~14px radius, arc line ~11px wide, pulse ~16px wide. */
export const NODE_RADIUS = 0.07;
export const ARC_HALF_WIDTH = 0.028;
export const PULSE_HALF_WIDTH = 0.04;
export const PULSE_LENGTH = 0.11;

/** Failure timeline, in seconds from the loop start. One node per loop:
 *  dims over FAIL_DIM_S, holds black for FAIL_DARK_S, then flashes and recovers
 *  over FAIL_FLASH_S. Its arcs fade out over FAIL_ARC_FADE_S and back during the flash.
 *  The whole window must end before SECONDS so it never straddles the loop seam. */
export const FAIL_START_S = 4.5;
export const FAIL_DIM_S = 0.3;
export const FAIL_DARK_S = 1.5;
export const FAIL_FLASH_S = 0.7;
export const FAIL_ARC_FADE_S = 0.4;
/** Longitude (degrees, negative = left of centre) the failing node faces at mid-blackout.
 *  The rotation phase is solved so the failure always lands on the lit front face. */
export const FAIL_FACING_DEG = -15;

/** Left fade: background is untouched right of LEFT_FADE_START (fraction of width)
 *  and eases to pure black by LEFT_FADE_END. */
export const LEFT_FADE_START = 0.45;
export const LEFT_FADE_END = 0.2;

/** Background noise level and amplitude (0..1 luminance). Kept very low. */
export const BG_LEVEL = 0.018;
export const BG_AMPLITUDE = 0.03;

/** Light direction (view space, x right, y up, z toward viewer): upper left. */
const LIGHT = normalize([-0.55, 0.62, 0.56]);

// ---------------------------------------------------------------------------
// Derived timing, exported so the ASCII preview can pick representative frames
// ---------------------------------------------------------------------------

const FAIL_DARK_START_S = FAIL_START_S + FAIL_DIM_S;
const FAIL_FLASH_START_S = FAIL_DARK_START_S + FAIL_DARK_S;
const FAIL_END_S = FAIL_FLASH_START_S + FAIL_FLASH_S;
if (FAIL_END_S >= SECONDS) throw new Error('Failure window must end before the loop seam');

export const PREVIEW_FRAMES = {
  normal: Math.round(1.5 * FPS),
  'failure-dark': Math.round((FAIL_DARK_START_S + FAIL_DARK_S / 2) * FPS),
  'recovery-flash': Math.round((FAIL_FLASH_START_S + 0.12) * FPS),
};

// ---------------------------------------------------------------------------
// Small math helpers
// ---------------------------------------------------------------------------

function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
const frac = (x) => x - Math.floor(x);
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** mulberry32: tiny deterministic PRNG. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Scene: nodes and arcs in body space (fixed for the whole video)
// ---------------------------------------------------------------------------

function fromLatLon(lat, lon) {
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
}
const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b))));

function buildScene() {
  const rand = mulberry32(SEED);
  const nodes = [];
  // Node 0 is the one that fails: keep it in the northern, lit band.
  nodes.push(fromLatLon((20 + rand() * 10) * DEG, rand() * TAU));
  let minSep = 20 * DEG;
  let tries = 0;
  while (nodes.length < NODE_COUNT) {
    const y = (rand() * 2 - 1) * Math.sin(68 * DEG);
    const p = fromLatLon(Math.asin(y), rand() * TAU);
    if (nodes.every((n) => angleBetween(n, p) >= minSep)) nodes.push(p);
    if (++tries % 2000 === 0) minSep *= 0.9;
  }

  const pairs = [];
  const used = new Set();
  const key = (i, j) => (i < j ? `${i}-${j}` : `${j}-${i}`);
  const pick = (candidates) => {
    // Fisher-Yates with the seeded PRNG, then take the first candidate.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates[0];
  };
  for (let k = 0; k < FAIL_NODE_ARCS; k++) {
    const c = [];
    for (let j = 1; j < NODE_COUNT; j++) {
      const ang = angleBetween(nodes[0], nodes[j]);
      if (ang >= 35 * DEG && ang <= 75 * DEG && !used.has(key(0, j))) c.push([0, j]);
    }
    const pr = pick(c);
    used.add(key(...pr));
    pairs.push(pr);
  }
  while (pairs.length < ARC_COUNT) {
    const c = [];
    for (let i = 1; i < NODE_COUNT; i++) {
      for (let j = i + 1; j < NODE_COUNT; j++) {
        const ang = angleBetween(nodes[i], nodes[j]);
        if (ang >= 40 * DEG && ang <= 100 * DEG && !used.has(key(i, j))) c.push([i, j]);
      }
    }
    const pr = pick(c);
    used.add(key(...pr));
    pairs.push(pr);
  }

  const arcs = pairs.map(([i, j], k) => ({
    i,
    j,
    omega: angleBetween(nodes[i], nodes[j]),
    trips: PULSE_TRIPS[k % PULSE_TRIPS.length],
    offset: k / ARC_COUNT,
    reverse: k % 2 === 1,
  }));

  // Solve the rotation phase so node 0 faces FAIL_FACING_DEG at mid-blackout.
  // Ry(theta) adds theta to body longitude atan2(x, z).
  const lon0 = Math.atan2(nodes[0][0], nodes[0][2]);
  const pMid = (FAIL_DARK_START_S + FAIL_DARK_S / 2) / SECONDS;
  const theta0 = FAIL_FACING_DEG * DEG - lon0 - TAU * pMid;

  return { nodes, arcs, theta0 };
}

export const SCENE = buildScene();

// ---------------------------------------------------------------------------
// Per-frame state
// ---------------------------------------------------------------------------

/** Body -> view: v = Rz(-tilt) . Rx(tip) . Ry(theta) . b */
function makeTransform(theta) {
  const ct = Math.cos(theta), st = Math.sin(theta);
  const cp = Math.cos(TIP_DEG * DEG), sp = Math.sin(TIP_DEG * DEG);
  const cz = Math.cos(-TILT_DEG * DEG), sz = Math.sin(-TILT_DEG * DEG);
  return (b) => {
    // Ry(theta)
    let x = b[0] * ct + b[2] * st;
    let y = b[1];
    let z = -b[0] * st + b[2] * ct;
    // Rx(tip): tips the north pole toward the viewer
    const y2 = y * cp + z * sp;
    const z2 = -y * sp + z * cp;
    y = y2; z = z2;
    // Rz(-tilt): leans the axis clockwise in the picture plane
    const x3 = x * cz - y * sz;
    const y3 = x * sz + y * cz;
    return [x3, y3, z];
  };
}

/** Failure envelope at time t (seconds): node health h (1 = normal, 0 = black),
 *  flash intensity f, arc visibility a for arcs touching the failed node. */
export function failureState(t) {
  let h = 1, f = 0, a = 1;
  if (t >= FAIL_START_S && t < FAIL_END_S) {
    if (t < FAIL_DARK_START_S) h = 1 - smoothstep(FAIL_START_S, FAIL_DARK_START_S, t);
    else if (t < FAIL_FLASH_START_S) h = 0;
    else {
      const u = (t - FAIL_FLASH_START_S) / FAIL_FLASH_S;
      h = smoothstep(0, 0.35, u);
      f = smoothstep(0, 0.08, u) * (1 - u) * (1 - u);
    }
    if (t < FAIL_FLASH_START_S) a = 1 - smoothstep(FAIL_START_S, FAIL_START_S + FAIL_ARC_FADE_S, t);
    else a = smoothstep(FAIL_FLASH_START_S, FAIL_END_S, t);
  }
  return { h, f, a };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const CX = SPHERE_CX * WIDTH;
const CY = SPHERE_CY * HEIGHT;
const R = SPHERE_R * HEIGHT;
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const NODE_REJECT = Math.cos(NODE_RADIUS * 3.2);
const ARC_REJECT = Math.sin(PULSE_HALF_WIDTH * 1.2);

/** Periodic, low-frequency background noise. Each wave has an integer number of
 *  cycles per loop in time, so it returns to its start exactly at p = 1. */
function background(u, v, p) {
  const a = Math.sin(TAU * (1.1 * u + 0.6 * v + p) + 1.3);
  const b = Math.sin(TAU * (0.5 * u - 1.2 * v - 2 * p) + 0.4);
  const c = Math.sin(TAU * (1.7 * u + 1.9 * v + p) + 2.9);
  const n = 0.5 + 0.25 * a * b + 0.25 * c * a;
  return BG_LEVEL + BG_AMPLITUDE * n;
}

/** Render one frame to an 8-bit gray buffer. `frame` may be FRAMES (seam check). */
export function renderFrame(frame, out = new Uint8Array(WIDTH * HEIGHT)) {
  const p = frame / FRAMES;
  const t = p * SECONDS;
  const toView = makeTransform(TAU * p + SCENE.theta0);
  const fail = failureState(t);

  const nodes = SCENE.nodes.map((b, k) => {
    const v = toView(b);
    return { v, h: k === 0 ? fail.h : 1, f: k === 0 ? fail.f : 0 };
  });
  const arcs = SCENE.arcs.map((arc) => {
    const av = nodes[arc.i].v;
    const bv = nodes[arc.j].v;
    const n = normalize(cross(av, bv));
    const w = cross(n, av); // in-plane, 90 degrees from a toward b
    let tp = frac(arc.trips * p + arc.offset);
    if (arc.reverse) tp = 1 - tp;
    const alpha = arc.i === 0 || arc.j === 0 ? fail.a : 1;
    return { av, n, w, omega: arc.omega, tp, alpha };
  });

  const s = [0, 0, 0];
  for (let py = 0; py < HEIGHT; py++) {
    const sy = -(py + 0.5 - CY) / R;
    const v = (py + 0.5) / HEIGHT;
    for (let px = 0; px < WIDTH; px++) {
      const u = (px + 0.5) / WIDTH;
      const sx = (px + 0.5 - CX) / R;
      const r2 = sx * sx + sy * sy;
      const d = Math.sqrt(r2);

      // Outside: background noise plus a soft atmospheric halo.
      let outside = background(u, v, p);
      if (d > 0.9) outside += 0.16 * Math.exp(-Math.max(0, d - 1) * 9);

      let lum = outside;
      // Edge coverage, 1px antialiased.
      const cover = clamp01((1 - d) * R + 0.5);
      if (cover > 0) {
        const sz = Math.sqrt(Math.max(0, 1 - Math.min(r2, 1)));
        const inv = 1 / Math.max(1e-6, Math.hypot(sx, sy, sz));
        s[0] = sx * inv; s[1] = sy * inv; s[2] = sz * inv;

        // Surface: Lambert + specular + rim.
        const lam = Math.max(0, dot(s, LIGHT));
        const spec = Math.pow(Math.max(0, dot(s, HALF)), 28);
        const rim = Math.pow(1 - s[2], 2.6);
        let c = 0.03 + 0.6 * lam + 0.36 * spec + 0.34 * rim;

        // Features fade out toward the limb so nothing gets thinner than ~6px.
        const limb = smoothstep(0.1, 0.38, s[2]);
        if (limb > 0) {
          for (const arc of arcs) {
            if (arc.alpha <= 0) continue;
            const dp = dot(s, arc.n);
            if (dp > ARC_REJECT || dp < -ARC_REJECT) continue;
            const ang = Math.atan2(dot(s, arc.w), dot(s, arc.av));
            const tt = ang / arc.omega;
            if (tt < -0.05 || tt > 1.05) continue;
            const ends = smoothstep(-0.05, 0.02, tt) * (1 - smoothstep(0.98, 1.05, tt));
            const ad = Math.abs(dp);
            const line = (1 - smoothstep(ARC_HALF_WIDTH * 0.55, ARC_HALF_WIDTH, ad)) * ends;
            c += (0.82 - c) * line * 0.6 * arc.alpha * limb;
            const along = (tt - arc.tp) * arc.omega;
            const env = Math.sin(Math.PI * arc.tp);
            const pulse =
              Math.exp(-(along * along) / (PULSE_LENGTH * PULSE_LENGTH)) *
              env *
              (1 - smoothstep(PULSE_HALF_WIDTH * 0.5, PULSE_HALF_WIDTH, ad)) *
              ends;
            c += (1 - c) * pulse * arc.alpha * limb;
          }
          for (const node of nodes) {
            const cd = dot(s, node.v);
            if (cd < NODE_REJECT) continue;
            const dist = Math.sqrt(Math.max(0, 2 - 2 * cd)); // chord ~ angle
            const nr = NODE_RADIUS;
            // Dark ring separates the bright dot from a lit surface.
            const ring = smoothstep(nr * 0.95, nr * 1.15, dist) * (1 - smoothstep(nr * 1.45, nr * 1.8, dist));
            c *= 1 - 0.7 * ring * node.h * limb;
            // While failed, a wider crater of black replaces the dot and its ring.
            c *= 1 - 0.92 * (1 - node.h) * (1 - smoothstep(nr * 1.3, nr * 2, dist)) * limb;
            const core = 1 - smoothstep(nr * 0.7, nr, dist);
            // A failed node goes to black (h = 0) and then flashes on recovery.
            c += (0.97 * node.h - c) * core * limb;
            if (node.f > 0) {
              const spread = nr * (1.4 + 1.6 * (1 - node.f));
              c += (1 - c) * node.f * Math.exp(-(dist * dist) / (spread * spread)) * limb;
            }
          }
        }
        lum = outside + (c - outside) * cover;
      }

      // Left fade over everything, so the headline area stays black.
      lum *= smoothstep(LEFT_FADE_END, LEFT_FADE_START, u);
      out[py * WIDTH + px] = Math.round(clamp01(lum) * 255);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main: render, encode, report
// ---------------------------------------------------------------------------

function run(cmd, args, stdinWriter) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: [stdinWriter ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err}`))));
    if (stdinWriter) stdinWriter(child.stdin).catch(reject);
  });
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const outDir = join(root, 'assets-src');
  const mp4 = join(outDir, 'hero.mp4');
  const gif = join(outDir, 'hero-preview.gif');
  mkdirSync(outDir, { recursive: true });

  const started = performance.now();
  const rawHash = createHash('sha256');
  let first = null;

  await run(
    'ffmpeg',
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${WIDTH}x${HEIGHT}`, '-r', String(FPS), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-an',
      '-movflags', '+faststart', '-map_metadata', '-1',
      '-fflags', '+bitexact', '-flags:v', '+bitexact',
      mp4,
    ],
    async (stdin) => {
      for (let f = 0; f < FRAMES; f++) {
        const buf = renderFrame(f);
        if (f === 0) first = Buffer.from(buf);
        rawHash.update(buf);
        if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r));
      }
      stdin.end();
    },
  );
  const renderMs = performance.now() - started;

  // Seam self-check: render p = 240/240 directly (no modulo) and compare bytes to frame 0.
  const seam = renderFrame(FRAMES);
  let seamDiff = 0, seamMax = 0;
  for (let i = 0; i < seam.length; i++) {
    const d = Math.abs(seam[i] - first[i]);
    if (d) { seamDiff++; if (d > seamMax) seamMax = d; }
  }

  const gifStart = performance.now();
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', mp4,
    '-vf', 'fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none',
    '-loop', '0', '-fflags', '+bitexact', gif,
  ]);
  const gifMs = performance.now() - gifStart;

  const rel = (f) => relative(root, f);
  console.log(`node ${process.version}`);
  console.log(`rendered ${FRAMES} frames ${WIDTH}x${HEIGHT}@${FPS} in ${(renderMs / 1000).toFixed(1)}s (incl. encode); gif ${(gifMs / 1000).toFixed(1)}s`);
  console.log(`seam: frame ${FRAMES} vs frame 0 -> ${seamDiff} differing pixels (max delta ${seamMax})`);
  console.log(`raw  sha256 ${rawHash.digest('hex')}`);
  for (const f of [mp4, gif]) {
    console.log(`${rel(f).padEnd(28)} ${mb(statSync(f).size).padStart(9)}  sha256 ${sha256(readFileSync(f))}`);
  }
  console.log(`failure node arcs: ${SCENE.arcs.filter((a) => a.i === 0 || a.j === 0).length}; preview frames ${JSON.stringify(PREVIEW_FRAMES)}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
