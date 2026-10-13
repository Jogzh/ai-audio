import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

/** Sustained harmony and eight-bar phrases, rather than applying the garage template to every song. */
export function buildWarmArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const selected = options.version === 'full' ? track.arrangement : [{ name: `HOOK / ${track.meta.title}`, bars: 8, energy: 'drop' as const }];
  const secondsPerBeat = 60 / options.bpm;
  let barIndex = 0;
  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[]) => {
    events.push({ instrument, beat, duration, velocity, notes: notes?.map(note => note + options.transpose) });
  };
  for (const section of selected) {
    sections.push({ name: section.name, start: barIndex * 4 * secondsPerBeat, end: (barIndex + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, barIndex++) {
      const beat = barIndex * 4;
      const intro = section.energy === 'tease';
      const air = section.energy === 'air';
      const outro = section.energy === 'outro';
      const final = section.energy === 'final';
      const heavy = section.energy === 'drop' || final;
      const ending = options.version === 'full' && outro && local === section.bars - 1;
      const harmony = track.harmony[ending ? 0 : barIndex % track.harmony.length];
      const fade = outro ? Math.max(0.22, 1 - local / section.bars) : 1;
      const melodyOn = heavy || (intro && local < 4) || (section.energy === 'groove' && local >= 4) || (air && local >= 4) || (outro && local < 4);

      if (melodyOn) {
        for (const note of track.hook[barIndex % track.hook.length]) {
          // The bridge recalls the theme one octave down; the chorus answers at its original height.
          add('lead', beat + note.offset, note.length, note.velocity * (air ? 0.5 : intro ? 0.76 : outro ? fade * 0.65 : 1), [note.note - (air ? 12 : 0)]);
        }
      }
      // Stagger chord tones by only a few milliseconds, like fingers on electric keys.
      for (const [index, note] of harmony.chord.entries()) {
        add('chord', beat + index * 0.018, air ? 3.5 : 2.4, (air ? 0.44 : intro ? 0.58 : 0.66) * fade, [note]);
        if (heavy || section.energy === 'groove') add('chord', beat + 2.75 + index * 0.018, 0.85, 0.28 * fade, [note]);
      }
      if (!intro || local >= 4) add('pad', beat, 3.85, (air ? 0.55 : 0.36) * fade, harmony.chord);
      // A quiet answering line appears only in the last chorus, not over every melody note.
      if (final && local % 2 === 1) {
        add('spark', beat + 3.25, 0.24, 0.38, [harmony.chord.at(-1)! + 12]);
        add('spark', beat + 3.75, 0.2, 0.27, [harmony.chord[2] + 12]);
      }
      if (air && local < 4) {
        for (const [index, offset] of [0.5, 1.75, 3].entries()) add('spark', beat + offset, 0.7, 0.35, [harmony.chord[index + 1] + 12]);
      }

      const drumsOn = (!intro || local >= 4) && (!air || local >= 6) && (!outro || local < 6);
      if (drumsOn) {
        const reduced = intro || air || outro;
        const transition = local === section.bars - 1 && !outro && options.version === 'full';
        for (const offset of reduced ? [0, 2] : [0, 1, 2, 3]) {
          if (transition && offset === 3) continue;
          add('kick', beat + offset, 0.4, (offset === 0 ? 0.84 : 0.72) * fade);
        }
        if (!intro) {
          for (const offset of [1.025, 3.025]) {
            if (transition && offset > 3) continue;
            add('clap', beat + offset, 0.34, (heavy ? 0.63 : 0.48) * fade);
          }
        }
        for (let step = 0; step < 8; step++) {
          if (reduced && step % 2 === 0 || transition && step >= 6) continue;
          const offbeat = step % 2 === 1;
          // Only hats lean behind the grid; the sung phrase and bass retain their written rhythm.
          add('hat', beat + step * 0.5 + (offbeat ? 0.035 : 0), 0.11, ((offbeat ? 0.36 : 0.16) + random() * 0.055) * fade);
        }
        if (heavy && local % 2 === 1 && !transition) add('openHat', beat + 2.53, 0.35, 0.23);
        if (heavy && local % 2 === 0) add('perc', beat + 3.28, 0.16, 0.19 + random() * 0.045);
        if (transition && heavy) {
          add('perc', beat + 3.25, 0.16, 0.28);
          add('perc', beat + 3.75, 0.16, 0.2);
        }
      }
      const bassOn = (!intro || local >= 4) && (!air || local >= 6) && (!outro || local < 6);
      if (bassOn) {
        const pattern = heavy || section.energy === 'groove' ? [{ at: 0, length: 1.35 }, { at: 1.75, length: 0.45 }, { at: 2.5, length: 1.2 }] : [{ at: 0, length: 2.8 }];
        for (const note of pattern) {
          add('bass', beat + note.at, note.length, 0.72 * fade, [harmony.root + 12]);
          add('sub', beat + note.at, note.length, 0.42 * fade, [harmony.root]);
        }
      }
      if (ending) add('lead', beat, 2.8, 0.34, [track.harmony[0].root + 36]);
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return { events, beats: barIndex * 4, sections };
}
