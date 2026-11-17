#!/usr/bin/env node
// Deterministic original station artwork. Node 24 + ffmpeg, no rendering dependencies.
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ART_WIDTH = 160, ART_HEIGHT = 90;
export const WIDTH = 960, HEIGHT = 540, FPS = 24, FRAMES = 240;
export const PALETTE = [[0, 0, 0], [48, 48, 48], [104, 104, 104], [176, 176, 176], [240, 240, 240], [255, 226, 120]];
export const CONTACT_FRAMES = [0, 48, 90, 114, 132, 138, 144, 192];
export const FAILURE = { start: 96, recovery: 132, end: 144, facing: -0.75 };
const TAU = Math.PI * 2;
const CX = ART_WIDTH * 0.72, CY = ART_HEIGHT * 0.5, R = ART_HEIGHT * 0.38;
const TW = 256, TH = 128;
const wrap = n => ((n % TW) + TW) % TW;
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ seed >>> 15, seed | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rand = random(0x57a710);
const texture = new Uint8Array(TW * TH).fill(2);
function rectangle(x, y, w, h, value) {
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    if (y + dy >= 0 && y + dy < TH) texture[(y + dy) * TW + wrap(x + dx)] = value;
  }
}
// Overlapping blocks avoid continuous latitude seams or an equatorial groove.
for (let i = 0; i < 270; i++) {
  const x = Math.floor(rand() * TW), y = Math.floor(rand() * TH);
  const w = 3 + Math.floor(rand() * 14), h = 2 + Math.floor(rand() * 8);
  rectangle(x, y, w, h, rand() < 0.48 ? 2 : 3);
  if (i % 7 === 0) for (let v = 0; v < 3; v++) rectangle(x + v * 2, y, 1, Math.min(h, 4), 1);
}
export const clusters = Array.from({ length: 8 }, (_, i) => ({
  lon: i * TAU / 8 + (rand() - 0.5) * 0.2,
  lat: i === 0 ? -0.65 : (rand() - 0.5) * 1.65,
}));
export const lights = clusters.flatMap((cluster, district) => Array.from({ length: 8 }, (_, order) => ({
  lon: cluster.lon + (order % 3 - 1) * 0.095 + (rand() - 0.5) * 0.04,
  lat: cluster.lat + (Math.floor(order / 3) - 1) * 0.085 + (rand() - 0.5) * 0.035,
  district, order, frequency: 2 + Math.floor(rand() * 4), phase: rand(),
})));
const stars = Array.from({ length: 34 }, () => ({
  x: 73 + Math.floor(rand() * 86), y: 3 + Math.floor(rand() * 84),
  frequency: 1 + Math.floor(rand() * 3), phase: rand(), twinkle: rand() < 0.3,
}));
const antennae = Array.from({ length: 7 }, () => ({ lon: rand() * TAU, lat: (rand() - 0.5) * 2.1 }));
// At the middle of the 36-frame blackout the failed district faces the night side.
const theta0 = FAILURE.facing - clusters[0].lon - TAU * ((FAILURE.start + FAILURE.recovery) / 2 / FRAMES);
function project(lon, lat, theta, radius = R) {
  const a = lon + theta, c = Math.cos(lat);
  const x = Math.sin(a) * c, y = Math.sin(lat), z = Math.cos(a) * c;
  return { x: Math.floor(CX + radius * x), y: Math.floor(CY - radius * y), z, night: 0.88 * x + 0.46 * y + 0.08 * z < 0 };
}
export function renderArtFrame(frame) {
  const p = frame / FRAMES;
  const theta = TAU * p + theta0;
  const pixels = new Uint8Array(ART_WIDTH * ART_HEIGHT);
  const put = (x, y, value) => {
    if (x >= 72 && x < ART_WIDTH && y >= 0 && y < ART_HEIGHT) pixels[y * ART_WIDTH + x] = value;
  };
  for (const star of stars) {
    if (!star.twinkle || Math.cos(TAU * (star.frequency * p + star.phase)) > -0.8) put(star.x, star.y, 4);
  }
  for (const stub of antennae) {
    const base = project(stub.lon, stub.lat, theta);
    if (base.z < 0 || base.z > 0.24) continue;
    for (let n = 0; n < 3; n++) {
      const point = project(stub.lon, stub.lat, theta, R + n);
      put(point.x, point.y, base.night ? 1 : 2);
    }
  }
  for (let y = 0; y < ART_HEIGHT; y++) for (let x = 0; x < ART_WIDTH; x++) {
    const nx = (x + 0.5 - CX) / R, ny = (CY - y - 0.5) / R;
    const rr = nx * nx + ny * ny;
    if (rr > 1) continue;
    const nz = Math.sqrt(1 - rr);
    const longitude = Math.atan2(nx, nz) - theta;
    const tx = wrap(Math.floor(longitude / TAU * TW));
    const ty = Math.min(TH - 1, Math.floor((0.5 - Math.asin(ny) / Math.PI) * TH));
    const panel = texture[ty * TW + tx];
    const light = 0.88 * nx + 0.46 * ny + 0.08 * nz;
    // Only the immediate one-art-pixel terminator band is dithered.
    const night = light < (((x + y) & 1) ? -0.012 : 0.012);
    pixels[y * ART_WIDTH + x] = night ? 1 : panel;
  }
  for (const light of lights) {
    const point = project(light.lon, light.lat, theta);
    if (point.z <= 0.12) continue;
    const recovery = (frame - FAILURE.recovery) / (FAILURE.end - FAILURE.recovery);
    const failed = light.district === 0 && frame >= FAILURE.start && frame < FAILURE.end;
    if (failed && (recovery < 0 || light.order >= Math.floor(recovery * 8))) continue;
    const flash = light.district === 0 && frame === FAILURE.end;
    // Integer frequency and seeded phase keep every twinkle periodic at the seam.
    if (!flash && !failed && Math.cos(TAU * (light.frequency * p + light.phase)) < -0.96) continue;
    put(point.x, point.y, point.night ? 5 : 3);
    // A single small white flash, rather than a halo, marks full recovery.
    if (flash && light.order === 3) put(point.x + 1, point.y, 4);
  }
  const rgb = new Uint8Array(ART_WIDTH * ART_HEIGHT * 3);
  for (let i = 0; i < pixels.length; i++) rgb.set(PALETTE[pixels[i]], i * 3);
  return rgb;
}
export function renderFrame(frame) {
  const art = renderArtFrame(frame), rgb = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const source = (Math.floor(y / 6) * ART_WIDTH + Math.floor(x / 6)) * 3;
    rgb.set(art.subarray(source, source + 3), (y * WIDTH + x) * 3);
  }
  return rgb;
}
export async function ffmpeg(args, writer) {
  const child = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [writer ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', data => stderr += data);
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr}`)));
  });
  if (writer) await writer(child.stdin);
  await done;
}
async function main() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const source = `${root}assets-src/hero.mp4`, gif = `${root}assets-src/hero-preview.gif`;
  const webm = `${root}public/video/hero.webm`, mp4 = `${root}public/video/hero.mp4`, poster = `${root}public/video/hero-poster.webp`;
  await mkdir(`${root}assets-src`, { recursive: true });
  await mkdir(`${root}public/video`, { recursive: true });
  const start = performance.now();
  const first = renderFrame(0), seam = renderFrame(FRAMES);
  let differences = 0;
  for (let i = 0; i < first.length; i += 3) if (first[i] !== seam[i] || first[i + 1] !== seam[i + 1] || first[i + 2] !== seam[i + 2]) differences++;
  console.log(`seam: frame 240 vs frame 0: ${differences} differing pixels`);
  if (differences) throw new Error('Loop seam mismatch');
  const hash = createHash('sha256');
  await ffmpeg(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '960x540', '-r', '24', '-i', '-', '-an', '-c:v', 'libx264', '-qp', '0', '-pix_fmt', 'yuv444p', '-threads', '1', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-movflags', '+faststart', source], async stdin => {
    for (let frame = 0; frame < FRAMES; frame++) {
      const rgb = renderFrame(frame);
      hash.update(rgb);
      if (!stdin.write(rgb)) await once(stdin, 'drain');
    }
    stdin.end();
  });
  const input = ['-i', source, '-an', '-sws_flags', 'neighbor', '-vf', 'scale=320:180:flags=neighbor', '-r', '24', '-frames:v', '240', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact'];
  await ffmpeg([...input, '-c:v', 'libvpx-vp9', '-lossless', '1', '-pix_fmt', 'yuv444p', '-threads', '1', webm]);
  await ffmpeg([...input, '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', '-threads', '1', '-movflags', '+faststart', mp4]);
  const encoders = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (encoders.stdout.includes('libwebp')) {
    await ffmpeg(['-i', source, '-sws_flags', 'neighbor', '-vf', 'scale=320:180:flags=neighbor', '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', poster]);
  } else {
    // Homebrew's minimal ffmpeg omits WebP; use its installed companion encoder.
    const png = `${root}assets-src/hero-poster.png`;
    await ffmpeg(['-i', source, '-vf', 'scale=320:180:flags=neighbor', '-frames:v', '1', png]);
    const result = spawnSync('cwebp', ['-quiet', '-lossless', png, '-o', poster]);
    if (result.status !== 0) throw new Error(`Poster needs ffmpeg with libwebp or cwebp: ${result.stderr}`);
  }
  await ffmpeg(['-i', source, '-vf', 'fps=12,scale=480:270:flags=neighbor,split[a][b];[a]palettegen=max_colors=8[p];[b][p]paletteuse=dither=none', '-loop', '0', '-fflags', '+bitexact', gif]);
  console.log(`Node ${process.version}; ${FRAMES} frames; render + all encodes ${((performance.now() - start) / 1000).toFixed(2)}s`);
  console.log(`raw sha256 ${hash.digest('hex')}`);
  for (const file of [source, gif, webm, mp4, poster]) {
    const size = (await stat(file)).size;
    if ((file === webm || file === mp4) && size > 1_500_000) throw new Error(`${file} exceeds 1.5MB`);
    console.log(`${file.slice(root.length)}: ${size} bytes; sha256 ${createHash('sha256').update(await readFile(file)).digest('hex')}`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error); process.exitCode = 1; });
