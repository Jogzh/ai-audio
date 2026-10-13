import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateOptions, validateTrack } from '../src/music/arrange.ts';
import { createRandom } from '../src/music/random.ts';
import type { RenderOptions, TrackDefinition } from '../src/music/types.ts';
import { afterglow } from '../src/tracks/afterglow.ts';
import { defaultTrack, findTrack, trackRegistry } from '../src/tracks/registry.ts';

const options: RenderOptions = { version: 'full', bpm: 118, transpose: 0, seed: 260713 };

test('registry selects afterglow by default and excludes retired demos', () => {
  assert.equal(defaultTrack, afterglow);
  assert.ok(trackRegistry.includes(afterglow));
  assert.equal(findTrack('afterglow'), afterglow);
  for (const id of ['velvet-hour', 'moonlit-sway', 'amber-tides', 'neon-rebound', 'missing']) assert.equal(findTrack(id), undefined);
  assert.equal(afterglow.production, 'emotional-pop');
  assert.equal(afterglow.meta.bpm, 118);
});

test('render options reject nonfinite, fractional and out-of-range parameters before composition', () => {
  for (const invalid of [
    { bpm: NaN }, { bpm: 0 }, { bpm: 89 }, { bpm: 171 }, { bpm: Infinity }, { bpm: 120.5 },
    { transpose: -13 }, { transpose: 13 }, { transpose: 1.5 }, { transpose: NaN }, { transpose: Infinity },
    { seed: -1 }, { seed: 2 ** 32 }, { seed: 0.5 }, { seed: NaN }, { seed: Infinity },
    { version: 'other' },
  ]) {
    const input = { ...options, ...invalid } as RenderOptions;
    assert.throws(() => validateOptions(input), RangeError);
    assert.throws(() => buildArrangement(afterglow, input), RangeError);
  }
  for (const version of ['full', 'hook', 'loop'] as const) {
    assert.doesNotThrow(() => validateOptions({ ...options, version, bpm: 90, transpose: -12, seed: 0 }));
    assert.doesNotThrow(() => validateOptions({ ...options, version, bpm: 170, transpose: 12, seed: 0xffffffff }));
  }
});

test('invalid melody, harmony and full sections fail even when rendering a short edit', () => {
  for (const field of ['harmony', 'hook', 'arrangement'] as const) {
    const track = structuredClone(afterglow);
    track[field] = [];
    assert.throws(() => buildArrangement(track, options), /曲目缺少/);
  }
  for (const patch of [
    { note: NaN }, { note: -1 }, { note: 128 }, { note: 60.5 },
    { offset: -0.5 }, { offset: 4 }, { offset: Infinity }, { offset: NaN },
    { length: 0 }, { length: -1 }, { length: Infinity }, { length: NaN },
    { velocity: 0 }, { velocity: 1.1 }, { velocity: Infinity }, { velocity: NaN },
  ]) {
    const track = structuredClone(afterglow);
    Object.assign(track.hook[0][0], patch);
    assert.throws(() => buildArrangement(track, { ...options, version: 'hook' }), /Hook/);
  }
  for (const root of [NaN, -1, 128, 60.5, Infinity]) {
    const track = structuredClone(afterglow);
    track.harmony[0].root = root;
    assert.throws(() => validateTrack(track), /和声/);
  }
  for (const note of [NaN, -1, 128, 60.5, Infinity]) {
    const track = structuredClone(afterglow);
    track.harmony[0].chord[2] = note;
    assert.throws(() => validateTrack(track), /和声/);
  }
  const chord = structuredClone(afterglow);
  chord.harmony[0].chord = [60, 64, 67];
  assert.throws(() => validateTrack(chord), /至少 4 个/);
  const sparse = structuredClone(afterglow);
  delete sparse.harmony[0].chord[2];
  assert.throws(() => validateTrack(sparse), /和声/);
  for (const bars of [0, -1, 1.5, Infinity, NaN]) {
    const track = structuredClone(afterglow);
    track.arrangement.at(-1)!.bars = bars;
    assert.throws(() => buildArrangement(track, { ...options, version: 'hook' }), /小节数/);
  }
  const unknownEnergy = structuredClone(afterglow);
  unknownEnergy.arrangement.at(-1)!.energy = 'missing' as TrackDefinition['arrangement'][number]['energy'];
  assert.throws(() => buildArrangement(unknownEnergy, { ...options, version: 'hook' }), /未知段落能量/);
  const unsupported = { ...afterglow, production: 'legacy' } as unknown as TrackDefinition;
  assert.throws(() => buildArrangement(unsupported, options));
});

