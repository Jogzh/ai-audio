import * as Tone from 'tone';
import { finishAudio, measureAudio, waveformPeaks } from '../audio/wav';
import { buildArrangement, validateOptions } from '../music/arrange';
import type { RenderedTrack, RenderOptions, TrackDefinition, Version } from '../music/types';
import { createEmotionalPopInstruments } from './emotional-pop';

export const defaultOptions: RenderOptions = { version: 'full', bpm: 118, transpose: 0, seed: 260713 };
let renderQueue: Promise<void> = Promise.resolve();

/** A loop has no tail; the other edits retain their release. */
export function getTailSeconds(track: TrackDefinition, version: Version): number {
  if (track.production !== 'emotional-pop') throw new RangeError(`未知制作风格: ${track.production}`);
  if (version === 'loop') return 0;
  return { full: 2.4, hook: 0.8 }[version];
}

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
  const secondsPerBeat = 60 / options.bpm;
  const musicalDuration = arrangement.beats * secondsPerBeat;
  const loop = options.version === 'loop';
  const repetitions = loop ? 3 : 1;
  const sampleRate = 44100;
  const tail = getTailSeconds(track, options.version);
  const originalContext = Tone.getContext();
  let rig: ReturnType<typeof createEmotionalPopInstruments> | undefined;
  let offline: Tone.ToneAudioBuffer | undefined;
  try {
    try {
      offline = await Tone.Offline(() => {
        rig = createEmotionalPopInstruments(options.bpm, options.seed);
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
    return {
      buffer,
      options,
      duration: buffer.duration,
      peaks: waveformPeaks(buffer),
      sections: arrangement.sections,
      stats,
      filename: `${track.meta.id}-${options.version}-${options.bpm}bpm-t${options.transpose}-s${options.seed}.wav`,
    };
  } finally {
    // Includes missing buffers, failed post-processing and successful renders alike.
    offline?.dispose();
  }
}
