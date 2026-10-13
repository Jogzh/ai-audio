import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateTrack } from '../src/music/arrange.ts';
import { mountainsAwake } from '../src/tracks/mountains-awake.ts';
import { findTrack } from '../src/tracks/registry.ts';
import type { Instrument, RenderOptions } from '../src/music/types.ts';

const options: RenderOptions = { version: 'full', bpm: mountainsAwake.meta.bpm, transpose: 0, seed: 261013 };

test('guofeng score has a full arc, pentatonic melody and safe musical event bounds', () => {
  assert.equal(findTrack('mountains-awake'), mountainsAwake);
  const score = buildArrangement(mountainsAwake, options);
  assert.equal(score.beats, 192);
  assert.ok(Math.abs(score.sections.at(-1)!.end - 192 * 60 / options.bpm) < 1e-9);
  assert.equal(score.sections.length, 7);
  const palette = new Set(score.events.map(event => event.instrument));
  for (const voice of ['guzheng', 'dizi', 'erhu', 'taiko', 'gong', 'strings', 'brass', 'granular', 'kick', 'clap', 'bass'] as Instrument[]) assert.ok(palette.has(voice), voice);
  const pentatonic = new Set([0, 2, 5, 7, 9]);
  for (const [index, event] of score.events.entries()) {
    assert.ok(event.beat >= 0 && event.beat < score.beats);
    assert.ok(event.duration > 0 && event.beat + event.duration <= score.beats + 1e-9);
    assert.ok(event.velocity > 0 && event.velocity <= 1);
    if (index) assert.ok(event.beat >= score.events[index - 1].beat);
    if (event.notes) assert.ok(event.notes.every(note => Number.isInteger(note) && note >= 0 && note <= 127));
    if (['dizi', 'erhu'].includes(event.instrument)) assert.ok(event.notes!.every(note => pentatonic.has(note % 12)), 'folk melody remains pentatonic while harmony may add other notes');
  }
});

test('short editions use the actual chorus and clip events at the edit boundary', () => {
  const full = buildArrangement(mountainsAwake, options);
  for (const version of ['hook', 'loop'] as const) {
    const edit = mountainsAwake.edits![version];
    const start = edit.startBar * 4;
    const end = start + edit.bars * 4;
    const score = buildArrangement(mountainsAwake, { ...options, version });
    assert.equal(start, 64);
    assert.equal(score.beats, 32);
    assert.deepEqual(score.events, full.events.filter(event => event.beat >= start && event.beat < end).map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) })));
    assert.deepEqual(score.sections.map(section => [section.start, section.end]), [[0, 32 * 60 / options.bpm]]);
    assert.ok(score.events.some(event => event.instrument === 'dizi' && event.beat === 0));
    assert.ok(score.events.some(event => event.instrument === 'strings' && event.beat === 0));
  }
});

test('bridge removes rhythmic weight, final theme develops, and outro resolves to D', () => {
  const score = buildArrangement(mountainsAwake, options);
  const bridge = score.events.filter(event => event.beat >= 96 && event.beat < 112);
  assert.ok(bridge.some(event => event.instrument === 'erhu'));
  assert.ok(!bridge.some(event => ['kick', 'clap', 'hat', 'taiko', 'bass', 'sub'].includes(event.instrument)));
  const first = score.events.filter(event => event.instrument === 'dizi' && event.beat >= 112 && event.beat < 144);
  const last = score.events.filter(event => event.instrument === 'dizi' && event.beat >= 144 && event.beat < 176);
  assert.notDeepEqual(first.map(event => event.notes), last.map(event => event.notes));
  assert.ok(Math.max(...last.flatMap(event => event.notes ?? [])) > Math.max(...first.flatMap(event => event.notes ?? [])));
  const ending = score.events.filter(event => event.beat >= 188);
  assert.ok(ending.some(event => event.instrument === 'guzheng' && event.notes && event.notes[0] % 12 === 2));
  assert.ok(!ending.some(event => ['kick', 'clap', 'bass', 'sub'].includes(event.instrument)));
});

test('seed varies touch without rewriting the melody, pitch changes retain all timing', () => {
  const base = buildArrangement(mountainsAwake, options);
  assert.deepEqual(base, buildArrangement(mountainsAwake, options));
  const changed = buildArrangement(mountainsAwake, { ...options, seed: 0 });
  assert.notDeepEqual(base.events, changed.events);
  const melody = (score: typeof base) => score.events.filter(event => ['dizi', 'erhu', 'bass'].includes(event.instrument));
  assert.deepEqual(melody(base), melody(changed));
  for (const transpose of [-12, 5, 12]) {
    const shifted = buildArrangement(mountainsAwake, { ...options, transpose, bpm: 170 });
    assert.deepEqual(shifted.events, base.events.map(event => ({ ...event, notes: event.notes?.map(note => note + transpose) })));
    assert.equal(shifted.sections.at(-1)!.end, 192 * 60 / 170);
  }
});

test('written development rejects invalid phrases before audio rendering', () => {
  for (const field of ['finalHook', 'bridgeHook'] as const) {
    const mismatch = structuredClone(mountainsAwake);
    mismatch.cinematicGuofeng![field]!.pop();
    assert.throws(() => validateTrack(mismatch), /小节数必须与 Hook/);
    const crossBar = structuredClone(mountainsAwake);
    crossBar.cinematicGuofeng![field]![0][0].length = 5;
    assert.throws(() => validateTrack(crossBar), /小节内结束/);
  }
});


test('chorus has an unbroken backbeat, aligned bass, and one sustained harmony layer', () => {
  const score = buildArrangement(mountainsAwake, { ...options, version: 'hook' });
  for (let bar = 0; bar < 8; bar++) {
    const beat = bar * 4;
    const events = score.events.filter(event => event.beat >= beat && event.beat < beat + 4);
    assert.deepEqual(events.filter(event => event.instrument === 'kick').map(event => event.beat - beat), [0, 2]);
    assert.deepEqual(events.filter(event => event.instrument === 'clap').map(event => event.beat - beat), [1, 3]);
    assert.deepEqual(events.filter(event => event.instrument === 'bass').map(event => event.beat - beat), [0, 2]);
    assert.ok(!events.some(event => event.instrument === 'sub' || event.instrument === 'pad' || event.instrument === 'brass' || event.instrument === 'erhu'));
    assert.ok(events.filter(event => event.instrument === 'guzheng').length <= 2);
  }
  const lead = score.events.filter(event => event.instrument === 'dizi');
  assert.ok(lead.length <= 26);
  assert.ok(lead.every(event => event.beat * 2 === Math.round(event.beat * 2) && event.notes![0] <= 81));
  for (let index = 1; index < lead.length; index++) assert.ok(lead[index].beat >= lead[index - 1].beat + lead[index - 1].duration, 'the melody leaves a gap between phrases');
});
