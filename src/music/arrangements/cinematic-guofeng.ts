import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

/** One foreground voice, stable pop backbeat, and orchestral layers that enter by phrase. */
export function buildCinematicGuofengArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const secondsPerBeat = 60 / options.bpm;
  const resolution = track.harmony[track.resolveHarmony ?? 0];
  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[], touch = false) => {
    // Touch varies only dynamics; drum, bass and pluck entrances keep a common grid.
    const strength = touch ? 0.94 + random() * 0.1 : 1;
    events.push({ instrument, beat, duration, velocity: Math.min(1, velocity * strength), notes: notes?.map(note => note + options.transpose) });
  };
  let bar = 0;
  for (const section of track.arrangement) {
    sections.push({ name: section.name, start: bar * 4 * secondsPerBeat, end: (bar + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, bar++) {
      const beat = bar * 4;
      const intro = section.energy === 'tease';
      const verse = section.energy === 'groove';
      const build = section.energy === 'build';
      const bridge = section.energy === 'air';
      const final = section.energy === 'final';
      const chorus = section.energy === 'drop' || final;
      const outro = section.energy === 'outro';
      const developed = final && local >= 8;
      const last = local === section.bars - 1;
      const phrase = local % track.hook.length;
      const theme = bridge && track.cinematicGuofeng?.bridgeHook
        ? track.cinematicGuofeng.bridgeHook
        : developed && track.cinematicGuofeng?.finalHook ? track.cinematicGuofeng.finalHook : track.hook;
      const harmony = outro ? resolution : build
        ? track.harmony[local < 2 ? 2 % track.harmony.length : 6 % track.harmony.length]
        : track.harmony[phrase % track.harmony.length];
      const fade = outro ? 1 - local / (section.bars + 0.5) : 1;
      const voicing = harmony.chord.slice(1); // Three voices; no duplicate sustained pad.

      if (intro) {
        add('guzheng', beat, 1.5, 0.6, [track.hook[phrase][0].note - 12]);
        if (local % 2 === 0) add('guzheng', beat + 2, 1.35, 0.43, [resolution.root + 31]);
      } else if (verse) {
        const first = theme[phrase][0];
        const answer = theme[phrase].at(-1)!;
        add('erhu', beat, local % 2 === 1 ? 2.8 : 1.4, 0.64, [Math.max(62, first.note - 12)]);
        if (local % 2 === 0) add('erhu', beat + 2, 1.45, 0.56, [Math.max(62, answer.note - 12)]);
      } else if (build) {
        add('dizi', beat, 2.8, 0.63 + local * 0.025, [[74, 77, 79, 81][local % 4]]);
      } else if (outro) {
        if (local === 0) add('dizi', beat, 2.8, 0.47, [74]);
        if (local === 1) add('guzheng', beat + 2, 1.5, 0.44, [69]);
        if (last) add('guzheng', beat, 3.6, 0.55, [62]);
      } else {
        for (const note of theme[phrase]) {
          add(bridge ? 'erhu' : 'dizi', beat + note.offset, note.length, note.velocity * (bridge ? 0.85 : developed ? 0.95 : 0.9), [note.note]);
        }
      }

      if (local % 2 === 0) {
        const duration = Math.min(7.5, (section.bars - local) * 4 - 0.4);
        const voice: Instrument = chorus || build ? 'strings' : 'pad';
        add(voice, beat, duration, (chorus ? developed ? 0.42 : 0.35 : build ? 0.22 : bridge ? 0.16 : verse ? 0.1 : 0.11) * fade, voicing);
        // Brass belongs to the final eight bars, and only punctuates phrase beginnings.
        if (developed && local % 4 === 0) add('brass', beat, 1.8, 0.21, [harmony.root + 24, harmony.root + 31]);
      }

      // Accompaniment plucks answer between beats; no chorus glissando or competing solo.
      if (!intro && !outro) {
        const offsets = bridge ? [3] : chorus ? [0.5, 2.5] : [3];
        for (const [index, offset] of offsets.entries()) {
          add('guzheng', beat + offset, 0.55, bridge ? 0.22 : chorus ? 0.17 : 0.2, [voicing[(index + local) % voicing.length] + 12], true);
        }
      }
      if ((intro && local === 2) || (bridge && local === 2)) add('granular', beat + 2, 1.5, 0.14, [74]);
      if (outro && local < 2) add('guzheng', beat + 0.5, 1.2, 0.22 * fade, [resolution.root + 24]);

      if (verse || chorus || build) {
        // All choruses retain the same beat-one kick; orchestral drums never replace it.
        const kicks = build && last ? [0] : [0, 2];
        for (const offset of kicks) add('kick', beat + offset, 0.4, chorus ? 0.78 : verse ? 0.62 : 0.65);
        for (const offset of [1, 3]) {
          if (build && last && offset === 3) continue;
          add('clap', beat + offset, 0.2, chorus ? 0.72 : verse ? 0.5 : 0.58);
        }
        if (!build) {
          const hats = chorus ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0.5, 1.5, 2.5, 3.5];
          for (const offset of hats) add('hat', beat + offset, 0.1, (offset % 1 ? 0.27 : 0.14) * (chorus ? 1 : 0.8), undefined, true);
        }
        // Bass roots reinforce the kick on beats one and three. No extra sub octave.
        for (const offset of kicks) add('bass', beat + offset, 1.55, chorus ? 0.61 : 0.44, [harmony.root]);
        if (build && last) {
          for (const offset of [2.5, 3, 3.5]) add('taiko', beat + offset, 0.28, 0.3 + (offset - 2.5) * 0.09, undefined, true);
        } else if (chorus && local % 4 === 3 && !last) {
          add('taiko', beat + 3.5, 0.32, 0.28);
        }
      }
      if (local === 0 && (section.energy === 'drop' || final)) add('gong', beat, 2, 0.14);
      if (last && (build || bridge)) add('sweep', beat + 3.5, 0.4, 0.12);
    }
  }
  const beats = bar * 4;
  events.sort((a, b) => a.beat - b.beat);
  if (options.version === 'full') return { events, beats, sections };
  const edit = track.edits![options.version];
  const start = edit.startBar * 4;
  const end = start + edit.bars * 4;
  return {
    events: events.filter(event => event.beat >= start && event.beat < end).map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) })),
    beats: end - start,
    sections: sections.filter(section => section.end > start * secondsPerBeat && section.start < end * secondsPerBeat).map(section => ({
      name: section.name,
      start: Math.max(0, section.start - start * secondsPerBeat),
      end: Math.min((end - start) * secondsPerBeat, section.end - start * secondsPerBeat),
    })),
  };
}
