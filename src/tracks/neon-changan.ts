import type { HookBar, TrackDefinition } from '../music/types.ts';

const phrase = (notes: [number, number, number][]): HookBar => notes.map(([offset, note, length]) => ({ offset, note, length, velocity: offset % 1 === 0 ? 0.86 : 0.73 }));

/** Original eight-bar call/answer. D–F–G–A–C is the melodic vocabulary. */
const hook = [
  phrase([[0, 69, .32], [.5, 72, .32], [1, 74, .8], [2.25, 74, .32], [2.75, 72, .32], [3.25, 69, .55]]),
  phrase([[0, 67, .65], [1, 69, .3], [1.5, 65, .55], [2.5, 62, 1]]),
  phrase([[0, 69, .32], [.5, 72, .32], [1, 74, .8], [2.25, 77, .32], [2.75, 74, .32], [3.25, 72, .55]]),
  phrase([[0, 69, .65], [1, 67, .32], [1.5, 65, .55], [2.5, 69, 1]]),
  phrase([[0, 72, .32], [.5, 74, .32], [1, 77, .8], [2.25, 77, .32], [2.75, 74, .32], [3.25, 72, .55]]),
  phrase([[0, 69, .65], [1, 72, .32], [1.5, 69, .55], [2.5, 65, 1]]),
  phrase([[0, 67, .32], [.5, 69, .32], [1, 72, .8], [2.25, 74, .32], [2.75, 72, .32], [3.25, 69, .55]]),
  phrase([[0, 67, .65], [1, 65, .32], [1.5, 67, .4], [2.25, 69, .35], [3, 74, .7]]),
];

export const neonChangan: TrackDefinition = {
  meta: {
    id: 'neon-changan', title: '霓虹长安', subtitle: 'Neon Changan', artist: 'AI AUDIO / 009',
    bpm: 128, key: 'D minor · 五声旋律', tags: ['国风 DJ', 'Club House', '古筝 × 唢呐', '128 BPM'],
    description: '古筝的三音暗号穿过长安夜色，唢呐感主音与弹跳低音点亮舞池。竹笛半拍桥段收住灯火，第二次 Drop 把主题推向高处。',
  },
  production: 'guofeng-club',
  hook,
  guofengClub: {
    finalHook: [
      phrase([[0, 69, .3], [.5, 72, .3], [1, 74, .75], [2, 77, .3], [2.5, 79, .3], [3, 81, .7]]),
      phrase([[0, 79, .6], [1, 77, .3], [1.5, 74, .5], [2.5, 69, .85]]),
      phrase([[0, 74, .3], [.5, 77, .3], [1, 81, .75], [2.25, 81, .3], [2.75, 79, .3], [3.25, 77, .5]]),
      phrase([[0, 74, .6], [1, 72, .3], [1.5, 69, .5], [2.5, 74, .95]]),
      phrase([[0, 77, .3], [.5, 79, .3], [1, 81, .75], [2.25, 84, .3], [2.75, 81, .3], [3.25, 77, .5]]),
      phrase([[0, 79, .6], [1, 77, .3], [1.5, 74, .5], [2.5, 72, 1]]),
      phrase([[0, 74, .3], [.5, 77, .3], [1, 79, .75], [2.25, 77, .3], [2.75, 74, .3], [3.25, 72, .5]]),
      phrase([[0, 69, .6], [1, 67, .3], [1.5, 65, .4], [2.25, 69, .35], [3, 74, .75]]),
    ],
    bridgeHook: [
      phrase([[0, 74, 1.65], [2, 72, .65], [3, 69, .75]]),
      phrase([[0, 67, 1.3], [2, 65, 1.6]]),
      phrase([[0, 69, 1.3], [2, 72, .65], [3, 74, .75]]),
      phrase([[0, 77, 2.4], [3, 74, .7]]),
      phrase([[0, 77, 1.5], [2, 74, 1.4]]),
      phrase([[0, 72, 1.4], [2, 69, 1.4]]),
      phrase([[0, 67, 1.5], [2, 69, .7], [3, 72, .75]]),
      phrase([[0, 74, 2.65]]),
    ],
  },
  harmony: [
    { root: 38, chord: [50, 57, 60, 65] }, { root: 38, chord: [50, 57, 60, 65] },
    { root: 34, chord: [50, 53, 57, 60] }, { root: 34, chord: [50, 53, 57, 60] },
    { root: 41, chord: [53, 57, 60, 67] }, { root: 41, chord: [53, 57, 60, 67] },
    { root: 36, chord: [48, 55, 62, 64] }, { root: 36, chord: [48, 55, 62, 64] },
  ],
  arrangement: [
    { name: '灯起 / 古筝暗号', bars: 2, energy: 'tease' },
    { name: '开城 / 短蓄力', bars: 2, energy: 'build' },
    { name: '霓虹 / 第一 Drop', bars: 16, energy: 'drop' },
    { name: '夜游 / 弹跳古筝', bars: 8, energy: 'groove' },
    { name: '月下 / 竹笛半拍', bars: 8, energy: 'air' },
    { name: '潮起 / 二次蓄力', bars: 4, energy: 'build' },
    { name: '长安 / 最终 Drop', bars: 16, energy: 'final' },
    { name: '天明 / 归弦', bars: 4, energy: 'outro' },
  ],
  edits: { hook: { startBar: 4, bars: 8 }, loop: { startBar: 4, bars: 8 } },
  resolveHarmony: 0,
};
