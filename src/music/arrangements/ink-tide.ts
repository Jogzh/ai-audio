import { cropMixTracks, createInkTideMixTracks } from '../ink-tide-mix.ts';
import { createRandom } from '../random.ts';
import type { Arrangement, HookNote, RenderOptions, TrackDefinition } from '../types.ts';

function partSeed(seed: number, id: string): number {
  let hash = seed >>> 0;
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

/** One singer, one moving accompaniment, and slowly changing orchestral colour. */
export function buildInkTideArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const secondsPerBeat = 60 / options.bpm;
  const tracks = createInkTideMixTracks(track.arrangement);
  const parts = new Map(tracks.map(part => [part.id, part]));
  const touches = new Map(tracks.map(part => [part.id, createRandom(partSeed(options.seed, part.id))]));
  const resolution = track.harmony[track.resolveHarmony ?? 0];
  const add = (trackId: string, beat: number, duration: number, velocity: number, notes?: number[]) => {
    const part = parts.get(trackId)!;
    const touch = 0.975 + touches.get(trackId)!() * 0.05;
    events.push({ trackId, instrument: part.instrument, beat, duration, velocity: Math.min(0.99, velocity * touch), notes: notes?.map(note => note + options.transpose) });
  };
  const line = (trackId: string, beat: number, phrase: HookNote[], strength = 1) => {
    for (const note of phrase) add(trackId, beat + note.offset, note.length, note.velocity * strength, [note.note]);
  };
  const keyboard = (beat: number, chord: number[], sparse: boolean, strength: number, closing = false) => {
    // The left shell rings; the right hand has one regular quarter-note pulse.
    // Both belong to one part rather than several competing arpeggios.
    add('piano-harmony', beat, sparse ? 2.65 : 3.25, strength * 0.83, [chord[0], chord[2]]);
    const pitches = [chord[1], chord[2], chord[3], chord[2]];
    const offsets = sparse ? [0, 2] : closing ? [0, 1, 2] : [0, 1, 2, 3];
    for (const offset of offsets) add('piano-harmony', beat + offset, sparse ? 0.85 : 0.6,
      strength * (offset === 0 || offset === 2 ? 0.66 : 0.55), [pitches[offset]]);
  };
  const upperChord = (phrase: number, lifted: boolean) => lifted
    ? phrase < 2 ? [62, 66, 69] : phrase < 4 ? [59, 62, 69]
      : phrase < 6 ? [59, 62, 67] : [61, 64, 69]
    : phrase < 2 ? [57, 62, 66] : phrase < 4 ? [57, 59, 66]
      : phrase < 6 ? [55, 59, 66] : [57, 61, 64];
  const cello = (phrase: number) => [50, 50, 54, 54, 55, 55, 57, 57][phrase];
  let bar = 0;
  for (const section of track.arrangement) {
    sections.push({ name: section.name, start: bar * 4 * secondsPerBeat, end: (bar + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, bar++) {
      const beat = bar * 4;
      const intro = section.energy === 'tease', restrained = section.energy === 'groove';
      const bridge = section.energy === 'air', final = section.energy === 'final', outro = section.energy === 'outro';
      const developed = final && local >= 8;
      const phrase = local % track.hook.length;
      const lifted = developed;
      // The last eight bars rotate the progression forward: G -> A -> D -> Bm.
      // It keeps the same palette while making the return to D in the outro feel earned.
      const harmonyIndex = bridge ? (local + 4) % track.harmony.length
        : lifted ? (phrase + 4) % track.harmony.length : phrase % track.harmony.length;
      const harmony = intro || outro ? resolution : track.harmony[harmonyIndex];

      if (intro) {
        keyboard(beat, harmony.chord, true, 0.48);
        if (local === section.bars - 1) add('harp-turn', beat + 3, 0.7, 0.37, [74]);
        continue;
      }
      if (outro) {
        if (local === 0) {
          line('flute-theme', beat, [{ offset: 0, note: 74, length: 2.65, velocity: 0.6 }]);
          add('piano-harmony', beat, 3.5, 0.37, [50, 57, 66]);
          add('violin-bed', beat, Math.min(7.1, section.bars * 4 - 0.5), 0.39, [57, 62, 66]);
          add('cello-floor', beat, Math.min(7, section.bars * 4 - 0.5), 0.39, [50]);
        } else {
          add('piano-harmony', beat, 3.5, 0.28, [50, 57, 62]);
          add('harp-turn', beat + 1.5, 1.75, 0.29, [81]);
        }
        continue;
      }

      const theme = bridge ? track.inkTide?.bridgeHook ?? track.hook : developed ? track.inkTide?.finalHook ?? track.hook : track.hook;
      line('flute-theme', beat, theme[phrase], restrained ? 0.94 : 1);
      keyboard(beat, harmony.chord, bridge || restrained, bridge ? 0.35 : restrained ? 0.4 : developed ? 0.49 : 0.45, phrase === 7);

      if (bridge) {
        if (local % 2 === 0) add('violin-bed', beat, Math.min(7.25, (section.bars - local) * 4 - 0.5), 0.39,
          local < 2 ? [55, 59, 66] : [57, 61, 64]);
        if (local === section.bars - 1) {
          for (const [index, note] of [74, 76, 78].entries()) add('harp-turn', beat + 2.5 + index * 0.5, 0.4, 0.36 + index * 0.015, [note]);
        }
        continue;
      }

      // Harmony expands at a phrase boundary, not by adding independent tunes.
      const stringsPresent = final || restrained || local >= 4;
      if (stringsPresent && phrase % 2 === 0) {
        const length = Math.min(7.3, (section.bars - local) * 4 - 0.5);
        add('violin-bed', beat, length, developed ? 0.57 : final ? 0.44 : 0.4, upperChord(harmonyIndex, lifted));
        add('cello-floor', beat, length - 0.15, developed ? 0.52 : 0.4, [cello(harmonyIndex)]);
      }
      if (phrase === 7) line('piano-upper', beat, (lifted
        ? track.inkTide?.finalResponse ?? track.inkTide?.response
        : track.inkTide?.response)?.[phrase] ?? []);

      // Two high, late answers let the lifted flute phrase land before the next
      // bar. They remain in the lead's rests, so the climax gains colour without
      // creating another continuous melody.
      if (lifted && (local === 9 || local === 13)) {
        add('harp-turn', beat + 3.75, 0.15, 0.58, [local === 9 ? 71 : 78]);
      }

      // Stable rhythm: bass and kick on 1/3, brush on 2/4. The last chorus
      // gains a gentle eighth-note layer rather than a busier drum pattern.
      const pulse = restrained ? 0.84 : developed ? 1.08 : 0.93;
      add('round-bass', beat, 1.75, 0.55 * pulse, [harmony.root]);
      add('round-bass', beat + 2, 1.6, 0.43 * pulse, [harmony.root]);
      add('soft-kick', beat, 0.32, 0.5 * pulse);
      add('soft-kick', beat + 2, 0.3, 0.43 * pulse);
      add('brush-snare', beat + 1, 0.3, 0.29 * pulse);
      add('brush-snare', beat + 3, 0.34, 0.34 * pulse);
      if (developed) for (const [index, offset] of [0.5, 1.5, 2.5, 3.5].entries()) {
        add('woven-shaker', beat + offset, 0.16, index % 2 ? 0.18 : 0.14);
      }
      if (final && (local === 7 || local === section.bars - 1)) {
        add('tom-fill', beat + 3.5, 0.28, local === 7 ? 0.34 : 0.28, [local === 7 ? 50 : 45]);
      }
      if (final && local === 0) add('cymbal-air', beat, 2.75, 0.27);
    }
  }
  const beats = bar * 4;
  events.sort((a, b) => a.beat - b.beat || a.trackId!.localeCompare(b.trackId!));
  if (options.version === 'full') return { tracks, events, beats, sections };
  const edit = track.edits![options.version];
  const start = edit.startBar * 4, end = start + edit.bars * 4;
  return {
    tracks: cropMixTracks(tracks, start, end),
    events: events.filter(event => event.beat >= start && event.beat < end).map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) })),
    beats: end - start,
    sections: sections.filter(section => section.end > start * secondsPerBeat && section.start < end * secondsPerBeat).map(section => ({ name: section.name,
      start: Math.max(0, section.start - start * secondsPerBeat), end: Math.min((end - start) * secondsPerBeat, section.end - start * secondsPerBeat) })),
  };
}
