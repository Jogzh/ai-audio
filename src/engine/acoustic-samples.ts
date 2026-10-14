export type AcousticInstrument = 'flute' | 'strings' | 'cello' | 'harp';

type AcousticSampleDefinition = {
  readonly midi: number;
  readonly name: string;
  readonly compensationGain: number;
};

// Scientific MIDI pitches follow the original SFZ pitch_keycenter. The flute,
// violin and cello WAV filenames use an octave convention different from harp.
const definitions: Readonly<Record<AcousticInstrument, readonly AcousticSampleDefinition[]>> = {
  flute: [
    { midi: 60, name: 'C4', compensationGain: 2 },
    { midi: 64, name: 'E4', compensationGain: 2 },
    { midi: 69, name: 'A4', compensationGain: 0.98295696 },
    { midi: 72, name: 'C5', compensationGain: 1.91422948 },
    { midi: 76, name: 'E5', compensationGain: 1.0 },
    { midi: 81, name: 'A5', compensationGain: 0.8250039 },
  ],
  strings: [
    { midi: 55, name: 'G3', compensationGain: 1.0 },
    { midi: 59, name: 'B3', compensationGain: 1.14381951 },
    { midi: 62, name: 'D4', compensationGain: 1.00869647 },
    { midi: 66, name: 'Fs4', compensationGain: 0.72290046 },
    { midi: 69, name: 'A4', compensationGain: 0.67310141 },
    { midi: 72, name: 'C5', compensationGain: 0.7273861 },
    { midi: 76, name: 'E5', compensationGain: 0.88562731 },
  ],
  cello: [
    { midi: 47, name: 'B2', compensationGain: 0.5 },
    { midi: 50, name: 'D3', compensationGain: 1.0 },
    { midi: 53, name: 'F3', compensationGain: 1.12947338 },
    { midi: 57, name: 'A3', compensationGain: 0.88125075 },
    { midi: 60, name: 'C4', compensationGain: 1.12898325 },
  ],
  harp: [
    { midi: 55, name: 'G3', compensationGain: 0.69853231 },
    { midi: 59, name: 'B3', compensationGain: 1.07052423 },
    { midi: 62, name: 'D4', compensationGain: 1.03373447 },
    { midi: 65, name: 'F4', compensationGain: 0.61190218 },
    { midi: 69, name: 'A4', compensationGain: 1.50350543 },
    { midi: 72, name: 'C5', compensationGain: 0.71361998 },
    { midi: 76, name: 'E5', compensationGain: 1.0 },
  ],
};

let banks: ReadonlyMap<AcousticInstrument, ReadonlyMap<number, AudioBuffer>> | undefined;
let pending: Promise<void> | undefined;

/** Decode every bundled recording before Tone.Offline changes the global context. */
export async function prepareAcousticSamples(): Promise<void> {
  if (banks) return;
  if (!pending) {
    pending = (async () => {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      const loaded = await Promise.all((Object.keys(definitions) as AcousticInstrument[]).map(async instrument => {
        const samples = await Promise.all(definitions[instrument].map(async ({ midi, name }) => {
          const sampleName = `${instrument}-${name}`;
          const response = await fetch(`${import.meta.env.BASE_URL}audio/vsco/${sampleName}.mp3`, { credentials: 'omit' });
          if (!response.ok) throw new Error(`原声采样加载失败：${sampleName} (${response.status})`);
          const recorded = await decoder.decodeAudioData(await response.arrayBuffer());
          if (!recorded.length || recorded.numberOfChannels < 1) throw new Error(`原声采样为空：${sampleName}`);
          // Bundled mono files preserve the source's left microphone. Never
          // average potentially phase-shifted microphones during preparation.
          const buffer = decoder.createBuffer(1, recorded.length, recorded.sampleRate);
          buffer.copyToChannel(recorded.getChannelData(0), 0);
          return [midi, buffer] as const;
        }));
        return [instrument, new Map(samples)] as const;
      }));
      // Publish atomically: a failed file must leave no partial sound bank.
      banks = new Map(loaded);
    })().catch(error => {
      pending = undefined;
      throw error;
    });
  }
  await pending;
}

/** Recordings are shared read-only data; each rendering rig owns its playback nodes. */
export function getAcousticSamples(instrument: AcousticInstrument): ReadonlyMap<number, AudioBuffer> {
  const bank = banks?.get(instrument);
  if (!bank) throw new Error(`原声采样尚未加载：${instrument}`);
  return bank;
}

/** Limited gain compensation of recorded sustain levels, without changing source files. */
export function getAcousticSampleGain(instrument: AcousticInstrument, midi: number): number {
  const nearest = definitions[instrument].reduce((best, entry) =>
    Math.abs(entry.midi - midi) < Math.abs(best.midi - midi) ? entry : best);
  return nearest.compensationGain;
}
