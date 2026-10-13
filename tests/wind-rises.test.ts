import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { buildArrangement, validateTrack } from '../src/music/arrange.ts';
import type { HookBar, MusicalEvent, RenderOptions } from '../src/music/types.ts';
import { afterglow } from '../src/tracks/afterglow.ts';
import { whenTheWindRises } from '../src/tracks/when-the-wind-rises.ts';
import { findTrack, trackRegistry } from '../src/tracks/registry.ts';

const options: RenderOptions = { version: 'full', bpm: 114, transpose: 0, seed: 261013 };
const sectionStart = (energy: 'drop' | 'air' | 'final') => {
  const index = whenTheWindRises.arrangement.findIndex(section => section.energy === energy);
  assert.ok(index >= 0);
  return whenTheWindRises.arrangement.slice(0, index).reduce((sum, section) => sum + section.bars * 4, 0);
};
const phraseEvents = (phrase: HookBar[], start: number, instrument: 'piano' | 'lead', level: number): MusicalEvent[] =>
  phrase.flatMap((bar, index) => bar.map(note => ({
    instrument, beat: start + index * 4 + note.offset,
    duration: note.length, velocity: note.velocity * level, notes: [note.note],
  })));
const melodyShape = (events: MusicalEvent[]) => events.map(event => ({ beat: event.beat, duration: event.duration, notes: event.notes }));

test('wind rises is an independent registered composition with a complete D-major score', () => {
  assert.equal(findTrack('when-the-wind-rises'), whenTheWindRises);
  assert.ok(trackRegistry.includes(afterglow));
  assert.equal(new Set(trackRegistry.map(track => track.meta.id)).size, trackRegistry.length);
  assert.equal(whenTheWindRises.meta.bpm, 114);
  assert.equal(whenTheWindRises.meta.key, 'D major');
  assert.notDeepEqual(whenTheWindRises.hook, afterglow.hook);
  assert.notDeepEqual(whenTheWindRises.harmony, afterglow.harmony);
  assert.equal(whenTheWindRises.hook.length, 8);
  assert.ok(whenTheWindRises.hook.every(bar => bar.length > 0));
  const full = buildArrangement(whenTheWindRises, options);
  assert.equal(full.beats, 176);
  assert.equal(full.sections.length, 6);
  assert.ok(full.events.some(event => event.instrument === 'piano' && event.beat === 0 && event.notes?.[0] === whenTheWindRises.hook[0][0].note));
  assert.equal(full.sections[1].start, 8 * 60 / 114);
  const key = new Set([1, 2, 4, 6, 7, 9, 11]);
  assert.ok(full.events.every(event => !event.notes || event.notes.every(note => key.has(note % 12))));
  assert.ok(full.events.every(event => event.beat >= 0 && event.beat < full.beats && event.duration > 0 && event.velocity > 0 && event.velocity <= 1));
  assert.ok(full.events.every((event, index) => index === 0 || event.beat >= full.events[index - 1].beat));
  const resolution = whenTheWindRises.harmony[whenTheWindRises.resolveHarmony!];
  assert.equal(resolution.root % 12, 2);
  const ending = full.events.filter(event => event.beat >= full.beats - 4);
  assert.deepEqual(ending.filter(event => event.instrument === 'chord').flatMap(event => event.notes ?? []), resolution.chord);
  assert.ok(ending.some(event => event.instrument === 'piano' && event.notes?.[0] === resolution.root + 36));
});

test('written piano replies fill lead rests in both chorus melodies without overlapping arpeggios', () => {
  const full = buildArrangement(whenTheWindRises, options);
  const development = whenTheWindRises.emotionalPop!;
  const starts = [sectionStart('drop'), sectionStart('final'), sectionStart('final') + 32];
  for (const start of starts) {
    const chorus = full.events.filter(event => event.beat >= start && event.beat < start + 32);
    assert.ok(!chorus.some(event => event.instrument === 'vocal'), 'the written reply replaces the old doubled vowel');
    const lead = chorus.filter(event => event.instrument === 'lead');
    const replies = phraseEvents(development.response!, start, 'piano', 0.76);
    assert.ok(replies.length > 0);
    for (const reply of replies) {
      assert.ok(chorus.some(event => JSON.stringify(event) === JSON.stringify(reply)), 'each written reply is scheduled in its own voice');
      assert.ok(!lead.some(event => reply.beat < event.beat + event.duration && reply.beat + reply.duration > event.beat), 'reply occupies a lead rest');
      const otherPiano = chorus.filter(event => event.instrument === 'piano' && !replies.some(written => JSON.stringify(written) === JSON.stringify(event)));
      assert.ok(!otherPiano.some(event => reply.beat < event.beat + event.duration && reply.beat + reply.duration > event.beat), 'accompaniment leaves room for the reply');
    }
  }
});

