/** Prepared mono PCM24 samples. Source neural speech is 24 kHz, not a live singer. */
export const vocalSamples = {
  'city-open': { kind: 'speech', midi: null },
  'night-call': { kind: 'speech', midi: null },
  'lights-on': { kind: 'speech', midi: null },
  'follow-drums': { kind: 'speech', midi: null },
  'tonight': { kind: 'speech', midi: null },
  'together': { kind: 'speech', midi: null },
  'hey': { kind: 'chop', midi: null },
  'ah-a4': { kind: 'chop', midi: 69 },
  'ye-a4': { kind: 'chop', midi: 69 },
  'choir-d4': { kind: 'texture', midi: 62 },
  'reverse-a4': { kind: 'texture', midi: 69 },
} as const;
export type VocalSampleId = keyof typeof vocalSamples;
