#!/usr/bin/env node
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { exportAudio, requireAudioTools, validateExportOptions } from './lib/audio-export.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: {
  version: { type: 'string', default: 'all' },
  track: { type: 'string' },
  bpm: { type: 'string' },
  transpose: { type: 'string', default: '0' },
  seed: { type: 'string', default: '260713' },
  out: { type: 'string', default: 'artifacts/audio' },
  format: { type: 'string', default: 'mp3' },
  master: { type: 'string', default: 'auto' },
  'sample-rate': { type: 'string' },
  'bit-depth': { type: 'string' },
  overwrite: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} });
if (values.help) {
  console.log('npm run render -- [--track neon-changan|ink-tide|mountains-awake|when-the-wind-rises|afterglow] [--version all|full|hook|loop] [--bpm 118] [--transpose 0] [--seed 260713] [--sample-rate 44100|48000] [--bit-depth 16|24] [--out artifacts/audio] [--format mp3|wav|both] [--master auto|off|loudness] [--overwrite]');
  console.log('Defaults: registry default track, track BPM, MP3 320 kbps. auto masters MP3 with two-pass loudnorm (-14 LUFS / -1.5 dBTP / LRA 9) and preserves raw WAV. loudness also masters WAV; off disables mastering. Existing files require --overwrite.');
  process.exit(0);
}
const options = { bpm: values.bpm === undefined ? undefined : Number(values.bpm), transpose: Number(values.transpose), seed: Number(values.seed) };
if (values['sample-rate'] !== undefined && !['44100', '48000'].includes(values['sample-rate'])) throw new Error('sample-rate 必须为 44100 或 48000');
if (values['bit-depth'] !== undefined && !['16', '24'].includes(values['bit-depth'])) throw new Error('bit-depth 必须为 16 或 24');
validateExportOptions(values.format, values.master);
if (!['all', 'full', 'hook', 'loop'].includes(values.version) || (values.bpm !== undefined && (!values.bpm.trim() || !Number.isInteger(options.bpm) || options.bpm < 90 || options.bpm > 170)) || !values.transpose.trim() || !Number.isInteger(options.transpose) || Math.abs(options.transpose) > 12 || !values.seed.trim() || !Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) {
  throw new Error('无效参数：version=all/full/hook/loop，bpm=90–170 整数，transpose=-12–12 整数，seed=uint32');
}
const output = path.resolve(process.cwd(), values.out);
const selected = values.version === 'all' ? ['full', 'hook', 'loop'] : [values.version];
let server;
let browser;
let tempDirectory;
try {
  const needsAudioTools = values.format !== 'wav' || values.master === 'loudness';
  // Fail before browser rendering or output creation if encoding prerequisites are missing.
  const binaries = needsAudioTools ? await requireAudioTools({ mp3: values.format !== 'wav' }) : undefined;
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  page.on('pageerror', error => console.error(error));
  await page.goto(`http://127.0.0.1:${address.port}`);
  const resolved = await page.evaluate(async ({ trackId, input, rate, bits }) => {
    const { defaultTrack, findTrack, trackRegistry } = await import('/src/tracks/registry.ts');
    const track = trackId === undefined ? defaultTrack : findTrack(trackId);
    if (!track) throw new Error(`未知曲目：${trackId}；可选曲目：${trackRegistry.map(entry => entry.meta.id).join(' / ')}`);
    const bpm = input.bpm ?? track.meta.bpm;
    const { validateOptions } = await import('/src/music/arrange.ts');
    validateOptions({ ...input, bpm, version: 'full' });
    const sampleRate = Number(rate ?? (track.production === 'guofeng-club' ? 48000 : 44100));
    const bitDepth = Number(bits ?? (track.production === 'guofeng-club' ? 24 : 16));
    return { trackId: track.meta.id, options: { ...input, bpm, sampleRate }, bitDepth };
  }, { trackId: values.track, input: options, rate: values['sample-rate'], bits: values['bit-depth'] });
  const outputFormats = values.format === 'both' ? ['wav', 'mp3'] : [values.format];
  if (!values.overwrite) {
    const expectedFiles = ['manifest.json', ...selected.flatMap(version => {
      const stem = `${resolved.trackId}-${version}-${resolved.options.bpm}bpm-t${resolved.options.transpose}-s${resolved.options.seed}`;
      return [...outputFormats.map(format => `${stem}.${format}`), `${stem}.mastering.json`];
    })];
    const existing = await Promise.all(expectedFiles.map(async filename => {
      try { await access(path.join(output, filename)); return filename; }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    }));
    if (existing.some(Boolean)) throw new Error(`输出已存在：${existing.filter(Boolean).join(', ')}。请选择新 --out 目录，或显式传 --overwrite。`);
  }
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-render-'));
  const manifest = [];
  for (const version of selected) {
    console.log(`Rendering ${resolved.trackId} / ${version}: ${resolved.options.bpm} BPM, transpose ${resolved.options.transpose}, seed ${resolved.options.seed}...`);
    const downloadPromise = page.waitForEvent('download', { timeout: 300000 });
    const renderPromise = page.evaluate(async ({ input, trackId, bitDepth }) => {
      const { renderTrack } = await import('/src/engine/render.ts');
      const { findTrack } = await import('/src/tracks/registry.ts');
      const track = findTrack(trackId);
      if (!track) throw new Error(`未知曲目：${trackId}`);
      const { encodeWav } = await import('/src/audio/wav.ts');
      const result = await renderTrack(track, input);
      const blob = new Blob([encodeWav(result.buffer, bitDepth)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return { track: track.meta.id, filename: result.filename, duration: result.duration, options: result.options, stats: result.stats, sections: result.sections, mixTracks: result.tracks, sampleRate: result.buffer.sampleRate, bitDepth, channels: result.buffer.numberOfChannels };
    }, { input: { ...resolved.options, version }, trackId: resolved.trackId, bitDepth: resolved.bitDepth });
    const [download, metadata] = await Promise.all([downloadPromise, renderPromise]);
    const sourcePath = path.join(tempDirectory, metadata.filename);
    await download.saveAs(sourcePath);
    const stem = metadata.filename.replace(/\.wav$/i, '');
    const exported = await exportAudio({ sourcePath, destinationDirectory: output, stem, format: values.format, master: values.master, binaries, overwrite: values.overwrite });
    const primary = exported.files.find(file => file.filename.endsWith('.mp3')) ?? exported.files[0];
    let masteringFilename;
    if (exported.mastering) {
      masteringFilename = `${stem}.mastering.json`;
      await writeFile(path.join(output, masteringFilename), JSON.stringify({ track: metadata.track, files: exported.files, ...exported.mastering }, null, 2) + '\n', { flag: values.overwrite ? 'w' : 'wx' });
    }
    manifest.push({ ...metadata, filename: primary.filename, format: primary.format, actualDurationSeconds: primary.durationSeconds, files: exported.files, sourceFilename: metadata.filename, sourceStatsNote: 'stats measures source PCM sample peak/RMS; final-file integrated LUFS and true peak appear in mastering.after.', masteringFilename, mastering: exported.mastering });
    console.log(`${primary.filename}: ${primary.durationSeconds.toFixed(2)}s; source PCM peak ${metadata.stats.peakDb.toFixed(2)} dBFS, RMS ${metadata.stats.rmsDb.toFixed(2)} dBFS, clipped ${metadata.stats.clippedSamples}`);
    for (const file of exported.files) {
      const measured = exported.mastering?.after[file.filename.endsWith('.mp3') ? 'mp3' : 'wav'];
      if (measured) console.log(`  ${file.filename}: ${measured.integratedLufs.toFixed(2)} LUFS, ${measured.truePeakDbtp.toFixed(2)} dBTP (measured after encoding)`);
    }
  }
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ track: resolved.trackId, engine: 'Tone.js 15.1.22 / Chromium OfflineAudioContext', generatedAt: new Date().toISOString(), format: values.format === 'both' ? `PCM${resolved.bitDepth} WAV + MP3 320 kbps` : manifest[0].format, masteringMode: values.master, tools: binaries, note: 'Source stats are sample peak/RMS. Integrated LUFS and oversampled true peak are measured by FFmpeg when available. MP3 container duration includes encoder padding; audioContentDurationSeconds is the rendered PCM frame duration. Loudness target is a project choice, not a claimed platform standard.', renders: manifest }, null, 2) + '\n', { flag: values.overwrite ? 'w' : 'wx' });
  console.log(`Saved to ${output}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } finally {
    try { await server?.close(); } finally {
      if (tempDirectory) await rm(tempDirectory, { recursive: true, force: true });
    }
  }
}
