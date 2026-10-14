import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { vocalSamples } from '../src/music/vocal-bank.ts';
import { inspectPcmWav } from '../scripts/lib/audio-export.mjs';

test('bundled original vocal assets match provenance hashes and usable mono PCM24 format', async () => {
  const directory = new URL('../public/audio/night-city/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
  assert.equal(manifest.model, 'hexgrad/Kokoro-82M-v1.1-zh');
  assert.equal(manifest.license, 'Apache-2.0');
  assert.deepEqual(manifest.files.map(f => f.id).sort(), Object.keys(vocalSamples).sort());
  for (const file of manifest.files) {
    const path = new URL(file.filename, directory);
    const bytes = await readFile(path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    const wav = await inspectPcmWav(path);
    assert.equal(wav.sampleRate, 48000);
    assert.equal(wav.bitsPerSample, 24);
    assert.equal(wav.channels, 1);
    assert.equal(wav.durationSeconds, file.duration);
    assert.equal(file.sourceSampleRate, 24000);
  }
});