test('bridge uses its sparse lower-register phrase and the final chorus develops after eight bars', () => {
  const full = buildArrangement(whenTheWindRises, options);
  const development = whenTheWindRises.emotionalPop!;
  const bridgeStart = sectionStart('air');
  const finalStart = sectionStart('final');
  const bridge = full.events.filter(event => event.beat >= bridgeStart && event.beat < finalStart);
  assert.ok(!bridge.some(event => ['kick', 'clap', 'hat', 'openHat', 'perc', 'bass', 'sub', 'lead', 'vocal'].includes(event.instrument)));
  const bridgePhrase = development.bridgeHook!.slice(0, (finalStart - bridgeStart) / 4);
  const writtenBridge = phraseEvents(bridgePhrase, bridgeStart, 'piano', 0.69);
  assert.ok(writtenBridge.length < whenTheWindRises.hook.slice(0, bridgePhrase.length).flat().length);
  assert.ok(Math.max(...bridgePhrase.flat().map(note => note.note)) < Math.max(...whenTheWindRises.hook.flat().map(note => note.note)));
  for (const expected of writtenBridge) assert.ok(bridge.some(event => JSON.stringify(event) === JSON.stringify(expected)));
  assert.ok(full.events.some(event => event.instrument === 'kick' && event.beat === finalStart), 'rhythm returns at the final chorus');
  const firstChorus = full.events.filter(event => event.instrument === 'lead' && event.beat >= finalStart && event.beat < finalStart + 32);
  const developed = full.events.filter(event => event.instrument === 'lead' && event.beat >= finalStart + 32 && event.beat < finalStart + 64);
  assert.deepEqual(melodyShape(firstChorus), melodyShape(phraseEvents(whenTheWindRises.hook, finalStart, 'lead', 0.92)));
  assert.deepEqual(melodyShape(developed), melodyShape(phraseEvents(development.finalHook!, finalStart + 32, 'lead', 0.92)));
  assert.notDeepEqual(firstChorus.map(event => event.notes), developed.map(event => event.notes));
});

test('syncopated chorus retains its pulse with lighter alternating kicks and displaced bass', () => {
  const start = sectionStart('drop');
  const full = buildArrangement(whenTheWindRises, options);
  const chorus = full.events.filter(event => event.beat >= start && event.beat < start + 28);
  const kicks = chorus.filter(event => event.instrument === 'kick');
  const bass = chorus.filter(event => event.instrument === 'bass');
  assert.ok(kicks.length >= 21 && kicks.length < 28, 'a clear drive without every quarter-note kick');
  assert.ok(kicks.some(event => event.beat % 1 !== 0));
  assert.notDeepEqual(kicks.filter(event => event.beat < start + 4).map(event => event.beat - start), kicks.filter(event => event.beat >= start + 4 && event.beat < start + 8).map(event => event.beat - start - 4));
  assert.ok(bass.every(event => !kicks.some(kick => kick.beat === event.beat)), 'bass attacks leave the kick attack clear');
  const straightTrack = structuredClone(whenTheWindRises);
  delete straightTrack.emotionalPop!.groove;
  const straight = buildArrangement(straightTrack, options).events.filter(event => event.instrument === 'kick' && event.beat >= start && event.beat < start + 28);
  assert.ok(Math.max(...kicks.map(event => event.velocity)) < Math.max(...straight.map(event => event.velocity)));
});

test('wind rises edits retain the actual full-score replies and development, including endpoint clipping', () => {
  const variants = [whenTheWindRises, {
    ...whenTheWindRises,
    edits: { hook: { startBar: sectionStart('final') / 4 + 8, bars: 8 }, loop: { startBar: sectionStart('air') / 4, bars: 2 } },
  }];
  for (const track of variants) {
    const full = buildArrangement(track, options);
    for (const version of ['hook', 'loop'] as const) {
      const edit = track.edits![version];
      const start = edit.startBar * 4;
      const end = start + edit.bars * 4;
      const excerpt = buildArrangement(track, { ...options, version });
      const expected = full.events.filter(event => event.instrument !== 'texture' && event.beat >= start && event.beat < end)
        .map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) }));
      assert.deepEqual(excerpt.events.filter(event => event.instrument !== 'texture'), expected);
      assert.equal(excerpt.beats, edit.bars * 4);
      assert.ok(excerpt.events.every(event => event.beat + event.duration <= excerpt.beats + 1e-9));
      assert.equal(excerpt.sections[0].start, 0);
      assert.equal(excerpt.sections.at(-1)!.end, excerpt.beats * 60 / 114);
    }
  }
  assert.deepEqual(buildArrangement(whenTheWindRises, { ...options, version: 'hook' }), buildArrangement(whenTheWindRises, { ...options, version: 'loop' }));
});

