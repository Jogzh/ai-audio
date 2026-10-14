import { neonChangan } from './neon-changan.ts';
import type { TrackDefinition } from '../music/types.ts';

/** A separate release: the instrumental score and its existing exports stay available. */
export const neonChanganVocal: TrackDefinition = {
  ...neonChangan,
  meta: {
    ...neonChangan.meta,
    id: 'neon-changan-vocal', title: '霓虹长安 · 灯起', subtitle: 'Neon Changan Lights On', artist: 'AI AUDIO / 010',
    tags: ['国风 DJ', '原创中文人声', 'Vocal Chop', '128 BPM'],
    description: '“长安入夜，灯起！”男女声呼应、调音人声切片与古筝交替领奏；碎拍过门、反向人声和呼吸和声把第二次 Drop 推向高处。',
  },
  guofengClub: { ...neonChangan.guofengClub!, vocals: 'night-city' },
};
