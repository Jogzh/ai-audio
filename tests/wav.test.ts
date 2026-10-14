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

test('PCM24 retains sub-16-bit signal, signed interleave, deterministic dither, and RIFF padding', () => {
  const source = { ...buffer([[.00001, -.00001, 1, -1], [0, 0, -1, 1]]), sampleRate: 48000 };
  const encoded = encodeWav(source, 24), bytes = new Uint8Array(encoded), view = new DataView(encoded);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(28, true), 288000);
  assert.equal(view.getUint16(32, true), 6);
  assert.equal(view.getUint16(34, true), 24);
  const value = (at: number) => { const n = bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16); return n & 0x800000 ? n - 0x1000000 : n; };
  assert.ok(Math.abs(value(44) - 84) <= 1);
  assert.ok(Math.abs(value(50) + 84) <= 1);
  assert.ok(value(56) >= 8388606 && value(59) <= -8388607);
  assert.deepEqual(encoded, encodeWav(source, 24));
  const mono = encodeWav(buffer([[.5]]), 24);
  assert.equal(mono.byteLength, 48);
  assert.equal(new DataView(mono).getUint32(4, true), 40);
  assert.equal(new DataView(mono).getUint32(40, true), 3);
  assert.equal(new Uint8Array(mono)[47], 0);
});
