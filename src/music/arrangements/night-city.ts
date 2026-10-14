import type { MixTrack, MusicalEvent, RenderOptions, TrackDefinition } from '../types.ts';
import type { VocalSampleId } from '../vocal-bank.ts';

const voicePart = (id: string, name: string, role: MixTrack['role'], gain: number, reverb: number, delay: number): MixTrack => ({
  id, name, role, instrument: 'vocal', mix: { gain, pan: 0, highpass: role === 'texture' ? 430 : 180, lowpass: 10500, reverb, delay },
});
export const nightCityParts: MixTrack[] = [
  voicePart('voice', '中文口号 · 女声与男声', 'foreground', .9, .06, .025),
  voicePart('chops', '人声切片 · 旋律暗号', 'foreground', .82, .11, .14),
  voicePart('choir', '呼吸和声 · 月下', 'texture', .32, .55, .16),
  voicePart('voice-fx', '反向人声 · 蓄力', 'transition', .48, .3, .13),
  { id: 'acid', name: '酸性电子音 · 空拍回答', role: 'reply', instrument: 'bass', mix: { gain: .37, pan: -.08, highpass: 210, lowpass: 4300, reverb: .06, delay: .11 } },
  { id: 'breaks', name: '碎拍军鼓 · 八小节转身', role: 'rhythm', instrument: 'clap', mix: { gain: .62, pan: .08, highpass: 350, lowpass: 12500, reverb: .13, delay: 0 } },
];

/** Each main voice owns its bars. This transforms only the opt-in vocal score. */
export function addNightCityArrangement(track: TrackDefinition, options: RenderOptions, input: MusicalEvent[]): MusicalEvent[] {
  let events = input.slice();
  const voice = (id: string, sample: VocalSampleId, beat: number, duration: number, velocity: number, note?: number) => events.push({
    trackId: id, instrument: 'vocal', sample, beat, duration, velocity, notes: note === undefined ? undefined : [note + options.transpose],
  });
  const remove = (start: number, end: number, ids: string[]) => { events = events.filter(e => e.beat < start || e.beat >= end || !ids.includes(e.trackId!)); };
  let bar = 0;
  for (const section of track.arrangement) {
    for (let local = 0; local < section.bars; local++, bar++) {
      const b = bar * 4, p = local % 8, energy = section.energy;
      const drop = energy === 'drop' || energy === 'final';
      const developed = energy === 'final' && local >= 8;
      if (energy === 'tease' && local === 0) {
        remove(b, b + 8, ['zheng']);
        voice('voice', 'city-open', b + .25, 6.75, .87);
        for (const [i, n] of [69, 72, 74].entries()) events.push({ trackId: 'zheng', instrument: 'guzheng', beat: b + 7 + i * .25, duration: .18, notes: [n + options.transpose], velocity: .58 });
      }
      if (energy === 'build' && local === section.bars - 1) {
        remove(b, b + 3.5, ['zheng']);
        voice('voice', 'together', b, 1.5, .86);
        voice('voice-fx', 'reverse-a4', b + 1.5, 1.75, .5, 69);
        // The last quarter-beat has no new sound, including the vocal rise.
      }
      if (drop) {
        if (p === 0) {
          remove(b, b + 4, ['reed', 'zheng']);
          voice('voice', 'night-call', b, 2.75, .98);
          voice('voice', 'lights-on', b + 2.75, 1.25, 1);
        }
        if (p === 1 || p === 4 || (developed && p === 5)) {
          remove(b, b + 4, ['reed', 'zheng']);
          const notes = p === 4 ? [[0, 72, .32], [.5, 74, .32], [1, 77, .72], [2.25, 77, .3], [2.75, 74, .3], [3.25, 72, .5]]
            : developed ? [[0, 81, .65], [1, 79, .3], [1.5, 77, .5], [2.5, 74, .8]]
            : [[0, 69, .3], [.5, 72, .3], [1, 74, .75], [2.25, 72, .3], [2.75, 69, .3], [3.25, 67, .5]];
          notes.forEach(([offset, note, length], i) => voice('chops', i % 3 === 2 ? 'ye-a4' : 'ah-a4', b + offset, length, .87, note));
        }
        if (p === 3) voice('chops', 'hey', b + 3.7, .26, .64);
        if (p === 7) {
          remove(b + 3, b + 4, ['reed', 'zheng', 'kick', 'clap', 'hat', 'open', 'wood', 'bass', 'drum']);
          for (const [i, offset] of [3, 3.375, 3.625].entries()) events.push({ trackId: 'breaks', instrument: 'clap', beat: b + offset, duration: .14, velocity: [.7, .47, .61][i] });
          voice('chops', 'ah-a4', b + 3, .18, .65, 74);
          voice('chops', 'ah-a4', b + 3.375, .12, .58, 74);
          voice('chops', 'ye-a4', b + 3.625, .12, .7, 77);
        }
      }
      if (energy === 'groove') {
        if (local === 0) {
          remove(b, b + 8, ['zheng']);
          voice('voice', 'follow-drums', b + .25, 6.5, .93);
        }
        if (p === 3 || p === 7) for (const [i, offset] of [3.5, 3.75].entries()) events.push({
          trackId: 'acid', instrument: 'bass', beat: b + offset, duration: .16, velocity: .68, notes: [track.harmony[p].root + 24 + i * 7 + options.transpose],
        });
      }
      if (energy === 'air') {
        if (local === 0) {
          remove(b, b + 8, ['bamboo', 'zheng']);
          voice('voice', 'tonight', b + .25, 6.75, .77);
        }
        if (local % 2 === 0) voice('choir', 'choir-d4', b, 7.5, .62, track.harmony[p].root + 24);
        if (local === 6) voice('voice-fx', 'reverse-a4', b + 2, 5.5, .44, 69);
      }
      if (energy === 'outro' && local === 0) voice('voice', 'lights-on', b + .25, 1.25, .55);
    }
  }
  return events;
}
