import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateTrack } from '../src/music/arrange.ts';
import { neonChangan } from '../src/tracks/neon-changan.ts';
import { neonChanganVocal } from '../src/tracks/neon-changan-vocal.ts';
import { vocalSamples } from '../src/music/vocal-bank.ts';
import { fitVocalPcm } from '../src/engine/vocal-time-fit.ts';
import { validateMixer } from '../src/music/mixer.ts';

const options = { version: 'full' as const, bpm: 128, transpose: 0, seed: 261014 };

test('vocal edition uses original speech, melodic chops, textures and new routed rhythms', () => {
  const score = buildArrangement(neonChanganVocal, options);
  assert.equal(score.beats, 240);
  assert.equal(score.tracks!.length, 20);
  const samples = new Set(score.events.filter(e => e.instrument === 'vocal').map(e => e.sample));
  assert.deepEqual(samples, new Set(Object.keys(vocalSamples)));
  assert.ok(score.events.some(e => e.trackId === 'acid'));
  assert.ok(score.events.some(e => e.trackId === 'breaks'));
  assert.ok(buildArrangement(neonChangan, options).events.every(e => e.instrument !== 'vocal'));
  const broken = structuredClone(score);
  broken.events.find(e => e.instrument === 'vocal')!.sample = 'missing' as 'night-call';
  assert.throws(() => validateMixer(broken), /引用已有采样/);
});

test('voice-led Drop bars contain no competing reed or guzheng attacks', () => {
  const full = buildArrangement(neonChanganVocal, options);
  for (const section of full.sections.filter(s => s.name.includes('Drop'))) {
    const start = section.start * 128 / 60, end = section.end * 128 / 60;
    for (const e of full.events.filter(e => e.beat >= start && e.beat < end && ['voice', 'chops'].includes(e.trackId!))) {
      if (e.sample === 'hey' || (e.beat - start) % 32 >= 31) continue;
      assert.ok(full.events.every(other => !['reed', 'zheng'].includes(other.trackId!) || other.beat >= e.beat + e.duration || other.beat + other.duration <= e.beat));
    }
  }
});

test('short vocal edits retain full-score samples and timing; speech ignores transposition', () => {
  const full = buildArrangement(neonChanganVocal, options);
  for (const version of ['hook', 'loop'] as const) {
    const score = buildArrangement(neonChanganVocal, { ...options, version });
    const start = neonChanganVocal.edits![version].startBar * 4;
    assert.deepEqual(score.events, full.events.filter(e => e.beat >= start && e.beat < start + 32).map(e => ({ ...e, beat: e.beat - start, duration: Math.min(e.duration, start + 32 - e.beat) })));
    assert.equal(score.beats * 60 / 128, 15);
  }
  const shifted = buildArrangement(neonChanganVocal, { ...options, transpose: 5 });
  const speech = (score: typeof full) => score.events.filter(e => e.sample && vocalSamples[e.sample].kind === 'speech');
  assert.deepEqual(speech(shifted), speech(full));
  const broken = structuredClone(neonChanganVocal);
  broken.guofengClub!.vocals = 'missing' as 'night-city';
  assert.throws(() => validateTrack(broken), /未知.*人声/);
});

test('speech fitting changes duration while preserving a voiced fundamental', () => {
  const sr = 24000, frequency = 220;
  const input = Float32Array.from({ length: sr }, (_, i) => .4 * Math.sin(2 * Math.PI * frequency * i / sr));
  for (const ratio of [.72, 1, 1.42]) {
    const output = fitVocalPcm(input, Math.round(sr * ratio), sr);
    assert.equal(output.length, Math.round(sr * ratio));
    assert.ok(output.every(Number.isFinite));
    let crossings = 0;
    const start = Math.round(sr * .15), end = output.length - start;
    for (let i = start; i < end - 1; i++) if (output[i] <= 0 && output[i + 1] > 0) crossings++;
    assert.ok(Math.abs(crossings * sr / (end - start) - frequency) < 5);
  }
});
