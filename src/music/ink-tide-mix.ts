import type { MixTrack, Section } from './types.ts';

type SectionLevels = readonly [number, number, number, number, number, number, number];
type ScoreSection = Pick<Section, 'bars' | 'energy'>;
const defaultSections: ScoreSection[] = [
  { bars: 2, energy: 'tease' }, { bars: 8, energy: 'drop' },
  { bars: 8, energy: 'groove' }, { bars: 4, energy: 'air' },
  { bars: 16, energy: 'final' }, { bars: 2, energy: 'outro' },
];

/** Envelopes follow the written section boundaries, including edited scores. */
function envelope(levels: SectionLevels, sections: readonly ScoreSection[]): NonNullable<MixTrack['automation']> {
  const [intro, chorus, verse, bridge, final, lift, outro] = levels;
  const levelFor = (energy: Section['energy']) => energy === 'tease' ? intro : energy === 'groove' ? verse
    : energy === 'air' ? bridge : energy === 'final' ? final : energy === 'outro' ? outro : chorus;
  const points: NonNullable<MixTrack['automation']> = [];
  const push = (beat: number, gain: number) => {
    if (points.at(-1)?.beat === beat) points[points.length - 1] = { beat, gain };
    else points.push({ beat, gain });
  };
  let beat = 0;
  let previous = levelFor(sections[0].energy);
  push(0, previous);
  for (const [index, section] of sections.entries()) {
    const level = levelFor(section.energy);
    const end = beat + section.bars * 4;
    if (index) {
      // Settled chorus boundaries keep its exported loop continuous.
      const before = section.energy === 'drop' || section.energy === 'final' || section.energy === 'outro';
      if (before) { push(beat - 0.5, previous); push(beat, level); }
      else { push(beat, previous); push(beat + 0.5, level); }
    }
    previous = level;
    if (section.energy === 'final' && section.bars > 8) {
      push(beat + 32, final);
      push(beat + 32.5, lift);
      previous = lift;
    }
    beat = end;
  }
  push(beat - 1, previous);
  push(beat, previous * 0.35);
  return points;
}

export function createInkTideMixTracks(sections: readonly ScoreSection[] = defaultSections): MixTrack[] {
  const part = (
    id: string, name: string, role: MixTrack['role'], instrument: MixTrack['instrument'],
    gain: number, pan: number, highpass: number, lowpass: number, reverb: number,
    levels: SectionLevels,
  ): MixTrack => ({ id, name, role, instrument, mix: { gain, pan, highpass, lowpass, reverb, delay: 0 }, automation: envelope(levels, sections) });
  return [
    part('flute-theme', '01 · 长笛主旋律', 'foreground', 'flute', 0.96, 0, 120, 7200, 0.18, [0, 1, 0.93, 0.76, 1.04, 1.1, 0.85]),
    part('piano-harmony', '02 · 钢琴伴奏', 'harmony', 'piano', 1.57, -0.16, 95, 7500, 0.12, [0.84, 0.84, 0.74, 0.6, 0.87, 0.9, 0.66]),
    part('piano-upper', '03 · 钢琴句尾', 'reply', 'piano', 0.8, -0.1, 130, 7200, 0.12, [0, 0.85, 0.72, 0, 0.88, 0.9, 0.5]),
    part('harp-turn', '04 · 竖琴过门', 'transition', 'harp', 0.48, 0.21, 250, 7600, 0.15, [0.66, 0, 0, 0.75, 0.42, 0.9, 0.55]),
    part('violin-bed', '05 · 弦乐长和声', 'harmony', 'strings', 0.75, -0.18, 140, 5800, 0.16, [0, 0.82, 0.67, 0.5, 0.96, 1.08, 0.5]),
    part('cello-floor', '06 · 大提琴支撑', 'harmony', 'cello', 0.76, 0.12, 85, 4200, 0.12, [0, 0.78, 0.63, 0, 0.92, 1.04, 0.45]),
    part('round-bass', '07 · 根音低音', 'bass', 'bass', 0.66, 0, 30, 900, 0, [0, 0.84, 0.7, 0, 0.88, 1.08, 0]),
    part('soft-kick', '08 · 稳定低鼓', 'rhythm', 'kick', 0.74, 0, 30, 1800, 0.025, [0, 0.79, 0.66, 0, 0.84, 1.08, 0]),
    part('brush-snare', '09 · 轻刷鼓', 'rhythm', 'perc', 0.65, -0.06, 260, 6800, 0.055, [0, 0.75, 0.62, 0, 0.81, 1.04, 0]),
    part('woven-shaker', '10 · 轻沙锤', 'rhythm', 'shaker', 0.26, 0.19, 1800, 8800, 0.02, [0, 0, 0, 0, 0, 0.98, 0]),
    part('tom-fill', '11 · 段落筒鼓', 'transition', 'tom', 0.35, 0.1, 80, 2800, 0.065, [0, 0.66, 0.5, 0, 0.72, 0.77, 0]),
    part('cymbal-air', '12 · 镲片入口', 'transition', 'cymbal', 0.2, -0.1, 1800, 7500, 0.12, [0, 0, 0, 0, 0.68, 0.7, 0]),
  ];
}

/** Instrument factories can use the same default registration as the score. */
export const inkTideMixTracks = createInkTideMixTracks();

export function automationValue(points: NonNullable<MixTrack['automation']>, beat: number): number {
  if (beat <= points[0].beat) return points[0].gain;
  for (let index = 1; index < points.length; index++) {
    const left = points[index - 1], right = points[index];
    if (beat <= right.beat) {
      const fraction = (beat - left.beat) / (right.beat - left.beat);
      return left.gain + (right.gain - left.gain) * fraction;
    }
  }
  return points[points.length - 1].gain;
}

/** A short score carries the original gain at both boundaries, not a fresh fade. */
export function cropMixTracks(tracks: MixTrack[], start: number, end: number): MixTrack[] {
  return tracks.map(track => {
    if (!track.automation?.length) return { ...track, mix: { ...track.mix } };
    const points = track.automation;
    return {
      ...track, mix: { ...track.mix },
      automation: [
        { beat: 0, gain: automationValue(points, start) },
        ...points.filter(point => point.beat > start && point.beat < end).map(point => ({ beat: point.beat - start, gain: point.gain })),
        { beat: end - start, gain: automationValue(points, end) },
      ],
    };
  });
}
