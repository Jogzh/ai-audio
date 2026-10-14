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

/** PCM16/24 WAV at the buffer's native rate. PCM24 receives deterministic TPDF dither. */
export function encodeWav(buffer: PCMBuffer, bits: 16 | 24 = 16): ArrayBuffer {
  if (![16, 24].includes(bits)) throw new RangeError('WAV 位深必须为 16 或 24');
  if (buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2 || !buffer.length || !buffer.sampleRate) throw new RangeError('需要有效的单声道或立体声音频');
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const bytesPerSample = bits / 8;
  const size = buffer.length * buffer.numberOfChannels * bytesPerSample;
  if (size > 0xffffffff - 36) throw new RangeError('音频超过 RIFF WAV 大小上限');
  const padding = size % 2;
  const output = new ArrayBuffer(44 + size + padding);
  const view = new DataView(output);
  const text = (at: number, value: string) => [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + size + padding, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * bytesPerSample, true);
  view.setUint16(32, buffer.numberOfChannels * bytesPerSample, true);
  view.setUint16(34, bits, true);
  text(36, 'data');
  view.setUint32(40, size, true);
  let at = 44;
  let ditherState = 0x4e454f4e;
  const uniform = () => { ditherState = (Math.imul(ditherState, 1664525) + 1013904223) >>> 0; return ditherState / 0x100000000; };
  for (let frame = 0; frame < buffer.length; frame++) {
    for (const channel of channels) {
      if (!Number.isFinite(channel[frame])) throw new Error('音频包含非有限采样值');
      const sample = Math.max(-1, Math.min(1, channel[frame]));
      if (bits === 16) view.setInt16(at, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      else {
        const value = Math.max(-8388608, Math.min(8388607, Math.round(sample * (sample < 0 ? 8388608 : 8388607) + uniform() - uniform())));
        view.setUint8(at, value & 255); view.setUint8(at + 1, (value >> 8) & 255); view.setUint8(at + 2, (value >> 16) & 255);
      }
      at += bytesPerSample;
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
