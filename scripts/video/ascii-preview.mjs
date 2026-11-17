#!/usr/bin/env node
// Quick ASCII preview of the hero source video: box-downsamples frames to
// 107x34 cells and maps luminance to a 10-step ramp. No dependencies; needs ffmpeg.
//
//   node scripts/video/ascii-preview.mjs [input.mp4] [--frames 36,133,154] [--out dir]
//
// Defaults: assets-src/hero.mp4, the normal / failure-dark / recovery-flash frames
// derived from render-hero's failure timing, written to artifacts/hero-video/.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIDTH, HEIGHT, PREVIEW_FRAMES } from './render-hero.mjs';

const COLS = 107;
const ROWS = 34;
const RAMP = ' .:-=+*#%@';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const framesArg = opt('--frames');
const outDir = opt('--out') ?? join(root, 'artifacts', 'hero-video');
const input = args[0] ?? join(root, 'assets-src', 'hero.mp4');

const frames = framesArg
  ? framesArg.split(',').map((n) => [`frame`, Number(n)])
  : Object.entries(PREVIEW_FRAMES);

function extractFrame(n) {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-loglevel', 'error', '-i', input, '-vf', `select=eq(n\\,${n})`, '-fps_mode', 'passthrough',
      '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: WIDTH * HEIGHT * 2 },
  );
  if (r.status !== 0 || r.stdout.length !== WIDTH * HEIGHT) {
    throw new Error(`ffmpeg failed to extract frame ${n}: ${r.stderr}`);
  }
  return r.stdout;
}

export function toAscii(gray, width = WIDTH, height = HEIGHT) {
  const lines = [];
  for (let row = 0; row < ROWS; row++) {
    const y0 = Math.floor((row * height) / ROWS);
    const y1 = Math.floor(((row + 1) * height) / ROWS);
    let line = '';
    for (let col = 0; col < COLS; col++) {
      const x0 = Math.floor((col * width) / COLS);
      const x1 = Math.floor(((col + 1) * width) / COLS);
      let sum = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) sum += gray[y * width + x];
      const l = sum / ((y1 - y0) * (x1 - x0) * 255);
      line += RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))];
    }
    lines.push(line.trimEnd());
  }
  return lines.join('\n') + '\n';
}

mkdirSync(outDir, { recursive: true });
for (const [label, n] of frames) {
  const text = toAscii(extractFrame(n));
  const file = join(outDir, `ascii-${String(n).padStart(3, '0')}-${label}.txt`);
  writeFileSync(file, text);
  console.log(`--- frame ${n} (${label}) -> ${relative(root, file)}`);
  process.stdout.write(text);
}
