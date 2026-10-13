import type { TrackDefinition } from '../music/types.ts';

/** Original pop phrase: repeat the question, lift the answer, leave a breath. */
export const afterglow: TrackDefinition = {
  meta: {
    id: 'afterglow', title: '余温', subtitle: 'AFTERGLOW',
    artist: 'AI AUDIO / ORIGINAL 005', bpm: 118, key: 'F# minor',
    tags: ['EMOTIONAL POP', 'MELODIC ELECTRONIC', 'SHORT VIDEO'],
    description: '落日之后，还留着一点余温。电钢琴先说出那句旋律，柔软电子主音接过应答；轻鼓点、空气和弦与渐渐明亮的尾句，让夜景与回忆都有落点。',
  },
  production: 'emotional-pop',
  resolveHarmony: 6,
  edits: { hook: { startBar: 2, bars: 8 }, loop: { startBar: 2, bars: 8 } },
  arrangement: [
    { name: '01 / 那句旋律', bars: 2, energy: 'tease' },
    { name: '02 / 余温', bars: 8, energy: 'drop' },
    { name: '03 / 走过街灯', bars: 8, energy: 'groove' },
    { name: '04 / 想起你', bars: 4, energy: 'air' },
    { name: '05 / 再亮一点', bars: 12, energy: 'final' },
    { name: '06 / 留在晚风里', bars: 6, energy: 'outro' },
  ],
  harmony: [
    { root: 38, chord: [54, 57, 61, 64] }, // Dmaj9
    { root: 38, chord: [54, 57, 61, 64] },
    { root: 33, chord: [52, 56, 59, 61] }, // Amaj9
    { root: 33, chord: [52, 56, 59, 61] },
    { root: 40, chord: [56, 59, 61, 66] }, // E6/9
    { root: 40, chord: [56, 59, 61, 66] },
    { root: 30, chord: [57, 61, 64, 68] }, // F#m9
    { root: 30, chord: [57, 61, 64, 68] },
  ],
  hook: [
    [
      { offset: 0, note: 73, length: 0.72, velocity: 0.86 },
      { offset: 1, note: 73, length: 0.34, velocity: 0.66 },
      { offset: 1.5, note: 76, length: 0.36, velocity: 0.76 },
      { offset: 2, note: 78, length: 1.08, velocity: 0.9 },
      { offset: 3.5, note: 76, length: 0.32, velocity: 0.68 },
    ],
    [
      { offset: 0.5, note: 73, length: 0.62, velocity: 0.74 },
      { offset: 1.5, note: 71, length: 0.38, velocity: 0.65 },
      { offset: 2.5, note: 69, length: 1.06, velocity: 0.78 },
    ],
    [
      { offset: 0, note: 73, length: 0.72, velocity: 0.82 },
      { offset: 1, note: 73, length: 0.34, velocity: 0.64 },
      { offset: 1.5, note: 76, length: 0.36, velocity: 0.74 },
      { offset: 2, note: 80, length: 0.7, velocity: 0.88 },
      { offset: 3, note: 78, length: 0.54, velocity: 0.77 },
    ],
    [
      { offset: 0.5, note: 76, length: 0.65, velocity: 0.72 },
      { offset: 1.5, note: 73, length: 0.4, velocity: 0.69 },
      { offset: 2.5, note: 71, length: 0.9, velocity: 0.74 },
    ],
    [
      { offset: 0, note: 71, length: 0.72, velocity: 0.81 },
      { offset: 1, note: 71, length: 0.34, velocity: 0.64 },
      { offset: 1.5, note: 73, length: 0.36, velocity: 0.72 },
      { offset: 2, note: 76, length: 1.08, velocity: 0.88 },
      { offset: 3.5, note: 73, length: 0.32, velocity: 0.67 },
    ],
    [
      { offset: 0.5, note: 71, length: 0.62, velocity: 0.74 },
      { offset: 1.5, note: 68, length: 0.4, velocity: 0.64 },
      { offset: 2.5, note: 66, length: 1.06, velocity: 0.78 },
    ],
    [
      { offset: 0, note: 69, length: 0.7, velocity: 0.83 },
      { offset: 1, note: 69, length: 0.34, velocity: 0.66 },
      { offset: 1.5, note: 73, length: 0.36, velocity: 0.78 },
      { offset: 2, note: 78, length: 0.8, velocity: 0.9 },
      { offset: 3, note: 76, length: 0.6, velocity: 0.75 },
    ],
    [
      { offset: 0.5, note: 73, length: 0.62, velocity: 0.76 },
      { offset: 1.5, note: 69, length: 0.38, velocity: 0.67 },
      { offset: 2.5, note: 66, length: 1.1, velocity: 0.8 },
    ],
  ],
};
