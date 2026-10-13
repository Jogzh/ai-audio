import c4 from '../audio/samples/guitar-acoustic/C4.mp3?url';
import f4 from '../audio/samples/guitar-acoustic/F4.mp3?url';
import a4 from '../audio/samples/guitar-acoustic/A4.mp3?url';
import c5 from '../audio/samples/guitar-acoustic/C5.mp3?url';
import e2 from '../audio/samples/bass-electric/E2.mp3?url';
import g2 from '../audio/samples/bass-electric/G2.mp3?url';
import as2 from '../audio/samples/bass-electric/As2.mp3?url';
import cs3 from '../audio/samples/bass-electric/Cs3.mp3?url';
import type { Instrument, SampleCredit } from '../music/types';

export type SampleInstrument = 'guitar' | 'electricBass';
export type SampleBank = Partial<Record<SampleInstrument, Record<string, AudioBuffer>>>;
const urls: Record<SampleInstrument, Record<string, string>> = {
  guitar: { C4: c4, F4: f4, A4: a4, C5: c5 },
  electricBass: { E2: e2, G2: g2, 'A#2': as2, 'C#3': cs3 },
};
const revision = '622c2f1c32c8cfce4158ddc3eb26e518ddef37e5';
const credits: Record<SampleInstrument, SampleCredit> = {
  guitar: {
    title: 'Acoustic guitar / C4 F4 A4 C5',
    author: 'N. P. Brosowsky (sample editing); University of Iowa (original recordings)',
    source: 'https://github.com/nbrosowsky/tonejs-instruments',
    license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', revision,
    modifications: 'Original library files retained; playback converts to mono, trims leading silence, removes DC, repitches and applies envelopes/EQ.',
  },
  electricBass: {
    title: 'Electric bass / E2 G2 A#2 C#3',
    author: 'N. P. Brosowsky (sample editing); Karoryfer (original recordings)',
    source: 'https://github.com/nbrosowsky/tonejs-instruments',
    license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', revision,
    modifications: 'Original library files retained; playback converts to mono, trims leading silence, removes DC, repitches and applies envelopes/EQ.',
  },
};
export function sampleCredits(instruments: readonly Instrument[]): SampleCredit[] {
  return (Object.keys(urls) as SampleInstrument[]).filter(name => instruments.includes(name)).map(name => ({ ...credits[name] }));
}
const cache = new Map<string, Promise<AudioBuffer>>();
let decoder: OfflineAudioContext | undefined;

function load(url: string): Promise<AudioBuffer> {
  const previous = cache.get(url);
  if (previous) return previous;
  const pending = (async () => {
    // A fixed-rate decoder avoids a device-dependent 48 kHz -> 44.1 kHz double resample.
    decoder ??= new OfflineAudioContext(1, 1, 44100);
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`采样加载失败: ${response.status}`);
    const source = await decoder.decodeAudioData(await response.arrayBuffer());
    const mono = new Float32Array(source.length);
    for (let channel = 0; channel < source.numberOfChannels; channel++) {
      const data = source.getChannelData(channel);
      for (let index = 0; index < mono.length; index++) mono[index] += data[index] / source.numberOfChannels;
    }
    let peak = 0;
    let sum = 0;
    for (const value of mono) { peak = Math.max(peak, Math.abs(value)); sum += value; }
    if (peak < 0.001) throw new Error('采样为静音');
    const onset = mono.findIndex(value => Math.abs(value) > peak * 0.018);
    const start = Math.max(0, onset - Math.round(source.sampleRate * 0.003));
    const buffer = new AudioBuffer({ numberOfChannels: 1, length: mono.length - start, sampleRate: 44100 });
    const output = buffer.getChannelData(0);
    const mean = sum / mono.length;
    const fade = Math.max(1, Math.round(source.sampleRate * 0.003));
    for (let index = 0; index < output.length; index++) output[index] = (mono[start + index] - mean) * Math.min(1, index / fade, (output.length - 1 - index) / fade);
    return buffer;
  })();
  cache.set(url, pending);
  void pending.catch(() => { if (cache.get(url) === pending) cache.delete(url); });
  return pending;
}

/** Decode before entering Tone.Offline; never fetch or create a live sampler inside its callback. */
export async function loadSamples(instruments: readonly Instrument[]): Promise<SampleBank> {
  const bank: SampleBank = {};
  await Promise.all((Object.keys(urls) as SampleInstrument[]).filter(name => instruments.includes(name)).map(async name => {
    const entries = await Promise.all(Object.entries(urls[name]).map(async ([note, url]) => [note, await load(url)] as const));
    bank[name] = Object.fromEntries(entries);
  }));
  return bank;
}