test('seeded random generator supports zero and both uint32 endpoints', () => {
  for (const seed of [0, 260713, 0xffffffff]) {
    const random = createRandom(seed);
    const values = Array.from({ length: 100 }, random);
    const repeated = createRandom(seed);
    assert.deepEqual(values, Array.from({ length: 100 }, repeated));
    assert.ok(values.every(value => value >= 0 && value < 1));
  }
  assert.notEqual(createRandom(0)(), createRandom(0xffffffff)());
});

test('afterglow presents the motif immediately and reaches its main section in about four seconds', () => {
  const input: RenderOptions = { ...options, bpm: afterglow.meta.bpm };
  const full = buildArrangement(afterglow, input);
  const hook = buildArrangement(afterglow, { ...input, version: 'hook' });
  const signature = afterglow.hook[0][0];
  assert.equal(full.beats, 160);
  assert.equal(full.sections.length, 6);
  full.sections.forEach((section, index) => {
    assert.ok(Math.abs(section.start - [0, 8, 40, 72, 88, 136][index] * 60 / input.bpm) < 1e-9);
    assert.ok(Math.abs(section.end - [8, 40, 72, 88, 136, 160][index] * 60 / input.bpm) < 1e-9);
  });
  assert.ok(full.sections.every((section, index) => section.end > section.start && (index === 0 || section.start === full.sections[index - 1].end)));
  assert.ok(full.events.some(event => event.instrument === 'piano' && event.beat === 0 && event.notes?.[0] === signature.note));
  assert.ok(hook.events.some(event => event.instrument === 'lead' && event.beat === 0 && event.notes?.[0] === signature.note));
  assert.ok(full.sections[1].start >= 3.5 && full.sections[1].start <= 4.5);
  assert.equal(full.sections[1].start, 8 * 60 / input.bpm);
  assert.equal(hook.beats, 32);
  assert.deepEqual(hook.events.filter(event => event.instrument === 'lead').map(event => ({ beat: event.beat, notes: event.notes, duration: event.duration })),
    afterglow.hook.flatMap((bar, index) => bar.map(note => ({ beat: index * 4 + note.offset, notes: [note.note], duration: note.length }))));
  const key = new Set([1, 2, 4, 6, 8, 9, 11]); // F# natural minor
  const palette = new Set(full.events.map(event => event.instrument));
  for (const instrument of ['piano', 'lead', 'vocal', 'chord', 'pad', 'kick', 'clap', 'hat', 'bass', 'sub', 'texture', 'sweep'] as const) assert.ok(palette.has(instrument), `${instrument} appears in the full composition`);
  for (const score of [full, hook]) {
    assert.ok(score.events.every(event => event.beat >= 0 && event.beat < score.beats && event.duration > 0 && event.velocity > 0 && event.velocity <= 1));
    assert.ok(score.events.every((event, index) => index === 0 || event.beat >= score.events[index - 1].beat));
    assert.ok(score.events.every(event => !event.notes || event.notes.every(note => key.has(note % 12))));
  }
});

test('emotional pop short edits contain the real full score excerpt and clip notes at their endpoint', () => {
  const input: RenderOptions = { ...options, bpm: afterglow.meta.bpm };
  // Also crop a different final-chorus range, so an independently generated hook cannot pass.
  for (const track of [afterglow, { ...afterglow, edits: { hook: { startBar: 26, bars: 3 }, loop: { startBar: 0, bars: 2 } } }]) {
    const full = buildArrangement(track, input);
    for (const version of ['hook', 'loop'] as const) {
      const edit = track.edits![version];
      const start = edit.startBar * 4;
      const end = start + edit.bars * 4;
      const excerpt = buildArrangement(track, { ...input, version });
      const expected = full.events.filter(event => event.instrument !== 'texture' && event.beat >= start && event.beat < end)
        .map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) }));
      assert.deepEqual(excerpt.events.filter(event => event.instrument !== 'texture'), expected);
      assert.equal(excerpt.beats, edit.bars * 4);
      assert.ok(excerpt.events.every(event => event.beat + event.duration <= excerpt.beats + 1e-9));
      assert.deepEqual(excerpt.events.filter(event => event.instrument === 'texture'), [{ instrument: 'texture', beat: 0, duration: excerpt.beats, velocity: 0.16 }]);
      assert.equal(excerpt.sections[0].start, 0);
      assert.equal(excerpt.sections.at(-1)!.end, excerpt.beats * 60 / input.bpm);
      assert.ok(excerpt.sections.every(section => section.start >= 0 && section.end > section.start && section.end <= excerpt.beats * 60 / input.bpm));
    }
  }
  assert.deepEqual(buildArrangement(afterglow, { ...input, version: 'hook' }), buildArrangement(afterglow, { ...input, version: 'loop' }));
});

