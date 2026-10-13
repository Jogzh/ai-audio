export const versions = ['full', 'hook', 'loop'] as const;
export type Version = typeof versions[number];
export type Instrument = 'kick' | 'clap' | 'hat' | 'openHat' | 'perc' | 'bass' | 'sub' | 'lead' | 'chord' | 'pad' | 'spark' | 'impact' | 'piano' | 'vocal' | 'texture' | 'sweep';

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

export interface HookNote {
  offset: number;
  note: number;
  length: number;
  velocity: number;
}

export type HookBar = HookNote[];

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
  production: 'emotional-pop';
  /** Optional written development for emotional-pop; omitted fields keep its original arrangement. */
  emotionalPop?: {
    groove?: 'syncopated';
    /** Piano replies placed in the main theme's rests, with the same number of bars. */
    response?: HookBar[];
    /** A new melody for the final section from its ninth bar onward. */
    finalHook?: HookBar[];
    /** A separate, sparse melody for the drum-free bridge. */
    bridgeHook?: HookBar[];
  };
  /** Short edits refer to the actual full score, measured in bars. */
  edits?: { hook: { startBar: number; bars: number }; loop: { startBar: number; bars: number } };
  /** Harmony index used for the final resolution; defaults to the first chord. */
  resolveHarmony?: number;
  arrangement: Section[];
  hook: HookBar[];
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

export interface RenderedTrack {
  buffer: AudioBuffer;
  duration: number;
  options: RenderOptions;
  peaks: number[];
  sections: Arrangement['sections'];
  stats: AudioStats;
  filename: string;
}
