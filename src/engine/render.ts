import * as Tone from 'tone';
import { finishAudio, measureAudio, waveformPeaks } from '../audio/wav';
import { buildArrangement, validateOptions } from '../music/arrange';
import type { RenderedTrack, RenderOptions, RenderSelection, TrackDefinition, Version } from '../music/types';
import { selectedTrackIds } from '../music/mixer';
import { createEmotionalPopInstruments } from './emotional-pop';
import { createCinematicGuofengInstruments } from './cinematic-guofeng';
import { createGuofengClubInstruments } from './guofeng-club';

export const defaultOptions: RenderOptions = { version: 'full', bpm: 118, transpose: 0, seed: 260713 };
let renderQueue: Promise<void> = Promise.resolve();

/** A loop has no tail; the other edits retain their release. */
export function getTailSeconds(track: TrackDefinition, version: Version): number {
  if (!['emotional-pop', 'cinematic-guofeng', 'guofeng-club'].includes(track.production)) throw new RangeError(`未知制作风格: ${track.production}`);
  if (version === 'loop') return 0;
  if (track.production === 'guofeng-club') return { full: 2.5, hook: .65 }[version];
  if (track.production === 'cinematic-guofeng') return { full: 3.6, hook: 1.6 }[version];
  return { full: 2.4, hook: 0.8 }[version];
}

// Tone.Offline temporarily switches the global context; serialize concurrent requests.
export function renderTrack(track: TrackDefinition, input: RenderOptions = { ...defaultOptions, bpm: track.meta.bpm }, inputSelection: RenderSelection = {}): Promise<RenderedTrack> {
  const options = { ...input };
  const selection = { ...inputSelection, soloTrackIds: inputSelection.soloTrackIds?.slice(), muteTrackIds: inputSelection.muteTrackIds?.slice() };
  validateOptions(options);
  const result = renderQueue.then(() => render(track, options, selection));
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function render(track: TrackDefinition, options: RenderOptions, selection: RenderSelection): Promise<RenderedTrack> {
  const arrangement = buildArrangement(track, options);
  const enabled = selectedTrackIds(arrangement, selection);
  const secondsPerBeat = 60 / options.bpm;
  const musicalDuration = arrangement.beats * secondsPerBeat;
  const loop = options.version === 'loop';
  const repetitions = loop ? 3 : 1;
  const sampleRate = options.sampleRate ?? (track.production === 'guofeng-club' ? 48000 : 44100);
  const tail = getTailSeconds(track, options.version);
  const originalContext = Tone.getContext();
  let rig: ReturnType<typeof createEmotionalPopInstruments> | undefined;
  let offline: Tone.ToneAudioBuffer | undefined;
  try {
    try {
      offline = await Tone.Offline(() => {
        rig = track.production === 'guofeng-club'
          ? createGuofengClubInstruments(options.bpm, options.seed, arrangement.tracks)
          : track.production === 'cinematic-guofeng'
          ? createCinematicGuofengInstruments(options.bpm, options.seed)
          : createEmotionalPopInstruments(options.bpm, options.seed);
        for (let cycle = 0; cycle < repetitions; cycle++) {
          for (const event of arrangement.events) {
            const at = event.beat * secondsPerBeat + cycle * musicalDuration;
            if (!enabled || (event.trackId && enabled.has(event.trackId))) rig.hit(event, at);
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
    if (selection.processing !== 'raw') finishAudio(buffer, loop);
    const stats = measureAudio(buffer);
    return {
      buffer,
      tracks: arrangement.tracks,
      selection,
      options,
      duration: buffer.duration,
      peaks: waveformPeaks(buffer),
      sections: arrangement.sections,
      stats,
      filename: `${track.meta.id}-${options.version}-${options.bpm}bpm-t${options.transpose}-s${options.seed}${selection.soloTrackIds?.length ? `-solo-${selection.soloTrackIds.join('_')}` : ''}${selection.muteTrackIds?.length ? `-minus-${selection.muteTrackIds.join('_')}` : ''}${selection.processing === 'raw' ? '-raw' : ''}.wav`,
    };
  } finally {
    // Includes missing buffers, failed post-processing and successful renders alike.
    offline?.dispose();
  }
}
