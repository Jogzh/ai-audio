#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  version: { type: 'string', default: 'all' },
  track: { type: 'string' },
  bpm: { type: 'string' },
  transpose: { type: 'string', default: '0' },
  seed: { type: 'string', default: '260713' },
  out: { type: 'string', default: 'artifacts/audio' },
  help: { type: 'boolean', default: false },
} });
if (values.help) {
  console.log('npm run render -- [--track velvet-hour|amber-tides|neon-rebound] [--version all|full|hook|loop] [--bpm 120] [--transpose 0] [--seed 260713] [--out artifacts/audio]');
  console.log('Default track: velvet-hour; BPM defaults to the selected track metadata.');
  process.exit(0);
}
const options = { bpm: values.bpm === undefined ? undefined : Number(values.bpm), transpose: Number(values.transpose), seed: Number(values.seed) };
if (!['all', 'full', 'hook', 'loop'].includes(values.version) || (values.bpm !== undefined && (!values.bpm.trim() || !Number.isInteger(options.bpm) || options.bpm < 90 || options.bpm > 170)) || !values.transpose.trim() || !Number.isInteger(options.transpose) || Math.abs(options.transpose) > 12 || !values.seed.trim() || !Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) {
  throw new Error('无效参数：version=all/full/hook/loop，bpm=90–170 整数，transpose=-12–12 整数，seed=uint32');
}
const output = path.resolve(process.cwd(), values.out);
const selected = values.version === 'all' ? ['full', 'hook', 'loop'] : [values.version];
let server;
let browser;
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  page.on('pageerror', error => console.error(error));
  await page.goto(`http://127.0.0.1:${address.port}`);
  const resolved = await page.evaluate(async ({ trackId, input }) => {
    const { defaultTrack, findTrack, trackRegistry } = await import('/src/tracks/registry.ts');
    const track = trackId === undefined ? defaultTrack : findTrack(trackId);
    if (!track) throw new Error(`未知曲目：${trackId}；可选曲目：${trackRegistry.map(entry => entry.meta.id).join(' / ')}`);
    const bpm = input.bpm ?? track.meta.bpm;
    const { validateOptions } = await import('/src/music/arrange.ts');
    validateOptions({ ...input, bpm, version: 'full' });
    return { trackId: track.meta.id, options: { ...input, bpm } };
  }, { trackId: values.track, input: options });
  await mkdir(output, { recursive: true });
  const manifest = [];
  for (const version of selected) {
    console.log(`Rendering ${resolved.trackId} / ${version}: ${resolved.options.bpm} BPM, transpose ${resolved.options.transpose}, seed ${resolved.options.seed}...`);
    const downloadPromise = page.waitForEvent('download', { timeout: 300000 });
    const renderPromise = page.evaluate(async ({ input, trackId }) => {
      const { renderTrack } = await import('/src/engine/render.ts');
      const { findTrack } = await import('/src/tracks/registry.ts');
      const track = findTrack(trackId);
      if (!track) throw new Error(`未知曲目：${trackId}`);
      const { encodeWav } = await import('/src/audio/wav.ts');
      const result = await renderTrack(track, input);
      const blob = new Blob([encodeWav(result.buffer)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return { track: track.meta.id, filename: result.filename, duration: result.duration, options: result.options, stats: result.stats, sections: result.sections, credits: result.credits, sampleRate: result.buffer.sampleRate, channels: result.buffer.numberOfChannels };
    }, { input: { ...resolved.options, version }, trackId: resolved.trackId });
    const [download, metadata] = await Promise.all([downloadPromise, renderPromise]);
    await download.saveAs(path.join(output, metadata.filename));
    if (metadata.credits.length) {
      const creditsFilename = `${metadata.filename.replace(/\.wav$/i, '')}.credits.json`;
      await writeFile(path.join(output, creditsFilename), JSON.stringify({ track: metadata.track, credits: metadata.credits }, null, 2) + '\n');
    }
    manifest.push(metadata);
    console.log(`${metadata.filename}: ${metadata.duration.toFixed(2)}s, peak ${metadata.stats.peakDb.toFixed(2)} dBFS, RMS ${metadata.stats.rmsDb.toFixed(2)} dBFS, clipped ${metadata.stats.clippedSamples}`);
    for (const credit of metadata.credits) {
      console.log(`  ${credit.title} — ${credit.author}\n  Source: ${credit.source}\n  License: ${credit.license} (${credit.licenseUrl})\n  Modifications: ${credit.modifications}`);
    }
    if (!metadata.credits.length) console.log('  No external sample credits returned by this render.');
  }
  const credits = [...new Map(manifest.flatMap(render => render.credits).map(credit => [JSON.stringify(credit), credit])).values()];
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ track: resolved.trackId, credits, engine: 'Tone.js 15.1.22 / Chromium OfflineAudioContext', generatedAt: new Date().toISOString(), format: 'PCM16 WAV', note: 'Sample-peak/RMS measurements, not integrated LUFS or oversampled true peak.', renders: manifest }, null, 2) + '\n');
  console.log(`Saved to ${output}`);
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
