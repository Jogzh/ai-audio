import type { Arrangement, Instrument, MixTrack, RenderOptions, TrackDefinition } from '../types.ts';
import { createRandom } from '../random.ts';

const strip = (id: string, name: string, instrument: Instrument, role: MixTrack['role'], gain: number, pan: number, highpass: number, lowpass: number, reverb = 0, delay = 0): MixTrack => ({ id, name, instrument, role, mix: { gain, pan, highpass, lowpass, reverb, delay } });
export const clubTracks: MixTrack[] = [
  strip('zheng', '古筝 · 暗号与回答', 'guzheng', 'foreground', .94, -.12, 190, 8800, .17, .24),
  strip('reed', '唢呐感主音 · Drop', 'lead', 'foreground', .72, 0, 350, 7400, .09, .1),
  strip('bamboo', '竹笛 · 月下长句', 'dizi', 'foreground', .82, .07, 340, 7200, .36, .2),
  strip('stabs', '切分和弦 · 舞池脉冲', 'chord', 'harmony', .48, 0, 340, 6000, .08),
  strip('night', '夜色 · 空间和声', 'pad', 'texture', .58, 0, 430, 4300, .4),
  strip('bass', '弹跳低音 · 单声道', 'bass', 'bass', .86, 0, 28, 2400),
  strip('kick', '底鼓 · 四拍骨架', 'kick', 'rhythm', .98, 0, 27, 9800),
  strip('clap', '军鼓拍手 · 二四拍', 'clap', 'rhythm', .78, .03, 180, 10500, .07),
  strip('hat', '闭镲 · 微切分', 'hat', 'rhythm', .55, -.2, 6200, 16000),
  strip('open', '开镲 · 反拍', 'openHat', 'rhythm', .5, .23, 6800, 15000),
  strip('wood', '木鱼 · 空拍回答', 'rim', 'rhythm', .55, -.27, 600, 6100, .09),
  strip('drum', '大堂鼓 · 转段', 'chineseDrum', 'transition', .78, 0, 65, 5700, .15),
  strip('gong', '小锣 · 段落标记', 'gong', 'transition', .55, .16, 400, 5800, .26),
  strip('lift', '风噪 · 上升与落点', 'sweep', 'transition', .55, 0, 650, 11500, .09),
];

