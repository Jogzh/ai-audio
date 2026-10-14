#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { exportAudio, inspectPcmWav, requireAudioTools } from './lib/audio-export.mjs';

const run = promisify(execFile);
const { values } = parseArgs({ options: { dir: { type: 'string', default: 'artifacts/audio/neon-changan' } } });
const directory = path.resolve(values.dir);
const root = path.resolve(import.meta.dirname, '..');
const base = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
if (!['neon-changan', 'neon-changan-vocal'].includes(base.track)) throw new Error('此脚本只打包《霓虹长安》及其人声版');
const vocal = base.track === 'neon-changan-vocal';
const full = base.renders.find(r => r.options.version === 'full');
if (!full || full.options.bpm !== 128) throw new Error('30 秒版本需要 128 BPM 完整版');
const wavFile = full.files.find(f => f.filename.endsWith('.wav'));
if (!wavFile || wavFile.sampleRate !== 48000 || wavFile.bitsPerSample !== 24) throw new Error('需要完整原生 48 kHz / PCM24 WAV');
const stem = `${base.track}-douyin30-128bpm-t${full.options.transpose}-s${full.options.seed}`;
// Validate all package destinations before exporting anything.
for (const name of [`${stem}.wav`, `${stem}.mp3`, `${stem}.mastering.json`, 'release.json']) {
  try { await access(path.join(directory, name)); throw new Error(`文件已存在: ${name}，请使用新目录`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const binaries = await requireAudioTools();
const temp = await mkdtemp(path.join(os.tmpdir(), 'neon-changan-edit-'));
try {
  const sourcePath = path.join(temp, 'final-drop.wav');
  // Bars 41–56: a complete final Drop, with the melody lift exactly at edit second 15.
  await run(binaries.ffmpeg, ['-v', 'error', '-y', '-i', path.join(directory, wavFile.filename), '-af', 'atrim=start_sample=3600000:end_sample=5040000,asetpts=PTS-STARTPTS,afade=t=in:d=0.003,afade=t=out:st=29.98:d=0.02', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', sourcePath]);
  const exported = await exportAudio({ sourcePath, destinationDirectory: directory, stem, format: 'both', master: 'loudness', binaries });
  await writeFile(path.join(directory, `${stem}.mastering.json`), JSON.stringify(exported.mastering, null, 2) + '\n', { flag: 'wx' });
  const sourceFiles = [
    'src/tracks/neon-changan.ts', 'src/music/arrangements/guofeng-club.ts', 'src/engine/guofeng-club.ts',
    'src/engine/ink-tide-voices.ts', 'src/engine/render.ts', 'src/audio/wav.ts', 'src/music/random.ts',
    'src/music/types.ts', 'src/music/arrange.ts', 'src/music/mixer.ts', 'src/music/validation.ts',
    'scripts/render.mjs', 'scripts/lib/audio-export.mjs', 'scripts/package-neon-changan.mjs',
  ];
  if (vocal) {
    const bank = JSON.parse(await readFile(path.join(root, 'public/audio/night-city/manifest.json'), 'utf8'));
    sourceFiles.push('src/tracks/neon-changan-vocal.ts', 'src/music/arrangements/night-city.ts', 'src/music/vocal-bank.ts', 'src/engine/vocal-samples.ts', 'src/engine/vocal-time-fit.ts', 'scripts/generate-night-city.py', 'scripts/requirements-vocals.txt', 'public/audio/night-city/manifest.json', 'public/audio/night-city/ATTRIBUTION.md', ...bank.files.map(f => `public/audio/night-city/${f.filename}`));
  }
  const sources = await Promise.all(sourceFiles.map(async filename => ({ filename, sha256: createHash('sha256').update(await readFile(path.join(root, filename))).digest('hex') })));
  const files = [];
  for (const entry of [...base.renders, { files: exported.files, mastering: exported.mastering }]) {
    for (const file of entry.files) {
      const format = file.filename.endsWith('.mp3') ? 'mp3' : 'wav';
      files.push({ ...file, loudness: entry.mastering.after[format], sha256: createHash('sha256').update(await readFile(path.join(directory, file.filename))).digest('hex') });
    }
  }
  const decoded = [];
  for (const file of files) {
    const { stdout } = await run(binaries.ffmpeg, ['-v', 'error', '-i', path.join(directory, file.filename), '-map', '0:a:0', '-ar', '48000', '-ac', '2', '-f', 'f32le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
    const frames = stdout.length / 8;
    let peak = 0, squares = 0, monoSquares = 0, sum = 0, clipped = 0;
    for (let i = 0; i < stdout.length; i += 8) {
      const l = stdout.readFloatLE(i), r = stdout.readFloatLE(i + 4);
      if (!Number.isFinite(l) || !Number.isFinite(r)) throw new Error(`非有限解码值: ${file.filename}`);
      peak = Math.max(peak, Math.abs(l), Math.abs(r));
      squares += l * l + r * r; monoSquares += ((l + r) / 2) ** 2; sum += l + r;
      if (Math.abs(l) >= 1) clipped++; if (Math.abs(r) >= 1) clipped++;
    }
    const record = { filename: file.filename, frames, decodedDurationSeconds: frames / 48000, finite: true, peakDbfs: 20 * Math.log10(peak), rmsDbfs: 10 * Math.log10(squares / (frames * 2)), dcOffset: sum / (frames * 2), clippedSamples: clipped, monoDeltaDb: 10 * Math.log10(monoSquares / (squares / 2)) };
    if (clipped || Math.abs(record.decodedDurationSeconds - file.audioContentDurationSeconds) > 1 / 48000 || record.monoDeltaDb < -1) throw new Error(`解码验证失败: ${JSON.stringify(record)}`);
    decoded.push(record);
  }
  const report = {
    title: vocal ? '霓虹长安 · 灯起 / Neon Changan Lights On' : '霓虹长安 / Neon Changan', generatedAt: new Date().toISOString(), bpm: 128,
    key: 'D minor pentatonic melody', seed: full.options.seed, transpose: full.options.transpose,
    synthesis: vocal ? 'Original 48 kHz Web Audio instruments and Kokoro neural Chinese voices sourced at 24 kHz, processed and converted to 48 kHz. WORLD-tuned vocal chops, original spoken text, no live singer or copied song recording.' : 'Original native Web Audio synthesis at 48 kHz. Ethnic timbres are synthesized instruments; no live performer or existing song recording.',
    manualListening: 'not performed; objective measurements and automated checks are not listening judgments',
    edit30: { source: wavFile.filename, sourceStartSeconds: 75, sourceEndSeconds: 105, bars: '41–56', durationSeconds: (await inspectPcmWav(path.join(directory, `${stem}.wav`))).durationSeconds, melodyLiftSeconds: 15, mastering: exported.mastering },
    files, decoded, sources,
  };
  await writeFile(path.join(directory, 'release.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ saved: directory, files: report.files.map(f => ({ filename: f.filename, duration: f.audioContentDurationSeconds, ...f.loudness })) }, null, 2));
} finally { await rm(temp, { recursive: true, force: true }); }
