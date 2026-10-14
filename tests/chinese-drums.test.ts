import assert from 'node:assert/strict';
import test from 'node:test';
import { createChineseDrumBuffers } from '../src/engine/chinese-drums.ts';
import type { DrumBody, DrumExpression, DrumStroke } from '../src/music/types.ts';

// PCM synthesis needs no browser nodes. A lower but audio-appropriate sample rate
// keeps these behavioral regressions fast without mirroring synthesis internals.
const sampleRate = 24000;
const context = {
  sampleRate,
  createBuffer(numberOfChannels: number, length: number, rate: number): AudioBuffer {
    const channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
    return { length, sampleRate: rate, duration: length / rate, numberOfChannels,
      getChannelData: (channel: number) => channels[channel],
    } as AudioBuffer;
  },
};
const seed = 261014;
const base: DrumExpression = { body: 'medium', stroke: 'open', position: 0.18, tension: 0.5, hand: 'right' };
const allBodies: DrumBody[] = ['large', 'medium', 'small'];
const allStrokes: DrumStroke[] = ['open', 'rim', 'mute'];

function audibleEnd(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  const peak = data.reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);
  for (let frame = data.length - 1; frame >= 0; frame--) {
    if (Math.abs(data[frame]) > peak * 0.01) return frame / buffer.sampleRate;
  }
  return 0;
}

function relativeDifference(a: AudioBuffer, b: AudioBuffer): number {
  const first = a.getChannelData(0), second = b.getChannelData(0);
  let difference = 0, energy = 0;
  for (let frame = 0; frame < Math.max(first.length, second.length); frame++) {
    const x = first[frame] ?? 0, y = second[frame] ?? 0;
    difference += (x - y) ** 2;
    energy += x * x;
  }
  return Math.sqrt(difference / energy);
}

test('all nine Chinese drum voices are non-silent finite PCM with safe, quiet boundaries', () => {
  const rig = createChineseDrumBuffers(context, seed);
  for (const body of allBodies) for (const stroke of allStrokes) {
    const buffer = rig.getBuffer({ ...base, body, stroke }, 0.7);
    const pcm = buffer.getChannelData(0);
    let energy = 0;
    for (const sample of pcm) {
      assert.ok(Number.isFinite(sample), `${body}/${stroke}: non-finite sample`);
      assert.ok(Math.abs(sample) <= 1, `${body}/${stroke}: sample clips`);
      energy += sample * sample;
    }
    assert.ok(energy > 1, `${body}/${stroke}: silent voice`);
    assert.ok(pcm[0] === 0 && pcm.at(-1) === 0, `${body}/${stroke}: discontinuous endpoint`);
    assert.ok(audibleEnd(buffer) < buffer.duration, `${body}/${stroke}: tail did not settle`);
  }
  rig.clear();
});

test('a fixed seed reproduces an entire alternating-hand stroke sequence', () => {
  const first = createChineseDrumBuffers(context, seed);
  const repeated = createChineseDrumBuffers(context, seed);
  const changed = createChineseDrumBuffers(context, seed + 1);
  const sequence: DrumExpression[] = [base, { ...base, hand: 'left' }, base,
    { ...base, body: 'large', stroke: 'mute' }, { ...base, body: 'small', stroke: 'rim' }, base];
  for (const [index, expression] of sequence.entries()) {
    const velocity = index % 2 ? 0.31 : 0.84;
    const original = first.getBuffer(expression, velocity);
    assert.deepEqual(repeated.getBuffer(expression, velocity).getChannelData(0), original.getChannelData(0));
    assert.ok(relativeDifference(original, changed.getBuffer(expression, velocity)) > 0.005, 'changing seed should vary the constructed skin/contact');
  }
});

test('position, strength, skin tension and hand change actual PCM rather than labels or loudness alone', () => {
  const original = createChineseDrumBuffers(context, seed).getBuffer(base, 0.6);
  const variations: { name: string; expression: DrumExpression; velocity: number }[] = [
    { name: 'position', expression: { ...base, position: 0.9 }, velocity: 0.6 },
    { name: 'strength', expression: base, velocity: 0.94 },
    { name: 'tension', expression: { ...base, tension: 0.9 }, velocity: 0.6 },
    { name: 'hand', expression: { ...base, hand: 'left' }, velocity: 0.6 },
  ];
  for (const variation of variations) {
    const buffer = createChineseDrumBuffers(context, seed).getBuffer(variation.expression, variation.velocity);
    assert.ok(relativeDifference(original, buffer) > 0.01, `${variation.name} should materially vary the waveform`);
  }
});

test('open, rim and muted strokes have progressively shorter audible resonance', () => {
  const rig = createChineseDrumBuffers(context, seed);
  for (const body of allBodies) {
    const tails = allStrokes.map(stroke => audibleEnd(rig.getBuffer({ ...base, body, stroke }, 0.8)));
    assert.ok(tails[0] > tails[1] && tails[1] > tails[2], `${body}: open ${tails[0]}, rim ${tails[1]}, mute ${tails[2]}`);
    assert.ok(tails[2] < tails[0] * 0.7, `${body}: mute should clearly damp the skin`);
  }
});

test('repeated strokes alternate subtle timbres and reuse PCM; clearing resets that sequence', () => {
  const rig = createChineseDrumBuffers(context, seed);
  const first = rig.getBuffer(base, 0.6);
  const next = rig.getBuffer(base, 0.6);
  assert.ok(relativeDifference(first, next) > 0.005, 'consecutive strokes should avoid an identical machine-gun waveform');
  assert.equal(rig.getBuffer(base, 0.6), first, 'returning to a timbre should reuse its buffer');
  rig.clear();
  const reset = rig.getBuffer(base, 0.6);
  assert.notEqual(reset, first, 'clear should release cached PCM');
  assert.deepEqual(reset.getChannelData(0), first.getChannelData(0), 'clear should restart deterministic alternation');
});
