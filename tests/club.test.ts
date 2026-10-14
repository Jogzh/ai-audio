import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateOptions, validateTrack } from '../src/music/arrange.ts';
import { neonChangan } from '../src/tracks/neon-changan.ts';
import { validateMixer } from '../src/music/mixer.ts';

const options = { version: 'full' as const, bpm: 128, transpose: 0, seed: 261014, sampleRate: 48000 as const };

test('club full score contains a real intro, early Drop, bridge, and developed final theme', () => {
  const score = buildArrangement(neonChangan, options);
  assert.equal(score.beats, 240);
  assert.equal(score.sections.find(s => s.name.includes('第一 Drop'))!.start, 7.5);
  assert.equal(score.sections.find(s => s.name.includes('最终 Drop'))!.start, 75);
  assert.ok(score.events.some(e => e.instrument === 'guzheng' && e.beat === 0));
  assert.ok(score.events.some(e => e.instrument === 'dizi' && e.beat >= 112 && e.beat < 144));
  assert.ok(score.events.some(e => e.trackId === 'reed' && e.beat >= 192 && e.notes!.includes(84)));
  const pentatonic = new Set([2, 5, 7, 9, 0]);
  for (const e of score.events.filter(e => e.instrument === 'lead' || e.instrument === 'dizi')) assert.ok(e.notes!.every(n => pentatonic.has(n % 12)));
  validateMixer(score);
});

test('short edits preserve the actual full score and full-score seeded velocities', () => {
  const full = buildArrangement(neonChangan, options);
  for (const version of ['hook', 'loop'] as const) {
    const edit = buildArrangement(neonChangan, { ...options, version });
    assert.equal(edit.beats * 60 / 128, 15);
    const start = neonChangan.edits![version].startBar * 4, end = start + edit.beats;
    assert.deepEqual(edit.events, full.events.filter(e => e.beat >= start && e.beat < end).map(e => ({ ...e, beat: e.beat - start, duration: Math.min(e.duration, end - e.beat) })));
    assert.ok(edit.events.every(e => e.beat + e.duration <= edit.beats));
  }
});

test('drums establish four-on-the-floor and bass attacks avoid the kick onsets', () => {
  const score = buildArrangement(neonChangan, { ...options, version: 'hook' });
  const kicks = score.events.filter(e => e.instrument === 'kick');
  assert.deepEqual(kicks.map(e => e.beat), Array.from({ length: 32 }, (_, i) => i));
  for (const e of score.events.filter(e => e.instrument === 'bass')) assert.ok(kicks.every(k => Math.abs(k.beat - e.beat) >= .24));
  const full = buildArrangement(neonChangan, options);
  // The last half-beat of each build contains no new hit.
  for (const section of full.sections.filter(s => s.name.includes('蓄力'))) {
    const end = section.end * 128 / 60;
    assert.ok(full.events.every(e => e.beat < end - .5 || e.beat >= end));
  }
});

test('foreground replies respect written notes and wind releases across the supported tempo range', () => {
  for (const bpm of [90, 128, 170]) {
    const score = buildArrangement(neonChangan, { ...options, bpm });
    const winds = score.events.filter(e => e.instrument === 'lead' || e.instrument === 'dizi');
    for (const reply of score.events.filter(e => e.instrument === 'guzheng')) {
      assert.ok(winds.every(e => reply.beat >= e.beat + e.duration + (e.instrument === 'dizi' ? .105 : .06) * bpm / 60 || reply.beat + reply.duration <= e.beat), `foreground overlap at ${reply.beat}, ${bpm} BPM`);
    }
  }
});

test('club phrase and native sample-rate validation reject broken renders before creating nodes', () => {
  assert.throws(() => validateOptions({ ...options, sampleRate: 96000 as 48000 }), /采样率/);
  const broken = structuredClone(neonChangan);
  broken.guofengClub!.finalHook[0][0].length = 5;
  assert.throws(() => validateTrack(broken), /小节内/);
  const base = buildArrangement(neonChangan, options);
  const shifted = buildArrangement(neonChangan, { ...options, transpose: -5 });
  assert.deepEqual(shifted.events, base.events.map(e => ({ ...e, notes: e.notes?.map(n => n - 5) })));
  assert.deepEqual(base, buildArrangement(neonChangan, options));
});
