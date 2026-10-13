import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateOptions } from '../src/music/arrange.ts';
import { createRandom } from '../src/music/random.ts';
import type { RenderOptions } from '../src/music/types.ts';
import { neonRebound } from '../src/tracks/neon-rebound.ts';
import { amberTides } from '../src/tracks/amber-tides.ts';
import { velvetHour } from '../src/tracks/velvet-hour.ts';
import { defaultTrack, findTrack, trackRegistry } from '../src/tracks/registry.ts';

const options: RenderOptions = { version: 'full', bpm: 132, transpose: 0, seed: 260713 };

test('full score is 48 bars and contains immediate signature, transitions, and breathing room', () => {
  const score = buildArrangement(neonRebound, options);
  assert.equal(score.beats, 192);
  assert.equal(score.sections.length, 7);
  assert.equal(score.events[0].beat, 0);
  assert.ok(score.events.some(event => event.beat === 0 && event.instrument === 'lead'));
  assert.equal(score.events.filter(event => event.instrument === 'riser').length, 1);
  assert.ok(score.events.every(event => event.beat >= 0 && event.beat < score.beats && event.duration > 0 && event.velocity > 0 && event.velocity <= 1));
  assert.ok(score.events.every((event, index) => index === 0 || event.beat >= score.events[index - 1].beat));
  assert.equal(score.sections[3].start, 64 * 60 / 132);
});

test('short versions are precisely 8 bars, loop has a pickup', () => {
  const hook = buildArrangement(neonRebound, { ...options, version: 'hook' });
  const loop = buildArrangement(neonRebound, { ...options, version: 'loop' });
  assert.equal(hook.beats, 32);
  assert.equal(loop.beats, 32);
  assert.ok(loop.events.some(event => event.beat === 31.75 && event.instrument === 'lead'));
  assert.ok(!hook.events.some(event => event.beat === 31.75 && event.instrument === 'lead'));
});

test('seed repeats arrangement, varies humanization, and includes seed zero', () => {
  assert.deepEqual(buildArrangement(neonRebound, options), buildArrangement(neonRebound, options));
  const changed = buildArrangement(neonRebound, { ...options, seed: 0 });
  assert.notDeepEqual(changed.events, buildArrangement(neonRebound, options).events);
  const random = createRandom(0);
  const results = Array.from({ length: 100 }, random);
  assert.ok(results.every(value => value >= 0 && value < 1));
});

test('transpose changes pitched voices but not drums, tempo changes seconds but not beats', () => {
  const base = buildArrangement(neonRebound, options);
  const shifted = buildArrangement(neonRebound, { ...options, transpose: 5, bpm: 100 });
  assert.equal(base.events.length, shifted.events.length);
  base.events.forEach((event, index) => {
    assert.equal(event.beat, shifted.events[index].beat);
    if (event.notes) assert.deepEqual(shifted.events[index].notes, event.notes.map(note => note + 5));
    else assert.equal(shifted.events[index].notes, undefined);
  });
  assert.equal(shifted.sections[0].end, 16 * 60 / 100);
});

test('invalid inputs fail, rather than silently clamp or create huge renders', () => {
  for (const invalid of [{ bpm: NaN }, { bpm: 0 }, { bpm: Infinity }, { transpose: 1.5 }, { seed: -1 }, { seed: 2 ** 32 }, { version: 'other' }]) {
    assert.throws(() => validateOptions({ ...options, ...invalid } as RenderOptions));
  }
  validateOptions({ ...options, bpm: 90, transpose: -12, seed: 0 });
  validateOptions({ ...options, bpm: 170, transpose: 12, seed: 0xffffffff });
});

test('warm score has a complete eight-bar theme, sustained harmony and quieter bridge', () => {
  const full = buildArrangement(amberTides, { ...options, bpm: 112 });
  const hook = buildArrangement(amberTides, { ...options, bpm: 112, version: 'hook' });
  const loop = buildArrangement(amberTides, { ...options, bpm: 112, version: 'loop' });
  assert.equal(full.beats, 192);
  assert.equal(full.sections.length, 6);
  assert.equal(hook.beats, 32);
  assert.deepEqual(loop.events, hook.events, 'loop preserves the phrase without an unrelated pickup');
  assert.equal(hook.events.filter(event => event.instrument === 'lead').length, amberTides.hook.flat().length);
  assert.ok(hook.events.filter(event => event.instrument === 'lead').every(event => event.duration >= 0.4));
  assert.ok(hook.events.some(event => event.instrument === 'chord' && event.duration > 2));
  assert.ok(hook.events.some(event => event.instrument === 'pad' && event.duration > 3));
  assert.ok(!full.events.some(event => event.instrument === 'riser'));
  assert.ok(!full.events.some(event => event.instrument === 'kick' && event.beat >= 96 && event.beat < 120));
  const lastChord = full.events.filter(event => event.instrument === 'chord' && event.beat >= 188).flatMap(event => event.notes ?? []);
  assert.deepEqual(lastChord, amberTides.harmony[0].chord, 'outro resolves to the tonic');
  assert.ok(full.events.every(event => event.beat >= 0 && event.beat < full.beats && event.duration > 0 && event.velocity > 0 && event.velocity <= 1));
});

