import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeWav, measureAudio, waveformPeaks } from '../src/audio/wav.ts';

function buffer(channels: number[][]) {
  return { numberOfChannels: channels.length, length: channels[0].length, sampleRate: 44100, getChannelData: (channel: number) => Float32Array.from(channels[channel]) };
}

test('WAV has valid PCM16 stereo header, length, byte rate, and channel interleave', () => {
  const encoded = encodeWav(buffer([[0, 0.5, -1], [1, -0.5, 0]]));
  const view = new DataView(encoded);
  assert.equal(encoded.byteLength, 56);
  assert.equal(new TextDecoder().decode(encoded.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(encoded.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint32(4, true), 48);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 176400);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getInt16(44, true), 0);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), 16384);
  assert.equal(view.getInt16(50, true), -16384);
  assert.equal(view.getInt16(52, true), -32768);
});

test('measurements report sample peak, RMS, DC and clipping honestly', () => {
  const stats = measureAudio(buffer([[0.5, -0.5], [0.5, -0.5]]));
  assert.equal(stats.peak, 0.5);
  assert.equal(stats.rms, 0.5);
  assert.equal(stats.dcOffset, 0);
  assert.equal(stats.clippedSamples, 0);
  assert.ok(Math.abs(stats.peakDb + 6.0206) < 0.0001);
  assert.equal(measureAudio(buffer([[1, -1]])).clippedSamples, 2);
  assert.equal(measureAudio(buffer([[0]])).peakDb, -Infinity);
});

test('waveform captures transients from both channels and small buffers', () => {
  assert.deepEqual(waveformPeaks(buffer([[0, 0, 0, 0], [0.5, 0, 0.75, 0]]), 2), [0.5, 0.75]);
  assert.equal(waveformPeaks(buffer([[0.5]]), 10).length, 10);
  assert.throws(() => waveformPeaks(buffer([[0]]), 0));
});

test('WAV handles mono, clamps out of range values and rejects non-finite PCM', () => {
  assert.equal(new DataView(encodeWav(buffer([[2, -2]]))).getInt16(44, true), 32767);
  assert.throws(() => encodeWav(buffer([[NaN]])));
  assert.throws(() => measureAudio(buffer([[Infinity]])));
  assert.throws(() => encodeWav(buffer([[]])));
});
