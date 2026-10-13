import type { TrackDefinition } from '../music/types.ts';

// Original, sparse guitar phrase. Each harmony lasts two bars; the rests are part of the hook.
export const moonlitSway: TrackDefinition = {
  meta: {
    id: 'moonlit-sway',
    title: '月光轻摇',
    subtitle: 'MOONLIT SWAY',
    artist: 'AI AUDIO / ORIGINAL 004',
    bpm: 116,
    key: 'D minor',
    tags: ['LIGHT DJ', 'SOFT HOUSE', 'GUITAR & SPACE'],
    description: '月光下轻轻摇摆。温柔吉他留出呼吸，电贝斯与轻四拍慢慢铺开；细碎打击乐点到为止，让旋律与夜色一起流动。',
  },
  production: 'disco-house',
  grooveIntensity: 0.72,
  arrangement: [
    { name: '01 / 月色', bars: 8, energy: 'tease' },
    { name: '02 / 轻步', bars: 8, energy: 'groove' },
    { name: '03 / 摇摆', bars: 8, energy: 'drop' },
    { name: '04 / 呼吸', bars: 8, energy: 'air' },
    { name: '05 / 相伴', bars: 8, energy: 'final' },
    { name: '06 / 晚安', bars: 8, energy: 'outro' },
  ],
  harmony: [
    { root: 26, chord: [53, 57, 60, 64] }, // Dm9: F, A, C, E over D
    { root: 26, chord: [53, 57, 60, 64] },
    { root: 34, chord: [53, 57, 60, 62] }, // Bbmaj9: F, A, C, D over Bb
    { root: 34, chord: [53, 57, 60, 62] },
    { root: 31, chord: [53, 57, 58, 62] }, // Gm9: F, A, Bb, D over G
    { root: 31, chord: [53, 57, 58, 62] },
    { root: 24, chord: [52, 55, 57, 62] }, // C6/9: E, G, A, D over C
    { root: 24, chord: [52, 55, 57, 62] },
  ],
  hook: [
    [
      { offset: 0.5, note: 69, length: 0.75, velocity: 0.62 },
      { offset: 1.75, note: 72, length: 0.4, velocity: 0.52 },
      { offset: 2.5, note: 74, length: 1, velocity: 0.66 },
    ],
    [
      { offset: 0.25, note: 76, length: 0.6, velocity: 0.52 },
      { offset: 1.5, note: 74, length: 1.15, velocity: 0.6 },
    ],
    [
      { offset: 0.5, note: 74, length: 0.65, velocity: 0.6 },
      { offset: 1.75, note: 72, length: 0.45, velocity: 0.5 },
      { offset: 2.75, note: 69, length: 0.8, velocity: 0.61 },
    ],
    [
      { offset: 0.75, note: 65, length: 0.75, velocity: 0.53 },
      { offset: 2.25, note: 69, length: 1.1, velocity: 0.55 },
    ],
    [
      { offset: 0.5, note: 70, length: 0.75, velocity: 0.59 },
      { offset: 1.75, note: 69, length: 0.35, velocity: 0.5 },
      { offset: 2.5, note: 67, length: 1, velocity: 0.61 },
    ],
    [
      { offset: 0.25, note: 74, length: 0.6, velocity: 0.57 },
      { offset: 1.5, note: 70, length: 0.85, velocity: 0.56 },
    ],
    [
      { offset: 0.5, note: 67, length: 0.65, velocity: 0.55 },
      { offset: 1.5, note: 72, length: 0.8, velocity: 0.61 },
      { offset: 2.75, note: 74, length: 0.6, velocity: 0.5 },
    ],
    [
      { offset: 0.5, note: 72, length: 0.75, velocity: 0.54 },
      { offset: 2, note: 69, length: 1, velocity: 0.56 },
    ],
  ],
};
