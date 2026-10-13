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
  await page.goto(`${baseUrl}/`);
  await page.locator('#play').waitFor();
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');

  const checks = await page.evaluate(async () => {
    const { getTailSeconds, renderTrack } = await import('/src/engine/render.ts');
    const { afterglow } = await import('/src/tracks/afterglow.ts');
    const { whenTheWindRises } = await import('/src/tracks/when-the-wind-rises.ts');
    const { defaultTrack, trackRegistry } = await import('/src/tracks/registry.ts');
    const { createEmotionalPopInstruments } = await import('/src/engine/emotional-pop.ts');
    const { encodeWav, measureAudio } = await import('/src/audio/wav.ts');
    const engineSource = await (await fetch('/src/engine/render.ts')).text();
    const toneUrl = engineSource.match(/from ["']([^"']*tone[^"']*)["']/)?.[1];
    if (!toneUrl) throw new Error('无法找到 Vite 解析后的 Tone 模块');
    const Tone = await import(toneUrl);
    const originalContext = Tone.getContext();
    const options = { version: 'hook', bpm: 118, transpose: 0, seed: 261013 };

    const invalidTrack = structuredClone(afterglow);
    invalidTrack.hook[0][0].note = NaN;
    let failureHandled = false;
    try { await renderTrack(invalidTrack, options); }
    catch { failureHandled = Tone.getContext() === originalContext; }

    // Fail after an owned native node has been created, before scheduling ends.
    const originalCreateOscillator = Tone.Context.prototype.createOscillator;
    const originalCreateGain = Tone.Context.prototype.createGain;
    const nativeNodes = [];
    let scheduleCalls = 0;
    let callbackFailureHandled = false;
    let callbackNodesDisconnected = 0;
    Tone.Context.prototype.createGain = function () {
      const node = originalCreateGain.call(this);
      const originalDisconnect = node.disconnect;
      node.disconnect = function (...args) {
        callbackNodesDisconnected++;
        return originalDisconnect.apply(this, args);
      };
      nativeNodes.push(node);
      return node;
    };
    Tone.Context.prototype.createOscillator = function () {
      if (++scheduleCalls === 2) throw new Error('intentional scheduling failure');
      return originalCreateOscillator.call(this);
    };
    try { await renderTrack(afterglow, options); }
    catch (error) {
      callbackFailureHandled = error.message.includes('intentional scheduling failure') && Tone.getContext() === originalContext;
    } finally {
      Tone.Context.prototype.createOscillator = originalCreateOscillator;
      Tone.Context.prototype.createGain = originalCreateGain;
    }

    const originalGet = Tone.ToneAudioBuffer.prototype.get;
    const originalDispose = Tone.ToneAudioBuffer.prototype.dispose;
    const shortScore = structuredClone(afterglow);
    shortScore.arrangement = [{ name: 'failure fixture', bars: 1, energy: 'tease' }];
    shortScore.edits = { hook: { startBar: 0, bars: 1 }, loop: { startBar: 0, bars: 1 } };
    let missingBufferHandled = false;
    let missingBufferDisposed = false;
    const missingBuffers = new Set();
    Tone.ToneAudioBuffer.prototype.get = function () { missingBuffers.add(this); return undefined; };
    Tone.ToneAudioBuffer.prototype.dispose = function () {
      if (missingBuffers.has(this)) missingBufferDisposed = true;
      return originalDispose.call(this);
    };
    try { await renderTrack(shortScore, { ...options, version: 'full' }); }
    catch (error) { missingBufferHandled = error.message.includes('音频缓冲') && Tone.getContext() === originalContext; }
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
    try { await renderTrack(shortScore, { ...options, version: 'full' }); }
    catch (error) { silentOutputHandled = error.message.includes('静音') && Tone.getContext() === originalContext; }
    finally {
      Tone.ToneAudioBuffer.prototype.get = originalGet;
      Tone.ToneAudioBuffer.prototype.dispose = originalDispose;
    }

    // Concurrent callers must be serialized around the shared Tone context.
    const [hook, hookRepeat] = await Promise.all([renderTrack(afterglow, options), renderTrack(afterglow, options)]);
    const full = await renderTrack(afterglow, { ...options, version: 'full' });
    const loop = await renderTrack(afterglow, { ...options, version: 'loop' });
    const low = await renderTrack(afterglow, { ...options, bpm: 90, transpose: -12, seed: 0 });
    const high = await renderTrack(afterglow, { ...options, bpm: 170, transpose: 12, seed: 0xffffffff });
    const finiteAudio = buffer => Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel).every(Number.isFinite)).every(Boolean);
    const compare = (first, second) => {
      let maximum = 0;
      let squares = 0;
      for (let channel = 0; channel < first.numberOfChannels; channel++) {
        const a = first.getChannelData(channel);
        const b = second.getChannelData(channel);
        for (let index = 0; index < a.length; index++) {
          const difference = Math.abs(a[index] - b[index]);
          maximum = Math.max(maximum, difference);
          squares += difference * difference;
        }
      }
      return { maximum, rms: Math.sqrt(squares / (first.length * first.numberOfChannels)) };
    };

    const windOptions = { ...options, bpm: whenTheWindRises.meta.bpm };
    const [windHook, windRepeat] = await Promise.all([renderTrack(whenTheWindRises, windOptions), renderTrack(whenTheWindRises, windOptions)]);
    const windLoop = await renderTrack(whenTheWindRises, { ...windOptions, version: 'loop' });
    const windLow = await renderTrack(whenTheWindRises, { ...windOptions, bpm: 90, transpose: -12, seed: 0 });
    const windHigh = await renderTrack(whenTheWindRises, { ...windOptions, bpm: 170, transpose: 12, seed: 0xffffffff });

    const palette = ['piano', 'vocal', 'texture', 'sweep'];
    let paletteRig;
    let paletteAudio;
    try {
      paletteAudio = await Tone.Offline(() => {
        paletteRig = createEmotionalPopInstruments(118, 261013);
        // Three seconds between voices lets prior tails decay before checking
        // the next one, so a silent instrument cannot pass on another's tail.
        palette.forEach((instrument, index) => paletteRig.hit({ instrument, beat: 0, duration: 1, velocity: 0.8, notes: ['piano', 'vocal'].includes(instrument) ? [73] : undefined }, index * 3));
      }, palette.length * 3, 2, 44100);
    } finally { Tone.setContext(originalContext); paletteRig?.dispose(); }
    const paletteBuffer = paletteAudio.get();
    const paletteStats = palette.map((instrument, index) => ({ instrument, ...measureAudio({ numberOfChannels: 2, length: 44100, sampleRate: 44100, getChannelData: channel => paletteBuffer.getChannelData(channel).subarray(index * 132300, index * 132300 + 44100) }) }));
    const paletteFinite = finiteAudio(paletteBuffer);
    paletteAudio.dispose();

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
    // The former feedback graph produced intermittent errors at its second
    // dotted-eighth echo. Keep a strict fixture independent of peak trimming.
    const pianoFixture = await renderPianoFixture();
    let pianoRepeatDifference = 0;
    for (let repeat = 0; repeat < 4; repeat++) {
      const difference = compare(pianoFixture, await renderPianoFixture());
      pianoRepeatDifference = Math.max(pianoRepeatDifference, difference.maximum);
    }

    const bytes = encodeWav(hook.buffer);
    const versions = [full, hook, hookRepeat, loop, low, high];
    const details = (rendered, track = afterglow) => ({
      stats: rendered.stats, duration: rendered.duration, rate: rendered.buffer.sampleRate,
      channels: rendered.buffer.numberOfChannels, finite: finiteAudio(rendered.buffer),
      expectedDuration: rendered.sections.at(-1).end + getTailSeconds(track, rendered.options.version),
    });
    return {
      registry: { defaultId: defaultTrack.meta.id, ids: trackRegistry.map(track => track.meta.id) },
      hook: details(hook), full: details(full), loop: details(loop), boundaries: [details(low), details(high)],
      wind: {
        hook: details(windHook, whenTheWindRises), loop: details(windLoop, whenTheWindRises),
        boundaries: [details(windLow, whenTheWindRises), details(windHigh, whenTheWindRises)],
        repeat: compare(windHook.buffer, windRepeat.buffer),
        allFinite: [windHook, windRepeat, windLoop, windLow, windHigh].every(rendered => finiteAudio(rendered.buffer)),
        loopEdges: Array.from({ length: 2 }, (_, channel) => [windLoop.buffer.getChannelData(channel)[0], windLoop.buffer.getChannelData(channel).at(-1)]),
        expectedLoopDuration: whenTheWindRises.edits.loop.bars * 4 * 60 / windOptions.bpm,
      },
      repeat: compare(hook.buffer, hookRepeat.buffer), pianoRepeatDifference,
      wavSize: bytes.byteLength, expectedWavSize: 44 + hook.buffer.length * 4,
      loopEdges: Array.from({ length: 2 }, (_, channel) => [loop.buffer.getChannelData(channel)[0], loop.buffer.getChannelData(channel).at(-1)]),
      fullSectionCount: full.sections.length,
      allFinite: versions.every(rendered => finiteAudio(rendered.buffer)), palette: paletteStats, paletteFinite,
      expectedLoopDuration: afterglow.edits.loop.bars * 4 * 60 / 118,
      failureHandled, callbackFailureHandled,
      callbackNodesCreated: nativeNodes.length, callbackNodesDisconnected,
      missingBufferHandled, missingBufferDisposed, silentOutputHandled, silentOutputDisposed,
      contextRestored: Tone.getContext() === originalContext,
    };
  });

  assert.equal(checks.registry.defaultId, 'afterglow');
  assert.equal(checks.registry.ids.length, 2);
  assert.ok(checks.registry.ids.includes('afterglow'), 'registry keeps afterglow');
  assert.ok(checks.registry.ids.includes('when-the-wind-rises'), 'registry includes the new composition');
  assert.ok(['moonlit-sway', 'velvet-hour', 'amber-tides', 'neon-rebound'].every(id => !checks.registry.ids.includes(id)), 'retired demos remain absent');
  assert.equal(checks.failureHandled, true, 'invalid score preserves the context');
  assert.equal(checks.callbackFailureHandled, true, 'native scheduling failure restores the context');
  assert.ok(checks.callbackNodesCreated > 0 && checks.callbackNodesDisconnected >= checks.callbackNodesCreated, 'scheduling failure disconnects the nodes it owns');
  assert.equal(checks.missingBufferHandled, true);
  assert.equal(checks.missingBufferDisposed, true, 'missing-buffer failure disposes the offline wrapper');
  assert.equal(checks.silentOutputHandled, true);
  assert.equal(checks.silentOutputDisposed, true, 'silent-output failure disposes the offline wrapper');
  assert.equal(checks.contextRestored, true, 'next render succeeds after failures without poisoning the queue');
  assert.equal(checks.allFinite, true);
  for (const rendered of [checks.full, checks.hook, checks.loop, ...checks.boundaries]) {
    assert.equal(rendered.channels, 2);
    assert.equal(rendered.rate, 44100);
    assert.equal(rendered.finite, true);
    assert.ok(rendered.stats.peak > 0.2 && rendered.stats.rms > 0.01, 'audible non-silent output');
    assert.equal(rendered.stats.clippedSamples, 0);
    assert.ok(rendered.stats.peakDb <= -1.19);
    assert.ok(Math.abs(rendered.stats.dcOffset) < 0.001);
    assert.ok(Math.abs(rendered.duration - rendered.expectedDuration) < 1 / 44100);
  }
  // Native compression has tiny float differences. Bound their maximum below
  // half a PCM16 quantization step, independently of the RMS error ceiling.
  assert.ok(checks.repeat.maximum < 1 / 65536, `same seed max difference: ${checks.repeat.maximum}`);
  assert.ok(checks.repeat.rms < 1e-6, `same seed RMS difference: ${checks.repeat.rms}`);
  assert.ok(checks.pianoRepeatDifference < 1e-6, `isolated echo difference: ${checks.pianoRepeatDifference}`);
  assert.equal(checks.wavSize, checks.expectedWavSize);
  assert.equal(checks.fullSectionCount, 6);
  assert.ok(Math.abs(checks.loop.duration - checks.expectedLoopDuration) < 1 / 44100);
  assert.ok(checks.loopEdges.flat().every(value => Math.abs(value) === 0), 'both stereo loop channels have silent edge samples');
  assert.equal(checks.paletteFinite, true);
  assert.ok(checks.palette.every(stats => stats.peak > 0.001 && stats.rms > 0.0001), 'each new voice must sound in its isolated segment');
  assert.equal(checks.wind.allFinite, true, 'new composition remains finite at tempo/pitch limits');
  for (const rendered of [checks.wind.hook, checks.wind.loop, ...checks.wind.boundaries]) {
    assert.equal(rendered.channels, 2);
    assert.equal(rendered.rate, 44100);
    assert.equal(rendered.finite, true);
    assert.ok(rendered.stats.peak > 0.2 && rendered.stats.rms > 0.01, 'new composition produces non-silent audio');
    assert.equal(rendered.stats.clippedSamples, 0);
    assert.ok(rendered.stats.peakDb <= -1.19 && Math.abs(rendered.stats.dcOffset) < 0.001);
    assert.ok(Math.abs(rendered.duration - rendered.expectedDuration) < 1 / 44100);
  }
  assert.ok(checks.wind.repeat.maximum < 1 / 65536, `wind same seed max difference: ${checks.wind.repeat.maximum}`);
  assert.ok(checks.wind.repeat.rms < 1e-6, `wind same seed RMS difference: ${checks.wind.repeat.rms}`);
  assert.ok(Math.abs(checks.wind.loop.duration - checks.wind.expectedLoopDuration) < 1 / 44100);
  assert.ok(checks.wind.loopEdges.flat().every(value => Math.abs(value) === 0), 'new loop fades both stereo edge samples');
  console.log('PASS: two compositions, full/hook/loop, four isolated voices, seeded repeatability, finite PCM, parameter limits, context cleanup, echo regression, WAV and levels');

  assert.equal(await page.locator('#track-select').inputValue(), 'afterglow');
  const selectableTracks = await page.locator('#track-select option').evaluateAll(options => options.map(option => option.value));
  assert.equal(selectableTracks.length, checks.registry.ids.length);
  assert.deepEqual(selectableTracks, checks.registry.ids, 'player offers the same two compositions as the renderer');
  assert.ok(selectableTracks.includes('afterglow'));
  assert.ok(['moonlit-sway', 'velvet-hour', 'amber-tides', 'neon-rebound'].every(id => !selectableTracks.includes(id)));
  await page.locator('#track-select').selectOption('afterglow');
  assert.equal(await page.locator('#bpm').inputValue(), '118');
  assert.equal(await page.locator('#player-title').textContent(), '余温');
  assert.equal(await page.locator('#bars-fact').textContent(), '40');
  assert.equal(await page.locator('#key-fact').textContent(), 'F# minor');
  assert.match(await page.title(), /AFTERGLOW/);
  assert.equal(await page.locator('#sample-credits').count(), 0);
  assert.equal(await page.locator('#export-credits').count(), 0);
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
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /afterglow-hook-118bpm-t0-s260713\.wav/);
  const bytes = await readFile(await download.path());
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length);
  assert.equal(bytes.readUInt16LE(22), 2);
  assert.equal(bytes.readUInt32LE(24), 44100);
  assert.equal(bytes.readUInt16LE(34), 16);
  assert.equal(await page.locator('.timeline-section').count(), 1);

  await page.locator('[data-version="full"]').click();
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  assert.equal(await page.locator('#seek').isDisabled(), true);
  assert.match(await page.locator('#score-title').textContent(), /40/);
  assert.match(await page.locator('#version-description').textContent(), /40/);
  await page.locator('[data-version="loop"]').click();
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  assert.equal(await page.locator('#seek').isDisabled(), true);
  await page.locator('#bpm').fill('10');
  await page.locator('#export').click();
  assert.match(await page.locator('#status').textContent(), /有效整数/);
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  await page.locator('#bpm').fill('118');
  await page.locator('#seed').fill('0');
  const loopDownloadPromise = page.waitForEvent('download', { timeout: 120000 });
  await page.locator('#export').click();
  const loopDownload = await loopDownloadPromise;
  assert.match(loopDownload.suggestedFilename(), /afterglow-loop-118bpm-t0-s0\.wav/);
  assert.equal(await page.locator('.timeline-section').count(), 1);
  await page.locator('#transpose').fill('3');
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  assert.equal(await page.locator('#seek').isDisabled(), true);
  await page.goto(`${baseUrl}/?track=when-the-wind-rises&version=hook`);
  await page.locator('#play').waitFor();
  assert.equal(await page.locator('#track-select').inputValue(), 'when-the-wind-rises', 'direct track URL opens the new composition');
  assert.equal(await page.locator('#bpm').inputValue(), '114');
  assert.equal(await page.locator('#player-title').textContent(), '风起时');
  assert.equal(await page.locator('#cover-id').textContent(), 'WTWR—006');
  assert.equal(await page.locator('#bars-fact').textContent(), '44');
  assert.equal(await page.locator('#key-fact').textContent(), 'D major');
  assert.match(await page.title(), /WHEN THE WIND RISES/);
  assert.equal(await page.locator('[data-version="hook"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#melody-description').textContent(), /独立问答电钢琴/);
  assert.match(await page.locator('#drum-description').textContent(), /切分轻鼓/);
  assert.equal(await page.locator('#render-badge').textContent(), '等待合成');
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#render-badge')?.textContent === '合成完成', undefined, { timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#play-state')?.textContent === '正在播放', undefined, { timeout: 20000 });
  await page.waitForFunction(() => Number(document.querySelector('#seek')?.value) > 0.2);
  assert.equal(await page.locator('#total-time').textContent(), '00:17');
  await page.locator('#stop').click();
  assert.equal(await page.locator('#seek').inputValue(), '0');
  assert.equal(await page.locator('.timeline-section').count(), 1);
  const windDownloadPromise = page.waitForEvent('download');
  await page.locator('#export').click();
  const windDownload = await windDownloadPromise;
  assert.match(windDownload.suggestedFilename(), /when-the-wind-rises-hook-114bpm-t0-s260713\.wav/);
  await page.locator('[data-version="full"]').click();
  assert.match(await page.locator('#score-title').textContent(), /44/);
  assert.match(await page.locator('#version-description').textContent(), /44/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'mobile layout must not overflow horizontally');
  assert.deepEqual(errors, []);
  console.log('PASS: afterglow default, wind direct URL/playback/download, retired demos absent, cache reset, versions, invalid inputs, seed zero and mobile layout');
  console.log(JSON.stringify(checks, null, 2));
} finally {
  try { await browser?.close(); } finally { await server?.close(); }
}
