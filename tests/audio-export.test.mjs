import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { exportAudio, inspectPcmWav, parseLoudnorm, requireAudioTools, secondPassFilter, validateExportOptions } from '../scripts/lib/audio-export.mjs';
import { encodeWav } from '../src/audio/wav.ts';

const execFileAsync = promisify(execFile);
const repo = path.resolve(import.meta.dirname, '..');

function sineWav(seconds = 6.25, amplitude = 0.08) {
  const sampleRate = 44100;
  const frames = Math.round(seconds * sampleRate);
  const bytes = Buffer.alloc(44 + frames * 4);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 4, 28);
  bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(frames * 4, 40);
  for (let frame = 0; frame < frames; frame++) {
    const value = Math.round(amplitude * Math.sin(2 * Math.PI * 997 * frame / sampleRate) * 32767);
    bytes.writeInt16LE(value, 44 + frame * 4); bytes.writeInt16LE(value, 46 + frame * 4);
  }
  return bytes;
}

test('loudness reports reject missing/nonfinite measurement instead of fabricated JSON', () => {
  assert.throws(() => parseLoudnorm('nothing'), /未返回/);
  assert.throws(() => parseLoudnorm('{"input_i":"-inf","input_tp":"-inf","input_lra":"0","input_thresh":"-70","target_offset":"inf"}'), /静音/);
  const raw = { input_i: '-22.75', input_tp: '-19.4', input_lra: '1.5', input_thresh: '-32.8', target_offset: '0.1' };
  assert.equal(parseLoudnorm(`prefix\n${JSON.stringify(raw)}\nsuffix`).input_i, '-22.75');
  assert.match(secondPassFilter(raw), /measured_I=-22.75:measured_TP=-19.4/);
  assert.match(secondPassFilter(raw), /^loudnorm=I=-14:TP=-1.5:LRA=9:/);
  assert.throws(() => validateExportOptions('aac', 'auto'), /format/);
  assert.throws(() => validateExportOptions('mp3', 'magic'), /master/);
});

test('raw WAV export preserves bytes and exact frame duration without FFmpeg', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-wav-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, 'source.wav');
  const destinationDirectory = path.join(directory, 'output');
  const bytes = sineWav(0.25);
  await writeFile(sourcePath, bytes);
  const result = await exportAudio({ sourcePath, destinationDirectory, stem: 'legacy', format: 'wav', master: 'auto' });
  assert.deepEqual(await readFile(path.join(destinationDirectory, 'legacy.wav')), bytes);
  assert.equal(result.files[0].durationSeconds, 0.25);
  assert.equal(result.files[0].durationSource, 'PCM frame count');
  assert.equal(result.files[0].mastered, false);
  assert.equal(result.mastering, null);
  await assert.rejects(exportAudio({ sourcePath, destinationDirectory, stem: 'legacy', format: 'wav' }), /--overwrite/);
  assert.deepEqual(await readFile(path.join(destinationDirectory, 'legacy.wav')), bytes);
  const bad = path.join(directory, 'bad.wav');
  await writeFile(bad, bytes.subarray(0, 60));
  await assert.rejects(inspectPcmWav(bad), /不完整/);
});

test('missing encoder fails CLI before producing an output directory', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-missing-encoder-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'must-not-exist');
  await assert.rejects(
    execFileAsync(process.execPath, ['scripts/render.mjs', '--version', 'hook', '--out', output], { cwd: repo, env: { ...process.env, PATH: '' } }),
    error => error.code === 1 && /找不到 ffmpeg/.test(error.stderr),
  );
  await assert.rejects(access(output), { code: 'ENOENT' });
});

test('MP3 uses measured two-pass normalization and probes actual lossy output; both keeps raw WAV', async t => {
  let binaries;
  try { binaries = await requireAudioTools(); }
  catch (error) { t.skip(`FFmpeg integration unavailable: ${error.message}`); return; }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-mp3-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, 'source.wav');
  const bytes = sineWav();
  await writeFile(sourcePath, bytes);
  const destinationDirectory = path.join(directory, 'output');
  const result = await exportAudio({ sourcePath, destinationDirectory, stem: 'verified', format: 'both', binaries });
  assert.deepEqual(await readFile(path.join(destinationDirectory, 'verified.wav')), bytes);
  const mp3 = result.files.find(file => file.filename.endsWith('.mp3'));
  assert.equal(mp3.codec, 'mp3');
  assert.equal(mp3.sampleRate, 44100);
  assert.equal(mp3.channels, 2);
  assert.ok(mp3.durationSeconds >= 6.25 && mp3.durationSeconds < 6.35);
  assert.equal(mp3.audioContentDurationSeconds, 6.25);
  assert.equal(mp3.durationSource, 'ffprobe container duration');
  assert.ok(mp3.bytes > 240000, '320 kbps encoding has an appropriate file size');
  assert.ok(result.mastering.before.integratedLufs < -20);
  assert.ok(Math.abs(result.mastering.after.mp3.integratedLufs + 14) < 0.3);
  assert.ok(result.mastering.after.mp3.truePeakDbtp <= -1.5);
  assert.ok(Math.abs(result.mastering.after.wav.integratedLufs - result.mastering.before.integratedLufs) < 0.01);
  assert.equal(result.mastering.processing.mp3.passes, 2);
  assert.equal(result.mastering.processing.wav, undefined);
});

