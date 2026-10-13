export const versions = ['full', 'hook', 'loop'] as const;
export type Version = typeof versions[number];
export type Instrument = 'kick' | 'clap' | 'hat' | 'openHat' | 'perc' | 'bass' | 'sub' | 'lead' | 'chord' | 'pad' | 'spark' | 'riser' | 'impact' | 'guitar' | 'electricBass' | 'organ' | 'pluck' | 'shaker' | 'rim' | 'conga';

export interface RenderOptions {
  version: Version;
  bpm: number;
  transpose: number;
  seed: number;
}

export interface MusicalEvent {
  instrument: Instrument;
  beat: number;
  duration: number;
  notes?: number[];
  velocity: number;
}

export interface Section {
  name: string;
  bars: number;
  energy: 'tease' | 'groove' | 'build' | 'drop' | 'air' | 'final' | 'outro';
}

export interface TrackDefinition {
  meta: {
    id: string;
    title: string;
    subtitle: string;
    artist: string;
    bpm: number;
    key: string;
    tags: string[];
    description: string;
  };
  production?: 'warm-house' | 'disco-house';
  arrangement: Section[];
  hook: { offset: number; note: number; length: number; velocity: number }[][];
  harmony: { root: number; chord: number[] }[];
}

export interface Arrangement {
  events: MusicalEvent[];
  beats: number;
  sections: { name: string; start: number; end: number }[];
}

export interface AudioStats {
  peak: number;
  rms: number;
  peakDb: number;
  rmsDb: number;
  clippedSamples: number;
  dcOffset: number;
}

export interface SampleCredit {
  title: string;
  author: string;
  source: string;
  license: string;
  licenseUrl: string;
  revision: string;
  modifications: string;
}

export interface RenderedTrack {
  buffer: AudioBuffer;
  duration: number;
  options: RenderOptions;
  peaks: number[];
  sections: Arrangement['sections'];
  stats: AudioStats;
  filename: string;
  credits: SampleCredit[];
}
