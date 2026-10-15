import { createRandom } from '../random.ts';
import type { Arrangement, Instrument, RenderOptions, TrackDefinition } from '../types.ts';

/** Compose once, then crop edits from that score so hooks are real song sections. */
export function buildEmotionalPopArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const secondsPerBeat = 60 / options.bpm;
  const resolution = track.harmony[track.resolveHarmony ?? 0];
  const development = track.emotionalPop;
  const syncopated = development?.groove === 'syncopated';
  let bar = 0;
  const add = (instrument: Instrument, beat: number, duration: number, velocity: number, notes?: number[], humanize = false) => {
    const shift = humanize ? random() * 0.017 : 0;
    const touch = humanize ? 0.94 + random() * 0.09 : 1;
    events.push({ instrument, beat: beat + shift, duration, velocity: Math.min(1, velocity * touch), notes: notes?.map(note => note + options.transpose) });
  };

  for (const section of track.arrangement) {
    sections.push({ name: section.name, start: bar * 4 * secondsPerBeat, end: (bar + section.bars) * 4 * secondsPerBeat });
    for (let local = 0; local < section.bars; local++, bar++) {
      const beat = bar * 4;
      const intro = section.energy === 'tease';
      const bridge = section.energy === 'air';
      const outro = section.energy === 'outro';
      const final = section.energy === 'final';
      const chorus = section.energy === 'drop' || final;
      const last = local === section.bars - 1;
      const ending = outro && last;
      const phrase = local % track.hook.length;
      const theme = bridge && development?.bridgeHook
        ? development.bridgeHook
        : final && local >= 8 && development?.finalHook ? development.finalHook : track.hook;
      const harmony = ending ? resolution : track.harmony[local % track.harmony.length];
      const fade = outro ? 1 - local / (section.bars + 1) : 1;

      // Piano and the electronic lead trade the motif instead of stacking it all the time.
      const melodyOn = !outro || local < 2;
      if (melodyOn) {
        for (const note of theme[phrase]) {
          const leadVoice: Instrument = intro || bridge || (!chorus && local < 4) ? 'piano' : 'lead';
          const level = intro ? 0.83 : bridge ? 0.69 : outro ? 0.57 * fade : 0.92;
          add(leadVoice, beat + note.offset, note.length, note.velocity * level, [note.note]);
          // A low, vowel-like response adds a distinct colour without masquerading as a singer.
          if (!development?.response && chorus && phrase % 2 === 1 && note.offset >= 2.5) {
          }
          if (!development?.finalHook && final && local >= 8 && note.offset === 2) add('spark', beat + 3.25, 0.4, 0.22, [note.note + 12]);
        }
        if (chorus && development?.response) {
          for (const note of development.response[phrase]) {
            add('piano', beat + note.offset, note.length, note.velocity * 0.76, [note.note]);
          }
        }
      }

      // Close, economical voicings and an arpeggio with a real two-bar response.
      if (local % 2 === 0 || ending) {
        add('chord', beat, ending ? 3.4 : 6.8, (bridge ? 0.46 : 0.33) * fade, harmony.chord);
        if (chorus || bridge || intro) add('pad', beat + 0.02, ending ? 3.5 : 7.4, (bridge ? 0.36 : intro ? 0.2 : 0.23) * fade, harmony.chord);
      }
      const pattern = bridge && development?.bridgeHook ? [0.5] : local % 2 === 0 ? [0, 1.5, 2.75] : [0.5, 2, 3.25];
      for (const [index, offset] of pattern.entries()) {
        if (ending && offset > 1.5) continue;
        // Leave the written piano reply clear of accompanying arpeggio notes.
        if (chorus && development?.response?.[phrase].some(note => offset < note.offset + note.length && offset + 0.767 > note.offset)) continue;
        add('piano', beat + offset, 0.75, (intro ? 0.28 : bridge ? 0.3 : 0.2) * fade, [harmony.chord[(index + local) % harmony.chord.length]], true);
      }

      const drumsOn = !intro && !bridge && (!outro || local < 4);
      const transition = last && !outro;
      if (drumsOn) {
        const kicks = syncopated
          ? chorus ? local % 2 === 0 ? [0, 1, 2.5] : [0, 1.5, 2, 3] : local % 2 === 0 ? [0, 2.25] : [0, 1.5, 2.75]
          : chorus ? [0, 1, 2, 3] : local % 2 === 0 ? [0, 1.5, 2.5] : [0, 2, 3.25];
        for (const offset of kicks) {
          if (transition && offset >= 3) continue;
          add('kick', beat + offset, 0.46, (offset === 0 ? 0.88 : 0.76) * fade * (syncopated ? 0.88 : 1));
        }
        for (const offset of [1, 3]) {
          if (transition && offset === 3) continue;
          add('clap', beat + offset + 0.012, 0.22, (chorus ? 0.67 : 0.54) * fade * (syncopated ? 0.88 : 1));
        }
        for (let step = 0; step < 8; step++) {
          if (transition && step >= 6) continue;
          if (syncopated && step === 0) continue;
          if (!chorus && step % 2 === 0) continue;
          const offset = step / 2 + (step % 2 ? 0.023 : 0);
          add('hat', beat + offset, 0.1, (step % 2 ? 0.27 : 0.12) * fade * (syncopated ? 0.9 : 1), undefined, true);
        }
        if (chorus && local % 2 === 1 && !last) add('openHat', beat + 3.5, 0.28, 0.21 * fade);
        if (local % 4 === 3 && !last) {
          add('perc', beat + 3.25, 0.16, 0.29 * fade);
          add('perc', beat + 3.75, 0.18, 0.34 * fade);
        }
      }

      if (!intro && !bridge && (!outro || local < 4)) {
        const bassPattern = syncopated
          ? chorus ? local % 2 === 0 ? [0.5, 1.75, 3.25] : [0.5, 2.5, 3.5] : local % 2 === 0 ? [0.5, 3] : [0.5, 2.25]
          : chorus ? [0.5, 1.75, 2.5, 3.5] : [0.5, 2.5];
        for (const [index, offset] of bassPattern.entries()) {
          if (transition && offset >= 3) continue;
          const passing = chorus && local % 2 === 1 && index === (syncopated ? bassPattern.length - 1 : 3);
          add('bass', beat + offset, passing ? 0.25 : 0.55, 0.7 * fade * (syncopated ? 0.88 : 1), [harmony.root + 12 + (passing ? 7 : 0)]);
          if (!passing && index % 2 === 0) add('sub', beat + offset, 0.56, 0.41 * fade * (syncopated ? 0.86 : 1), [harmony.root]);
        }
      }
      // One short inhale between sections, no stock sixteen-bar EDM noise riser.
      if (transition && section.energy !== 'tease') add('sweep', beat + 2.5, 1.45, bridge ? 0.24 : 0.18);
      if (chorus && local === 0) add('impact', beat, 0.6, 0.17);
      if (ending) add('piano', beat, 3.5, 0.51, [resolution.root + 36]);
    }
  }
  const beats = bar * 4;
  add('texture', 0, beats, 0.16);
  events.sort((a, b) => a.beat - b.beat);
  if (options.version === 'full') return { events, sections, beats };

  const edit = track.edits![options.version];
  const start = edit.startBar * 4;
  const end = start + edit.bars * 4;
  const cropped = events.filter(event => event.instrument !== 'texture' && event.beat >= start && event.beat < end).map(event => ({ ...event, beat: event.beat - start, duration: Math.min(event.duration, end - event.beat) }));
  // Continuous atmosphere belongs to each edit, unlike melodic events from previous bars.
  cropped.push({ instrument: 'texture', beat: 0, duration: end - start, velocity: 0.16 });
  cropped.sort((a, b) => a.beat - b.beat);
  return {
    events: cropped, beats: end - start,
    sections: sections.filter(section => section.end > start * secondsPerBeat && section.start < end * secondsPerBeat).map(section => ({
      name: section.name,
      start: Math.max(0, section.start - start * secondsPerBeat),
      end: Math.min((end - start) * secondsPerBeat, section.end - start * secondsPerBeat),
    })),
  };
}
