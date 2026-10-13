import * as Tone from 'tone';
import { finishAudio, measureAudio, waveformPeaks } from '../audio/wav';
import { buildArrangement, validateOptions } from '../music/arrange';
import type { RenderedTrack, RenderOptions, TrackDefinition, Version } from '../music/types';
import { createInstruments } from './instruments';
import { createEmotionalPopInstruments } from './emotional-pop';
import { loadSamples, sampleCredits } from './sample-library';

export const defaultOptions: RenderOptions = { version: 'full', bpm: 132, transpose: 0, seed: 260713 };
let renderQueue: Promise<void> = Promise.resolve();

/** A loop has no added tail; other edits retain each production style's release. */
export function getTailSeconds(track: TrackDefinition, version: Version): number {
  if (version === 'loop') return 0;
  const tails = {
    garage: { full: 2, hook: 0.45 },
    'warm-house': { full: 3, hook: 1.4 },
    'disco-house': { full: 2.5, hook: 0.9 },
    'emotional-pop': { full: 2.4, hook: 0.8 },
  };
  return tails[track.production ?? 'garage'][version];
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
  const instruments = [...new Set(arrangement.events.map(event => event.instrument))];
  const samples = await loadSamples(instruments);
  const credits = sampleCredits(instruments);
  const secondsPerBeat = 60 / options.bpm;
  const musicalDuration = arrangement.beats * secondsPerBeat;
  const loop = options.version === 'loop';
  const repetitions = loop ? 3 : 1;
  const sampleRate = 44100;
  const tail = getTailSeconds(track, options.version);
  const originalContext = Tone.getContext();
  let rig: ReturnType<typeof createInstruments> | undefined;
  let offline: Tone.ToneAudioBuffer | undefined;
  try {
    try {
      offline = await Tone.Offline(() => {
        rig = track.production === 'emotional-pop'
          ? createEmotionalPopInstruments(options.bpm, options.seed)
          : createInstruments(options.bpm, options.seed, track.production, samples);
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
      credits,
    };
  } finally {
    // Includes missing buffers, failed post-processing and successful renders alike.
    offline?.dispose();
  }
}
