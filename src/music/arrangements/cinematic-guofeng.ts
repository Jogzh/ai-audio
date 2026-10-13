import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

/** Written pentatonic voices, two-bar harmony and a restrained pop/orchestral rhythm. */
export function buildCinematicGuofengArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const secondsPerBeat = 60 / options.bpm;
  const resolution = track.harmony[track.resolveHarmony ?? 0];
  const development = track.cinematicGuofeng;
  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[], touch = false) => {
    const timing = touch ? random() * 0.014 : 0;
    const strength = touch ? 0.95 + random() * 0.08 : 1;
    events.push({ instrument, beat: beat + timing, duration, velocity: Math.min(1, velocity * strength), notes: notes?.map(note => note + options.transpose) });
  };
  let bar = 0;

  for (const section of track.arrangement) {
    sections.push({ name: section.name, start: bar * 4 * secondsPerBeat, end: (bar + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, bar++) {
      const beat = bar * 4;
      const intro = section.energy === 'tease';
      const groove = section.energy === 'groove';
      const build = section.energy === 'build';
      const bridge = section.energy === 'air';
      const final = section.energy === 'final';
      const chorus = section.energy === 'drop' || final;
      const outro = section.energy === 'outro';
      const last = local === section.bars - 1;
      const developed = final && local >= 8;
      const phrase = local % track.hook.length;
      const theme = bridge && development?.bridgeHook
        ? development.bridgeHook
        : developed && development?.finalHook ? development.finalHook : track.hook;
      const harmony = outro ? resolution : build
        ? track.harmony[(local < 2 ? 2 : 6) % track.harmony.length]
        : track.harmony[local % track.harmony.length];
      const fade = outro ? 1 - local / (section.bars + 0.5) : 1;

      // The introduction quotes the motif on strings; the verse sings it an octave lower.
      if (intro) {
        for (const [index, note] of track.hook[phrase].entries()) {
          if (index > 1) continue;
          add('guzheng', beat + index * 1.5, 1.2, note.velocity * 0.64, [note.note - 12]);
        }
        if (local === 2) add('dizi', beat + 1, 2.6, 0.46, [resolution.root + 36]);
      } else if (build) {
        const climb = [36, 39, 41, 43];
        add('dizi', beat, last ? 1.3 : 2.9, 0.59 + local * 0.055, [resolution.root + climb[local % 4]]);
        if (last) {
          add('dizi', beat + 1.5, 0.75, 0.72, [resolution.root + 46]);
          add('dizi', beat + 2.5, 0.65, 0.66, [resolution.root + 43]);
        }
      } else if (outro) {
        if (local === 0) add('dizi', beat, 2.6, 0.48, [resolution.root + 36]);
        if (local === 1) add('erhu', beat + 1, 2.1, 0.43, [resolution.root + 24]);
        if (last) add('guzheng', beat, 3.65, 0.58, [resolution.root + 24]);
      } else {
        const voice: Instrument = bridge || groove ? 'erhu' : 'dizi';
        for (const [index, note] of theme[phrase].entries()) {
          // Thin the low verse into an outline; the complete turns arrive in the chorus.
          if (groove && ((local % 2 === 0 && index === 1) || (local % 2 === 1 && note.offset >= 3))) continue;
          const octave = groove ? -12 : 0;
          // The erhu's low phrase resolves to its open D rather than reaching below it.
          const pitch = groove ? Math.max(resolution.root + 24, note.note + octave) : note.note;
          add(voice, beat + note.offset, note.length, note.velocity * (bridge ? 0.79 : groove ? 0.73 : developed ? 0.97 : 0.9), [pitch]);
          // Only the long summit notes gain an orchestral octave; leave the small turns clear.
          if (developed && note.length > 1 && note.note >= 81) {
            add('strings', beat + note.offset, note.length, 0.28, [note.note - 12]);
          }
        }
        if (groove && local % 4 === 3) {
          add('dizi', beat + 3.125, 0.65, 0.48, [theme[phrase][theme[phrase].length - 1].note]);
        }
      }

      if (local % 2 === 0) {
        const duration = Math.min(7.75, (section.bars - local) * 4 - 0.1);
        add('pad', beat, duration, (intro ? 0.14 : bridge ? 0.18 : chorus ? 0.22 : 0.16) * fade, harmony.chord);
        add('strings', beat, duration, (intro ? 0.17 : bridge ? 0.2 : chorus ? developed ? 0.43 : 0.36 : build ? 0.28 : 0.22) * fade, harmony.chord);
        if (chorus) add('brass', beat + 0.08, 2.65, developed ? 0.31 : 0.24, [harmony.root + 24, harmony.root + 31]);
      }

      // Quiet alternating plucks, with one rapid roll at each orchestral entrance.
      const plucks = outro ? last ? [] : [0.75, 2.5]
        : bridge ? [0.5, 3] : build ? [0, 0.5, 1, 1.5, 2, 2.5, 3]
        : intro ? [0.5, 2.5, 3.25] : local % 2 === 0 ? [0.5, 1.5, 2.75] : [0.25, 1.75, 3.25];
      for (const [index, offset] of plucks.entries()) {
        add('guzheng', beat + offset, bridge ? 1.1 : 0.65, (intro ? 0.22 : bridge ? 0.24 : build ? 0.22 + local * 0.02 : 0.18) * fade, [harmony.chord[(index + local) % harmony.chord.length] + 12], true);
      }
      if (chorus && local === 0) {
        for (const [index, note] of harmony.chord.entries()) add('guzheng', beat + index * 0.075, 0.8, 0.3, [note + 12]);
      }
      if ((intro || bridge) && local % 2 === 0) add('granular', beat + 0.25, 3.4, bridge ? 0.22 : 0.18, [harmony.root + 36]);
      if (chorus && local % 4 === 2) add('granular', beat + 2.5, 1.1, 0.15, [harmony.root + 36]);

      if (groove || chorus || build) {
        const space = last;
        const orchestralDownbeat = chorus && local % 4 === 0;
        const kicks = build ? local < 2 ? [0] : [0, 2]
          : chorus ? local % 2 === 0 ? [0, 1.75, 2.5] : [0, 2.25]
          : local % 2 === 0 ? [0, 2.5] : [0, 1.75];
        for (const offset of kicks) {
          if (orchestralDownbeat && offset === 0) continue;
          add('kick', beat + offset, 0.42, chorus ? 0.79 : build ? 0.65 : 0.65);
        }
        if (!build) {
          for (const offset of [1, 3]) {
            if (space && offset === 3) continue;
            add('clap', beat + offset, 0.24, chorus ? 0.57 : 0.43);
          }
          for (const offset of [0.5, 1.5, 2.5, 3.5]) {
            if ((space && offset > 2.5) || (groove && offset === 1.5)) continue;
            add('hat', beat + offset, 0.12, chorus ? 0.2 : 0.15, undefined, true);
          }
          if (developed && local % 2 === 1 && !space) add('openHat', beat + 3.5, 0.32, 0.16);
        }
        if (chorus) {
          if (orchestralDownbeat) add('taiko', beat, 0.92, developed ? 0.79 : 0.7, [resolution.root]);
          if (local % 2 === 0) add('taiko', beat + 2, 0.74, 0.52, [resolution.root + 7]);
          if (local % 4 === 3 && !last) {
            add('taiko', beat + 2.75, 0.48, 0.43, [resolution.root + 7]);
            add('perc', beat + 3.25, 0.18, 0.29, undefined, true);
          }
        } else if (build) {
          const roll = local < 2 ? [2] : last ? [1, 1.5, 2, 2.5] : [1, 2, 3];
          for (const offset of roll) add('taiko', beat + offset, 0.45, 0.29 + local * 0.055, [resolution.root + 7], true);
        }

        const bassNotes = build ? [0.5] : chorus ? [0.5, 1.75, 3.25] : [0.5, 2.75];
        for (const [index, offset] of bassNotes.entries()) {
          if (space && offset > 3) continue;
          add('bass', beat + offset, index === 0 ? 0.88 : 0.55, chorus ? 0.63 : 0.46, [harmony.root]);
          if (index === 0) add('sub', beat + offset, 1.05, chorus ? 0.35 : 0.23, [harmony.root - 12]);
        }
      }

      // Gongs mark form, not every bar. End each transition with a real breath.
      if (local === 0 && (intro || chorus || outro)) {
        add('gong', beat, intro ? 3.5 : 3.8, outro ? 0.16 : intro ? 0.19 : final ? 0.45 : 0.36, [resolution.root + 24]);
      }
      if (last && (build || bridge)) add('sweep', beat + 3, 0.8, build ? 0.24 : 0.15);
    }
  }

  const beats = bar * 4;
  events.sort((a, b) => a.beat - b.beat);
  if (options.version === 'full') return { events, beats, sections };

  // Each short version is the actual first chorus, including its chord and gong attack.
  const edit = track.edits![options.version];
  const start = edit.startBar * 4;
  const end = start + edit.bars * 4;
  const cropped = events.filter(event => event.beat >= start && event.beat < end).map(event => ({
    ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat),
  }));
  return {
    events: cropped, beats: end - start,
    sections: sections.filter(section => section.end > start * secondsPerBeat && section.start < end * secondsPerBeat).map(section => ({
      name: section.name,
      start: Math.max(0, section.start - start * secondsPerBeat),
      end: Math.min((end - start) * secondsPerBeat, section.end - start * secondsPerBeat),
    })),
  };
}
