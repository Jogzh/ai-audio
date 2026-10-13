import type { TrackDefinition } from '../music/types';

// An original eight-bar question/answer phrase, over closely voiced F# minor harmony.
export const amberTides: TrackDefinition = {
  meta: {
    id: 'amber-tides',
    title: '晚风来信',
    subtitle: 'AMBER TIDES',
    artist: 'AI AUDIO / ORIGINAL 002',
    bpm: 112,
    key: 'F# minor',
    tags: ['MELODIC HOUSE', 'WARM KEYS', 'ORIGINAL'],
    description: '把节奏放慢，让旋律说完一句话。温暖电钢琴、柔软的合成主音与克制的鼓点，像晚风里一封没有署名的信。',
  },
  production: 'warm-house',
  arrangement: [
    { name: '01 / 信笺', bars: 8, energy: 'tease' },
    { name: '02 / 晚风', bars: 8, energy: 'groove' },
    { name: '03 / 想起你', bars: 8, energy: 'drop' },
    { name: '04 / 留白', bars: 8, energy: 'air' },
    { name: '05 / 回信', bars: 8, energy: 'final' },
    { name: '06 / 灯火', bars: 8, energy: 'outro' },
  ],
  harmony: [
    { root: 30, chord: [54, 57, 61, 64, 68] }, // F#m9
    { root: 26, chord: [54, 57, 61, 64] },     // Dmaj9
    { root: 33, chord: [52, 56, 59, 61, 64] }, // Amaj9, root in bass
    { root: 28, chord: [52, 56, 59, 61, 66] }, // E6/9
    { root: 30, chord: [54, 57, 61, 64, 68] },
    { root: 26, chord: [54, 57, 61, 64] },
    { root: 35, chord: [54, 57, 61, 62] },     // Bm9, root in bass
    { root: 28, chord: [52, 56, 59, 61, 66] },
  ],
  hook: [
    [
      { offset: 0, note: 73, length: 0.7, velocity: 0.78 },
      { offset: 1, note: 76, length: 0.45, velocity: 0.65 },
      { offset: 1.75, note: 78, length: 0.9, velocity: 0.83 },
      { offset: 3, note: 76, length: 0.65, velocity: 0.64 },
    ],
    [
      { offset: 0, note: 73, length: 0.9, velocity: 0.75 },
      { offset: 1.5, note: 71, length: 0.4, velocity: 0.58 },
      { offset: 2.25, note: 69, length: 1.35, velocity: 0.7 },
    ],
    [
      { offset: 0.5, note: 71, length: 0.45, velocity: 0.58 },
      { offset: 1.25, note: 73, length: 0.6, velocity: 0.72 },
      { offset: 2.25, note: 76, length: 1.2, velocity: 0.79 },
    ],
    [
      { offset: 0, note: 71, length: 0.7, velocity: 0.72 },
      { offset: 1, note: 68, length: 0.5, velocity: 0.62 },
      { offset: 2, note: 66, length: 0.55, velocity: 0.57 },
      { offset: 2.75, note: 68, length: 0.8, velocity: 0.65 },
    ],
    [
      { offset: 0, note: 73, length: 0.6, velocity: 0.76 },
      { offset: 0.75, note: 76, length: 0.45, velocity: 0.66 },
      { offset: 1.5, note: 78, length: 1.1, velocity: 0.84 },
      { offset: 3, note: 80, length: 0.65, velocity: 0.73 },
    ],
    [
      { offset: 0.25, note: 78, length: 0.85, velocity: 0.76 },
      { offset: 1.5, note: 76, length: 0.5, velocity: 0.62 },
      { offset: 2.25, note: 73, length: 1.3, velocity: 0.71 },
    ],
    [
      { offset: 0, note: 74, length: 0.7, velocity: 0.74 },
      { offset: 1, note: 73, length: 0.55, velocity: 0.65 },
      { offset: 2, note: 71, length: 1.2, velocity: 0.7 },
    ],
    [
      { offset: 0, note: 68, length: 0.65, velocity: 0.6 },
      { offset: 1, note: 71, length: 0.65, velocity: 0.67 },
      { offset: 2, note: 73, length: 1.15, velocity: 0.75 },
    ],
  ],
};
