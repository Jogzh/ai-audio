#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
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
  await page.goto(`${base}/?track=mountains-awake&version=hook`);
  await page.locator('#play').waitFor();
  const checks = await page.evaluate(async () => {
    const { renderTrack, getTailSeconds } = await import('/src/engine/render.ts');
    const { mountainsAwake: track } = await import('/src/tracks/mountains-awake.ts');
    const { createCinematicGuofengInstruments } = await import('/src/engine/cinematic-guofeng.ts');
    const { measureAudio } = await import('/src/audio/wav.ts');
    const engineSource = await (await fetch('/src/engine/render.ts')).text();
    const toneUrl = engineSource.match(/from ["']([^"']*tone[^"']*)["']/)?.[1];
    const Tone = await import(toneUrl);
    const original = Tone.getContext();
    const options = { version: 'hook', bpm: 96, transpose: 0, seed: 261013 };
    const [hook, repeat] = await Promise.all([renderTrack(track, options), renderTrack(track, options)]);
    const loop = await renderTrack(track, { ...options, version: 'loop' });
    const low = await renderTrack(track, { ...options, bpm: 90, transpose: -12, seed: 0 });
    const high = await renderTrack(track, { ...options, bpm: 170, transpose: 12, seed: 0xffffffff });
    let maximum = 0;
    let sum = 0;
    for (let channel = 0; channel < 2; channel++) {
      const a = hook.buffer.getChannelData(channel);
      const b = repeat.buffer.getChannelData(channel);
      for (let index = 0; index < a.length; index++) {
        const difference = Math.abs(a[index] - b[index]);
        maximum = Math.max(maximum, difference);
        sum += difference * difference;
      }
    }
    const summary = rendered => ({
      options: rendered.options, duration: rendered.duration, stats: rendered.stats,
      sampleRate: rendered.buffer.sampleRate, channels: rendered.buffer.numberOfChannels,
      finite: [0, 1].every(channel => rendered.buffer.getChannelData(channel).every(Number.isFinite)),
      expectedDuration: 32 * 60 / rendered.options.bpm + getTailSeconds(track, rendered.options.version),
    });
    const voices = ['guzheng', 'dizi', 'erhu', 'strings', 'brass', 'granular', 'taiko', 'gong'];
    let rig;
    let rendered;
    let palette;
    try {
      rendered = await Tone.Offline(() => {
        rig = createCinematicGuofengInstruments(96, 261013);
        voices.forEach((instrument, index) => rig.hit({ instrument, beat: 0, duration: 1.2, velocity: 0.8, notes: [74] }, index * 4));
      }, voices.length * 4, 2, 44100);
      const buffer = rendered.get();
      palette = voices.map((instrument, index) => ({ instrument, ...measureAudio({
        numberOfChannels: 2, sampleRate: 44100, length: 44100,
        getChannelData: channel => buffer.getChannelData(channel).subarray(index * 4 * 44100, (index * 4 + 1) * 44100),
      }) }));
    } finally { Tone.setContext(original); rig?.dispose(); rendered?.dispose(); }
    return {
      renders: [hook, loop, low, high].map(summary),
      repeat: { maximum, rms: Math.sqrt(sum / (hook.buffer.length * 2)) },
      loopEdges: [0, 1].flatMap(channel => { const data = loop.buffer.getChannelData(channel); return [data[0], data.at(-1)]; }),
      palette, contextRestored: Tone.getContext() === original,
    };
  });
  for (const result of checks.renders) {
    assert.equal(result.finite, true);
    assert.equal(result.sampleRate, 44100);
    assert.equal(result.channels, 2);
    assert.ok(result.stats.rms > 0.01 && result.stats.peak > 0.1);
    assert.equal(result.stats.clippedSamples, 0);
    assert.ok(result.stats.peakDb <= -1.19 && Math.abs(result.stats.dcOffset) < 0.001);
    assert.ok(Math.abs(result.duration - result.expectedDuration) < 1 / 44100);
  }
  assert.ok(checks.repeat.maximum < 1 / 65536, `same seed maximum: ${checks.repeat.maximum}`);
  assert.ok(checks.repeat.rms < 1e-6, `same seed RMS: ${checks.repeat.rms}`);
  assert.ok(checks.loopEdges.every(value => value === 0));
  assert.ok(checks.palette.every(voice => voice.rms > 0.0001 && voice.peak > 0.001));
  assert.equal(checks.contextRestored, true);

  assert.equal(await page.locator('#track-select').inputValue(), 'mountains-awake');
  assert.equal(await page.locator('#player-title').textContent(), '山河醒');
  assert.equal(await page.locator('#bpm').inputValue(), '96');
  assert.equal(await page.locator('#bars-fact').textContent(), '48');
  assert.match(await page.locator('#melody-description').textContent(), /筝声与笛声/);
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#render-badge')?.textContent === '合成完成', undefined, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#play-state')?.textContent === '正在播放', undefined, { timeout: 20000 });
  await page.waitForFunction(() => Number(document.querySelector('#seek')?.value) > 0.2);
  assert.equal(await page.locator('#total-time').textContent(), '00:21');
  await page.locator('#stop').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /mountains-awake-hook-96bpm-t0-s260713\.wav/);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt16LE(22), 2);
  assert.equal(bytes.readUInt32LE(24), 44100);
  assert.equal(await page.locator('.timeline-section').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  const report = { passed: true, generatedAt: new Date().toISOString(), ...checks, player: { directUrl: true, playbackProgress: true, wavDownload: true, mobileOverflow: false, pageErrors: errors }, manualListening: 'not performed' };
  await mkdir(`${root}/artifacts/audio/mountains-awake-qa`, { recursive: true });
  await writeFile(`${root}/artifacts/audio/mountains-awake-qa/browser-check.json`, JSON.stringify(report, null, 2) + '\n');
  console.log('PASS: guofeng voices, seeded PCM, pitch/tempo limits, loop edges, context cleanup and player/download');
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
