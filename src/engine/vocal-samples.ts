import { vocalSamples, type VocalSampleId } from '../music/vocal-bank';

let bank: ReadonlyMap<VocalSampleId, AudioBuffer> | undefined;
let pending: Promise<void> | undefined;

/** Load atomically before Tone.Offline replaces the context; failed requests can retry. */
export async function prepareVocalSamples(): Promise<void> {
  if (bank) return;
  if (!pending) pending = (async () => {
    const decoder = new OfflineAudioContext(1, 1, 48000);
    const loaded = await Promise.all((Object.keys(vocalSamples) as VocalSampleId[]).map(async id => {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/night-city/${id}.wav`, { credentials: 'omit' });
      if (!response.ok) throw new Error(`人声采样加载失败：${id} (${response.status})`);
      const buffer = await decoder.decodeAudioData(await response.arrayBuffer());
      if (!buffer.length || buffer.numberOfChannels !== 1 || buffer.duration > 8 || !buffer.getChannelData(0).every(Number.isFinite)) throw new Error(`人声采样无效：${id}`);
      return [id, buffer] as const;
    }));
    bank = new Map(loaded);
  })().catch(error => { pending = undefined; throw error; });
  await pending;
}

export function getVocalSample(id: VocalSampleId): AudioBuffer {
  const buffer = bank?.get(id);
  if (!buffer) throw new Error(`人声采样尚未加载：${id}`);
  return buffer;
}
