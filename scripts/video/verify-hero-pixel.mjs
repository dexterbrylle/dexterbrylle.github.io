#!/usr/bin/env node
// Re-runnable media evidence, including every frame's left-side luminance.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { renderFrame, renderArtFrame, FRAMES, PALETTE, CONTACT_FRAMES, FAILURE, clusters, lights, ffmpeg } from './render-hero.mjs';
const output = new URL('../../artifacts/hero-pixel/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
function decode(file, filter, width, height, frames = 1) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', filter, '-frames:v', String(frames), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: width * height * frames * 3 + 1024 });
  assert.equal(result.status, 0, result.stderr.toString());
  assert.equal(result.stdout.length, width * height * frames * 3);
  return result.stdout;
}
function blocks(rgb, width, height, side) {
  let differences = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = (y * width + x) * 3, q = (Math.floor(y / side) * side * width + Math.floor(x / side) * side) * 3;
    if (rgb[p] !== rgb[q] || rgb[p + 1] !== rgb[q + 1] || rgb[p + 2] !== rgb[q + 2]) differences++;
  }
  return differences;
}
const seam = renderFrame(FRAMES);
assert.deepEqual(seam, renderFrame(0));
const palette = new Set(PALETTE.map(c => c.join(',')));
const luminance = [];
let yellow = 0;
for (let frame = 0; frame < FRAMES; frame++) {
  const rgb = renderArtFrame(frame);
  let sum = 0;
  for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
    const p = (y * 160 + x) * 3;
    assert.ok(palette.has([...rgb.subarray(p, p + 3)].join(',')));
    if (x < 64) sum += (rgb[p] * 0.2126 + rgb[p + 1] * 0.7152 + rgb[p + 2] * 0.0722) / 255;
    if (rgb[p] === 255) yellow++;
  }
  luminance.push(sum / (64 * 90));
}
assert.ok(Math.max(...luminance) < 0.08);
// The solved facing is on the visible night side at the middle of the blackout.
const facing = FAILURE.facing, lat = clusters[0].lat;
assert.ok(Math.cos(facing) * Math.cos(lat) > 0);
assert.ok(0.88 * Math.sin(facing) * Math.cos(lat) + 0.46 * Math.sin(lat) + 0.08 * Math.cos(facing) * Math.cos(lat) < 0);
for (const frame of [114, 132, 138, 144]) for (const light of lights.filter(light => light.district === 0)) {
  const a = light.lon - clusters[0].lon + FAILURE.facing + Math.PI * 2 * (frame - 114) / FRAMES;
  const x = Math.sin(a) * Math.cos(light.lat), y = Math.sin(light.lat), z = Math.cos(a) * Math.cos(light.lat);
  assert.ok(z > 0.12, 'failed district stays visible through recovery');
  assert.ok(0.88 * x + 0.46 * y + 0.08 * z < 0, 'recovery windows remain on the night side');
}
const districtStates = [];
for (const frame of [114, 132, 138, 144]) {
  const rgb = renderArtFrame(frame);
  let on = 0;
  for (const light of lights.filter(light => light.district === 0)) {
    const a = light.lon - clusters[0].lon + FAILURE.facing + Math.PI * 2 * (frame - 114) / FRAMES;
    const x = Math.floor(160 * 0.72 + 90 * 0.38 * Math.sin(a) * Math.cos(light.lat));
    const y = Math.floor(90 * 0.5 - 90 * 0.38 * Math.sin(light.lat));
    const p = (y * 160 + x) * 3;
    const yellow = rgb[p] === 255 && rgb[p + 1] === 226 && rgb[p + 2] === 120;
    const expected = frame === 144 || (frame === 138 && light.order < 4);
    assert.equal(yellow, expected, `frame ${frame}, window ${light.order}: blackout/ordered recovery`);
    if (yellow) on++;
  }
  districtStates.push({ frame, windowsOn: on });
}
const sourceBlocks = blocks(decode('assets-src/hero.mp4', 'select=eq(n\\,0)', 960, 540), 960, 540, 6);
assert.equal(sourceBlocks, 0, 'source has hard uniform 6x6 blocks');
const web = decode('public/video/hero.webm', 'null', 320, 180, FRAMES);
let webBlockDifferences = 0;
for (let frame = 0; frame < FRAMES; frame++) webBlockDifferences += blocks(web.subarray(frame * 320 * 180 * 3, (frame + 1) * 320 * 180 * 3), 320, 180, 2);
assert.equal(webBlockDifferences, 0, 'VP9 preserves all 2x2 blocks');
const fallback = decode('public/video/hero.mp4', 'select=eq(n\\,0)', 320, 180);
const fallbackBlockDifferences = blocks(fallback, 320, 180, 2);
const streams = {};
for (const file of ['assets-src/hero.mp4', 'public/video/hero.webm', 'public/video/hero.mp4']) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', file]);
  assert.equal(probe.status, 0);
  const [stream] = JSON.parse(probe.stdout).streams;
  assert.equal(stream.nb_read_frames, '240');
  assert.equal(stream.r_frame_rate, '24/1');
  assert.equal(streams[file] = stream.pix_fmt, file.startsWith('assets') || file.endsWith('webm') ? 'yuv444p' : 'yuv420p');
  assert.equal(stream.width, file.startsWith('assets') ? 960 : 320);
  assert.equal(stream.height, file.startsWith('assets') ? 540 : 180);
}
await ffmpeg(['-i', 'assets-src/hero.mp4', '-vf', `select='${CONTACT_FRAMES.map(n => `eq(n,${n})`).join('+')}',scale=480:270:flags=neighbor,tile=4x2`, '-frames:v', '1', `${output}contact.png`]);
await ffmpeg(['-i', 'assets-src/hero.mp4', '-vf', 'scale=3840:2160:flags=neighbor', '-frames:v', '1', `${output}zoom-4x.png`]);
const report = {
  seamDifferingPixels: 0, paletteValues: PALETTE.length, yellowArtPixelsAcrossLoop: yellow,
  source6x6DifferingPixels: sourceBlocks, webm2x2DifferingPixelsAll240Frames: webBlockDifferences,
  mp4ChromaInterpolationDifferingPixelsFrame0: fallbackBlockDifferences,
  reasonForVP9444: 'H.264 4:2:0 interpolates yellow edges; lossless VP9 4:4:4 preserves uniform blocks.',
  left40Luminance: { min: Math.min(...luminance), max: Math.max(...luminance), mean: luminance.reduce((a, b) => a + b) / FRAMES, frames: luminance },
  streams, districtStates, contactFrames: CONTACT_FRAMES,
};
await writeFile(`${output}media-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, left40Luminance: { ...report.left40Luminance, frames: '(all 240 in media-report.json)' } }, null, 2));
