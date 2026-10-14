import type { HookBar, HookNote, TrackDefinition } from '../music/types.ts';

const n = (offset: number, note: number, length: number, velocity = 0.8): HookNote => ({ offset, note, length, velocity });

// D–F–A asks; G–F–D answers. Its rhythm survives each change of harmony.
// Each line finishes before the quiet, separately written flute response.
const hook: HookBar[] = [
  [n(0, 74, 0.68, 0.86), n(1, 77, 0.3, 0.69), n(1.5, 81, 0.9, 0.82)],
  [n(0, 79, 0.68, 0.79), n(1, 77, 0.3, 0.68), n(1.5, 74, 1.08, 0.83)],
  [n(0, 74, 0.68, 0.83), n(1, 77, 0.3, 0.67), n(1.5, 81, 0.9, 0.8)],
  [n(0, 77, 0.68, 0.77), n(1, 74, 0.3, 0.66), n(1.5, 72, 1.08, 0.77)],
  [n(0, 72, 0.68, 0.81), n(1, 77, 0.3, 0.68), n(1.5, 81, 0.9, 0.84)],
  [n(0, 79, 0.68, 0.8), n(1, 77, 0.3, 0.68), n(1.5, 74, 1.08, 0.81)],
  [n(0, 79, 0.68, 0.81), n(1, 81, 0.3, 0.71), n(1.5, 79, 0.9, 0.79)],
  [n(0, 77, 0.68, 0.78), n(1, 74, 0.3, 0.67), n(1.5, 72, 1.08, 0.75)],
];

export const inkTide: TrackDefinition = {
  meta: {
    id: 'ink-tide', title: '墨潮', subtitle: 'INK TIDE',
    artist: 'AI AUDIO / ORIGINAL 008', bpm: 124, key: 'D minor pentatonic',
    tags: ['CHINESE MELODIC HOUSE', 'GUQIN × XIAO', 'ORIGINAL VIBE'],
    description: '像墨落入水，一句清亮的琴声先浮上来。箫在留白里轻轻回答，温暖的反拍低音和细碎沙铃推着水波向前；中段收起鼓点，再让同一句旋律带着新的颜色回来。',
  },
  production: 'ink-tide',
  resolveHarmony: 0,
  edits: { hook: { startBar: 2, bars: 8 }, loop: { startBar: 2, bars: 8 } },
  arrangement: [
    { name: '01 / 落墨', bars: 2, energy: 'tease' },
    { name: '02 / 墨潮', bars: 8, energy: 'drop' },
    { name: '03 / 水面来信', bars: 8, energy: 'groove' },
    { name: '04 / 月白', bars: 4, energy: 'air' },
    { name: '05 / 潮生 · 回声', bars: 16, energy: 'final' },
    { name: '06 / 墨归于水', bars: 2, energy: 'outro' },
  ],
  // Roots remain low; sustained chord voices start at C4 to leave the bass clear.
  harmony: [
    { root: 38, chord: [65, 69, 72, 76] }, // Dm9
    { root: 38, chord: [65, 69, 72, 76] },
    { root: 34, chord: [62, 65, 69, 74] }, // Bbmaj7
    { root: 34, chord: [62, 65, 69, 74] },
    { root: 41, chord: [60, 65, 67, 69] }, // Fadd9
    { root: 41, chord: [60, 65, 67, 69] },
    { root: 36, chord: [62, 67, 72, 74] }, // Csus2
    { root: 36, chord: [62, 67, 72, 74] },
  ],
  hook,
  inkTide: {
    response: [
      [], [n(3, 69, 0.66, 0.55)],
      [], [n(3, 65, 0.66, 0.52)],
      [], [n(3, 72, 0.66, 0.55)],
      [], [n(3, 67, 0.66, 0.52)],
    ],
    finalHook: [
      hook[0],
      hook[1],
      hook[2],
      [n(0, 79, 0.68, 0.8), n(1, 77, 0.3, 0.69), n(1.5, 81, 1.08, 0.83)],
      [n(0, 81, 0.68, 0.84), n(1, 84, 0.3, 0.72), n(1.5, 81, 0.9, 0.82)],
      hook[5],
      hook[6],
      [n(0, 77, 0.68, 0.78), n(1, 74, 0.3, 0.68), n(1.5, 74, 1.08, 0.82)],
    ],
    bridgeHook: [
      [n(0, 69, 1.55, 0.69), n(2, 74, 1.2, 0.64)],
      [n(0.5, 72, 2.15, 0.65)],
      [n(0, 65, 1.55, 0.65), n(2, 69, 1.2, 0.62)],
      [n(0.5, 74, 2.15, 0.66)],
      [n(0, 69, 1.55, 0.67), n(2, 72, 1.2, 0.63)],
      [n(0.5, 67, 2.15, 0.64)],
      [n(0, 67, 1.55, 0.65), n(2, 72, 1.2, 0.62)],
      [n(0.5, 74, 2.15, 0.66)],
    ],
  },
};
