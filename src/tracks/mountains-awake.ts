import type { HookBar, HookNote, TrackDefinition } from '../music/types.ts';

const n = (offset: number, note: number, length: number, velocity = 0.8): HookNote => ({ offset, note, length, velocity });

// A three-note call, then a descending answer: all entrances follow the half-beat grid.
const hook: HookBar[] = [
  [n(0, 74, 1.4), n(1.5, 77, 0.4, 0.72), n(2, 81, 1.5, 0.85)],
  [n(0, 79, 0.85, 0.76), n(1, 77, 0.85, 0.73), n(2, 74, 1.6)],
  [n(0, 77, 1.6), n(2, 79, 0.4, 0.72), n(2.5, 77, 0.4, 0.7), n(3, 74, 0.8, 0.75)],
  [n(0, 77, 1.6, 0.77), n(2, 74, 1.6, 0.75)],
  [n(0, 81, 1.4, 0.85), n(1.5, 79, 0.4, 0.73), n(2, 77, 1.6)],
  [n(0, 77, 1.4, 0.76), n(1.5, 81, 0.4, 0.8), n(2, 79, 1.6, 0.78)],
  [n(0, 79, 1.4), n(1.5, 81, 0.4, 0.75), n(2, 79, 0.8, 0.76), n(3, 72, 0.8, 0.7)],
  [n(0, 72, 1.4, 0.73), n(2, 74, 1.6)],
];

export const mountainsAwake: TrackDefinition = {
  meta: {
    id: 'mountains-awake', title: '山河醒', subtitle: 'MOUNTAINS AWAKE',
    artist: 'AI AUDIO / ORIGINAL 007', bpm: 104, key: 'D minor pentatonic',
    tags: ['CINEMATIC GUOFENG', 'STEADY POP GROOVE', 'REVISION 02'],
    description: '筝声开场，二胡低声陈述，笛子唱出清晰的三音主题。稳定的流行鼓与同拍低音带动副歌，弦乐逐步展开，深鼓只在转段出现；留白后再向高处推进，最后落回安静的 D。',
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
  // Simple triads, with one doubled chord tone to retain the four-note harmony contract.
  harmony: [
    { root: 38, chord: [57, 62, 65, 69] },
    { root: 38, chord: [57, 62, 65, 69] },
    { root: 34, chord: [53, 58, 62, 65] },
    { root: 34, chord: [53, 58, 62, 65] },
    { root: 41, chord: [57, 60, 65, 69] },
    { root: 41, chord: [57, 60, 65, 69] },
    { root: 36, chord: [55, 60, 64, 67] },
    { root: 36, chord: [55, 60, 64, 67] },
  ],
  hook,
  cinematicGuofeng: {
    finalHook: [
      hook[0],
      [n(0, 79, 0.85, 0.8), n(1, 77, 0.85, 0.75), n(2, 81, 1.6, 0.85)],
      hook[2],
      [n(0, 77, 1.4, 0.8), n(1.5, 79, 0.4, 0.76), n(2, 81, 1.6, 0.86)],
      [n(0, 81, 1.4, 0.86), n(1.5, 84, 0.4, 0.82), n(2, 81, 1.6, 0.85)],
      hook[5],
      [n(0, 84, 1.4, 0.87), n(1.5, 81, 0.4, 0.8), n(2, 79, 0.8, 0.77), n(3, 72, 0.8, 0.73)],
      hook[7],
    ],
    bridgeHook: [
      [n(0, 69, 2.8, 0.65)],
      [n(0, 67, 2.8, 0.6)],
      [n(0, 65, 2.8, 0.62)],
      [n(0, 62, 2.8, 0.6)],
      [n(0, 65, 2.8, 0.62)],
      [n(0, 67, 2.8, 0.6)],
      [n(0, 69, 2.8, 0.65)],
      [n(0, 62, 2.8, 0.62)],
    ],
  },
};
