import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

export function buildGarageArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const selected = options.version === 'full' ? track.arrangement : [{ name: 'HOOK / 回弹', bars: 8, energy: 'drop' as const }];
  const secondsPerBeat = 60 / options.bpm;
  const swing = 0.12;
  let barIndex = 0;

  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[], loose = false) => {
    // Shift alternate eighths; never randomize the downbeat or section boundary.
    const eighth = Math.round(beat * 2);
    const shift = loose && Math.abs(beat * 2 - eighth) < 0.001 && eighth % 2 ? swing : 0;
    events.push({ instrument, beat: beat + shift, duration, velocity: Math.min(1, Math.max(0.05, velocity)), notes: notes?.map(note => note + options.transpose) });
  };

  for (const section of selected) {
    sections.push({ name: section.name, start: barIndex * 4 * secondsPerBeat, end: (barIndex + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, barIndex++) {
      const beat = barIndex * 4;
      const harmony = track.harmony[barIndex % track.harmony.length];
      const { energy } = section;
      const heavy = energy === 'drop' || energy === 'final';
      const air = energy === 'air';
      const build = energy === 'build';
      const tease = energy === 'tease';
      const outro = energy === 'outro';
      const last = local === section.bars - 1;
      const gap = (heavy || build) && last;
      const melodyOn = heavy || tease || (air && local >= 4) || (energy === 'groove' && local >= 4) || (outro && local < 2);

      // The opening contains the signature immediately. Air and outro give the ears a rest.
      if (melodyOn) {
        for (const note of track.hook[barIndex % track.hook.length]) {
          if (gap && note.offset > 2.5) continue;
          add('lead', beat + note.offset, note.length, note.velocity * (air || outro ? 0.55 : tease ? 0.8 : 1), [note.note], true);
          if (energy === 'final' && local >= 4 && note.offset === 1.5) {
            add('spark', beat + 2.25, 0.18, 0.42, [note.note + 12], true);
          }
        }
      }

      // Offbeat chord stabs share harmony with the bass; the air section uses long pads.
      const chordTimes = air ? [0] : tease ? [0, 2.5] : outro ? [0] : [0.5, 2.5];
      for (const offset of chordTimes) {
        add('chord', beat + offset, air ? 3.1 : outro ? 1.5 : 0.36, air ? 0.32 : heavy ? 0.38 : 0.28, harmony.chord, !air);
      }
      if (air || (energy === 'final' && local % 2 === 1)) {
        for (const [index, offset] of [0.75, 1.75, 2.75, 3.5].entries()) {
          add('spark', beat + offset, 0.25, air ? 0.32 : 0.22, [harmony.chord[index % harmony.chord.length] + 12], true);
        }
      }

      const drumsOn = !air || local >= 6;
      if (drumsOn) {
        const kickPattern = tease ? [0, 2.5] : outro ? [0] : build ? [0, 1.5, 2, 3] : [0, 1.75, 2.5, ...(barIndex % 2 === 1 ? [3.5] : [])];
        for (const offset of kickPattern) {
          if (gap && offset >= 3) continue;
          add('kick', beat + offset, 0.4, offset === 0 ? 0.95 : 0.81);
        }
        if (!outro && (!tease || local >= 2)) {
          for (const offset of [1, 3]) {
            if (gap && offset === 3) continue;
            add('clap', beat + offset, 0.25, 0.82);
          }
          if (heavy && !last && local % 2 === 1) add('clap', beat + 2.75, 0.12, 0.2);
        }
        const steps = build && local >= 2 ? 16 : 8;
        for (let step = 0; step < steps; step++) {
          const offset = step * 4 / steps;
          if (gap && offset >= 3 || outro && offset >= 2 || tease && step % 2 === 0) continue;
          add('hat', beat + offset, 0.06, (step % 2 ? 0.5 : 0.29) + random() * 0.13, undefined, true);
        }
        if (heavy || energy === 'groove') {
          for (const offset of [0.5, 2.5]) add('openHat', beat + offset, 0.25, 0.4, undefined, true);
          for (const offset of [1.25, 3.25]) {
            if (gap && offset >= 3) continue;
            add('perc', beat + offset, 0.1, 0.35 + random() * 0.15, undefined, true);
          }
        }
      }

      if (!air && !build && (!tease || local >= 2)) {
        const bassPattern = outro ? [0.5] : [0.5, 1.5, 2.75, 3.25];
        for (const [index, offset] of bassPattern.entries()) {
          if (gap && offset >= 3) continue;
          const root = harmony.root + (index === 2 && barIndex % 2 === 1 ? 12 : 0);
          add('bass', beat + offset, index === 3 ? 0.23 : 0.34, heavy ? 0.85 : 0.62, [root + 12], true);
          add('sub', beat + offset, index === 3 ? 0.23 : 0.34, heavy ? 0.8 : 0.6, [root], true);
        }
      }
      if (build) {
        add('sub', beat, 3.5, 0.44, [harmony.root]);
        const count = 4 * 2 ** local;
        for (let step = 0; step < count; step++) {
          const offset = step * 4 / count;
          if (last && offset > 3.5) continue;
          add('clap', beat + offset, 0.08, 0.18 + 0.3 * step / count);
        }
        if (local === 0) add('riser', beat, section.bars * 4 - 0.5, 0.55);
      }
      if (heavy && local === 0) add('impact', beat, 1, 0.45);
      if (gap) {
        // One beat of breathing room, a tiny two-note pickup, then the next drop.
        add('perc', beat + 3.25, 0.1, 0.62);
        if (options.version === 'full' || options.version === 'loop') {
          add('lead', beat + 3.5, 0.12, 0.65, [63], true);
          add('lead', beat + 3.75, 0.12, 0.78, [68]);
        }
      }
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  return { events, beats: barIndex * 4, sections };
}