/** Write the full score once. Short versions retain identical timing and dynamics. */
export function buildGuofengClubArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  const random = createRandom(options.seed);
  const events: Arrangement['events'] = [];
  const sections: Arrangement['sections'] = [];
  const spb = 60 / options.bpm;
  const add = (id: string, beat: number, duration: number, velocity: number, notes?: number[], touch = false, gesture?: 'rise' | 'fall') => {
    const part = clubTracks.find(part => part.id === id)!;
    events.push({ trackId: id, instrument: part.instrument, beat, duration, velocity: Math.min(1, velocity * (touch ? .94 + random() * .09 : 1)), notes: notes?.map(note => note + options.transpose), gesture });
  };
  let bar = 0;
  for (const section of track.arrangement) {
    sections.push({ name: section.name, start: bar * 4 * spb, end: (bar + section.bars) * 4 * spb });
    for (let local = 0; local < section.bars; local++, bar++) {
      const b = bar * 4;
      const { energy } = section;
      const drop = energy === 'drop' || energy === 'final';
      const build = energy === 'build';
      const air = energy === 'air';
      const groove = energy === 'groove';
      const outro = energy === 'outro';
      const last = local === section.bars - 1;
      const developed = energy === 'final' && local >= 8;
      const p = local % 8;
      const harmony = outro ? track.harmony[0] : track.harmony[p];
      const theme = air ? track.guofengClub!.bridgeHook : developed ? track.guofengClub!.finalHook : track.hook;
      const fade = outro ? 1 - local * .19 : 1;

      if (build) {
        // Familiar three-note cell, increasingly compressed; the last half-beat is silent.
        const offsets = last ? [0, .5, 1, 1.5, 2, 2.5, 3] : [0, 1, 2, 3];
        offsets.forEach((offset, i) => add('zheng', b + offset, .32, .62 + local * .035, [[69, 72, 74][i % 3]]));
      } else if (outro) {
        if (local < 2) for (const n of track.hook[p]) add('zheng', b + n.offset, n.length, n.velocity * .64 * fade, [n.note]);
        if (last) add('zheng', b, 3.7, .71, [62, 69, 74]);
      } else {
        for (const n of theme[p]) add(drop ? 'reed' : air ? 'bamboo' : 'zheng', b + n.offset, n.length, n.velocity * (drop ? .92 : air ? .81 : .96), [n.note]);
        // Pluck replies occupy explicit melody rests, rather than doubling the lead.
        if (drop && p % 2 === 1) {
          const end = Math.max(...theme[p].map(n => n.offset + n.length));
          const replyAt = end + .06 / spb + .015; // leave room for the reed's release, at every BPM
          if (replyAt < 3.87) add('zheng', b + replyAt, .12, .56, [harmony.chord[1] + 24]);
          if (replyAt < 3.66) add('zheng', b + 3.87, .12, .48, [harmony.chord[2] + 24]);
        }
        if (air && p % 2 === 1 && p !== 3) {
          const end = Math.max(...theme[p].map(n => n.offset + n.length));
          const replyAt = end + .105 / spb + .015;
          if (replyAt < 3.84) add('zheng', b + replyAt, .14, .4, [harmony.chord[1] + 12]);
        }
      }

      if (energy === 'tease' || air || outro || (build && local === 0)) {
        if (local % 2 === 0) add('night', b, Math.min(7.6, (section.bars - local) * 4 - .2), (air ? .45 : .3) * fade, harmony.chord.slice(1));
      }
      if (drop || groove) {
        for (const offset of [0.5, 1.5, 2.75]) add('stabs', b + offset, .18, drop ? .62 : .4, harmony.chord.slice(1));
        // Kick body ends before the bass attacks; upper harmonics translate on phones.
        for (const [i, offset] of [.5, 1.5, 2.5, 3.25, 3.5].entries()) {
          const note = i === 3 && p % 2 === 1 ? harmony.root + 7 : harmony.root;
          add('bass', b + offset, offset === 3.25 ? .18 : .34, drop ? .83 : .61, [note]);
        }
        for (const offset of [0, 1, 2, 3]) add('kick', b + offset, .45, drop ? .95 : .79);
        for (const offset of [1, 3]) add('clap', b + offset, .35, drop ? .87 : .65);
        for (const offset of [0, .75, 1, 1.75, 2, 2.75, 3, 3.75]) add('hat', b + offset, .09, offset % 1 === 0 ? .3 : .22, undefined, true);
        for (const offset of [.5, 1.5, 2.5, 3.5]) add('open', b + offset, .27, drop ? .43 : .25, undefined, true);
        if (p % 2 === 1) for (const offset of [1.75, 2.25]) add('wood', b + offset, .18, .38, undefined, true);
        if (local >= 8 && p % 4 === 3) for (const offset of [3.5, 3.75]) add('drum', b + offset, .2, .38 + (offset - 3.5) * .7, [offset === 3.5 ? 45 : 50]);
      }
      if (air && local >= 4) {
        add('kick', b, .45, .62);
        add('clap', b + 2, .45, .49);
        add('bass', b + .5, 1.3, .49, [harmony.root]);
        for (const offset of [.5, 1.5, 2.5, 3.5]) add('hat', b + offset, .1, .21, undefined, true);
      }
      if (build) {
        const stop = last ? 3.5 : 4;
        const step = last ? .25 : local >= 2 ? .5 : 1;
        for (let offset = 0; offset < stop; offset += step) add('clap', b + offset, .17, .28 + local * .055 + offset * .015);
        for (const offset of last ? [0, 1, 2] : [0, 1, 2, 3]) add('kick', b + offset, .35, .64);
        if (last) for (const [i, offset] of [2.5, 2.75, 3, 3.25].entries()) add('drum', b + offset, .22, .47 + i * .1, [50 - i * 2]);
        // One long riser per build; its end is before the Drop to preserve the impact.
        if (local === 0) add('lift', b, section.bars * 4 - .5, .55);
      }
      if (local === 0 && drop) {
        add('gong', b, 2.2, .52);
        add('drum', b, .9, .69, [38]);
        add('lift', b, 1.8, .42, undefined, false, 'fall');
      }
      if (energy === 'tease' && local === 0) add('gong', b, 2, .25);
      if (outro && local === 0) add('drum', b, .7, .47, [38]);
    }
  }
  events.sort((a, b) => a.beat - b.beat);
  if (options.version === 'full') return { tracks: clubTracks, events, beats: bar * 4, sections };
  const edit = track.edits![options.version];
  const start = edit.startBar * 4;
  const end = start + edit.bars * 4;
  return {
    tracks: clubTracks,
    events: events.filter(e => e.beat >= start && e.beat < end).map(e => ({ ...e, beat: e.beat - start, duration: Math.min(e.duration, end - e.beat) })),
    beats: end - start,
    sections: sections.filter(s => s.end > start * spb && s.start < end * spb).map(s => ({ name: s.name, start: Math.max(0, s.start - start * spb), end: Math.min((end - start) * spb, s.end - start * spb) })),
  };
}
