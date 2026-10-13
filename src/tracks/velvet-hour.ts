import type { TrackDefinition } from '../music/types.ts';

// Original guitar phrase; two-bar harmonic rhythm lets the groove breathe.
export const velvetHour: TrackDefinition = {
  meta: {
    id: 'velvet-hour', title: '微醺舞步', subtitle: 'VELVET HOUR',
    artist: 'AI AUDIO / ORIGINAL 003', bpm: 120, key: 'A minor',
    tags: ['SOFT DISCO', 'DEEP HOUSE', 'GUITAR GROOVE'],
    description: '一点 DJ，一点微醺。真实吉他与电贝斯的拨弦质感，风琴反拍、沙锤和康加鼓织成轻盈律动；不靠猛烈 Drop，也能跟着点头。',
  },
  production: 'disco-house',
  arrangement: [
    { name: '01 / 暖场', bars: 8, energy: 'tease' },
    { name: '02 / 靠近', bars: 8, energy: 'groove' },
    { name: '03 / 微醺', bars: 8, energy: 'drop' },
    { name: '04 / 夜风', bars: 8, energy: 'air' },
    { name: '05 / 共舞', bars: 16, energy: 'final' },
    { name: '06 / 散步回家', bars: 8, energy: 'outro' },
  ],
  harmony: [
    { root: 33, chord: [55, 59, 60, 64] }, // Am9, root in bass
    { root: 33, chord: [55, 59, 60, 64] },
    { root: 29, chord: [55, 57, 60, 64] }, // Fmaj9
    { root: 29, chord: [55, 57, 60, 64] },
    { root: 26, chord: [53, 57, 60, 64] }, // Dm9
    { root: 26, chord: [53, 57, 60, 64] },
    { root: 31, chord: [55, 59, 62, 64] }, // G6
    { root: 31, chord: [55, 59, 62, 64] },
  ],
  hook: [
    [
      { offset: 0, note: 76, length: 0.48, velocity: 0.82 },
      { offset: 0.75, note: 79, length: 0.32, velocity: 0.65 },
      { offset: 1.5, note: 81, length: 0.7, velocity: 0.8 },
      { offset: 2.75, note: 79, length: 0.36, velocity: 0.63 },
      { offset: 3.25, note: 76, length: 0.5, velocity: 0.71 },
    ],
    [
      { offset: 0.5, note: 72, length: 0.4, velocity: 0.69 },
      { offset: 1.25, note: 74, length: 0.32, velocity: 0.61 },
      { offset: 2, note: 76, length: 1.15, velocity: 0.78 },
    ],
    [
      { offset: 0, note: 76, length: 0.45, velocity: 0.78 },
      { offset: 0.75, note: 79, length: 0.3, velocity: 0.64 },
      { offset: 1.5, note: 81, length: 0.65, velocity: 0.81 },
      { offset: 2.5, note: 79, length: 0.3, velocity: 0.64 },
      { offset: 3, note: 76, length: 0.6, velocity: 0.7 },
    ],
    [
      { offset: 0.5, note: 72, length: 0.4, velocity: 0.68 },
      { offset: 1.5, note: 69, length: 0.65, velocity: 0.71 },
      { offset: 2.75, note: 72, length: 0.6, velocity: 0.7 },
    ],
    [
      { offset: 0, note: 77, length: 0.4, velocity: 0.76 },
      { offset: 0.75, note: 76, length: 0.3, velocity: 0.62 },
      { offset: 1.5, note: 74, length: 0.75, velocity: 0.78 },
      { offset: 2.75, note: 72, length: 0.3, velocity: 0.62 },
      { offset: 3.25, note: 69, length: 0.45, velocity: 0.69 },
    ],
    [
      { offset: 0.5, note: 72, length: 0.45, velocity: 0.66 },
      { offset: 1.25, note: 74, length: 0.35, velocity: 0.68 },
      { offset: 2, note: 76, length: 0.7, velocity: 0.76 },
      { offset: 3.25, note: 74, length: 0.45, velocity: 0.63 },
    ],
    [
      { offset: 0, note: 74, length: 0.45, velocity: 0.72 },
      { offset: 0.75, note: 76, length: 0.35, velocity: 0.66 },
      { offset: 1.5, note: 79, length: 0.7, velocity: 0.8 },
      { offset: 2.75, note: 76, length: 0.5, velocity: 0.69 },
    ],
    [
      { offset: 0.5, note: 74, length: 0.45, velocity: 0.65 },
      { offset: 1.25, note: 71, length: 0.45, velocity: 0.62 },
      { offset: 2, note: 72, length: 0.65, velocity: 0.73 },
      { offset: 3, note: 69, length: 0.7, velocity: 0.7 },
    ],
  ],
};
