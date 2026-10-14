import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

/** A two-bar guqin phrase, a flute in its rests, and a restrained house pulse. */
export function buildInkTideArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const secondsPerBeat = 60 / options.bpm;
  const resolution = track.harmony[track.resolveHarmony ?? 0];
  const development = track.inkTide;
  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[], touch = false) => {
    // Only the touch varies with the seed. Pitches, entrances and the bass grid do not.
    const strength = touch ? 0.96 + random() * 0.08 : 1;
    events.push({ instrument, beat, duration, velocity: Math.min(1, velocity * strength), notes: notes?.map(note => note + options.transpose) });
  };
  let bar = 0;

  for (const section of track.arrangement) {
    sections.push({ name: section.name, start: bar * 4 * secondsPerBeat, end: (bar + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, bar++) {
      const beat = bar * 4;
      const intro = section.energy === 'tease';
      const verse = section.energy === 'groove';
      const bridge = section.energy === 'air';
      const final = section.energy === 'final';
      const developed = final && local >= 8;
      const outro = section.energy === 'outro';
      const drumsOn = !intro && !bridge && !outro;
      const phrase = local % track.hook.length;
      const harmony = intro || outro ? resolution : track.harmony[phrase % track.harmony.length];
      const theme = bridge && development?.bridgeHook
        ? development.bridgeHook
        : developed && development?.finalHook ? development.finalHook : track.hook;
      const melody = theme[local % theme.length];
      const response = !intro && !bridge && !outro ? development?.response?.[phrase] ?? [] : [];

      if (intro) {
        const opening = local === 0
          ? [{ offset: 0, note: 62, length: 1.1 }, { offset: 1.5, note: 69, length: 0.7 }, { offset: 2.5, note: 74, length: 0.85 }]
          : [{ offset: 0.5, note: 77, length: 0.85 }, { offset: 2, note: 74, length: 1 }];
        for (const note of opening) add('guqin', beat + note.offset, note.length, 0.64, [note.note], true);
        if (local === 1) add('jade', beat + 3.5, 0.3, 0.2, [86], true);
      } else if (outro) {
        if (local === 0) {
          add('guqin', beat, 1.3, 0.58, [74], true);
          add('guqin', beat + 2, 1.2, 0.49, [69], true);
        } else if (local === section.bars - 1) {
          add('guqin', beat, 3.4, 0.57, [resolution.root + 24], true);
        }
      } else {
        // The electronic colour takes four selected bars, never doubling the solo.
        const electronic = final && (developed ? phrase === 4 || phrase === 5 : phrase === 6 || phrase === 7);
        const voice: Instrument = bridge && local % 2 === 1 ? 'xiao' : electronic ? 'lead' : 'guqin';
        const line = verse && phrase % 2 === 1 ? melody.slice(0, 2) : melody;
        for (const note of line) {
          add(voice, beat + note.offset, note.length, note.velocity * (bridge ? 0.78 : verse ? 0.73 : electronic ? 1.04 : 0.94), [note.note], true);
        }
        for (const note of response) {
          // In the lighter verse the same reply has room to breathe for a full beat.
          const offset = verse ? note.offset - 0.5 : note.offset;
          const length = verse ? Math.min(note.length + 0.45, 3.8 - offset) : note.length;
          if (line.some(lead => offset < lead.offset + lead.length && offset + length > lead.offset)) continue;
          add('xiao', beat + offset, length, note.velocity * (verse ? 1.08 : 0.9), [note.note], true);
        }
      }

      // Three upper voices per two bars, with no extra sustained low-mid layer.
      if (local % 2 === 0) {
        const duration = Math.min(7.4, (section.bars - local) * 4 - 0.4);
        const voicing = [harmony.chord[0], harmony.chord[2], harmony.chord[3]];
        add('pad', beat, duration, outro ? 0.13 : intro ? 0.14 : bridge ? 0.21 : verse ? 0.16 : 0.22, voicing);
      }
      // A short piano dyad sits in the even bar's rest, leaving the flute reply alone.
      if (!intro && !outro && !bridge && local % 2 === 0) {
        add('piano', beat + 3, 0.52, verse ? 0.19 : 0.24, [harmony.chord[1], harmony.chord[3]], true);
      }
      if (drumsOn && phrase === 6) add('jade', beat + 3.25, 0.35, verse ? 0.14 : 0.2, [86], true);

      if (drumsOn) {
        // Every main section keeps the same quarter-note pulse; no random downbeats.
        for (const offset of [0, 1, 2, 3]) {
          add('kick', beat + offset, 0.36, (offset === 0 ? 0.75 : 0.69) * (verse ? 0.78 : 1));
        }
        for (const offset of [1, 3]) add('rim', beat + offset, 0.16, verse ? 0.32 : offset === 1 ? 0.44 : 0.4);
        for (let step = 0; step < 8; step++) {
          if (verse && step % 2 === 0) continue;
          // A fixed, small swing is part of the score, independent of the seed.
          const offset = step / 2 + (step % 2 ? 0.035 : 0);
          add('shaker', beat + offset, 0.11, (step % 2 ? 0.26 : 0.12) * (verse ? 0.8 : 1), undefined, true);
        }
        const bassOffsets = verse ? [0.5, 2.5] : [0.5, 1.5, 2.5, 3.5];
        for (const offset of bassOffsets) add('bass', beat + offset, 0.31, verse ? 0.46 : 0.57, [harmony.root]);
      }
      if (bridge && local === section.bars - 1) add('sweep', beat + 3.25, 0.6, 0.1);
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
