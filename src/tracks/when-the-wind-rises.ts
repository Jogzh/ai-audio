import type { TrackDefinition } from '../music/types.ts';

/** Original rising question, answered by a quieter piano in the space it leaves. */
export const whenTheWindRises: TrackDefinition = {
  meta: {
    id: 'when-the-wind-rises', title: '风起时', subtitle: 'WHEN THE WIND RISES',
    artist: 'AI AUDIO / ORIGINAL 006', bpm: 114, key: 'D major',
    tags: ['MELODIC POP', 'SOFT ELECTRONIC', 'HOPEFUL'],
    description: '风吹过来，心情也慢慢亮起来。上行的三音主题与低声电钢琴互相应答，切分低音托住轻鼓点；留白后，熟悉的旋律展开成更明亮的一句。',
  },
  production: 'emotional-pop',
  resolveHarmony: 0,
  edits: { hook: { startBar: 2, bars: 8 }, loop: { startBar: 2, bars: 8 } },
  arrangement: [
    { name: '01 / 风从这里起', bars: 2, energy: 'tease' },
    { name: '02 / 向着光', bars: 8, energy: 'drop' },
    { name: '03 / 沿途的温柔', bars: 8, energy: 'groove' },
    { name: '04 / 停一停', bars: 4, energy: 'air' },
    { name: '05 / 风起时', bars: 16, energy: 'final' },
    { name: '06 / 把光留下', bars: 6, energy: 'outro' },
  ],
  harmony: [
    { root: 38, chord: [54, 57, 61, 64] }, // Dmaj9
    { root: 38, chord: [54, 57, 61, 64] },
    { root: 35, chord: [54, 57, 62, 66] }, // Bm7
    { root: 35, chord: [54, 57, 62, 66] },
    { root: 31, chord: [54, 57, 59, 62] }, // Gmaj9
    { root: 31, chord: [54, 57, 59, 62] },
    { root: 33, chord: [54, 59, 61, 64] }, // A6/9: a gentle lift back to D
    { root: 33, chord: [54, 59, 61, 64] },
  ],
  hook: [
    [
      { offset: 0, note: 69, length: 0.44, velocity: 0.78 },
      { offset: 0.75, note: 74, length: 0.68, velocity: 0.82 },
      { offset: 1.75, note: 78, length: 0.8, velocity: 0.88 },
      { offset: 3, note: 76, length: 0.46, velocity: 0.69 },
    ],
    [
      { offset: 0.25, note: 74, length: 0.75, velocity: 0.77 },
      { offset: 1.5, note: 69, length: 0.66, velocity: 0.69 },
    ],
    [
      { offset: 0, note: 69, length: 0.44, velocity: 0.78 },
      { offset: 0.75, note: 74, length: 0.68, velocity: 0.81 },
      { offset: 1.75, note: 78, length: 0.8, velocity: 0.87 },
      { offset: 3, note: 81, length: 0.48, velocity: 0.82 },
    ],
    [
      { offset: 0.25, note: 78, length: 0.9, velocity: 0.79 },
      { offset: 1.5, note: 76, length: 0.64, velocity: 0.7 },
    ],
    [
      { offset: 0, note: 74, length: 0.44, velocity: 0.8 },
      { offset: 0.75, note: 71, length: 0.68, velocity: 0.77 },
      { offset: 1.75, note: 69, length: 0.8, velocity: 0.75 },
      { offset: 3, note: 71, length: 0.46, velocity: 0.72 },
    ],
    [
      { offset: 0.25, note: 69, length: 0.9, velocity: 0.76 },
      { offset: 1.5, note: 67, length: 0.64, velocity: 0.68 },
    ],
    [
      { offset: 0, note: 76, length: 0.44, velocity: 0.79 },
      { offset: 0.75, note: 78, length: 0.68, velocity: 0.82 },
      { offset: 1.75, note: 81, length: 0.8, velocity: 0.88 },
      { offset: 3, note: 78, length: 0.46, velocity: 0.72 },
    ],
    [
      { offset: 0.25, note: 76, length: 0.9, velocity: 0.77 },
      { offset: 1.5, note: 73, length: 0.64, velocity: 0.7 },
    ],
  ],
  emotionalPop: {
    groove: 'syncopated',
    // Silence in the main phrase is occupied by a softer voice, not a doubled lead.
    response: [
      [],
      [
        { offset: 2.75, note: 66, length: 0.32, velocity: 0.72 },
        { offset: 3.25, note: 64, length: 0.48, velocity: 0.65 },
      ],
      [],
      [
        { offset: 2.75, note: 74, length: 0.32, velocity: 0.74 },
        { offset: 3.25, note: 71, length: 0.48, velocity: 0.67 },
      ],
      [],
      [
        { offset: 2.75, note: 66, length: 0.32, velocity: 0.7 },
        { offset: 3.25, note: 62, length: 0.48, velocity: 0.66 },
      ],
      [],
      [
        { offset: 2.75, note: 76, length: 0.32, velocity: 0.74 },
        { offset: 3.25, note: 73, length: 0.48, velocity: 0.67 },
      ],
    ],
    // Return to the signature before developing its final ascent.
    finalHook: [
      [
        { offset: 0, note: 69, length: 0.44, velocity: 0.8 },
        { offset: 0.75, note: 74, length: 0.68, velocity: 0.84 },
        { offset: 1.75, note: 78, length: 0.8, velocity: 0.9 },
        { offset: 3, note: 81, length: 0.48, velocity: 0.85 },
      ],
      [
        { offset: 0.25, note: 78, length: 0.9, velocity: 0.8 },
        { offset: 1.5, note: 74, length: 0.64, velocity: 0.74 },
      ],
      [
        { offset: 0, note: 74, length: 0.44, velocity: 0.81 },
        { offset: 0.75, note: 78, length: 0.68, velocity: 0.85 },
        { offset: 1.75, note: 81, length: 0.8, velocity: 0.9 },
        { offset: 3, note: 83, length: 0.48, velocity: 0.84 },
      ],
      [
        { offset: 0.25, note: 81, length: 0.9, velocity: 0.82 },
        { offset: 1.5, note: 78, length: 0.64, velocity: 0.74 },
      ],
      [
        { offset: 0, note: 79, length: 0.44, velocity: 0.8 },
        { offset: 0.75, note: 78, length: 0.68, velocity: 0.81 },
        { offset: 1.75, note: 74, length: 0.8, velocity: 0.84 },
        { offset: 3, note: 71, length: 0.46, velocity: 0.72 },
      ],
      [
        { offset: 0.25, note: 74, length: 0.9, velocity: 0.78 },
        { offset: 1.5, note: 71, length: 0.64, velocity: 0.7 },
      ],
      [
        { offset: 0, note: 76, length: 0.44, velocity: 0.81 },
        { offset: 0.75, note: 78, length: 0.68, velocity: 0.84 },
        { offset: 1.75, note: 81, length: 0.8, velocity: 0.89 },
        { offset: 3, note: 78, length: 0.46, velocity: 0.74 },
      ],
      [
        { offset: 0.25, note: 76, length: 0.9, velocity: 0.79 },
        { offset: 1.5, note: 73, length: 0.64, velocity: 0.72 },
      ],
    ],
    bridgeHook: [
      [{ offset: 0, note: 66, length: 2.8, velocity: 0.65 }],
      [{ offset: 0.75, note: 64, length: 1.65, velocity: 0.58 }],
      [{ offset: 0, note: 62, length: 2.8, velocity: 0.65 }],
      [{ offset: 1, note: 66, length: 1.8, velocity: 0.6 }],
      [{ offset: 0, note: 67, length: 2.8, velocity: 0.63 }],
      [{ offset: 0.75, note: 66, length: 1.65, velocity: 0.58 }],
      [{ offset: 0, note: 64, length: 2.8, velocity: 0.63 }],
      [{ offset: 1, note: 61, length: 1.8, velocity: 0.58 }],
    ],
  },
};
