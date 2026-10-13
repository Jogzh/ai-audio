import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

/** Light DJ groove: straight kick, syncopated real bass, small percussion and alternating melodic layers. */
export function buildDiscoArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const selected = options.version === 'full' ? track.arrangement : [{ name: `HOOK / ${track.meta.title}`, bars: 8, energy: 'drop' as const }];
  const secondsPerBeat = 60 / options.bpm;
  const grooveIntensity = track.grooveIntensity ?? 1;
  const rhythmVoices = new Set<Instrument>(['kick', 'clap', 'hat', 'openHat', 'shaker', 'rim', 'conga', 'electricBass', 'sub', 'organ']);
  let barIndex = 0;
  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[]) => {
    events.push({ instrument, beat, duration, velocity: velocity * (rhythmVoices.has(instrument) ? grooveIntensity : 1), notes: notes?.map(note => note + options.transpose) });
  };
  for (const section of selected) {
    sections.push({ name: section.name, start: barIndex * 4 * secondsPerBeat, end: (barIndex + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, barIndex++) {
      const beat = barIndex * 4;
      const intro = section.energy === 'tease';
      const air = section.energy === 'air';
      const outro = section.energy === 'outro';
      const final = section.energy === 'final';
      const chorus = section.energy === 'drop' || final;
      const ending = options.version === 'full' && outro && local === section.bars - 1;
      const harmony = track.harmony[ending ? 0 : barIndex % track.harmony.length];
      const fade = outro ? Math.max(0.16, 1 - local / section.bars) : 1;
      const melodic = chorus || (intro && local < 4) || (section.energy === 'groove' && local >= 4) || (air && local >= 4) || (outro && local < 4);
      if (melodic) {
        for (const note of track.hook[barIndex % track.hook.length]) {
          add('guitar', beat + note.offset, note.length, note.velocity * (air ? 0.68 : intro ? 0.8 : outro ? fade * 0.75 : 1), [note.note - (air ? 12 : 0)]);
        }
      }
      // Long electric keys anchor harmony; clipped organ chords provide a different rhythmic texture.
      if (barIndex % 2 === 0 || ending) {
        for (const [index, note] of harmony.chord.entries()) add('chord', beat + index * 0.014, air ? 5.8 : 4.7, (air ? 0.6 : 0.44) * fade, [note]);
        if (air || chorus) add('pad', beat, 7.7, (air ? 0.44 : 0.24) * fade, harmony.chord);
      }
      if (!air && (!intro || local >= 4) && (!outro || local < 6)) {
        for (const offset of [0.5, 2.5, ...(local % 2 === 1 ? [3.25] : [])]) {
          add('organ', beat + offset + 0.025, offset === 3.25 ? 0.2 : 0.36, (chorus ? 0.58 : 0.45) * fade, harmony.chord.map(note => note + 12));
        }
      }
      if ((final && local >= 8 && local % 2 === 1) || (air && local < 4)) {
        for (const [index, offset] of (air ? [0.5, 1.75, 3] : [3.25, 3.75]).entries()) {
          add('pluck', beat + offset, air ? 0.7 : 0.25, air ? 0.48 : 0.37, [harmony.chord[index + 1] + 24]);
        }
      }

      const drums = (!air || local >= 6) && (!outro || local < 6);
      if (drums) {
        const sparse = intro && local < 4 || air || outro;
        const transition = options.version === 'full' && local === section.bars - 1 && !outro;
        for (const offset of sparse ? [0, 2] : [0, 1, 2, 3]) {
          if (transition && offset === 3) continue;
          add('kick', beat + offset, 0.42, (offset === 0 ? 0.88 : 0.8) * fade);
        }
        if (!intro || local >= 4) {
          for (const offset of [1.018, 3.018]) {
            if (transition && offset > 3) continue;
            add('clap', beat + offset, 0.3, (chorus ? 0.65 : 0.49) * fade);
          }
        }
        for (const offset of [0.5, 1.5, 2.5, 3.5]) {
          if (transition && offset >= 3 || sparse && offset === 3.5) continue;
          if (chorus && offset === 2.5) add('openHat', beat + offset + 0.028, 0.35, 0.29 * fade);
          else add('hat', beat + offset + 0.028, 0.12, (0.4 + random() * 0.045) * fade);
        }
        if (!sparse) {
          for (let step = 0; step < 16; step++) {
            if (step % 4 === 0 || transition && step >= 12) continue;
            add('shaker', beat + step * 0.25 + (step % 2 ? 0.032 : 0.01), 0.105, ((step % 2 ? 0.21 : 0.36) + random() * 0.07) * fade);
          }
          if (local % 2 === 0) add('rim', beat + 2.77, 0.18, 0.36 * fade);
          if (chorus || section.energy === 'groove') {
            for (const offset of local % 2 === 0 ? [1.75, 3.25] : [0.75, 2.75, 3.5]) {
              if (transition && offset > 3) continue;
              add('conga', beat + offset + 0.016, 0.55, (offset > 3 ? 0.3 : 0.44) * fade);
            }
          }
          if (transition) {
            add('rim', beat + 3.25, 0.18, 0.4);
            add('conga', beat + 3.75, 0.5, 0.32);
          }
        }
      }
      const bassOn = (!intro || local >= 2) && (!air || local >= 6) && (!outro || local < 6);
      if (bassOn) {
        const bassPattern = intro && local < 4 || air || outro
          ? [{ at: 0.5, length: 1.15, interval: 12 }, { at: 2.5, length: 0.85, interval: 12 }]
          : [{ at: 0.5, length: 0.62, interval: 12 }, { at: 1.25, length: 0.26, interval: 12 }, { at: 1.75, length: 0.38, interval: 19 }, { at: 2.5, length: 0.6, interval: 12 }, { at: 3.25, length: 0.45, interval: 12 }];
        for (const [index, note] of bassPattern.entries()) {
          add('electricBass', beat + note.at, note.length, (index === 0 ? 0.82 : 0.65) * fade, [harmony.root + note.interval]);
          if (note.interval === 12 && (index === 0 || note.at === 2.5)) add('sub', beat + note.at, note.length, 0.29 * fade, [harmony.root]);
        }
      }
      if (ending) add('guitar', beat, 2.6, 0.45, [track.harmony[0].root + 36]);
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return { events, beats: barIndex * 4, sections };
}
