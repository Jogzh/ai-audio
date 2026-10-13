import { createRandom } from './random.ts';
import { versions, type Arrangement, type Instrument, type RenderOptions, type TrackDefinition } from './types.ts';

export function validateOptions(options: RenderOptions): void {
  if (!versions.includes(options.version)) throw new RangeError('版本必须为 full / hook / loop');
  if (!Number.isFinite(options.bpm) || options.bpm < 90 || options.bpm > 170) throw new RangeError('BPM 必须为 90–170');
  if (!Number.isInteger(options.transpose) || Math.abs(options.transpose) > 12) throw new RangeError('移调必须为 -12–12 的整数');
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new RangeError('Seed 必须为 0–4294967295 的整数');
}

export function buildArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  validateOptions(options);
  if (!track.harmony.length || !track.hook.length || !track.arrangement.length) throw new Error('曲目缺少和声、Hook 或编曲');
  if (track.production === 'warm-house') return buildWarmArrangement(track, options);
  if (track.production === 'disco-house') return buildDiscoArrangement(track, options);
  if (track.production !== undefined) throw new Error(`未知制作风格: ${track.production}`);
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
    if (!Number.isInteger(section.bars) || section.bars < 1) throw new Error('小节数必须为正整数');
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

/** Sustained harmony and eight-bar phrases, rather than applying the garage template to every song. */
function buildWarmArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
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
    if (!Number.isInteger(section.bars) || section.bars < 1) throw new Error('小节数必须为正整数');
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

/** Light DJ groove: straight kick, syncopated real bass, small percussion and alternating melodic layers. */
function buildDiscoArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
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
    if (!Number.isInteger(section.bars) || section.bars < 1) throw new Error('小节数必须为正整数');
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