test('new phrase development stays deterministic and transposes without changing its timing', () => {
  const base = buildArrangement(whenTheWindRises, options);
  assert.deepEqual(buildArrangement(whenTheWindRises, options), base);
  const changed = buildArrangement(whenTheWindRises, { ...options, seed: 0 });
  assert.notDeepEqual(base.events, changed.events);
  assert.deepEqual(base.events.filter(event => ['lead', 'bass', 'sub'].includes(event.instrument)), changed.events.filter(event => ['lead', 'bass', 'sub'].includes(event.instrument)));
  for (const transpose of [-12, 5, 12]) {
    const shifted = buildArrangement(whenTheWindRises, { ...options, bpm: 100, transpose });
    assert.equal(shifted.events.length, base.events.length);
    base.events.forEach((event, index) => {
      assert.deepEqual(shifted.events[index], { ...event, notes: event.notes?.map(note => note + transpose) });
    });
    assert.equal(shifted.sections.at(-1)!.end, base.beats * 60 / 100);
  }
});

test('development rejects malformed notes, unmatched phrases and overlapping replies before composition', () => {
  for (const field of ['response', 'finalHook', 'bridgeHook'] as const) {
    const wrongLength = structuredClone(whenTheWindRises);
    wrongLength.emotionalPop![field]!.pop();
    assert.throws(() => buildArrangement(wrongLength, options), /小节数必须与 Hook/);
    const sparse = structuredClone(whenTheWindRises);
    delete sparse.emotionalPop![field]![0];
    assert.throws(() => validateTrack(sparse), /有效小节/);
    for (const patch of [{ note: NaN }, { note: 128 }, { offset: -1 }, { offset: Infinity }, { length: 0 }, { length: 10 }, { velocity: 1.1 }, { velocity: NaN }]) {
      const invalid = structuredClone(whenTheWindRises);
      Object.assign(invalid.emotionalPop![field]!.find(bar => bar.length)![0], patch);
      assert.throws(() => buildArrangement(invalid, { ...options, version: 'hook' }), new RegExp(field));
    }
  }
  const overlap = structuredClone(whenTheWindRises);
  overlap.emotionalPop!.response![0] = [{ ...overlap.hook[0][0] }];
  assert.throws(() => validateTrack(overlap), /应答必须位于主旋律留白/);
  const finalOverlap = structuredClone(whenTheWindRises);
  finalOverlap.emotionalPop!.finalHook![1].push({ ...finalOverlap.emotionalPop!.response![1][0] });
  assert.throws(() => validateTrack(finalOverlap), /应答必须位于主旋律留白/);
  const crossBar = structuredClone(whenTheWindRises);
  crossBar.hook[0].push({ offset: 3.9, note: 74, length: 0.6, velocity: 0.5 });
  assert.throws(() => validateTrack(crossBar), /小节内结束/);
  const unknownGroove = structuredClone(whenTheWindRises);
  unknownGroove.emotionalPop!.groove = 'unknown' as 'syncopated';
  assert.throws(() => validateTrack(unknownGroove), /律动必须为 syncopated/);
});

test('omitted development keeps every afterglow event and section identical to the previous release', () => {
  const expected = {
    full: 'fcfcd03d71abcc766cb1349a7302c2955c7a8916a899e7d11c9553a03c8b66a7',
    hook: '8e320205e9bfb9bd7a43173f61a86fcf10251b52463bd1872cfd853ccdbdafbd',
    loop: '8e320205e9bfb9bd7a43173f61a86fcf10251b52463bd1872cfd853ccdbdafbd',
  };
  for (const version of ['full', 'hook', 'loop'] as const) {
    const input: RenderOptions = { version, bpm: 118, transpose: 0, seed: 260713 };
    const score = buildArrangement(afterglow, input);
    assert.equal(createHash('sha256').update(JSON.stringify(score)).digest('hex'), expected[version]);
    assert.deepEqual(buildArrangement({ ...afterglow, emotionalPop: {} }, input), score);
  }
});
