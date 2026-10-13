#!/usr/bin/env node
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
let server;
let browser;
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  await server.listen();
  const address = server.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Keep the existing sampled-instrument and player regression explicit.
  await page.goto(`${baseUrl}/?track=velvet-hour&version=hook`);
  await page.locator('#play').waitFor();
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');

  const checks = await page.evaluate(async () => {
    const { getTailSeconds, renderTrack } = await import('/src/engine/render.ts');
    const { neonRebound } = await import('/src/tracks/neon-rebound.ts');
    const { amberTides } = await import('/src/tracks/amber-tides.ts');
    const { velvetHour } = await import('/src/tracks/velvet-hour.ts');
    const { moonlitSway } = await import('/src/tracks/moonlit-sway.ts');
    const { afterglow } = await import('/src/tracks/afterglow.ts');
    const { encodeWav } = await import('/src/audio/wav.ts');
    const engineSource = await (await fetch('/src/engine/render.ts')).text();
    const toneUrl = engineSource.match(/from ["']([^"']*tone[^"']*)["']/)?.[1];
    if (!toneUrl) throw new Error('无法找到 Vite 解析后的 Tone 模块');
    const Tone = await import(toneUrl);
    const originalContext = Tone.getContext();
    const invalidTrack = structuredClone(neonRebound);
    invalidTrack.hook[0][0].note = NaN;
    let failureHandled = false;
    try { await renderTrack(invalidTrack, { version: 'hook', bpm: 132, transpose: 0, seed: 260713 }); }
    catch { failureHandled = Tone.getContext() === originalContext; }
    let callbackFailureHandled = false;
    const originalKick = Tone.MembraneSynth.prototype.triggerAttackRelease;
    Tone.MembraneSynth.prototype.triggerAttackRelease = () => { throw new Error('intentional scheduling failure'); };
    try { await renderTrack(neonRebound, { version: 'hook', bpm: 132, transpose: 0, seed: 260713 }); }
    catch { callbackFailureHandled = Tone.getContext() === originalContext; }
    finally { Tone.MembraneSynth.prototype.triggerAttackRelease = originalKick; }
    let postProcessingDisposed = false;
    const originalGet = Tone.ToneAudioBuffer.prototype.get;
    const originalDispose = Tone.ToneAudioBuffer.prototype.dispose;
    const observedBuffers = new Set();
    Tone.ToneAudioBuffer.prototype.get = function () { observedBuffers.add(this); return undefined; };
    Tone.ToneAudioBuffer.prototype.dispose = function () {
      if (observedBuffers.has(this)) postProcessingDisposed = true;
      return originalDispose.call(this);
    };
    const noSources = structuredClone(neonRebound);
    noSources.arrangement = [{ name: 'silent test', bars: 1, energy: 'air' }];
    let missingBufferHandled = false;
    try { await renderTrack(noSources, { version: 'full', bpm: 132, transpose: 0, seed: 260713 }); }
    catch { missingBufferHandled = Tone.getContext() === originalContext; }
    finally {
      Tone.ToneAudioBuffer.prototype.get = originalGet;
      Tone.ToneAudioBuffer.prototype.dispose = originalDispose;
    }
    let silentOutputHandled = false;
    let silentOutputDisposed = false;
    const silentBuffers = new Set();
    Tone.ToneAudioBuffer.prototype.get = function () {
      const buffer = originalGet.call(this);
      if (buffer) {
        silentBuffers.add(this);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) buffer.getChannelData(channel).fill(0);
      }
      return buffer;
    };
    Tone.ToneAudioBuffer.prototype.dispose = function () {
      if (silentBuffers.has(this)) silentOutputDisposed = true;
      return originalDispose.call(this);
    };
    try { await renderTrack(noSources, { version: 'full', bpm: 132, transpose: 0, seed: 260713 }); }
    catch (error) { silentOutputHandled = error.message.includes('静音') && Tone.getContext() === originalContext; }
    finally {
      Tone.ToneAudioBuffer.prototype.get = originalGet;
      Tone.ToneAudioBuffer.prototype.dispose = originalDispose;
    }
    const options = { version: 'hook', bpm: 132, transpose: 0, seed: 260713 };
    const [first, second] = await Promise.all([renderTrack(neonRebound, options), renderTrack(neonRebound, options)]);
    let maxDifference = 0;
    for (let channel = 0; channel < 2; channel++) {
      const a = first.buffer.getChannelData(channel);
      const b = second.buffer.getChannelData(channel);
      for (let index = 0; index < a.length; index++) maxDifference = Math.max(maxDifference, Math.abs(a[index] - b[index]));
    }
    const loop = await renderTrack(neonRebound, { ...options, version: 'loop' });
    const changed = await renderTrack(neonRebound, { ...options, seed: 0, transpose: 5, bpm: 100 });
    const low = await renderTrack(neonRebound, { ...options, bpm: 90, transpose: -12, seed: 0 });
    const high = await renderTrack(neonRebound, { ...options, bpm: 170, transpose: 12, seed: 0xffffffff });
    const warmOptions = { ...options, bpm: 112 };
    const [warm, warmRepeat] = await Promise.all([renderTrack(amberTides, warmOptions), renderTrack(amberTides, warmOptions)]);
    let warmDifference = 0;
    for (let channel = 0; channel < 2; channel++) {
      const a = warm.buffer.getChannelData(channel);
      const b = warmRepeat.buffer.getChannelData(channel);
      for (let index = 0; index < a.length; index++) warmDifference = Math.max(warmDifference, Math.abs(a[index] - b[index]));
    }
    const warmLoop = await renderTrack(amberTides, { ...warmOptions, version: 'loop' });
    const warmLow = await renderTrack(amberTides, { ...warmOptions, bpm: 90, transpose: -12, seed: 0 });
    const warmHigh = await renderTrack(amberTides, { ...warmOptions, bpm: 170, transpose: 12, seed: 0xffffffff });
    const discoOptions = { ...options, bpm: 120 };
    const [disco, discoRepeat] = await Promise.all([renderTrack(velvetHour, discoOptions), renderTrack(velvetHour, discoOptions)]);
    let discoDifference = 0;
    for (let channel = 0; channel < 2; channel++) {
      const a = disco.buffer.getChannelData(channel);
      const b = discoRepeat.buffer.getChannelData(channel);
      for (let index = 0; index < a.length; index++) discoDifference = Math.max(discoDifference, Math.abs(a[index] - b[index]));
    }
    const discoLoop = await renderTrack(velvetHour, { ...discoOptions, version: 'loop' });
    const discoLow = await renderTrack(velvetHour, { ...discoOptions, bpm: 90, transpose: -12, seed: 0 });
    const discoHigh = await renderTrack(velvetHour, { ...discoOptions, bpm: 170, transpose: 12, seed: 0xffffffff });
    const light = await renderTrack(moonlitSway, { ...options, bpm: 116, seed: 261013 });
    const lightLoop = await renderTrack(moonlitSway, { ...options, bpm: 116, seed: 261013, version: 'loop' });
    const popOptions = { ...options, bpm: 118, seed: 261013 };
    const [pop, popRepeat] = await Promise.all([renderTrack(afterglow, popOptions), renderTrack(afterglow, popOptions)]);
    let popDifference = 0;
    let popSquaredDifference = 0;
    let popFirstSignificantDifference = -1;
    for (let channel = 0; channel < 2; channel++) {
      const a = pop.buffer.getChannelData(channel);
      const b = popRepeat.buffer.getChannelData(channel);
      for (let index = 0; index < a.length; index++) {
        const difference = Math.abs(a[index] - b[index]);
        popDifference = Math.max(popDifference, difference);
        popSquaredDifference += difference * difference;
        if (difference > 1e-6 && (popFirstSignificantDifference < 0 || index < popFirstSignificantDifference)) popFirstSignificantDifference = index;
      }
    }
    const popLoop = await renderTrack(afterglow, { ...popOptions, version: 'loop' });
    const popLow = await renderTrack(afterglow, { ...popOptions, bpm: 90, transpose: -12, seed: 0 });
    const popHigh = await renderTrack(afterglow, { ...popOptions, bpm: 170, transpose: 12, seed: 0xffffffff });
    const finiteAudio = buffer => Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel).every(Number.isFinite)).every(Boolean);
    const { loadSamples } = await import('/src/engine/sample-library.ts');
    const { createInstruments } = await import('/src/engine/instruments.ts');
    const { createEmotionalPopInstruments } = await import('/src/engine/emotional-pop.ts');
    const { measureAudio } = await import('/src/audio/wav.ts');
    const palette = ['guitar', 'electricBass', 'organ', 'pluck', 'shaker', 'rim', 'conga'];
    const bank = await loadSamples(palette);
    let paletteRig;
    let paletteAudio;
    try {
      paletteAudio = await Tone.Offline(() => {
        paletteRig = createInstruments(120, 260713, 'disco-house', bank);
        palette.forEach((instrument, index) => paletteRig.hit({ instrument, beat: 0, duration: 1, velocity: 0.8, notes: ['shaker', 'rim', 'conga'].includes(instrument) ? undefined : [instrument === 'electricBass' ? 45 : 72] }, index * 2));
      }, palette.length * 2, 2, 44100);
    } finally { Tone.setContext(originalContext); paletteRig?.dispose(); }
    const paletteBuffer = paletteAudio.get();
    const paletteStats = palette.map((instrument, index) => ({ instrument, ...measureAudio({ numberOfChannels: 2, length: 44100, sampleRate: 44100, getChannelData: channel => paletteBuffer.getChannelData(channel).subarray(index * 88200, index * 88200 + 44100) }) }));
    paletteAudio.dispose();
    const popPalette = ['piano', 'vocal', 'texture', 'sweep'];
    let popPaletteRig;
    let popPaletteAudio;
    try {
      popPaletteAudio = await Tone.Offline(() => {
        popPaletteRig = createEmotionalPopInstruments(118, 261013);
        // Three seconds between voices prevents the previous room tail from
        // passing the next instrument's non-silence check.
        popPalette.forEach((instrument, index) => popPaletteRig.hit({ instrument, beat: 0, duration: 1, velocity: 0.8, notes: ['piano', 'vocal'].includes(instrument) ? [73] : undefined }, index * 3));
      }, popPalette.length * 3, 2, 44100);
    } finally { Tone.setContext(originalContext); popPaletteRig?.dispose(); }
    const popPaletteBuffer = popPaletteAudio.get();
    const popPaletteStats = popPalette.map((instrument, index) => ({ instrument, ...measureAudio({ numberOfChannels: 2, length: 44100, sampleRate: 44100, getChannelData: channel => popPaletteBuffer.getChannelData(channel).subarray(index * 132300, index * 132300 + 44100) }) }));
    const popPaletteFinite = finiteAudio(popPaletteBuffer);
    popPaletteAudio.dispose();
    const renderPianoFixture = async () => {
      let rig;
      let audio;
      try {
        audio = await Tone.Offline(() => {
          rig = createEmotionalPopInstruments(118, 261013);
          rig.hit({ instrument: 'piano', beat: 0, duration: 1.5, velocity: 0.7, notes: [73] }, 0);
        }, 2.5, 2, 44100);
        return audio.get();
      } finally { Tone.setContext(originalContext); rig?.dispose(); audio?.dispose(); }
    };
    // The second dotted-eighth echo exposed intermittent feedback-loop
    // differences. Repeat a short audible fixture to keep that regression
    // independent of the chosen composition and its final peak trim.
    const pianoFixture = await renderPianoFixture();
    let pianoRepeatDifference = 0;
    for (let repeat = 0; repeat < 4; repeat++) {
      const next = await renderPianoFixture();
      for (let channel = 0; channel < 2; channel++) {
        const a = pianoFixture.getChannelData(channel);
        const b = next.getChannelData(channel);
        for (let index = 0; index < a.length; index++) pianoRepeatDifference = Math.max(pianoRepeatDifference, Math.abs(a[index] - b[index]));
      }
    }
    const peak = first.stats.peak;
    const bytes = encodeWav(first.buffer);
    return {
      stats: first.stats, duration: first.duration, channels: first.buffer.numberOfChannels, rate: first.buffer.sampleRate,
      maxDifference, wavSize: bytes.byteLength, expectedWavSize: 44 + first.buffer.length * 4,
      loop: { duration: loop.duration, start: loop.buffer.getChannelData(0)[0], end: loop.buffer.getChannelData(0).at(-1), stats: loop.stats },
      changed: { duration: changed.duration, stats: changed.stats },
      boundaries: [low.stats, high.stats, warmLow.stats, warmHigh.stats, discoLow.stats, discoHigh.stats],
      disco: { duration: disco.duration, stats: disco.stats, difference: discoDifference, credits: disco.credits, loopDuration: discoLoop.duration, loopStats: discoLoop.stats, start: discoLoop.buffer.getChannelData(0)[0], end: discoLoop.buffer.getChannelData(0).at(-1) },
      light: { duration: light.duration, stats: light.stats, credits: light.credits.length, loopDuration: lightLoop.duration, loopStats: lightLoop.stats, start: lightLoop.buffer.getChannelData(0)[0], end: lightLoop.buffer.getChannelData(0).at(-1) },
      pop: {
        duration: pop.duration, stats: pop.stats, difference: popDifference,
        rmsDifference: Math.sqrt(popSquaredDifference / (pop.buffer.length * 2)),
        firstSignificantDifference: popFirstSignificantDifference < 0 ? null : popFirstSignificantDifference / pop.buffer.sampleRate,
        channels: pop.buffer.numberOfChannels, rate: pop.buffer.sampleRate, credits: pop.credits,
        finite: [pop, popRepeat, popLoop, popLow, popHigh].every(rendered => finiteAudio(rendered.buffer)),
        loopDuration: popLoop.duration, loopStats: popLoop.stats,
        loopEdges: Array.from({ length: 2 }, (_, channel) => [popLoop.buffer.getChannelData(channel)[0], popLoop.buffer.getChannelData(channel).at(-1)]),
        boundaries: [popLow.stats, popHigh.stats],
        expectedLoopDuration: afterglow.edits.loop.bars * 4 * 60 / 118,
        palette: popPaletteStats, paletteFinite: popPaletteFinite, pianoRepeatDifference,
      },
      palette: paletteStats,
      sampleRates: Object.values(bank).flatMap(voices => Object.values(voices).map(buffer => buffer.sampleRate)),
      warm: { duration: warm.duration, stats: warm.stats, difference: warmDifference, loopDuration: warmLoop.duration, loopStats: warmLoop.stats, start: warmLoop.buffer.getChannelData(0)[0], end: warmLoop.buffer.getChannelData(0).at(-1) },
      signal: peak > 0.2 && first.stats.rms > 0.01,
      failureHandled, callbackFailureHandled, missingBufferHandled, postProcessingDisposed, silentOutputHandled, silentOutputDisposed,
      expectedDuration: first.sections.at(-1).end + getTailSeconds(neonRebound, 'hook'),
      expectedChangedDuration: changed.sections.at(-1).end + getTailSeconds(neonRebound, 'hook'),
      expectedWarmDuration: warm.sections.at(-1).end + getTailSeconds(amberTides, 'hook'),
      expectedDiscoDuration: disco.sections.at(-1).end + getTailSeconds(velvetHour, 'hook'),
      expectedPopDuration: pop.sections.at(-1).end + getTailSeconds(afterglow, 'hook'),
      contextRestored: Tone.getContext() === originalContext,
    };
  });
  assert.equal(checks.failureHandled, true, 'invalid track fails without switching the audio context');
  assert.equal(checks.callbackFailureHandled, true, 'failed scheduling restores original context');
  assert.equal(checks.missingBufferHandled, true, 'missing output buffer is handled');
  assert.equal(checks.postProcessingDisposed, true, 'missing-buffer failure disposes the offline wrapper');
  assert.equal(checks.silentOutputHandled, true, 'silent output fails in finishAudio');
  assert.equal(checks.silentOutputDisposed, true, 'failed finishAudio still disposes the offline wrapper');
  assert.equal(checks.contextRestored, true, 'next render succeeds without poisoning queue');
  assert.equal(checks.channels, 2);
  assert.equal(checks.rate, 44100);
  assert.ok(checks.signal, 'audible non-silent output');
  assert.equal(checks.stats.clippedSamples, 0);
  assert.ok(Math.abs(checks.stats.dcOffset) < 0.001);
  assert.ok(checks.stats.peakDb <= -1.19);
  assert.ok(checks.maxDifference < 1e-6, `same seed difference: ${checks.maxDifference}`);
  assert.equal(checks.wavSize, checks.expectedWavSize);
  assert.ok(Math.abs(checks.duration - checks.expectedDuration) < 1 / 44100);
  assert.ok(Math.abs(checks.loop.duration - 32 * 60 / 132) < 1 / 44100);
  assert.equal(checks.loop.start, 0);
  assert.equal(checks.loop.end, 0);
  assert.equal(checks.loop.stats.clippedSamples, 0);
  assert.ok(Math.abs(checks.changed.duration - checks.expectedChangedDuration) < 1 / 44100);
  assert.ok(checks.boundaries.every(stats => stats.clippedSamples === 0 && stats.rms > 0.01));
  assert.ok(checks.warm.stats.rms > 0.01);
  assert.equal(checks.warm.stats.clippedSamples, 0);
  assert.ok(checks.warm.stats.peakDb <= -1.19);
  assert.ok(checks.warm.difference < 1e-6, `warm same seed difference: ${checks.warm.difference}`);
  assert.ok(Math.abs(checks.warm.duration - checks.expectedWarmDuration) < 1 / 44100);
  assert.ok(Math.abs(checks.warm.loopDuration - 32 * 60 / 112) < 1 / 44100);
  assert.equal(checks.warm.loopStats.clippedSamples, 0);
  // IEEE-754 negative zero is also a silent sample; compare its magnitude.
  assert.equal(Math.abs(checks.warm.start), 0);
  assert.equal(Math.abs(checks.warm.end), 0);
  assert.ok(checks.sampleRates.length === 8 && checks.sampleRates.every(rate => rate === 44100), 'all local samples decode at the offline render rate');
  console.log(`Disco repeat max PCM difference: ${checks.disco.difference}`);
  assert.ok(checks.disco.stats.rms > 0.01);
  assert.equal(checks.disco.stats.clippedSamples, 0);
  assert.ok(checks.disco.stats.peakDb <= -1.19);
  assert.ok(checks.disco.difference < 1e-6, `sampled disco repeat difference: ${checks.disco.difference}`);
  assert.ok(Math.abs(checks.disco.duration - checks.expectedDiscoDuration) < 1 / 44100);
  assert.equal(checks.disco.loopDuration, 16);
  assert.equal(checks.disco.loopStats.clippedSamples, 0);
  assert.equal(Math.abs(checks.disco.start), 0);
  assert.equal(Math.abs(checks.disco.end), 0);
  assert.equal(checks.disco.credits.length, 2);
  assert.ok(checks.disco.credits.every(credit => credit.author && credit.license === 'CC BY 3.0' && credit.source.startsWith('https://') && credit.modifications));
  assert.ok(checks.palette.every(stats => stats.peak > 0.005 && stats.rms > 0.0005), 'each new timbre must produce measurable sound, not only appear in events');
  assert.ok(checks.light.stats.rms > 0.01 && checks.light.stats.peakDb <= -1.19);
  assert.equal(checks.light.stats.clippedSamples, 0);
  assert.equal(checks.light.credits, 2);
  assert.ok(Math.abs(checks.light.duration - (32 * 60 / 116 + 0.9)) < 1 / 44100);
  assert.ok(Math.abs(checks.light.loopDuration - 32 * 60 / 116) < 1 / 44100);
  assert.equal(checks.light.loopStats.clippedSamples, 0);
  assert.equal(Math.abs(checks.light.start), 0);
  assert.equal(Math.abs(checks.light.end), 0);
  assert.equal(checks.pop.channels, 2);
  assert.equal(checks.pop.rate, 44100);
  assert.equal(checks.pop.finite, true, 'new pop render remains finite at both tempo/pitch limits');
  assert.ok(checks.pop.stats.peak > 0.2 && checks.pop.stats.rms > 0.01, 'pop composition must produce non-silent audio');
  assert.equal(checks.pop.stats.clippedSamples, 0);
  assert.ok(checks.pop.stats.peakDb <= -1.19);
  assert.ok(Math.abs(checks.pop.stats.dcOffset) < 0.001);
  // Native pop bus compression can differ by a few float ULPs. Its maximum
  // error must stay below half a PCM16 quantization step, with a separate
  // RMS ceiling; the isolated echo regression and all old tracks stay strict.
  assert.ok(checks.pop.difference < 1 / 65536, `pop repeat max PCM difference: ${checks.pop.difference}`);
  assert.ok(checks.pop.rmsDifference < 1e-6, `pop repeat RMS difference: ${checks.pop.rmsDifference}`);
  assert.ok(checks.pop.pianoRepeatDifference < 1e-6, `isolated pop echo repeat difference: ${checks.pop.pianoRepeatDifference}`);
  assert.ok(Math.abs(checks.pop.duration - checks.expectedPopDuration) < 1 / 44100);
  assert.deepEqual(checks.pop.credits, [], 'sample-free pop does not inherit guitar credits');
  assert.ok(Math.abs(checks.pop.loopDuration - checks.pop.expectedLoopDuration) < 1 / 44100);
  assert.ok(checks.pop.loopStats.rms > 0.01);
  assert.equal(checks.pop.loopStats.clippedSamples, 0);
  assert.ok(checks.pop.loopEdges.flat().every(value => Math.abs(value) === 0), 'both stereo loop channels have silent edge samples');
  assert.ok(checks.pop.boundaries.every(stats => stats.clippedSamples === 0 && stats.rms > 0.01 && stats.peakDb <= -1.19));
  assert.equal(checks.pop.paletteFinite, true);
  assert.ok(checks.pop.palette.every(stats => stats.peak > 0.001 && stats.rms > 0.0001), 'each pop voice must create sound in its isolated segment');
  console.log('PASS: five compositions, isolated sample/pop timbres, credits, seeded repeatability, tempo/pitch limits, finite PCM, stereo loop edges, WAV and levels');

  assert.equal(await page.locator('#track-select').inputValue(), 'velvet-hour');
  assert.equal(await page.locator('#track-select option').count(), 5);
  assert.equal(await page.locator('#bpm').inputValue(), '120');
  assert.equal(await page.locator('#player-title').textContent(), '微醺舞步');
  assert.equal(await page.locator('#bars-fact').textContent(), '56');
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#render-badge')?.textContent === '合成完成', undefined, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#play-state')?.textContent === '正在播放', undefined, { timeout: 20000 });
  await page.waitForFunction(() => Number(document.querySelector('#seek')?.value) > 0.2);
  await page.locator('#play').click();
  assert.equal(await page.locator('#play-state').textContent(), '准备就绪');
  await page.locator('#seek').evaluate(input => { input.value = '5'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await page.locator('#current-time').textContent(), '00:05');
  await page.locator('#stop').click();
  assert.equal(await page.locator('#seek').inputValue(), '0');
  assert.equal(await page.locator('#sample-credits li').count(), 2);
  const standaloneCreditsPromise = page.waitForEvent('download');
  await page.locator('#export-credits').click();
  const standaloneCredits = await standaloneCreditsPromise;
  assert.match(standaloneCredits.suggestedFilename(), /velvet-hour-hook-120bpm-t0-s260713\.credits\.json/);
  const downloadPromise = page.waitForEvent('download', { predicate: download => download.suggestedFilename().endsWith('.wav') });
  const creditsPromise = page.waitForEvent('download', { predicate: download => download.suggestedFilename().endsWith('.credits.json') });
  await page.locator('#export').click();
  const [download, attribution] = await Promise.all([downloadPromise, creditsPromise]);
  assert.match(download.suggestedFilename(), /velvet-hour-hook-120bpm-t0-s260713\.wav/);
  const attributionFile = await attribution.path();
  const attributionJson = JSON.parse(await readFile(attributionFile, 'utf8'));
  assert.equal(attributionJson.track, 'velvet-hour');
  assert.equal(attributionJson.credits.length, 2);
  await page.locator('#track-select').selectOption('amber-tides');
  assert.equal(await page.locator('#bpm').inputValue(), '112');
  assert.equal(await page.locator('#player-title').textContent(), '晚风来信');
  assert.equal(await page.locator('#sample-credits li').count(), 0);
  assert.equal(await page.locator('#export-credits').isHidden(), true);
  await page.locator('#transpose').fill('3');
  await page.locator('#track-select').selectOption('neon-rebound');
  assert.equal(await page.locator('#bpm').inputValue(), '132');
  assert.equal(await page.locator('#transpose').inputValue(), '0');
  assert.equal(await page.locator('#player-title').textContent(), '霓虹回弹');
  assert.equal(await page.locator('#key-fact').textContent(), 'F minor');
  assert.match(await page.title(), /NEON REBOUND/);
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  await page.locator('[data-version="loop"]').click();
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  assert.equal(await page.locator('#seek').isDisabled(), true);
  await page.locator('#bpm').fill('10');
  await page.locator('#export').click();
  assert.match(await page.locator('#status').textContent(), /有效整数/);
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  await page.locator('#bpm').fill('132');
  await page.locator('#seed').fill('0');
  const loopDownloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.locator('#export').click();
  const loopDownload = await loopDownloadPromise;
  assert.match(loopDownload.suggestedFilename(), /loop-132bpm-t0-s0\.wav/);
  assert.equal(await page.locator('.timeline-section').count(), 1);
  await page.locator('#track-select').selectOption('amber-tides');
  assert.equal(await page.locator('#bpm').inputValue(), '112');
  assert.equal(await page.locator('#seek').isDisabled(), true);
  assert.match(await page.title(), /AMBER TIDES/);
  await page.locator('#track-select').selectOption('velvet-hour');
  await page.locator('[data-version="full"]').click();
  assert.match(await page.locator('#score-title').textContent(), /56/);
  assert.match(await page.locator('#version-description').textContent(), /56/);
  await page.locator('#track-select').selectOption('moonlit-sway');
  assert.equal(await page.locator('#bpm').inputValue(), '116');
  assert.equal(await page.locator('#player-title').textContent(), '月光轻摇');
  assert.equal(await page.locator('#cover-id').textContent(), 'MS—004');
  assert.equal(await page.locator('#bars-fact').textContent(), '48');
  assert.match(await page.title(), /MOONLIT SWAY/);

  // A fresh navigation must open the new default, independent of the old
  // regression page's explicit query and cached audio.
  await page.goto(`${baseUrl}/`);
  await page.locator('#play').waitFor();
  assert.equal(await page.locator('#track-select').inputValue(), 'afterglow');
  assert.equal(await page.locator('#track-select option').count(), 5);
  assert.equal(await page.locator('#bpm').inputValue(), '118');
  assert.equal(await page.locator('#player-title').textContent(), '余温');
  assert.equal(await page.locator('#bars-fact').textContent(), '40');
  assert.equal(await page.locator('#key-fact').textContent(), 'F# minor');
  assert.match(await page.title(), /AFTERGLOW/);
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  assert.equal(await page.locator('#sample-credits li').count(), 0);
  assert.equal(await page.locator('#export-credits').isHidden(), true);
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#render-badge')?.textContent === '合成完成', undefined, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#play-state')?.textContent === '正在播放', undefined, { timeout: 20000 });
  await page.waitForFunction(() => Number(document.querySelector('#seek')?.value) > 0.2);
  await page.locator('#stop').click();
  assert.equal(await page.locator('#seek').inputValue(), '0');
  assert.equal(await page.locator('.timeline-section').count(), 1, 'default hook displays its actual full-score section');
  await page.locator('[data-version="full"]').click();
  assert.match(await page.locator('#score-title').textContent(), /40/);
  assert.match(await page.locator('#version-description').textContent(), /40/);
  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false, 'mobile layout must not overflow horizontally');
  assert.deepEqual(errors, []);
  console.log('PASS: sampled-track player/download regression, new default pop playback, cache reset, versions, invalid inputs, seed zero and mobile layout');
  console.log(JSON.stringify(checks, null, 2));
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
