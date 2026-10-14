const sampleNotes = [
  [45, 'A2'], [48, 'C3'], [51, 'Ds3'], [54, 'Fs3'], [57, 'A3'],
  [60, 'C4'], [63, 'Ds4'], [66, 'Fs4'], [69, 'A4'], [72, 'C5'],
  [75, 'Ds5'], [78, 'Fs5'], [81, 'A5'],
] as const;

let bank: ReadonlyMap<number, AudioBuffer> | undefined;
let pending: Promise<void> | undefined;

/** Decode bundled recordings before Tone.Offline changes the global context. */
export async function preparePianoSamples(): Promise<void> {
  if (bank) return;
  if (!pending) {
    pending = (async () => {
      const decoder = new OfflineAudioContext(2, 1, 44100);
      const samples = await Promise.all(sampleNotes.map(async ([midi, name]) => {
        const url = `${import.meta.env.BASE_URL}audio/salamander/${name}.mp3`;
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) throw new Error(`钢琴采样加载失败：${name} (${response.status})`);
        const recorded = await decoder.decodeAudioData(await response.arrayBuffer());
        if (!recorded.length || recorded.numberOfChannels < 1) throw new Error(`钢琴采样为空：${name}`);
        // Use one of the original AB microphones rather than averaging phase-
        // shifted recordings. The rig supplies restrained pan and room afterwards.
        const buffer = decoder.createBuffer(1, recorded.length, recorded.sampleRate);
        buffer.copyToChannel(recorded.getChannelData(0), 0);
        return [midi, buffer] as const;
      }));
      bank = new Map(samples);
    })().catch(error => {
      pending = undefined;
      throw error;
    });
  }
  await pending;
}

/** Recordings are read-only shared data; each rig owns its playback nodes. */
export function getPianoSamples(): ReadonlyMap<number, AudioBuffer> {
  if (!bank) throw new Error('钢琴采样尚未加载');
  return bank;
}
