import type { HookBar, TrackDefinition } from '../music/types.ts';

/** D / F / G / A / C: an original pentatonic call, with room to breathe. */
const hook: HookBar[] = [
  [
    { offset: 0, note: 74, length: 0.68, velocity: 0.8 },
    { offset: 0.75, note: 77, length: 0.42, velocity: 0.73 },
    { offset: 1.25, note: 79, length: 0.56, velocity: 0.79 },
    { offset: 2, note: 81, length: 1.12, velocity: 0.87 },
    { offset: 3.5, note: 79, length: 0.32, velocity: 0.67 },
  ],
  [
    { offset: 0, note: 77, length: 0.88, velocity: 0.78 },
    { offset: 1, note: 74, length: 0.8, velocity: 0.72 },
    { offset: 2.25, note: 72, length: 1.18, velocity: 0.73 },
  ],
  [
    { offset: 0, note: 72, length: 0.42, velocity: 0.72 },
    { offset: 0.5, note: 74, length: 0.42, velocity: 0.74 },
    { offset: 1, note: 77, length: 0.84, velocity: 0.8 },
    { offset: 2, note: 81, length: 0.84, velocity: 0.85 },
    { offset: 3, note: 79, length: 0.76, velocity: 0.76 },
  ],
  [
    { offset: 0, note: 79, length: 0.86, velocity: 0.79 },
    { offset: 1, note: 84, length: 0.82, velocity: 0.88 },
    { offset: 2.25, note: 81, length: 0.65, velocity: 0.8 },
    { offset: 3.25, note: 79, length: 0.5, velocity: 0.71 },
  ],
  [
    { offset: 0, note: 74, length: 0.68, velocity: 0.79 },
    { offset: 0.75, note: 77, length: 0.42, velocity: 0.75 },
    { offset: 1.25, note: 79, length: 0.56, velocity: 0.8 },
    { offset: 2, note: 81, length: 1.3, velocity: 0.89 },
    { offset: 3.5, note: 79, length: 0.32, velocity: 0.69 },
  ],
  [
    { offset: 0, note: 77, length: 0.86, velocity: 0.79 },
    { offset: 1, note: 74, length: 0.4, velocity: 0.72 },
    { offset: 1.5, note: 77, length: 0.4, velocity: 0.76 },
    { offset: 2, note: 81, length: 0.82, velocity: 0.85 },
    { offset: 3, note: 84, length: 0.7, velocity: 0.87 },
  ],
  [
    { offset: 0, note: 81, length: 0.86, velocity: 0.84 },
    { offset: 1, note: 79, length: 0.86, velocity: 0.79 },
    { offset: 2, note: 77, length: 0.42, velocity: 0.73 },
    { offset: 2.5, note: 79, length: 0.42, velocity: 0.78 },
    { offset: 3, note: 81, length: 0.76, velocity: 0.83 },
  ],
  [
    { offset: 0, note: 79, length: 0.86, velocity: 0.78 },
    { offset: 1, note: 77, length: 0.86, velocity: 0.74 },
    { offset: 2, note: 74, length: 1.68, velocity: 0.81 },
  ],
];

