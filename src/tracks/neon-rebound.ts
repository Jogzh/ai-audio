import type { TrackDefinition } from '../music/types';

// Original motif: C – Ab – F – Eb. Syncopation and response, not a borrowed melody.
export const neonRebound: TrackDefinition = {
  meta: {
    id: 'neon-rebound',
    title: '霓虹回弹',
    subtitle: 'NEON REBOUND',
    artist: 'AI AUDIO / ORIGINAL 001',
    bpm: 132,
    key: 'F minor',
    tags: ['UK GARAGE', 'BOUNCY BASS', 'ORIGINAL'],
    description: '夜色里的弹跳感。四音符记忆点、错位低音与两步鼓点；为循环、转场和身体律动而写。',
  },
  arrangement: [
    { name: '01 / 点亮', bars: 4, energy: 'tease' },
    { name: '02 / 入夜', bars: 8, energy: 'groove' },
    { name: '03 / 蓄力', bars: 4, energy: 'build' },
    { name: '04 / 回弹', bars: 8, energy: 'drop' },
    { name: '05 / 悬浮', bars: 8, energy: 'air' },
    { name: '06 / 再回弹', bars: 12, energy: 'final' },
    { name: '07 / 余光', bars: 4, energy: 'outro' },
  ],
  harmony: [
    { root: 29, chord: [53, 56, 60, 67] }, // Fm(add9)
    { root: 25, chord: [53, 56, 60, 65] }, // Dbmaj7
    { root: 32, chord: [55, 60, 63, 70] }, // Abmaj9
    { root: 27, chord: [55, 58, 63, 65] }, // Eb(add9)
  ],
  hook: [
    [
      { offset: 0, note: 72, length: 0.32, velocity: 0.88 },
      { offset: 0.75, note: 68, length: 0.2, velocity: 0.72 },
      { offset: 1.5, note: 65, length: 0.36, velocity: 0.92 },
      { offset: 2.5, note: 63, length: 0.23, velocity: 0.68 },
      { offset: 3.25, note: 65, length: 0.38, velocity: 0.84 },
    ],
    [
      { offset: 0.5, note: 72, length: 0.2, velocity: 0.72 },
      { offset: 1.25, note: 68, length: 0.2, velocity: 0.78 },
      { offset: 2, note: 65, length: 0.45, velocity: 0.92 },
      { offset: 3, note: 63, length: 0.22, velocity: 0.72 },
      { offset: 3.5, note: 72, length: 0.2, velocity: 0.78 },
    ],
    [
      { offset: 0, note: 72, length: 0.32, velocity: 0.88 },
      { offset: 0.75, note: 68, length: 0.2, velocity: 0.72 },
      { offset: 1.5, note: 65, length: 0.36, velocity: 0.92 },
      { offset: 2.5, note: 63, length: 0.23, velocity: 0.68 },
      { offset: 3.25, note: 68, length: 0.38, velocity: 0.84 },
    ],
    [
      { offset: 0.5, note: 72, length: 0.25, velocity: 0.8 },
      { offset: 1.25, note: 68, length: 0.24, velocity: 0.74 },
      { offset: 2, note: 65, length: 0.42, velocity: 0.9 },
      { offset: 3.25, note: 63, length: 0.25, velocity: 0.74 },
    ],
  ],
};
