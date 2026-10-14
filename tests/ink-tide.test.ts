import assert from 'node:assert/strict';
import test from 'node:test';
import { buildArrangement, validateTrack } from '../src/music/arrange.ts';
import { inkTide } from '../src/tracks/ink-tide.ts';
import { selectedTrackIds, validateMixer } from '../src/music/mixer.ts';
import { automationValue, cropMixTracks } from '../src/music/ink-tide-mix.ts';
import type { MixTrack, RenderOptions } from '../src/music/types.ts';

const options: RenderOptions = { version: 'full', bpm: 92, transpose: 0, seed: 261014 };

test('Ink Tide edits preserve the written full score and have safe event boundaries', () => {
  const full = buildArrangement(inkTide, options);
  assert.equal(full.beats, 160);
  assert.ok(full.events.some(event => event.beat === 0));
  for (const version of ['hook', 'loop'] as const) {
    const score = buildArrangement(inkTide, { ...options, version });
    const edit = inkTide.edits![version];
    const start = edit.startBar * 4, end = start + edit.bars * 4;
    assert.equal(score.beats, 32);
    assert.deepEqual(score.events, full.events.filter(event => event.beat >= start && event.beat < end)
      .map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) })));
    assert.deepEqual(score.tracks, cropMixTracks(full.tracks!, start, end));
    for (const track of score.tracks!) {
      assert.equal(track.automation![0].beat, 0);
      assert.equal(track.automation!.at(-1)!.beat, score.beats);
      const original = full.tracks!.find(part => part.id === track.id)!;
      assert.equal(track.automation![0].gain, automationValue(original.automation!, start));
      assert.equal(track.automation!.at(-1)!.gain, automationValue(original.automation!, end));
    }
  }
  for (const [index, event] of full.events.entries()) {
    assert.ok(event.beat >= 0 && event.duration > 0 && event.beat + event.duration <= full.beats + 1e-9);
    assert.ok(event.velocity > 0 && event.velocity <= 1);
    assert.ok(event.notes?.every(note => Number.isInteger(note) && note >= 0 && note <= 127) ?? true);
    if (index) assert.ok(event.beat >= full.events[index - 1].beat);
  }
});

test('the written flute is a single melodic foreground and the piano replies occupy its rests', () => {
  const score = buildArrangement(inkTide, options);
  assert.deepEqual(score.tracks!.filter(track => track.role === 'foreground').map(track => track.id), ['flute-theme']);
  const foreground = score.events.filter(event => event.trackId === 'flute-theme');
  assert.ok(foreground.length > 0);
  assert.ok(foreground.every(event => event.notes?.length === 1));
  for (let index = 1; index < foreground.length; index++) {
    assert.ok(foreground[index].beat >= foreground[index - 1].beat + foreground[index - 1].duration - 1e-9,
      'the lead must remain monophonic');
  }
  const airIndex = inkTide.arrangement.findIndex(section => section.energy === 'air');
  assert.ok(airIndex >= 0);
  const section = score.sections[airIndex];
  const bridge = score.events.filter(event => event.beat * 60 / options.bpm >= section.start && event.beat * 60 / options.bpm < section.end - 1e-9);
  assert.ok(bridge.length > 0);
  assert.ok(!bridge.some(event => ['kick', 'perc', 'hat', 'shaker', 'bass', 'tom', 'cymbal'].includes(event.instrument)));
  const dMajor = new Set([2, 4, 6, 7, 9, 11, 1]);
  assert.ok(foreground.every(event => event.notes!.every(note => dMajor.has(note % 12))));
  assert.ok(inkTide.hook.flat().some(note => note.length >= 1.75), 'the theme must retain written sustained notes');
  for (const reply of score.events.filter(event => event.trackId === 'piano-upper' || event.trackId === 'harp-turn')) {
    assert.ok(!foreground.some(note => reply.beat < note.beat + note.duration && reply.beat + reply.duration > note.beat),
      `${reply.trackId} must fit the lead rests`);
  }
});

test('the two-bar theme returns intact at the chorus and final entrances', () => {
  const score = buildArrangement(inkTide, options);
  const motif = inkTide.hook.slice(0, 2).flatMap((bar, index) => bar.map(note => ({
    beat: index * 4 + note.offset, duration: note.length, notes: [note.note],
  })));
  assert.ok(motif.length > 0);
  for (const energy of ['drop', 'final'] as const) {
    const index = inkTide.arrangement.findIndex(section => section.energy === energy);
    const startBeat = inkTide.arrangement.slice(0, index).reduce((sum, section) => sum + section.bars * 4, 0);
    const written = score.events.filter(event => event.trackId === 'flute-theme' && event.beat >= startBeat - 1e-9 && event.beat < startBeat + 8 - 1e-9)
      .map(event => ({ beat: event.beat - startBeat, duration: event.duration, notes: event.notes }));
    assert.deepEqual(written, motif);
  }
});