test('afterglow gives the bridge space and resolves its final chord and melody to F# minor', () => {
  const input: RenderOptions = { ...options, bpm: afterglow.meta.bpm };
  const full = buildArrangement(afterglow, input);
  const bridgeIndex = afterglow.arrangement.findIndex(section => section.energy === 'air');
  const bridgeStart = afterglow.arrangement.slice(0, bridgeIndex).reduce((sum, section) => sum + section.bars * 4, 0);
  const bridgeEnd = bridgeStart + afterglow.arrangement[bridgeIndex].bars * 4;
  const bridge = full.events.filter(event => event.beat >= bridgeStart && event.beat < bridgeEnd);
  assert.ok(bridge.some(event => event.instrument === 'piano'));
  assert.ok(bridge.some(event => event.instrument === 'pad'));
  assert.ok(!bridge.some(event => ['kick', 'clap', 'hat', 'openHat', 'bass', 'sub'].includes(event.instrument)));
  assert.ok(full.events.some(event => event.instrument === 'kick' && event.beat === bridgeEnd), 'rhythm returns at the final chorus');
  const resolution = afterglow.harmony[afterglow.resolveHarmony!];
  assert.equal(resolution.root % 12, 6);
  const ending = full.events.filter(event => event.beat >= full.beats - 4);
  assert.deepEqual(ending.filter(event => event.instrument === 'chord').flatMap(event => event.notes ?? []), resolution.chord);
  assert.ok(ending.some(event => event.instrument === 'piano' && event.beat === full.beats - 4 && event.notes?.[0] === resolution.root + 36));
  assert.ok(!ending.some(event => ['kick', 'clap', 'bass', 'sub'].includes(event.instrument)));
});

test('emotional pop seed changes touch while preserving the tune, and transposition preserves all timing', () => {
  const input: RenderOptions = { ...options, bpm: afterglow.meta.bpm, version: 'hook' };
  const base = buildArrangement(afterglow, input);
  assert.deepEqual(base, buildArrangement(afterglow, input));
  const changed = buildArrangement(afterglow, { ...input, seed: 0 });
  assert.notDeepEqual(base.events, changed.events);
  assert.deepEqual(base.events.filter(event => event.instrument === 'lead'), changed.events.filter(event => event.instrument === 'lead'));
  assert.deepEqual(base.events.filter(event => event.instrument === 'bass' || event.instrument === 'sub'), changed.events.filter(event => event.instrument === 'bass' || event.instrument === 'sub'));
  assert.deepEqual(base.sections, changed.sections);
  for (const transpose of [-12, 5, 12]) {
    const shifted = buildArrangement(afterglow, { ...input, bpm: 100, transpose });
    assert.equal(base.events.length, shifted.events.length);
    base.events.forEach((event, index) => {
      const expected = { ...event };
      if (event.notes) expected.notes = event.notes.map(note => note + transpose);
      assert.deepEqual(shifted.events[index], expected);
    });
    assert.equal(shifted.sections.at(-1)!.end, shifted.beats * 60 / 100);
  }
});

test('emotional pop rejects invalid edit ranges and resolutions even when rendering the full version', () => {
  const input: RenderOptions = { ...options, bpm: afterglow.meta.bpm };
  const missing = structuredClone(afterglow);
  delete missing.edits;
  assert.throws(() => buildArrangement(missing, input), /精华与循环/);
  for (const version of ['hook', 'loop'] as const) {
    for (const patch of [
      { startBar: -1 }, { startBar: 0.5 }, { startBar: NaN }, { startBar: Infinity },
      { startBar: 40 }, { startBar: 39, bars: 2 },
      { bars: 0 }, { bars: -1 }, { bars: 1.5 }, { bars: NaN }, { bars: Infinity },
    ]) {
      const track = structuredClone(afterglow);
      Object.assign(track.edits![version], patch);
      assert.throws(() => buildArrangement(track, input), new RegExp(`${version}.*有效小节区间`));
    }
    const track = structuredClone(afterglow);
    delete (track.edits as Partial<NonNullable<typeof track.edits>>)[version];
    assert.throws(() => buildArrangement(track, input), new RegExp(`${version}.*有效小节区间`));
  }
  for (const resolveHarmony of [-1, 0.5, NaN, Infinity, afterglow.harmony.length]) {
    assert.throws(() => validateTrack({ ...afterglow, resolveHarmony }), /结束和声/);
  }
  assert.doesNotThrow(() => validateTrack({ ...afterglow, edits: { hook: { startBar: 0, bars: 40 }, loop: { startBar: 39, bars: 1 } }, resolveHarmony: 0 }));
});
