#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const ink = process.argv.includes('--ink-tide');
const vocal = process.argv.includes('--vocal');
const club = process.argv.includes('--neon-changan') || vocal;
const config = vocal ? {
  id: 'neon-changan-vocal', engine: 'guofeng-club', exportName: 'neonChanganVocal', factory: 'createGuofengClubInstruments',
  title: '霓虹长安 · 灯起', bpm: 128, bars: 60, description: /男女声.*切片/,
  seed: 261014, sampleRate: 48000, bitDepth: 24, mix: true, vocal: true, report: 'neon-changan-vocal-qa',
} : club ? {
  id: 'neon-changan', engine: 'guofeng-club', exportName: 'neonChangan', factory: 'createGuofengClubInstruments',
  title: '霓虹长安', bpm: 128, bars: 60, description: /古筝.*唢呐/,
  seed: 261014, sampleRate: 48000, bitDepth: 24, mix: true, report: 'neon-changan-qa',
} : ink ? {
  id: 'ink-tide', exportName: 'inkTide', factory: 'createInkTideInstruments',
  title: '墨潮', bpm: 92, bars: 40, description: /长笛.*钢琴/,
  seed: 261014,
  voices: ['flute', 'piano', 'harp', 'strings', 'cello', 'bass', 'kick', 'perc', 'shaker', 'tom', 'cymbal'],
  report: 'ink-tide-v6-qa',
} : {
  id: 'mountains-awake', engine: 'cinematic-guofeng', exportName: 'mountainsAwake', factory: 'createCinematicGuofengInstruments',
  title: '山河醒', bpm: 104, bars: 48, description: /筝声与笛声/,
  seed: 261013,
  voices: ['guzheng', 'dizi', 'erhu', 'strings', 'brass', 'granular', 'taiko', 'gong'],
  report: 'mountains-awake-v2-qa',
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
  await page.goto(`${base}/?track=${config.id}&version=hook`);
  await page.locator('#play').waitFor();
  let sampleLoadRetry;
  if (vocal) {
    const missing = '**/audio/night-city/night-call.wav';
    await page.route(missing, route => route.fulfill({ status: 404, body: 'missing voice' }));
    sampleLoadRetry = await page.evaluate(async () => {
      const module = await import('/src/engine/vocal-samples.ts');
      let failed = false, empty = false;
      try { await module.prepareVocalSamples(); } catch (error) { failed = /人声采样加载失败/.test(String(error)); }
      try { module.getVocalSample('ah-a4'); } catch { empty = true; }
      return { failed, empty };
    });
    await page.unroute(missing);
    assert.deepEqual(sampleLoadRetry, { failed: true, empty: true });
  }
  if (ink) {
    const missingSample = '**/audio/salamander/C4.mp3';
    await page.route(missingSample, route => route.fulfill({ status: 404, body: 'missing sample' }));
    const pianoRetry = await page.evaluate(async () => {
      const module = await import('/src/engine/piano-samples.ts');
      let failed = false, empty = false;
      try { await module.preparePianoSamples(); } catch (error) { failed = /钢琴采样加载失败/.test(String(error)); }
      try { module.getPianoSamples(); } catch { empty = true; }
      return { failed, empty };
    });
    await page.unroute(missingSample);
    assert.deepEqual(pianoRetry, { failed: true, empty: true }, 'failed piano sample loading must not publish a partial bank');
    const missingAcousticSample = '**/audio/vsco/flute-C5.mp3';
    await page.route(missingAcousticSample, route => route.fulfill({ status: 404, body: 'missing acoustic sample' }));
    const acousticRetry = await page.evaluate(async () => {
      const module = await import('/src/engine/acoustic-samples.ts');
      let failed = false;
      try { await module.prepareAcousticSamples(); } catch (error) { failed = /原声采样加载失败/.test(String(error)); }
      const emptyBanks = ['flute', 'strings', 'cello', 'harp'].map(kind => {
        try { module.getAcousticSamples(kind); return false; } catch { return true; }
      });
      return { failed, emptyBanks };
    });
    await page.unroute(missingAcousticSample);
    assert.deepEqual(acousticRetry, { failed: true, emptyBanks: [true, true, true, true] }, 'one missing acoustic sample must leave all banks unpublished and permit a complete retry');
    sampleLoadRetry = { piano: pianoRetry, acoustic: acousticRetry };
  }
  const checks = await page.evaluate(async config => {
    const { renderTrack, getTailSeconds } = await import('/src/engine/render.ts');
    const track = (await import(`/src/tracks/${config.id}.ts`))[config.exportName];
    const createInstruments = (await import(`/src/engine/${config.engine ?? config.id}.ts`))[config.factory];
    const { measureAudio } = await import('/src/audio/wav.ts');
    const engineSource = await (await fetch('/src/engine/render.ts')).text();
    const toneUrl = engineSource.match(/from ["']([^"']*tone[^"']*)["']/)?.[1];
    const Tone = await import(toneUrl);
    const original = Tone.getContext();
    const options = { version: 'hook', bpm: track.meta.bpm, transpose: 0, seed: config.seed, ...(config.sampleRate ? { sampleRate: config.sampleRate } : {}) };
    const mixTracks = config.id === 'ink-tide' || config.mix
      ? (await import('/src/music/arrange.ts')).buildArrangement(track, options).tracks.map(track => ({ ...track, automation: undefined }))
      : undefined;
    const [hook, repeat] = await Promise.all([renderTrack(track, options), renderTrack(track, options)]);
    const vocalBank = config.vocal ? await (async () => {
      const { vocalSamples } = await import('/src/music/vocal-bank.ts');
      const { getVocalSample } = await import('/src/engine/vocal-samples.ts');
      return Object.keys(vocalSamples).map(id => {
        const buffer = getVocalSample(id);
        return { id, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels, finite: buffer.getChannelData(0).every(Number.isFinite) };
      });
    })() : undefined;
    const sampleBank = config.id === 'ink-tide' ? [...(await import('/src/engine/piano-samples.ts')).getPianoSamples()].map(([midi, buffer]) => ({
      midi, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels,
      finite: buffer.getChannelData(0).every(Number.isFinite),
    })) : undefined;
    const acousticModule = config.id === 'ink-tide' ? await import('/src/engine/acoustic-samples.ts') : undefined;
    const acousticBanks = acousticModule ? Object.fromEntries(
      ['flute', 'strings', 'cello', 'harp'].map(kind => [kind, [...acousticModule.getAcousticSamples(kind)].map(([midi, buffer]) => ({
        midi, duration: buffer.duration, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels,
        finite: buffer.getChannelData(0).every(Number.isFinite),
        compensationGain: acousticModule.getAcousticSampleGain(kind, midi),
      }))]),
    ) : undefined;
    const loop = await renderTrack(track, { ...options, version: 'loop' });
    const low = await renderTrack(track, { ...options, bpm: 90, transpose: -12, seed: 0 });
    const high = await renderTrack(track, { ...options, bpm: 170, transpose: 12, seed: 0xffffffff });
    const renderContextRestored = Tone.getContext() === original;
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
    const voices = mixTracks
      ? mixTracks.map(track => ({ name: track.id, event: { trackId: track.id, instrument: track.instrument, beat: 0, duration: 1.2, velocity: 0.8, notes: [74], ...(track.instrument === 'vocal' ? { sample: ({ voice: 'night-call', chops: 'ah-a4', choir: 'choir-d4', 'voice-fx': 'reverse-a4' })[track.id] } : {}) } }))
      : config.voices.map(instrument => ({ name: instrument, event: { instrument, beat: 0, duration: 1.2, velocity: 0.8, notes: [74] } }));
    for (const drum of config.drumCases ?? []) voices.push({
      name: `drum/${drum.body}/${drum.stroke}`, event: { instrument: 'chineseDrum', beat: 0, duration: 1.2, velocity: 0.7, drum },
    });
    let rig;
    let rendered;
    let palette;
    try {
      rendered = await Tone.Offline(() => {
        rig = createInstruments(config.bpm, config.seed, mixTracks);
        voices.forEach(({ event }, index) => rig.hit(event, index * 4));
      }, voices.length * 4, 2, config.sampleRate ?? 44100);
      const buffer = rendered.get();
      palette = voices.map(({ name }, index) => ({ instrument: name, ...measureAudio({
        numberOfChannels: 2, sampleRate: buffer.sampleRate, length: buffer.sampleRate,
        getChannelData: channel => buffer.getChannelData(channel).subarray(index * 4 * buffer.sampleRate, (index * 4 + 1) * buffer.sampleRate),
      }) }));
    } finally { Tone.setContext(original); rig?.dispose(); rendered?.dispose(); }
    let vocalStemSum;
    if (config.vocal) {
      const ids = ['voice', 'chops', 'choir', 'voice-fx'];
      const raw = await renderTrack(track, options, { processing: 'raw' });
      const voices = await renderTrack(track, options, { processing: 'raw', soloTrackIds: ids });
      const music = await renderTrack(track, options, { processing: 'raw', muteTrackIds: ids });
      let maximum = 0, squares = 0;
      for (let c = 0; c < 2; c++) {
        const a = raw.buffer.getChannelData(c), b = voices.buffer.getChannelData(c), d = music.buffer.getChannelData(c);
        for (let i = 0; i < a.length; i++) { const diff = a[i] - b[i] - d[i]; maximum = Math.max(maximum, Math.abs(diff)); squares += diff ** 2; }
      }
      vocalStemSum = { maximum, rms: Math.sqrt(squares / (raw.buffer.length * 2)), voiceRms: voices.stats.rms, musicRms: music.stats.rms };
    }
    return {
      renders: [hook, loop, low, high].map(summary),
      repeat: { maximum, rms: Math.sqrt(sum / (hook.buffer.length * 2)) },
      loopEdges: [0, 1].flatMap(channel => { const data = loop.buffer.getChannelData(channel); return [data[0], data.at(-1)]; }),
      monoDeltaDb: (() => {
        const left = hook.buffer.getChannelData(0), right = hook.buffer.getChannelData(1);
        let stereo = 0, mono = 0;
        for (let i = 0; i < left.length; i++) { stereo += (left[i] ** 2 + right[i] ** 2) / 2; mono += ((left[i] + right[i]) / 2) ** 2; }
        return 10 * Math.log10(mono / stereo);
      })(),
      palette, sampleBank, acousticBanks, vocalBank, vocalStemSum, renderContextRestored, contextRestored: Tone.getContext() === original,
    };
  }, { ...config, description: undefined });
  await mkdir(`${root}/artifacts/audio/${config.report}`, { recursive: true });
  await writeFile(`${root}/artifacts/audio/${config.report}/pcm-check.json`, JSON.stringify(checks, null, 2) + '\n');
  for (const result of checks.renders) {
    assert.equal(result.finite, true);
    assert.equal(result.sampleRate, config.sampleRate ?? 44100);
    assert.equal(result.channels, 2);
    assert.ok(result.stats.rms > 0.01 && result.stats.peak > 0.1);
    assert.equal(result.stats.clippedSamples, 0);
    assert.ok(result.stats.peakDb <= -1.19 && Math.abs(result.stats.dcOffset) < 0.001);
    assert.ok(Math.abs(result.duration - result.expectedDuration) < 1 / result.sampleRate);
  }
  assert.ok(checks.repeat.maximum < 1 / 65536, `same seed maximum: ${checks.repeat.maximum}`);
  assert.ok(checks.repeat.rms < 1e-6, `same seed RMS: ${checks.repeat.rms}`);
  assert.ok(checks.loopEdges.every(value => value === 0));
  assert.ok(checks.palette.every(voice => voice.rms > 0.0001 && voice.peak > 0.001));
  assert.equal(checks.contextRestored, true);
  assert.equal(checks.renderContextRestored, true, 'renderTrack restores its caller context');
  assert.ok(checks.monoDeltaDb > -1, 'mono fold-down must preserve the foreground');
  if (vocal) {
    assert.equal(checks.vocalBank.length, 11);
    assert.ok(checks.vocalBank.every(s => s.finite && s.sampleRate === 48000 && s.channels === 1 && s.duration > .1));
    assert.ok(checks.vocalStemSum.maximum < 2e-6 && checks.vocalStemSum.rms < 1e-7);
    assert.ok(checks.vocalStemSum.voiceRms > .01 && checks.vocalStemSum.musicRms > .01);
  }
  if (ink) {
    assert.equal(checks.sampleBank.length, 13);
    assert.ok(checks.sampleBank.every(sample => sample.finite && sample.channels === 1 && sample.sampleRate === 44100 && sample.duration > 5));
    assert.deepEqual(Object.keys(checks.acousticBanks).sort(), ['cello', 'flute', 'harp', 'strings']);
    for (const [kind, bank] of Object.entries(checks.acousticBanks)) {
      assert.ok(bank.length > 0, `${kind} sample bank is empty after retry`);
      assert.equal(new Set(bank.map(sample => sample.midi)).size, bank.length);
      assert.ok(bank.every(sample => sample.finite && sample.channels === 1 && sample.sampleRate === 44100 && sample.duration > 0.2), `${kind} samples must be finite mono PCM`);
      assert.ok(bank.every(sample => Number.isFinite(sample.compensationGain) && sample.compensationGain > 0),
        `${kind} sample-level compensation must remain finite and positive`);
    }
  }

  assert.equal(await page.locator('#track-select').inputValue(), config.id);
  assert.equal(await page.locator('#player-title').textContent(), config.title);
  assert.equal(await page.locator('#bpm').inputValue(), String(config.bpm));
  assert.equal(await page.locator('#bars-fact').textContent(), String(config.bars));
  assert.match(await page.locator('#melody-description').textContent(), config.description);
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#render-badge')?.textContent === '合成完成', undefined, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#play-state')?.textContent === '正在播放', undefined, { timeout: 20000 });
  await page.waitForFunction(() => Number(document.querySelector('#seek')?.value) > 0.2);
  assert.equal(await page.locator('#total-time').textContent(), club ? '00:15' : ink ? '00:22' : '00:20');
  await page.locator('#stop').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), `${config.id}-hook-${config.bpm}bpm-t0-s260713.wav`);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.readUInt16LE(22), 2);
  assert.equal(bytes.readUInt32LE(24), config.sampleRate ?? 44100);
  assert.equal(bytes.readUInt16LE(34), config.bitDepth ?? 16);
  assert.equal(await page.locator('.timeline-section').count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  const report = { passed: true, generatedAt: new Date().toISOString(), ...checks, sampleLoadRetry, player: { directUrl: true, playbackProgress: true, wavDownload: true, mobileOverflow: false, pageErrors: errors }, manualListening: 'not performed' };
  await mkdir(`${root}/artifacts/audio/${config.report}`, { recursive: true });
  await writeFile(`${root}/artifacts/audio/${config.report}/browser-check.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS: ${config.id} voices, seeded PCM, pitch/tempo limits, mono compatibility, loop edges, context cleanup and player/download`);
  console.log(JSON.stringify({ renders: checks.renders.map(({ duration, stats }) => ({ duration, rmsDb: stats.rmsDb })), repeat: checks.repeat, monoDeltaDb: checks.monoDeltaDb }));
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