test('the accompaniment supports written harmony while decoration and rhythm enter by section', () => {
  const score = buildArrangement(inkTide, options);
  validateMixer(score);
  assert.equal(score.tracks!.length, 12);
  const tracks = new Map(score.tracks!.map(track => [track.id, track]));
  assert.equal(tracks.size, 12);
  const instruments = new Set(['flute', 'piano', 'harp', 'strings', 'cello', 'bass', 'kick', 'perc', 'shaker', 'tom', 'cymbal']);
  assert.deepEqual(new Set(score.tracks!.map(track => track.instrument)), instruments);
  assert.deepEqual(new Set(score.events.map(event => event.instrument)), instruments);
  for (const event of score.events) assert.equal(event.instrument, tracks.get(event.trackId!)?.instrument);
  const layerCounts = score.sections.map(section => new Set(score.events.filter(event => event.beat * 60 / options.bpm >= section.start && event.beat * 60 / options.bpm < section.end).map(event => event.trackId)).size);
  const index = (energy: string) => inkTide.arrangement.findIndex(section => section.energy === energy);
  assert.ok(layerCounts[index('tease')] < layerCounts[index('drop')]);
  assert.ok(layerCounts[index('air')] < layerCounts[index('groove')]);
  assert.ok(layerCounts[index('outro')] < layerCounts[index('final')]);
  assert.equal(tracks.get('flute-theme')!.mix.pan, 0, 'the melodic foreground remains centred');
  assert.ok(tracks.get('piano-harmony')!.mix.pan < 0 && tracks.get('violin-bed')!.mix.pan < 0,
    'the keyboard and sustained strings sit to the left of the foreground');
  assert.ok(tracks.get('cello-floor')!.mix.pan > 0 && tracks.get('harp-turn')!.mix.pan > 0,
    'the cello and sparse transition gestures provide the right-side balance');
  assert.ok(score.tracks!.filter(track => track.role === 'bass' || track.instrument === 'kick').every(track => track.mix.pan === 0));
  const hook = buildArrangement(inkTide, { ...options, version: 'hook' });
  assert.ok(new Set(hook.events.map(event => event.trackId)).size < tracks.size,
    'the hook retains intentional track rests; late accents need not play in every edit');
  for (const event of hook.events.filter(event => event.trackId === 'piano-harmony' || event.trackId === 'violin-bed')) {
    const harmony = inkTide.harmony[Math.floor(event.beat / 4) % inkTide.harmony.length];
    const pitches = new Set(harmony.chord.map(note => note % 12));
    assert.ok(event.notes!.every(note => pitches.has(note % 12)), `${event.trackId} must support the current written chord`);
  }
  const liftStart = inkTide.arrangement.slice(0, index('final')).reduce((sum, section) => sum + section.bars * 4, 0) + 32;
  for (const event of score.events.filter(event => event.beat >= liftStart && event.beat < liftStart + 32)) {
    const phrase = Math.floor((event.beat - liftStart) / 4);
    const harmony = inkTide.harmony[(phrase + 4) % inkTide.harmony.length];
    if (event.trackId === 'piano-harmony' || event.trackId === 'violin-bed' || event.trackId === 'cello-floor') {
      const pitches = new Set(harmony.chord.map(note => note % 12));
      assert.ok(event.notes!.every(note => pitches.has(note % 12)), `${event.trackId} must follow the changed climax harmony`);
    }
    if (event.trackId === 'round-bass') assert.deepEqual(event.notes, [harmony.root]);
  }
  const tomBars = new Set(hook.events.filter(event => event.instrument === 'tom').map(event => Math.floor(event.beat / 4)));
  assert.ok(tomBars.size < inkTide.edits!.hook.bars / 2, 'transition fills must not run through every bar');
  const finalSection = score.sections[index('final')];
  const finalStart = inkTide.arrangement.slice(0, index('final')).reduce((sum, section) => sum + section.bars * 4, 0);
  const shaker = score.events.filter(event => event.trackId === 'woven-shaker');
  assert.ok(shaker.length > 0 && shaker.every(event => event.beat >= finalStart + 32 && event.beat * 60 / options.bpm < finalSection.end),
    'the shaker is reserved for the last chorus lift');
  const cymbal = score.events.filter(event => event.trackId === 'cymbal-air');
  assert.ok(cymbal.length > 0 && cymbal.every(event => Math.abs(event.beat - finalStart) < 1e-9),
    'the cymbal marks the final entrance, rather than restarting throughout the score');
  assert.notDeepEqual(inkTide.inkTide!.finalHook, inkTide.hook);
});