test('both rejects an existing MP3 before conversion without creating a missing WAV', async t => {
  let binaries;
  try { binaries = await requireAudioTools(); }
  catch (error) { t.skip(`FFmpeg integration unavailable: ${error.message}`); return; }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-both-collision-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, 'source.wav');
  const destinationDirectory = path.join(directory, 'output');
  await writeFile(sourcePath, sineWav());
  await exportAudio({ sourcePath, destinationDirectory, stem: 'existing', format: 'mp3', master: 'off', binaries });
  const oldMp3Path = path.join(destinationDirectory, 'existing.mp3');
  const missingWavPath = path.join(destinationDirectory, 'existing.wav');
  const oldMp3 = await readFile(oldMp3Path);
  await assert.rejects(access(missingWavPath), { code: 'ENOENT' });
  // A broken converter verifies that collision detection happens before conversion.
  const unavailableBinaries = { ffmpeg: path.join(directory, 'missing-ffmpeg'), ffprobe: path.join(directory, 'missing-ffprobe') };
  await assert.rejects(exportAudio({ sourcePath, destinationDirectory, stem: 'existing', format: 'both', binaries: unavailableBinaries }), /existing\.mp3.*--overwrite/);
  assert.deepEqual(await readFile(oldMp3Path), oldMp3);
  await assert.rejects(access(missingWavPath), { code: 'ENOENT' });
});

test('silent MP3 source fails without creating a destination or a bogus mastering report', async t => {
  let binaries;
  try { binaries = await requireAudioTools(); }
  catch (error) { t.skip(`FFmpeg integration unavailable: ${error.message}`); return; }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-silent-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, 'silence.wav');
  await writeFile(sourcePath, sineWav(1, 0));
  const destinationDirectory = path.join(directory, 'must-not-exist');
  await assert.rejects(exportAudio({ sourcePath, destinationDirectory, stem: 'silent', binaries }), /静音/);
  await assert.rejects(access(destinationDirectory), { code: 'ENOENT' });
});

test('explicit WAV loudness applies mastering while MP3 off retains source loudness', async t => {
  let binaries;
  try { binaries = await requireAudioTools(); }
  catch (error) { t.skip(`FFmpeg integration unavailable: ${error.message}`); return; }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-master-modes-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = path.join(directory, 'source.wav');
  await writeFile(sourcePath, sineWav());
  const wav = await exportAudio({ sourcePath, destinationDirectory: path.join(directory, 'wav'), stem: 'mastered', format: 'wav', master: 'loudness', binaries });
  assert.equal(wav.files[0].codec, 'pcm_s16le');
  assert.equal(wav.files[0].mastered, true);
  assert.equal(wav.mastering.processing.wav.passes, 2);
  assert.ok(Math.abs(wav.mastering.after.wav.integratedLufs + 14) < 0.3);
  const mp3 = await exportAudio({ sourcePath, destinationDirectory: path.join(directory, 'mp3'), stem: 'unmastered', format: 'mp3', master: 'off', binaries });
  assert.equal(mp3.files[0].mastered, false);
  assert.deepEqual(mp3.mastering.processing, {});
  assert.ok(Math.abs(mp3.mastering.after.mp3.integratedLufs - mp3.mastering.before.integratedLufs) < 0.15);
});

test('native 48 kHz PCM24 survives mastering, FFmpeg extensible WAV, and lossy encoding', async t => {
  let binaries;
  try { binaries = await requireAudioTools(); }
  catch (error) { t.skip(error.message); return; }
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ai-audio-24bit-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pcm = Float32Array.from({ length: 48000 * 5 }, (_, i) => .08 * Math.sin(2 * Math.PI * 997 * i / 48000));
  const sourcePath = path.join(directory, 'source24.wav');
  await writeFile(sourcePath, new Uint8Array(encodeWav({ sampleRate: 48000, length: pcm.length, numberOfChannels: 2, getChannelData: () => pcm }, 24)));
  const result = await exportAudio({ sourcePath, destinationDirectory: directory, stem: 'master24', format: 'both', master: 'loudness', binaries });
  const mastered = await inspectPcmWav(path.join(directory, 'master24.wav'));
  assert.equal(mastered.codec, 'pcm_s24le');
  assert.equal(mastered.sampleRate, 48000);
  assert.equal(mastered.bitsPerSample, 24);
  assert.equal(mastered.durationSeconds, 5);
  assert.equal(result.files.find(f => f.filename.endsWith('.mp3')).sampleRate, 48000);
  assert.ok(Math.abs(result.mastering.after.wav.integratedLufs + 14) < .3);
  // Reject the same extensible header with an IEEE-float subformat GUID.
  const invalid = await readFile(path.join(directory, 'master24.wav'));
  invalid.writeUInt32LE(3, 44);
  await writeFile(path.join(directory, 'invalid-subformat.wav'), invalid);
  await assert.rejects(inspectPcmWav(path.join(directory, 'invalid-subformat.wav')), /PCM16\/24/);
});
