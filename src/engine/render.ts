import * as Tone from 'tone';
import { finishAudio, measureAudio, waveformPeaks } from '../audio/wav';
import { buildArrangement, validateOptions } from '../music/arrange';
import type { RenderedTrack, RenderOptions, TrackDefinition } from '../music/types';
import { createInstruments } from './instruments';
import { loadSamples, sampleCredits } from './sample-library';

export const defaultOptions: RenderOptions = { version: 'full', bpm: 132, transpose: 0, seed: 260713 };
let renderQueue: Promise<void> = Promise.resolve();

// Tone.Offline temporarily switches the global context; serialize concurrent requests.
export function renderTrack(track: TrackDefinition, input: RenderOptions = { ...defaultOptions, bpm: track.meta.bpm }): Promise<RenderedTrack> {
  const options = { ...input };
  validateOptions(options);
  const result = renderQueue.then(() => render(track, options));
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function render(track: TrackDefinition, options: RenderOptions): Promise<RenderedTrack> {
  const arrangement = buildArrangement(track, options);
  const instruments = [...new Set(arrangement.events.map(event => event.instrument))];
  const samples = await loadSamples(instruments);
  const credits = sampleCredits(instruments);
  const secondsPerBeat = 60 / options.bpm;
  const musicalDuration = arrangement.beats * secondsPerBeat;
  const loop = options.version === 'loop';
  const repetitions = loop ? 3 : 1;
  const sampleRate = 44100;
  const tail = loop ? 0 : track.production === 'disco-house' ? (options.version === 'full' ? 2.5 : 0.9) : track.production === 'warm-house' ? (options.version === 'full' ? 3 : 1.4) : options.version === 'full' ? 2 : 0.45;
  const originalContext = Tone.getContext();
  let rig: ReturnType<typeof createInstruments> | undefined;
  let offline: Tone.ToneAudioBuffer;
  try {
    offline = await Tone.Offline(() => {
      rig = createInstruments(options.bpm, options.seed, track.production, samples);
      for (let cycle = 0; cycle < repetitions; cycle++) {
        for (const event of arrangement.events) {
          const at = event.beat * secondsPerBeat + cycle * musicalDuration;
          rig.hit(event, at);
          if (event.instrument === 'kick') rig.duck(at);
        }
      }
    }, musicalDuration * repetitions + tail, 2, sampleRate);
  } finally {
    Tone.setContext(originalContext);
    rig?.dispose();
  }
  const rendered = offline.get();
  if (!rendered) throw new Error('浏览器未能创建音频缓冲');
  let buffer: AudioBuffer;
  if (loop) {
    // Capture a warmed-up cycle so delay/reverb from the previous cycle crosses the seam.
    const frames = Math.round(musicalDuration * sampleRate);
    buffer = new AudioBuffer({ length: frames, numberOfChannels: 2, sampleRate });
    const offset = rendered.length - frames;
    for (let channel = 0; channel < 2; channel++) buffer.copyToChannel(rendered.getChannelData(channel).subarray(offset), channel);
  } else {
    buffer = rendered;
  }
  finishAudio(buffer, loop);
  const stats = measureAudio(buffer);
  offline.dispose();
  return {
    buffer,
    options,
    duration: buffer.duration,
    peaks: waveformPeaks(buffer),
    sections: arrangement.sections,
    stats,
    filename: `${track.meta.id}-${options.version}-${options.bpm}bpm-t${options.transpose}-s${options.seed}.wav`,
    credits,
  };
}
