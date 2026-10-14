import * as Tone from 'tone';
import { createRandom } from '../music/random';
import { inkTideMixTracks } from '../music/ink-tide-mix';
import { getPianoSamples, preparePianoSamples } from './piano-samples';
import { getAcousticSamples, getAcousticSampleGain, prepareAcousticSamples } from './acoustic-samples';
import { createInkTideVoice, hashVoiceIdentity } from './ink-tide-voices';
import type { MixTrack, MusicalEvent } from '../music/types';

export async function prepareInkTideSamples(): Promise<void> {
  await Promise.all([preparePianoSamples(), prepareAcousticSamples()]);
}

export interface InkTideTimeline { cycleBeats: number; repetitions: number }

/** Independently seeded voices feed independent strips and a shared linear space. */
export function createInkTideInstruments(bpm: number, seed: number, tracks: MixTrack[] = inkTideMixTracks, timeline?: InkTideTimeline) {
  const context = Tone.getContext();
  const sampleRate = context.sampleRate;
  const beat = 60 / bpm;
  const pianoSamples = getPianoSamples();
  if (!pianoSamples.size) throw new Error('钢琴采样尚未加载，请先准备音源');
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  let disposed = false;
  const own = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };
  const scheduled = <T extends AudioScheduledSourceNode>(node: T): T => {
    own(node);
    sources.push(node);
    return node;
  };
  const gain = (level = 1) => {
    const node = own(context.createGain());
    node.gain.value = level;
    return node;
  };
  const filter = (type: BiquadFilterType, frequency: number, q = 0.6) => {
    const node = own(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = Math.min(sampleRate * 0.44, frequency);
    node.Q.value = q;
    return node;
  };
  const masterHighpass = filter('highpass', 26, 0.55);
  // A linear master permits raw stems to sum back into this mix.
  const master = gain(0.65);
  masterHighpass.connect(master);
  master.connect(context.rawContext.destination);

  const roomInput = gain();
  const room = own(context.createConvolver());
  room.normalize = false;
  const impulse = context.createBuffer(2, Math.ceil(sampleRate * 1.65), sampleRate);
  const roomRandom = createRandom(seed ^ 0x60ae2139);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let previous = 0;
    for (let frame = 0; frame < data.length; frame++) {
      const seconds = frame / sampleRate;
      previous = previous * 0.76 + (roomRandom() * 2 - 1) * 0.24;
      data[frame] = previous * 0.029 * Math.exp(-seconds * 4.5)
        * Math.min(1, seconds / 0.03) * Math.min(1, (data.length - frame) / (sampleRate * 0.12));
    }
    for (const [index, seconds] of [0.033, 0.051, 0.081, 0.126, 0.173].entries()) {
      data[Math.round((seconds + channel * 0.003) * sampleRate)] += (index % 2 ? -1 : 1) * 0.16 * 0.64 ** index;
    }
  }
  room.buffer = impulse;
  const roomLow = filter('highpass', 310);
  const roomHigh = filter('lowpass', 3800);
  const roomReturn = gain(0.24);
  roomInput.connect(room);
  room.connect(roomLow);
  roomLow.connect(roomHigh);
  roomHigh.connect(roomReturn);
  roomReturn.connect(masterHighpass);

  // Finite, forward echoes stay linear and cannot feed back into other parts.
  const delayInput = gain();
  const delayHighpass = filter('highpass', 540);
  const delayLowpass = filter('lowpass', 2600);
  delayInput.connect(delayHighpass);
  delayHighpass.connect(delayLowpass);
  for (const [index, delayBeats] of [0.75, 1.5, 2.25].entries()) {
    const delay = own(context.createDelay(4));
    delay.delayTime.value = beat * delayBeats;
    const echoGain = gain([0.3, 0.13, 0.055][index]);
    const echoPan = own(context.createStereoPanner());
    echoPan.pan.value = [0.22, -0.24, 0.12][index];
    delayLowpass.connect(delay);
    delay.connect(echoGain);
    echoGain.connect(echoPan);
    echoPan.connect(masterHighpass);
  }

  const bassDucks: GainNode[] = [];
  const voices = new Map<string, { definition: MixTrack; voice: ReturnType<typeof createInkTideVoice> }>();
  for (const track of tracks) {
    if (voices.has(track.id)) throw new Error(`音轨 ID 重复: ${track.id}`);
    const input = filter('highpass', track.mix.highpass, 0.55);
    const colour = filter('lowpass', track.mix.lowpass, 0.55);
    const level = gain(track.mix.gain);
    const pan = own(context.createStereoPanner());
    pan.pan.value = track.role === 'bass' || track.instrument === 'kick' ? 0 : track.mix.pan;
    input.connect(colour);
    colour.connect(level);
    let postLevel: AudioNode = level;
    if (track.role === 'bass') {
      const duck = gain();
      level.connect(duck);
      bassDucks.push(duck);
      postLevel = duck;
    }
    postLevel.connect(pan);
    pan.connect(masterHighpass);
    if (track.mix.reverb > 0) {
      const send = gain(track.mix.reverb);
      pan.connect(send);
      send.connect(roomInput);
    }
    if (track.mix.delay > 0) {
      const send = gain(track.mix.delay);
      pan.connect(send);
      send.connect(delayInput);
    }
    if (track.automation?.length) {
      const points = [...track.automation].sort((left, right) => left.beat - right.beat);
      for (let cycle = 0; cycle < (timeline?.repetitions ?? 1); cycle++) {
        const cycleStart = cycle * (timeline?.cycleBeats ?? 0) * beat;
        level.gain.setValueAtTime(track.mix.gain * points[0].gain, cycleStart);
        for (const point of points) {
          if (point.beat === 0) level.gain.setValueAtTime(track.mix.gain * point.gain, cycleStart);
          else level.gain.linearRampToValueAtTime(track.mix.gain * point.gain, cycleStart + point.beat * beat);
        }
      }
    }
    const voice = createInkTideVoice({ context, own, scheduled, pianoSamples, acousticSamples: getAcousticSamples, acousticSampleGain: getAcousticSampleGain }, track.instrument, seed ^ hashVoiceIdentity(track.id), input);
    voices.set(track.id, { definition: track, voice });
  }

  const hit = (event: MusicalEvent, time: number): void => {
    if (disposed) throw new Error('音源已释放');
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(event.duration) || event.duration <= 0
      || !Number.isFinite(event.beat) || event.beat < 0 || !Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 1) {
      throw new RangeError('音符时间、时值及力度无效');
    }
    const entry = event.trackId ? voices.get(event.trackId) : [...voices.values()].find(candidate => candidate.definition.instrument === event.instrument);
    if (!entry) throw new Error(`墨潮音轨未注册: ${event.trackId ?? event.instrument}`);
    if (entry.definition.instrument !== event.instrument) throw new Error(`音轨与音色不匹配: ${entry.definition.id} / ${event.instrument}`);
    if (event.velocity === 0) return;
    entry.voice.play(event, time, Math.max(0.025, event.duration * beat));
  };
  const duck = (time: number): void => {
    if (disposed) throw new Error('音源已释放');
    if (!Number.isFinite(time) || time < 0) throw new RangeError('音符时间无效');
    for (const node of bassDucks) {
      node.gain.setValueAtTime(1, time);
      node.gain.linearRampToValueAtTime(0.85, time + 0.012);
      node.gain.linearRampToValueAtTime(1, time + 0.17);
    }
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const source of sources) {
      try { source.stop(); } catch { /* Already stopped one-shots remain safe to release. */ }
    }
    for (const node of nodes.reverse()) {
      try { node.disconnect(); } catch { /* Keep releasing after interrupted Offline rendering. */ }
    }
    for (const { voice } of voices.values()) voice.clear();
    room.buffer = null;
    voices.clear();
    sources.length = 0;
    nodes.length = 0;
  };
  return { hit, duck, dispose };
}