export const mountainsAwake: TrackDefinition = {
  meta: {
    id: 'mountains-awake', title: '山河醒', subtitle: 'MOUNTAINS AWAKE',
    artist: 'AI AUDIO / ORIGINAL 007', bpm: 96, key: 'D minor pentatonic',
    tags: ['CINEMATIC GUOFENG', 'EPIC POP', 'NEW TIMBRES'],
    description: '筝弦划开晨雾，笛与二胡把五声旋律递向远山。流行和声与切分低音托住堂鼓、铜管和宽阔弦乐，凝结筝音的钟玉颗粒在留白中闪过；最后一次主题登高，落回一个安静的 D。',
  },
  production: 'cinematic-guofeng',
  resolveHarmony: 0,
  edits: { hook: { startBar: 16, bars: 8 }, loop: { startBar: 16, bars: 8 } },
  arrangement: [
    { name: '01 / 云开', bars: 4, energy: 'tease' },
    { name: '02 / 沿山而行', bars: 8, energy: 'groove' },
    { name: '03 / 风向高处', bars: 4, energy: 'build' },
    { name: '04 / 山河醒', bars: 8, energy: 'drop' },
    { name: '05 / 一川月色', bars: 4, energy: 'air' },
    { name: '06 / 万象向光', bars: 16, energy: 'final' },
    { name: '07 / 余响入山', bars: 4, energy: 'outro' },
  ],
  // Two-bar pop harmony under a pentatonic melody; sustained layers agree with the bass.
  harmony: [
    { root: 38, chord: [57, 62, 65, 69] }, // Dm
    { root: 38, chord: [57, 62, 65, 69] },
    { root: 34, chord: [58, 62, 65, 69] }, // Bbmaj7
    { root: 34, chord: [58, 62, 65, 69] },
    { root: 41, chord: [57, 60, 65, 67] }, // Fadd9
    { root: 41, chord: [57, 60, 65, 67] },
    { root: 36, chord: [55, 60, 62, 64] }, // Cadd9
    { root: 36, chord: [55, 60, 62, 64] },
  ],
  hook,
  cinematicGuofeng: {
    finalHook: [
      hook[0],
      [
        { offset: 0, note: 74, length: 0.84, velocity: 0.81 },
        { offset: 1, note: 77, length: 0.84, velocity: 0.8 },
        { offset: 2, note: 81, length: 1.36, velocity: 0.89 },
      ],
      [
        { offset: 0, note: 77, length: 0.42, velocity: 0.8 },
        { offset: 0.5, note: 79, length: 0.42, velocity: 0.82 },
        { offset: 1, note: 81, length: 0.84, velocity: 0.85 },
        { offset: 2, note: 84, length: 1.36, velocity: 0.9 },
      ],
      [
        { offset: 0, note: 86, length: 1.32, velocity: 0.91 },
        { offset: 1.5, note: 84, length: 0.6, velocity: 0.84 },
        { offset: 2.25, note: 81, length: 0.7, velocity: 0.81 },
        { offset: 3.25, note: 79, length: 0.5, velocity: 0.75 },
      ],
      [
        { offset: 0, note: 81, length: 0.84, velocity: 0.86 },
        { offset: 1, note: 79, length: 0.84, velocity: 0.82 },
        { offset: 2, note: 77, length: 0.7, velocity: 0.78 },
        { offset: 3, note: 74, length: 0.7, velocity: 0.79 },
      ],
      [
        { offset: 0, note: 77, length: 0.84, velocity: 0.8 },
        { offset: 1, note: 79, length: 0.84, velocity: 0.83 },
        { offset: 2, note: 81, length: 0.82, velocity: 0.87 },
        { offset: 3, note: 84, length: 0.7, velocity: 0.9 },
      ],
      [
        { offset: 0, note: 81, length: 0.84, velocity: 0.86 },
        { offset: 1, note: 79, length: 0.84, velocity: 0.81 },
        { offset: 2, note: 77, length: 0.42, velocity: 0.78 },
        { offset: 2.5, note: 79, length: 0.42, velocity: 0.81 },
        { offset: 3, note: 81, length: 0.7, velocity: 0.85 },
      ],
      [
        { offset: 0, note: 84, length: 1.55, velocity: 0.9 },
        { offset: 1.75, note: 81, length: 0.8, velocity: 0.83 },
        { offset: 2.75, note: 86, length: 0.93, velocity: 0.89 },
      ],
    ],
    bridgeHook: [
      [{ offset: 0, note: 74, length: 2.6, velocity: 0.67 }],
      [{ offset: 0.75, note: 72, length: 1.65, velocity: 0.61 }],
      [{ offset: 0, note: 69, length: 2.5, velocity: 0.64 }],
      [{ offset: 1, note: 67, length: 1.6, velocity: 0.6 }],
      [{ offset: 0, note: 65, length: 2.6, velocity: 0.61 }],
      [{ offset: 0.75, note: 67, length: 1.65, velocity: 0.59 }],
      [{ offset: 0, note: 69, length: 2.5, velocity: 0.64 }],
      [{ offset: 1, note: 74, length: 1.6, velocity: 0.65 }],
    ],
  },
};
