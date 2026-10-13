import type { AudioStats } from '../music/types';

type PCMBuffer = Pick<AudioBuffer, 'numberOfChannels' | 'length' | 'sampleRate' | 'getChannelData'>;

export function measureAudio(buffer: PCMBuffer): AudioStats {
  let peak = 0;
  let squares = 0;
  let sum = 0;
  let clippedSamples = 0;
  const count = buffer.length * buffer.numberOfChannels;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (const sample of data) {
      if (!Number.isFinite(sample)) throw new Error('音频包含非有限采样值');
      peak = Math.max(peak, Math.abs(sample));
      squares += sample * sample;
      sum += sample;
      if (Math.abs(sample) >= 1) clippedSamples++;
    }
  }
  const rms = count ? Math.sqrt(squares / count) : 0;
  const db = (value: number) => value > 0 ? 20 * Math.log10(value) : -Infinity;
  return { peak, rms, peakDb: db(peak), rmsDb: db(rms), clippedSamples, dcOffset: count ? sum / count : 0 };
}

export function waveformPeaks(buffer: PCMBuffer, bins = 320): number[] {
  if (!Number.isInteger(bins) || bins < 1) throw new RangeError('波形分段数必须为正整数');
  return Array.from({ length: bins }, (_, bin) => {
    let peak = 0;
    const from = Math.floor(bin * buffer.length / bins);
    const to = Math.floor((bin + 1) * buffer.length / bins);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let frame = from; frame < to; frame++) peak = Math.max(peak, Math.abs(data[frame]));
    }
    return peak;
  });
}

/** Standard little-endian interleaved PCM16 WAV. No resampling or fake MP3 headers. */
export function encodeWav(buffer: PCMBuffer): ArrayBuffer {
  if (buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2 || !buffer.length || !buffer.sampleRate) throw new RangeError('需要有效的单声道或立体声音频');
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const size = buffer.length * buffer.numberOfChannels * 2;
  if (size > 0xffffffff - 36) throw new RangeError('音频超过 RIFF WAV 大小上限');
  const output = new ArrayBuffer(44 + size);
  const view = new DataView(output);
  const text = (at: number, value: string) => [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + size, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  view.setUint16(32, buffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, size, true);
  let at = 44;
  for (let frame = 0; frame < buffer.length; frame++) {
    for (const channel of channels) {
      if (!Number.isFinite(channel[frame])) throw new Error('音频包含非有限采样值');
      const sample = Math.max(-1, Math.min(1, channel[frame]));
      view.setInt16(at, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      at += 2;
    }
  }
  return output;
}

/** DC removal, transparent peak trim, tiny edge fades; this is not LUFS mastering. */
export function finishAudio(buffer: AudioBuffer, loop: boolean): void {
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    let sum = 0;
    for (const value of data) sum += value;
    const mean = sum / data.length;
    const fadeIn = Math.round(buffer.sampleRate * 0.003);
    const fadeOut = Math.round(buffer.sampleRate * (loop ? 0.003 : 0.5));
    for (let frame = 0; frame < data.length; frame++) {
      const gain = Math.min(1, frame / fadeIn, (data.length - 1 - frame) / fadeOut);
      data[frame] = (data[frame] - mean) * gain;
    }
  }
  const { peak } = measureAudio(buffer);
  if (peak === 0) throw new Error('渲染结果为静音');
  const gain = Math.min(2, Math.pow(10, -1.2 / 20) / peak);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let frame = 0; frame < data.length; frame++) data[frame] *= gain;
  }
}
