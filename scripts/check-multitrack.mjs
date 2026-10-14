#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const reportDirectory = `${root}/artifacts/audio/ink-tide-v6-qa`;
const pcmTolerance = { maximum: 1 / 65536, rms: 1e-6 };
const wavDifference = (actual, expected) => {
  assert.deepEqual(actual.subarray(0, 44), expected.subarray(0, 44));
  assert.equal(actual.length, expected.length);
  let maximumLsb = 0, squares = 0;
  for (let offset = 44; offset < actual.length; offset += 2) {
    const value = actual.readInt16LE(offset) - expected.readInt16LE(offset);
    maximumLsb = Math.max(maximumLsb, Math.abs(value));
    squares += value * value;
  }
  return { maximumLsb, rmsLsb: Math.sqrt(squares / ((actual.length - 44) / 2)) };
};
let server;
let browser;
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  await server.listen();
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?track=ink-tide&version=hook`);
  await page.locator('#audition-track').waitFor();
  const checks = await page.evaluate(async () => {
    const { renderTrack } = await import('/src/engine/render.ts');
    const { inkTide } = await import('/src/tracks/ink-tide.ts');
    const { buildArrangement } = await import('/src/music/arrange.ts');
    const options = { version: 'hook', bpm: inkTide.meta.bpm, transpose: 0, seed: 261014 };
    const score = buildArrangement(inkTide, options);
    const whole = await renderTrack(inkTide, options, { processing: 'raw' });
    const sums = [new Float64Array(whole.buffer.length), new Float64Array(whole.buffer.length)];
    const difference = (left, right) => {
      let maximum = 0, squares = 0;
      for (let channel = 0; channel < 2; channel++) {
        for (let index = 0; index < left[channel].length; index++) {
          const value = left[channel][index] - right[channel][index];
          maximum = Math.max(maximum, Math.abs(value));
          squares += value * value;
        }
      }
      return { maximum, rms: Math.sqrt(squares / (left[0].length * 2)) };
    };
    const channels = rendered => [0, 1].map(channel => rendered.buffer.getChannelData(channel));
    const stems = [];
    let referenceStem;
    for (const track of score.tracks) {
      const rendered = await renderTrack(inkTide, options, { soloTrackIds: [track.id], processing: 'raw' });
      const data = channels(rendered);
      for (let channel = 0; channel < 2; channel++) {
        for (let index = 0; index < rendered.buffer.length; index++) sums[channel][index] += data[channel][index];
      }
      if (track.id === 'flute-theme') referenceStem = data.map(channel => channel.slice());
      stems.push({ id: track.id, instrument: track.instrument, stats: rendered.stats,
        events: score.events.filter(event => event.trackId === track.id).length,
        duration: rendered.duration, sampleRate: rendered.buffer.sampleRate, channels: rendered.buffer.numberOfChannels,
        finite: data.every(channel => channel.every(Number.isFinite)),
        selectedIds: rendered.selection.soloTrackIds,
      });
    }
    const expectedMuted = channels(whole).map((channel, channelIndex) => Float64Array.from(channel, (value, index) => value - referenceStem[channelIndex][index]));
    const muted = await renderTrack(inkTide, options, { muteTrackIds: ['flute-theme'], processing: 'raw' });
    const repeatedStem = await renderTrack(inkTide, options, { soloTrackIds: ['flute-theme'], processing: 'raw' });
    const none = await renderTrack(inkTide, options, { muteTrackIds: score.tracks.map(track => track.id), processing: 'raw' });
    const invalidSelections = [];
    for (const selection of [
      { soloTrackIds: ['does-not-exist'] }, { muteTrackIds: ['does-not-exist'] },
      { processing: 'invalid' },
    ]) {
      try { await renderTrack(inkTide, options, selection); invalidSelections.push({ selection, rejected: false }); }
      catch (error) { invalidSelections.push({ selection, rejected: true, message: String(error) }); }
    }
    return {
      trackIds: score.tracks.map(track => track.id), stems,
      whole: { stats: whole.stats, duration: whole.duration, selection: whole.selection },
      summation: difference(sums, channels(whole)),
      muteDifference: difference(expectedMuted, channels(muted)),
      repeatStem: difference(referenceStem, channels(repeatedStem)),
      allMuted: none.stats,
      invalidSelections,
    };
  });
  assert.equal(checks.trackIds.length, 12);
  assert.equal(new Set(checks.trackIds).size, checks.trackIds.length);
  for (const stem of checks.stems) {
    assert.equal(stem.finite, true, `${stem.id} has non-finite PCM`);
    assert.equal(stem.sampleRate, 44100);
    assert.equal(stem.channels, 2);
    assert.ok(Math.abs(stem.duration - checks.whole.duration) < 1 / 44100);
    if (stem.events > 0) {
      assert.ok(stem.stats.rms > 0.000001 && stem.stats.peak > 0.00001, `${stem.id} has written events but no effective audio`);
    } else {
      assert.equal(stem.stats.peak, 0, `${stem.id} must be silent when its score contains no events`);
      assert.equal(stem.stats.rms, 0);
    }
    assert.deepEqual(stem.selectedIds, [stem.id]);
  }
  for (const name of ['summation', 'muteDifference', 'repeatStem']) {
    assert.ok(checks[name].maximum < pcmTolerance.maximum, `${name} maximum ${checks[name].maximum}`);
    assert.ok(checks[name].rms < pcmTolerance.rms, `${name} RMS ${checks[name].rms}`);
  }
  assert.equal(checks.allMuted.peak, 0);
  assert.ok(checks.invalidSelections.every(result => result.rejected), 'unknown tracks and processing must be rejected');
  assert.equal(await page.locator('#audition-track option').count(), checks.trackIds.length + 1);
  for (const stem of checks.stems) {
    assert.equal(await page.locator(`#audition-track option[value="${stem.id}"]`).isDisabled(), stem.events === 0,
      `${stem.id} audition availability must follow the selected score`);
  }
  assert.equal(await page.locator('#audition-track').inputValue(), '');
  assert.equal(await page.locator('#mix-tracks').isVisible(), true);

  // Check the actual exported WAV against renderTrack for each selection, so stale
  // cached audio cannot pass merely because a label or filename changed.
  const playerChecks = [];
  let initialMixWav;
  for (const selection of [
    { label: 'full mix', trackId: '', mute: false },
    { label: 'flute solo', trackId: 'flute-theme', mute: false },
    { label: 'flute muted', trackId: 'flute-theme', mute: true },
    { label: 'full mix restored', trackId: '', mute: false },
  ]) {
    await page.locator('#audition-track').selectOption(selection.trackId);
    if (selection.trackId) await page.locator('#mute-track').setChecked(selection.mute);
    assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
    assert.equal(await page.locator('#total-time').textContent(), '--:--');
    const expectedWav = await page.evaluate(async selection => {
      const { renderTrack } = await import('/src/engine/render.ts');
      const { inkTide } = await import('/src/tracks/ink-tide.ts');
      const { encodeWav } = await import('/src/audio/wav.ts');
      const request = selection.trackId
        ? selection.mute ? { muteTrackIds: [selection.trackId] } : { soloTrackIds: [selection.trackId] }
        : undefined;
      const rendered = await renderTrack(inkTide, { version: 'hook', bpm: inkTide.meta.bpm, transpose: 0, seed: 260713 }, request);
      const bytes = new Uint8Array(encodeWav(rendered.buffer));
      const pieces = [];
      for (let offset = 0; offset < bytes.length; offset += 8192) pieces.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
      return { filename: rendered.filename, base64: btoa(pieces.join('')) };
    }, selection);
    const downloadPromise = page.waitForEvent('download');
    const duringRender = await page.evaluate(() => {
      document.querySelector('#export').click();
      return {
        auditionDisabled: document.querySelector('#audition-track').matches(':disabled'),
        muteDisabled: document.querySelector('#mute-track').matches(':disabled'),
        playDisabled: document.querySelector('#play').matches(':disabled'),
        exportDisabled: document.querySelector('#export').matches(':disabled'),
      };
    });
    assert.ok(Object.values(duringRender).every(Boolean), 'render controls must be disabled while a mix is rendering');
    const download = await downloadPromise;
    const bytes = await readFile(await download.path());
    assert.equal(download.suggestedFilename(), expectedWav.filename);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt16LE(22), 2);
    assert.equal(bytes.readUInt32LE(24), 44100);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const pcmDifference = wavDifference(bytes, Buffer.from(expectedWav.base64, 'base64'));
    // PCM16 rounding can put two sub-LSB floating-point renders on adjacent codes.
    // The source PCM is separately checked against the stricter thresholds above.
    assert.ok(pcmDifference.maximumLsb <= 1 && pcmDifference.rmsLsb < 0.1, `${selection.label} export reused incorrect audio`);
    if (selection.label === 'full mix') initialMixWav = bytes;
    if (selection.label === 'full mix restored') {
      const restoredDifference = wavDifference(bytes, initialMixWav);
      assert.ok(restoredDifference.maximumLsb <= 1 && restoredDifference.rmsLsb < 0.1, 'restoring full mix must restore its PCM');
    }
    playerChecks.push({ ...selection, filename: download.suggestedFilename(), digest, pcmDifference, duringRender });
  }
  assert.notEqual(playerChecks[0].digest, playerChecks[1].digest);
  assert.notEqual(playerChecks[0].digest, playerChecks[2].digest);
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#play-state')?.textContent === '正在播放', undefined, { timeout: 20000 });
  await page.waitForFunction(() => Number(document.querySelector('#seek')?.value) > 0.2);
  await page.locator('#stop').click();
  await page.locator('#track-select').selectOption('afterglow');
  assert.equal(await page.locator('#mix-tracks').isVisible(), false);
  await page.locator('#track-select').selectOption('ink-tide');
  assert.equal(await page.locator('#audition-track').inputValue(), '');
  assert.equal(await page.locator('#mute-track').isChecked(), false);
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(`${reportDirectory}/multitrack-check.json`, JSON.stringify({
    passed: true, generatedAt: new Date().toISOString(), pcmTolerance, ...checks,
    player: { selectionExports: playerChecks, playbackProgress: true, switchingResetsSelection: true, mobileOverflow: false, errors },
    manualListening: 'not performed',
  }, null, 2) + '\n');
  console.log(`PASS: ${checks.trackIds.length} raw stems sum to their full mix, active/silent parts follow the score, deterministic solo/mute and cache-safe player exports`);
  console.log(JSON.stringify({ summation: checks.summation, muteDifference: checks.muteDifference, repeatStem: checks.repeatStem }));
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
