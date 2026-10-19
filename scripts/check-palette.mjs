#!/usr/bin/env node
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
let server, browser;
try {
  server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false }, logLevel: 'error' });
  await server.listen();
  browser = await chromium.launch({ headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ acceptDownloads: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const base = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.goto(`${base}/palette.html`);
  await page.locator('#status').waitFor({ state: 'hidden' });
  const manifest = await (await page.request.get(`${base}/audio/palette/manifest.json`)).json();
  const assets = manifest.assets;
  assert.equal(await page.locator('.card').count(), assets.filter(a => a.category === 'previews').length);
  // Verify actual media playback advances in Chromium; this is not a listening review.
  await page.locator('audio').first().evaluate(audio => audio.play());
  await page.waitForFunction(() => document.querySelector('audio').currentTime > .1);
  await page.locator('audio').nth(1).evaluate(audio => audio.play());
  assert.equal(await page.locator('audio').first().evaluate(audio => audio.paused), true);
  for (const category of ['recorded', 'synth', 'fx', 'loops', 'all']) {
    await page.locator(`[data-category="${category}"]`).click();
    const expected = category === 'all' ? assets : assets.filter(a => a.category === category);
    assert.equal(await page.locator('.card').count(), expected.length);
    assert.equal(await page.locator(`[data-category="${category}"]`).getAttribute('aria-pressed'), 'true');
  }
  const decoded = await page.evaluate(async assets => {
    const decoder = new OfflineAudioContext(2, 1, 44100);
    const results = [];
    for (const asset of assets) {
      const response = await fetch(`audio/palette/${asset.file}`);
      if (!response.ok) throw new Error(`${asset.id}: HTTP ${response.status}`);
      const audio = await decoder.decodeAudioData(await response.arrayBuffer());
      results.push({ id: asset.id, frames: audio.length, rate: audio.sampleRate, channels: audio.numberOfChannels,
        finite: Array.from({ length: audio.numberOfChannels }, (_, ch) => audio.getChannelData(ch).every(Number.isFinite)).every(Boolean) });
    }
    return results;
  }, assets);
  for (let i = 0; i < assets.length; i++) {
    assert.equal(decoded[i].finite, true, assets[i].id);
    assert.equal(decoded[i].rate, assets[i].sampleRate, assets[i].id);
    assert.equal(decoded[i].channels, assets[i].channels, assets[i].id);
    // WAV is sample-exact; MP3 gapless padding can vary between browser decoders.
    if (assets[i].file.endsWith('.wav')) assert.equal(decoded[i].frames, assets[i].frames, assets[i].id);
  }
  await page.locator('[data-category="loops"]').click();
  assert.equal(await page.locator('audio').evaluateAll(elements => elements.every(audio => audio.loop)), true);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('.links a[download]').first().click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), assets.find(a => a.category === 'loops').file.split('/').pop());
  assert.equal(await download.failure(), null);
  await page.setViewportSize({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  assert.deepEqual(pageErrors, []);
  console.log(`PASS: ${assets.length} browser-decodable assets; gallery filters, playback, loop flags, download and mobile width.`);
} finally {
  await browser?.close();
  await server?.close();
}
