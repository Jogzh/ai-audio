#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  track: { type: 'string', default: 'ink-tide' }, version: { type: 'string', default: 'hook' },
  seed: { type: 'string', default: '261014' }, bpm: { type: 'string' },
  transpose: { type: 'string', default: '0' },
  out: { type: 'string', default: 'artifacts/audio/ink-tide-v6-stems' },
  help: { type: 'boolean', default: false },
} });
if (values.help) {
  console.log('npm run render:stems -- [--track ink-tide] [--version full|hook|loop] [--bpm 92] [--transpose 0] [--seed 261014] [--out NEW_DIRECTORY]');
  console.log('Exports independent PCM16 WAV stems at their original mix levels, with effects and automation, plus raw mix and a measured sum check. No peak or loudness normalization. The output directory must be new.');
  process.exit(0);
}
const options = { version: values.version, seed: Number(values.seed), transpose: Number(values.transpose), bpm: values.bpm === undefined ? undefined : Number(values.bpm) };
if (!values.seed.trim() || !values.transpose.trim() || (values.bpm !== undefined && !values.bpm.trim())) throw new RangeError('数值参数不能为空');
const output = path.resolve(values.out);
let server, browser;
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  const prepared = await page.evaluate(async ({ trackId, input }) => {
    const { findTrack } = await import('/src/tracks/registry.ts');
    const { buildArrangement } = await import('/src/music/arrange.ts');
    const song = findTrack(trackId);
    if (!song) throw new RangeError('未知曲目: ' + trackId);
    const options = { ...input, bpm: input.bpm ?? song.meta.bpm };
    const score = buildArrangement(song, options);
    if (!score.tracks?.length) throw new RangeError('这首作品尚未配置独立轨道');
    window.stemSession = { song, options, score };
    return { options, tracks: score.tracks, beats: score.beats, sections: score.sections };
  }, { trackId: values.track, input: options });
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // Refuse overwriting any existing stem project.
  const renders = [];
  for (const track of [null, ...prepared.tracks]) {
    console.log('Rendering raw ' + (track?.name ?? '完整混音') + '...');
    const downloadPromise = page.waitForEvent('download', { timeout: 300000 });
    const metadataPromise = page.evaluate(async id => {
      const { renderTrack } = await import('/src/engine/render.ts');
      const { encodeWav } = await import('/src/audio/wav.ts');
      const session = window.stemSession;
      const result = await renderTrack(session.song, session.options, { processing: 'raw', ...(id ? { soloTrackIds: [id] } : {}) });
      if (result.stats.peak >= 1) throw new Error('原始轨道超出 PCM16 电平，请先调整混音');
      if (!id) {
        session.mix = [0, 1].map(channel => new Float32Array(result.buffer.getChannelData(channel)));
        session.sum = [0, 1].map(() => new Float64Array(result.buffer.length));
      } else {
        for (let channel = 0; channel < 2; channel++) {
          const data = result.buffer.getChannelData(channel);
          for (let i = 0; i < data.length; i++) session.sum[channel][i] += data[i];
        }
      }
      const filename = (id ?? 'raw-mix') + '.wav';
      const url = URL.createObjectURL(new Blob([encodeWav(result.buffer)], { type: 'audio/wav' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return { trackId: id, filename, duration: result.duration, frames: result.buffer.length, stats: result.stats };
    }, track?.id ?? null);
    const [download, metadata] = await Promise.all([downloadPromise, metadataPromise]);
    await download.saveAs(path.join(output, metadata.filename));
    renders.push(metadata);
  }
  const sumCheck = await page.evaluate(() => {
    const { sum, mix } = window.stemSession;
    let maximum = 0, squares = 0;
    for (let channel = 0; channel < 2; channel++) for (let i = 0; i < mix[channel].length; i++) {
      const difference = Math.abs(sum[channel][i] - mix[channel][i]);
      maximum = Math.max(maximum, difference); squares += difference * difference;
    }
    return { maximum, rms: Math.sqrt(squares / (mix[0].length * 2)), domain: 'float PCM before WAV quantization' };
  });
  if (sumCheck.maximum >= 1 / 65536 || sumCheck.rms >= 1e-6) throw new Error('分轨相加与原始混音不一致: ' + JSON.stringify(sumCheck));
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
    track: values.track, generatedAt: new Date().toISOString(), ...prepared, renders, sumCheck,
    processing: 'Original track gain, pan, filters, linear sends, automation and kick-driven bass ducking. No per-stem normalization, DC removal or edge fades.',
    note: 'Import every WAV at time zero with unity gain. They reconstruct the raw mix; separately peak-trimmed and loudness-mastered MP3 is a different signal. PCM16 quantization adds rounding error. Raw loop edges retain their original values.',
    manualListening: 'not performed',
  }, null, 2) + '\n', { flag: 'wx' });
  console.log('Saved ' + prepared.tracks.length + ' stems to ' + output + '; sum max ' + sumCheck.maximum);
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