test('warm production retains melody timing, key and deterministic humanization', () => {
  const base = buildArrangement(amberTides, { ...options, version: 'hook', bpm: 112 });
  assert.deepEqual(base, buildArrangement(amberTides, { ...options, version: 'hook', bpm: 112 }));
  const shifted = buildArrangement(amberTides, { ...options, version: 'hook', bpm: 100, transpose: 5 });
  base.events.forEach((event, index) => {
    assert.equal(event.beat, shifted.events[index].beat);
    if (event.notes) assert.deepEqual(shifted.events[index].notes, event.notes.map(note => note + 5));
  });
  const melody = base.events.filter(event => event.instrument === 'lead');
  assert.deepEqual(melody.map(event => event.beat), amberTides.hook.flatMap((bar, index) => bar.map(note => index * 4 + note.offset)));
  const key = new Set([1, 2, 4, 6, 8, 9, 11]); // F# natural minor
  assert.ok(base.events.every(event => !event.notes || event.notes.every(note => key.has(note % 12))));
  assert.notDeepEqual(base.events, buildArrangement(amberTides, { ...options, version: 'hook', bpm: 112, seed: 0 }).events);
});

test('registry defaults to the new song, keeps previous songs and rejects unknown IDs', () => {
  assert.equal(defaultTrack, velvetHour);
  assert.equal(findTrack('velvet-hour'), velvetHour);
  assert.equal(findTrack('missing'), undefined);
  assert.equal(new Set(trackRegistry.map(track => track.meta.id)).size, trackRegistry.length);
  assert.equal(trackRegistry.length, 3);
  for (const track of trackRegistry) {
    assert.ok(track.meta.bpm >= 90 && track.meta.bpm <= 170);
    assert.ok(track.hook.length > 0 && track.harmony.length > 0);
    assert.ok(track.hook.flat().every(note => note.offset >= 0 && note.offset < 4 && note.length > 0 && Number.isFinite(note.note)));
    const score = buildArrangement(track, { ...options, bpm: track.meta.bpm });
    assert.equal(score.beats, track.arrangement.reduce((sum, section) => sum + section.bars * 4, 0));
  }
});

test('disco groove actually uses sampled guitar/bass and the expanded percussion palette', () => {
  const full = buildArrangement(velvetHour, { ...options, bpm: 120 });
  const hook = buildArrangement(velvetHour, { ...options, bpm: 120, version: 'hook' });
  const loop = buildArrangement(velvetHour, { ...options, bpm: 120, version: 'loop' });
  assert.equal(full.beats, 224);
  assert.equal(full.sections.length, 6);
  assert.equal(hook.beats, 32);
  assert.deepEqual(hook.events, loop.events);
  const palette = new Set(full.events.map(event => event.instrument));
  for (const instrument of ['guitar', 'electricBass', 'organ', 'pluck', 'shaker', 'rim', 'conga', 'kick']) assert.ok(palette.has(instrument as typeof full.events[number]['instrument']), instrument);
  assert.ok(!palette.has('riser') && !palette.has('impact'), 'light DJ groove does not need a huge EDM build');
  assert.deepEqual(hook.events.filter(event => event.instrument === 'kick').map(event => event.beat), Array.from({ length: 32 }, (_, beat) => beat));
  assert.equal(hook.events.filter(event => event.instrument === 'guitar').length, velvetHour.hook.flat().length);
  assert.ok(hook.events.filter(event => event.instrument === 'electricBass').every(event => event.beat % 1 !== 0), 'bass leaves space around the kick');
  assert.ok(!full.events.some(event => event.instrument === 'kick' && event.beat >= 96 && event.beat < 120), 'bridge rests before the second chorus');
  const key = new Set([0, 2, 4, 5, 7, 9, 11]);
  assert.ok(full.events.every(event => !event.notes || event.notes.every(note => key.has(note % 12))));
  assert.ok(full.events.every(event => event.beat >= 0 && event.beat < full.beats && event.duration > 0 && event.velocity > 0 && event.velocity <= 1));
  assert.ok(full.events.every((event, index) => index === 0 || event.beat >= full.events[index - 1].beat));
  const lastKeys = full.events.filter(event => event.instrument === 'chord' && event.beat >= 220).flatMap(event => event.notes ?? []);
  assert.deepEqual(lastKeys, velvetHour.harmony[0].chord);
});

test('disco arrangement is seeded and transposes pitched voices without moving the groove', () => {
  const baseOptions: RenderOptions = { ...options, bpm: 120, version: 'hook' };
  const base = buildArrangement(velvetHour, baseOptions);
  assert.deepEqual(base, buildArrangement(velvetHour, baseOptions));
  const shifted = buildArrangement(velvetHour, { ...baseOptions, bpm: 100, transpose: 5 });
  base.events.forEach((event, index) => {
    assert.equal(event.beat, shifted.events[index].beat);
    assert.equal(event.duration, shifted.events[index].duration);
    if (event.notes) assert.deepEqual(shifted.events[index].notes, event.notes.map(note => note + 5));
    else assert.equal(shifted.events[index].notes, undefined);
  });
  const changed = buildArrangement(velvetHour, { ...baseOptions, seed: 0 });
  assert.notDeepEqual(base.events, changed.events);
  assert.deepEqual(base.events.filter(event => event.notes), changed.events.filter(event => event.notes), 'seed changes texture, not the written melody');
});
