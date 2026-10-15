export const versions = ['full', 'hook', 'loop'] as const;
export type Version = typeof versions[number];
export type Instrument = 'kick' | 'clap' | 'hat' | 'openHat' | 'perc' | 'bass' | 'sub' | 'lead' | 'chord' | 'pad' | 'spark' | 'impact' | 'piano' | 'vocal' | 'texture' | 'sweep' | 'guzheng' | 'dizi' | 'erhu' | 'taiko' | 'gong' | 'brass' | 'strings' | 'granular' | 'guqin' | 'xiao' | 'jade' | 'rim' | 'shaker' | 'chineseDrum' | 'guitar' | 'violin' | 'cello' | 'tom' | 'cymbal' | 'flute' | 'harp';

/** An independently routed part, separate from the song definition. */
export interface MixTrack {
  id: string;
  name: string;
  role: 'foreground' | 'reply' | 'harmony' | 'texture' | 'bass' | 'rhythm' | 'transition';
  instrument: Instrument;
  mix: { gain: number; pan: number; highpass: number; lowpass: number; reverb: number; delay: number };
  /** Linear gain envelopes, expressed in score beats; 1 means the track's base level. */
  automation?: { beat: number; gain: number }[];
}

export interface RenderSelection {
  soloTrackIds?: string[];
  muteTrackIds?: string[];
  /** Raw stems retain mix levels and effects; they are not independently normalized. */
  processing?: 'master' | 'raw';
}

export type DrumBody = 'large' | 'medium' | 'small';
export type DrumStroke = 'open' | 'rim' | 'mute';

/** Physical playing choices; these vary timbre independently of hit volume. */
export interface DrumExpression {
  body: DrumBody;
  stroke: DrumStroke;
  position: number;
  tension: number;
  hand: 'left' | 'right';
}

export interface RenderOptions {
  version: Version;
  bpm: number;
  transpose: number;
  seed: number;
  /** Native synthesis rate; omitted preserves the original 44.1 kHz renders. */
  sampleRate?: 44100 | 48000;
}

export interface MusicalEvent {
  trackId?: string;
  instrument: Instrument;
  beat: number;
  duration: number;
  notes?: number[];
  velocity: number;
  drum?: DrumExpression;
  gesture?: 'rise' | 'fall';
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
  production: 'emotional-pop' | 'cinematic-guofeng' | 'guofeng-club';
  guofengClub?: { finalHook: HookBar[]; bridgeHook: HookBar[] };
  /** Written melody development for the separate cinematic Chinese palette. */
  cinematicGuofeng?: {
    finalHook?: HookBar[];
    bridgeHook?: HookBar[];
  };
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
  tracks?: MixTrack[];
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
  tracks?: MixTrack[];
  selection?: RenderSelection;
  buffer: AudioBuffer;
  duration: number;
  options: RenderOptions;
  peaks: number[];
  sections: Arrangement['sections'];
  stats: AudioStats;
  filename: string;
}