test('track automation follows changed section lengths instead of fixed release beat numbers', () => {
  const changed = structuredClone(inkTide);
  const lengths = [3, 5, 3, 2, 9, 1];
  changed.arrangement.forEach((section, index) => section.bars = lengths[index]);
  const score = buildArrangement(changed, options);
  assert.equal(score.beats, lengths.reduce((sum, bars) => sum + bars * 4, 0));
  validateMixer(score);
  for (const part of score.tracks!) {
    assert.equal(part.automation![0].beat, 0);
    assert.equal(part.automation!.at(-1)!.beat, score.beats);
    assert.ok(part.automation!.every(point => point.beat >= 0 && point.beat <= score.beats));
  }
  assert.notDeepEqual(score.tracks!.map(part => part.automation), buildArrangement(inkTide, options).tracks!.map(part => part.automation));
});

test('editing inside a gain ramp preserves its interpolated levels and leaves the source intact', () => {
  const tracks: MixTrack[] = [{ id: 'ramp', name: '渐入', role: 'texture', instrument: 'pad',
    mix: { gain: 0.4, pan: 0.2, highpass: 600, lowpass: 2900, reverb: 0.2, delay: 0 },
    automation: [{ beat: 0, gain: 0 }, { beat: 10, gain: 1 }, { beat: 20, gain: 0 }],
  }];
  const before = structuredClone(tracks);
  const cropped = cropMixTracks(tracks, 4, 16);
  assert.deepEqual(cropped[0].automation, [{ beat: 0, gain: 0.4 }, { beat: 6, gain: 1 }, { beat: 12, gain: 0.4 }]);
  for (const beat of [0, 2, 6, 9, 12]) assert.ok(Math.abs(automationValue(cropped[0].automation!, beat) - automationValue(tracks[0].automation!, beat + 4)) < 1e-9);
  cropped[0].mix.gain = 0.1;
  assert.deepEqual(tracks, before);
});

test('malformed routing, mix settings and automation are rejected before creating audio nodes', () => {
  const score = buildArrangement(inkTide, options);
  const duplicate = structuredClone(score);
  duplicate.tracks![1].id = duplicate.tracks![0].id;
  assert.throws(() => validateMixer(duplicate), /ID 必须唯一/);
  for (const value of [undefined, 'not-a-track']) {
    const broken = structuredClone(score);
    broken.events[0].trackId = value;
    assert.throws(() => validateMixer(broken), /未连接匹配/);
  }
  const wrongPatch = structuredClone(score);
  wrongPatch.events[0].instrument = 'gong';
  assert.throws(() => validateMixer(wrongPatch), /未连接匹配/);
  const pan = structuredClone(score);
  pan.tracks![0].mix.pan = 1.1;
  assert.throws(() => validateMixer(pan), /混音参数无效/);
  for (const points of [
    [{ beat: 8, gain: 1 }, { beat: 8, gain: 0.5 }],
    [{ beat: 9, gain: 1 }, { beat: 8, gain: 0.5 }],
    [{ beat: score.beats + 1, gain: 1 }],
    [{ beat: 0, gain: NaN }],
  ]) {
    const broken = structuredClone(score);
    broken.tracks![0].automation = points;
    assert.throws(() => validateMixer(broken), /自动化无效/);
  }
});

test('selection rejects unknown and duplicate IDs, and mute takes precedence over solo', () => {
  const score = buildArrangement(inkTide, options);
  assert.equal(selectedTrackIds(score, {}), undefined);
  assert.deepEqual(selectedTrackIds(score, { soloTrackIds: ['flute-theme', 'round-bass'], muteTrackIds: ['round-bass'] }), new Set(['flute-theme']));
  assert.deepEqual(selectedTrackIds(score, { muteTrackIds: score.tracks!.map(track => track.id) }), new Set());
  for (const selection of [
    { soloTrackIds: ['missing'] }, { muteTrackIds: ['missing'] },
    { soloTrackIds: ['flute-theme', 'flute-theme'] }, { muteTrackIds: ['round-bass', 'round-bass'] },
  ]) assert.throws(() => selectedTrackIds(score, selection), /已存在且不重复/);
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

test('a developed cadence can use its own rests while the first theme retains its reply', () => {
  assert.doesNotThrow(() => validateTrack(inkTide));
  const fallback = structuredClone(inkTide);
  delete fallback.inkTide!.finalResponse;
  assert.throws(() => validateTrack(fallback), /应答必须位于主旋律留白/);
  const collision = structuredClone(inkTide);
  collision.inkTide!.finalResponse![0] = [{ offset: 0, note: 57, length: 0.3, velocity: 0.4 }];
  assert.throws(() => validateTrack(collision), /应答必须位于主旋律留白/);
  const missingTheme = structuredClone(inkTide);
  delete missingTheme.inkTide!.finalHook;
  assert.throws(() => validateTrack(missingTheme), /finalResponse 需要最终旋律/);
  const mismatch = structuredClone(inkTide);
  mismatch.inkTide!.finalResponse!.pop();
  assert.throws(() => validateTrack(mismatch), /小节数必须与 Hook/);
});
