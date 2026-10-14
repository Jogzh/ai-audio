import type { HookBar, HookNote, TrackDefinition } from '../music/types.ts';

const n = (offset: number, note: number, length: number, velocity = 0.72): HookNote => ({ offset, note, length, velocity });

// One two-bar thought: D–E–F#, then E–F#–D. The flute breathes after
// the answer; the accompaniment does not turn each breath into another solo.
const hook: HookBar[] = [
  [n(0, 74, 1.35, 0.7), n(1.5, 76, 0.35, 0.65), n(2, 78, 1.55, 0.75)],
  [n(0, 76, 0.75, 0.67), n(1, 78, 0.75, 0.71), n(2, 74, 1.25, 0.68)],
  [n(0, 71, 1.25, 0.67), n(1.5, 74, 0.35, 0.63), n(2, 78, 1.55, 0.73)],
  [n(0, 76, 1.25, 0.67), n(1.5, 74, 1.5, 0.66)],
  [n(0, 69, 0.75, 0.63), n(1, 71, 0.75, 0.66), n(2, 74, 1.55, 0.71)],
  [n(0, 78, 1.25, 0.74), n(1.5, 76, 0.35, 0.66), n(2, 74, 1.25, 0.68)],
  [n(0, 76, 1.35, 0.69), n(1.5, 81, 1.75, 0.73)],
  [n(0, 76, 0.75, 0.66), n(1, 69, 1.75, 0.62)],
];

const bridgeHook: HookBar[] = [
  [n(0, 71, 1.65, 0.59), n(2, 74, 1.25, 0.62)],
  [n(0, 78, 2.75, 0.63)],
  [n(0, 76, 1.65, 0.61), n(2, 74, 1.25, 0.59)],
  [n(0, 69, 1.75, 0.56)],
  [n(0, 71, 1.65, 0.59), n(2, 74, 1.25, 0.62)],
  [n(0, 78, 2.75, 0.63)],
  [n(0, 76, 1.65, 0.61), n(2, 74, 1.25, 0.59)],
  [n(0, 69, 1.75, 0.56)],
];

export const inkTide: TrackDefinition = {
  meta: {
    id: 'ink-tide', title: '墨潮', subtitle: 'INK TIDE',
    artist: 'AI AUDIO / ORIGINAL 008', bpm: 92, key: 'D major / D pentatonic melody',
    tags: ['LYRICAL CINEMA', 'ACOUSTIC ENSEMBLE', 'REVISION 06'],
    description: '长笛唱出一段可以轻轻哼出的旋律，钢琴沿同一个脉搏铺开和声。弦乐慢慢进入，鼓与低音稳住脚步；最后一次主题先向高处聚拢，再用竖琴和弦乐托住峰值，最后安静落回 D 大调。',
  },
  production: 'ink-tide',
  resolveHarmony: 0,
  edits: { hook: { startBar: 2, bars: 8 }, loop: { startBar: 2, bars: 8 } },
  arrangement: [
    { name: '01 / 清晨的窗', bars: 2, energy: 'tease' },
    { name: '02 / 一句话的光', bars: 8, energy: 'drop' },
    { name: '03 / 慢慢向前', bars: 8, energy: 'groove' },
    { name: '04 / 风停下来', bars: 4, energy: 'air' },
    { name: '05 / 光越过山', bars: 16, energy: 'final' },
    { name: '06 / 留在心里', bars: 2, energy: 'outro' },
  ],
  // Nearby voicings hold common tones; bass notes are the actual roots.
  harmony: [
    { root: 38, chord: [50, 54, 57, 64] }, // Dadd9
    { root: 38, chord: [50, 54, 57, 64] },
    { root: 35, chord: [50, 54, 57, 59] }, // Bm7/D
    { root: 35, chord: [50, 54, 57, 59] },
    { root: 43, chord: [50, 54, 55, 59] }, // Gmaj7/D, bass G2
    { root: 43, chord: [50, 54, 55, 59] },
    { root: 45, chord: [52, 57, 59, 61] }, // Aadd9/E, bass A2
    { root: 45, chord: [52, 57, 59, 61] },
  ],
  hook,
  inkTide: {
    // One low reply at the eight-bar cadence leaves the other breaths open.
    response: [[], [], [], [], [], [], [], [n(3.25, 57, 0.3, 0.4)]],
    finalResponse: [[], [], [], [], [], [], [], []],
    finalHook: [
      [n(0, 74, 0.75, 0.74), n(1, 76, 0.75, 0.71), n(2, 78, 1.55, 0.79)],
      [n(0, 81, 1.35, 0.8), n(1.5, 78, 0.35, 0.72), n(2, 76, 1.25, 0.73)],
      [n(0, 76, 0.75, 0.75), n(1, 78, 0.75, 0.76), n(2, 81, 1.55, 0.82)],
      [n(0, 78, 1.25, 0.77), n(1.5, 76, 1.5, 0.73)],
      [n(0, 78, 0.75, 0.75), n(1, 81, 0.75, 0.82), n(2, 83, 1.55, 0.83)],
      [n(0, 81, 1.15, 0.8), n(1.5, 78, 0.35, 0.72), n(2, 76, 1.35, 0.75)],
      [n(0, 78, 0.75, 0.77), n(1, 81, 0.75, 0.83), n(2, 83, 1.55, 0.84)],
      [n(0, 81, 0.75, 0.8), n(1, 78, 0.75, 0.74), n(2, 74, 1.75, 0.78)],
    ],
    bridgeHook,
  },
};
