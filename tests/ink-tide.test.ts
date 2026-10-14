import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateTrack } from '../src/music/arrange.ts';
import { inkTide } from '../src/tracks/ink-tide.ts';
import type { RenderOptions } from '../src/music/types.ts';

const options: RenderOptions = { version: 'full', bpm: 124, transpose: 0, seed: 261014 };

test('Ink Tide edits preserve the written full score and have safe event boundaries', () => {
  const full = buildArrangement(inkTide, options);
  assert.equal(full.beats, 160);
  assert.ok(full.events.some(event => event.instrument === 'guqin' && event.beat === 0));
  for (const version of ['hook', 'loop'] as const) {
    const score = buildArrangement(inkTide, { ...options, version });
    const edit = inkTide.edits![version];
    const start = edit.startBar * 4, end = start + edit.bars * 4;
    assert.equal(score.beats, 32);
    assert.deepEqual(score.events, full.events.filter(event => event.beat >= start && event.beat < end)
      .map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) })));
  }
  for (const [index, event] of full.events.entries()) {
    assert.ok(event.beat >= 0 && event.duration > 0 && event.beat + event.duration <= full.beats + 1e-9);
    assert.ok(event.velocity > 0 && event.velocity <= 1);
    assert.ok(event.notes?.every(note => Number.isInteger(note) && note >= 0 && note <= 127) ?? true);
    if (index) assert.ok(event.beat >= full.events[index - 1].beat);
  }
});

test('foreground phrases leave room for xiao replies and the bridge releases rhythmic weight', () => {
  const score = buildArrangement(inkTide, options);
  const foreground = score.events.filter(event => ['guqin', 'lead', 'xiao'].includes(event.instrument));
  for (const reply of foreground.filter(event => event.instrument === 'xiao')) {
    assert.ok(!foreground.some(event => event.instrument !== 'xiao' && event.beat < reply.beat + reply.duration && event.beat + event.duration > reply.beat), 'xiao should not compete with the foreground phrase');
  }
  const airIndex = inkTide.arrangement.findIndex(section => section.energy === 'air');
  assert.ok(airIndex >= 0);
  const section = score.sections[airIndex];
  const bridge = score.events.filter(event => event.beat * 60 / options.bpm >= section.start && event.beat * 60 / options.bpm < section.end - 1e-9);
  assert.ok(bridge.length > 0);
  assert.ok(!bridge.some(event => ['kick', 'bass', 'rim', 'shaker'].includes(event.instrument)));
  const pentatonic = new Set([0, 2, 5, 7, 9]);
  assert.ok(foreground.every(event => event.notes!.every(note => pentatonic.has(note % 12))));
});

test('tempo and transpose keep score timing intact, seed changes touch only', () => {
  const score = buildArrangement(inkTide, options);
  assert.deepEqual(score, buildArrangement(inkTide, options));
  const changed = buildArrangement(inkTide, { ...options, seed: 0 });
  assert.notDeepEqual(changed.events, score.events);
  const withoutTouch = (events: typeof score.events) => events.map(({ velocity: _velocity, ...event }) => event);
  assert.deepEqual(withoutTouch(score.events), withoutTouch(changed.events));
  for (const transpose of [-12, 12]) {
    const shifted = buildArrangement(inkTide, { ...options, bpm: 170, transpose });
    assert.deepEqual(shifted.events, score.events.map(event => ({ ...event, notes: event.notes?.map(note => note + transpose) })));
    assert.ok(Math.abs(shifted.sections.at(-1)!.end - score.beats * 60 / 170) < 1e-9);
  }
});

test('malformed development and replies are rejected before audio scheduling', () => {
  for (const field of ['response', 'finalHook', 'bridgeHook'] as const) {
    const mismatch = structuredClone(inkTide);
    mismatch.inkTide![field]!.pop();
    assert.throws(() => validateTrack(mismatch), /小节数必须与 Hook/);
    const crossBar = structuredClone(inkTide);
    const first = crossBar.inkTide![field]!.flat()[0];
    first.length = 5;
    assert.throws(() => validateTrack(crossBar), /小节内结束/);
  }
  const overlap = structuredClone(inkTide);
  overlap.inkTide!.response![0] = [{ ...overlap.hook[0][0] }];
  assert.throws(() => validateTrack(overlap), /应答必须位于主旋律留白/);
  const wrongProduction = structuredClone(inkTide);
  wrongProduction.production = 'emotional-pop';
  assert.throws(() => validateTrack(wrongProduction), /ink-tide/);
});
