import * as Tone from 'tone';
import { createRandom } from '../music/random';
import type { MusicalEvent } from '../music/types';

type Envelope = { attack: number; decay: number; sustain: number; release: number };

/**
 * A self-contained, sample-free pop palette. `vocal` is an original synthesised
 * vowel instrument: it contains no recorded singer, words or voice imitation.
 * All nodes belong to the active Tone.Offline context and this one render.
 */
export function createEmotionalPopInstruments(bpm: number, seed: number) {
  const context = Tone.getContext();
  const sampleRate = context.sampleRate;
  const beat = 60 / bpm;
  const random = createRandom(seed ^ 0x639ea431);
  const roomRandom = createRandom(seed ^ 0xa17c2b53);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  let disposed = false;
  const own = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };
  const gain = (level = 1) => {
    const node = own(context.createGain());
    node.gain.value = level;
    return node;
  };
  const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
    const node = own(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    return node;
  };
  const pan = (position: number) => {
    const node = own(context.createStereoPanner());
    node.pan.value = Math.max(-1, Math.min(1, position));
    return node;
  };
  const scheduled = <T extends AudioScheduledSourceNode>(node: T): T => {
    own(node);
    sources.push(node);
    return node;
  };
  const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  // Parallel dry buses keep the melody clear. Low-frequency voices stay mono.
  const masterHighpass = filter('highpass', 27, 0.58);
  const glue = own(context.createDynamicsCompressor());
  glue.threshold.value = -15;
  glue.knee.value = 10;
  glue.ratio.value = 1.7;
  glue.attack.value = 0.022;
  glue.release.value = 0.12;
  const headroom = gain(0.84);
  masterHighpass.connect(glue);
  glue.connect(headroom);
  headroom.connect(context.rawContext.destination);

  const drums = gain(0.92);
  const melodyDuck = gain();
  const bassDuck = gain();
  drums.connect(masterHighpass);
  melodyDuck.connect(masterHighpass);
  bassDuck.connect(masterHighpass);

  // A deterministic, short stereo room: early reflections plus a dark tail.
  const roomSend = gain();
  const room = own(context.createConvolver());
  room.normalize = false;
  const impulse = context.createBuffer(2, Math.ceil(sampleRate * 1.3), sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let frame = 0; frame < data.length; frame++) {
      const time = frame / sampleRate;
      data[frame] = (roomRandom() * 2 - 1) * 0.024 * Math.exp(-time * 7.6) * Math.min(1, time / 0.018);
    }
    for (const [index, seconds] of [0.022, 0.039, 0.061, 0.094, 0.142].entries()) {
      const frame = Math.round((seconds + channel * 0.004) * sampleRate);
      data[frame] += (index % 2 ? -1 : 1) * 0.32 * 0.68 ** index;
    }
  }
  room.buffer = impulse;
  const roomHighpass = filter('highpass', 280);
  const roomLowpass = filter('lowpass', 5600);
  const roomReturn = gain(0.48);
  roomSend.connect(room);
  room.connect(roomHighpass);
  roomHighpass.connect(roomLowpass);
  roomLowpass.connect(roomReturn);
  roomReturn.connect(melodyDuck);

  // Dotted-eighth echoes are a send, so they never replace the dry attack.
  // Independent taps avoid the repeatability differences observed at the
  // second echo when this graph used a two-delay feedback loop.
  const echoSend = gain();
  const echoReturn = gain(0.54);
  for (const [index, level] of [1, 0.23, 0.046, 0.01058].entries()) {
    const tap = own(context.createDelay(3));
    tap.delayTime.value = beat * 0.75 * (index + 1);
    const dark = filter('lowpass', index % 2 ? 2900 : 3300);
    const tapLevel = gain(level);
    const position = pan(index % 2 ? 0.5 : -0.5);
    echoSend.connect(tap);
    tap.connect(dark);
    dark.connect(tapLevel);
    tapLevel.connect(position);
    position.connect(echoReturn);
  }
  echoReturn.connect(melodyDuck);

  const route = (input: AudioNode, destination: AudioNode, roomLevel = 0, echoLevel = 0) => {
    input.connect(destination);
    if (roomLevel > 0) {
      const send = gain(roomLevel);
      input.connect(send);
      send.connect(roomSend);
    }
    if (echoLevel > 0) {
      const send = gain(echoLevel);
      input.connect(send);
      send.connect(echoSend);
    }
  };

  const pianoBus = filter('highpass', 145);
  const pianoTop = filter('lowpass', 7400);
  pianoBus.connect(pianoTop);
  route(pianoTop, melodyDuck, 0.15, 0.045);
  const vocalBus = filter('highpass', 170);
  route(vocalBus, melodyDuck, 0.2, 0.15);
  const leadBus = filter('highpass', 150);
  route(leadBus, melodyDuck, 0.12, 0.105);
  const padBus = filter('highpass', 260);
  route(padBus, melodyDuck, 0.25, 0);
  const airBus = filter('highpass', 2400);
  route(airBus, melodyDuck, 0.24, 0);
  const clapBus = filter('highpass', 540);
  route(clapBus, drums, 0.085, 0);
  const hatsBus = filter('highpass', 5700);
  route(hatsBus, drums, 0.035, 0);

  // Different starts in one seeded pool vary the texture of each percussion hit.
  const noisePool = context.createBuffer(1, Math.ceil(sampleRate * 2), sampleRate);
  const noiseData = noisePool.getChannelData(0);
  for (let index = 0; index < noiseData.length; index++) noiseData[index] = random() * 2 - 1;
  const noiseSource = (time: number, seconds: number, destination: AudioNode, rate = 1) => {
    const source = scheduled(context.createBufferSource());
    source.buffer = noisePool;
    source.loop = true;
    source.playbackRate.value = rate;
    source.connect(destination);
    source.start(time, random() * 1.4);
    source.stop(time + seconds);
    return source;
  };
  const oscillator = (type: OscillatorType, hz: number, time: number, seconds: number, destination: AudioNode, cents = 0) => {
    const source = scheduled(context.createOscillator());
    source.type = type;
    source.frequency.value = hz;
    source.detune.value = cents;
    source.connect(destination);
    source.start(time);
    source.stop(time + seconds);
    return source;
  };

  const shape = (param: AudioParam, time: number, duration: number, level: number, envelope: Envelope) => {
    const attack = Math.min(envelope.attack, Math.max(0.003, duration * 0.35));
    const decay = Math.min(envelope.decay, Math.max(0.006, duration - attack));
    const endAttack = time + attack;
    const endDecay = Math.min(time + duration, endAttack + decay);
    const sustain = Math.max(0.00001, level * envelope.sustain);
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(level, endAttack);
    param.exponentialRampToValueAtTime(sustain, endDecay);
    if (endDecay < time + duration) param.linearRampToValueAtTime(sustain, time + duration);
    param.exponentialRampToValueAtTime(0.00001, time + duration + envelope.release);
    param.linearRampToValueAtTime(0, time + duration + envelope.release + 0.008);
  };

  /** A warm tine piano whose upper partials decay faster than its fundamental. */
  const piano = (midi: number, time: number, duration: number, velocity: number, soft = false) => {
    const noteOut = gain();
    const position = pan(Math.max(-0.22, Math.min(0.22, (midi - 64) * 0.012)));
    noteOut.connect(position);
    position.connect(pianoBus);
    const hz = frequency(midi);
    const cents = (random() - 0.5) * 3;
    const partials = [
      { ratio: 1, level: 0.74, decay: 1.1, sustain: 0.25 },
      { ratio: 2.002, level: 0.22, decay: 0.6, sustain: 0.065 },
      { ratio: 3.009, level: 0.1, decay: 0.35, sustain: 0.022 },
      { ratio: 4.011, level: 0.045, decay: 0.24, sustain: 0.009 },
      { ratio: 6.021, level: 0.013, decay: 0.14, sustain: 0.002 },
      { ratio: 2.67, level: 0.022, decay: 0.075, sustain: 0.001 },
    ];
    for (const partial of partials) {
      if (hz * partial.ratio >= sampleRate * 0.43) continue;
      const amplitude = gain(0);
      amplitude.connect(noteOut);
      const high = partial.ratio > 2 ? 0.5 + velocity * 0.5 : 1;
      shape(amplitude.gain, time, duration, partial.level * high * velocity * (soft ? 0.095 : 0.145), {
        attack: partial.ratio < 2 ? 0.008 : 0.004,
        decay: partial.decay,
        sustain: partial.sustain,
        release: partial.ratio < 2 ? 0.43 : 0.24,
      });
      oscillator('sine', hz * partial.ratio, time, duration + 0.45, amplitude, cents);
    }
  };

  /** Flowing ah -> oh vowels, with quiet breath and delayed vibrato. */
  const vowel = (midi: number, time: number, duration: number, velocity: number) => {
    const release = 0.28;
    const voiceEnd = duration + release + 0.02;
    const expression = gain(0);
    shape(expression.gain, time, duration, velocity * 0.7, { attack: 0.035, decay: 0.2, sustain: 0.78, release });
    expression.connect(vocalBus);
    const excitation = gain(0.39);
    const fundamental = frequency(midi);
    const reed = oscillator('sawtooth', fundamental, time, voiceEnd, excitation, (random() - 0.5) * 4);
    // Each formant has its own trajectory; their movement supplies articulation.
    const length = Math.max(0.12, Math.min(duration, 0.52));
    for (const [index, formant] of [
      { start: 730, end: 510, q: 3.1, level: 0.83 },
      { start: 1220, end: 990, q: 4.6, level: 0.47 },
      { start: 2640, end: 2480, q: 5.3, level: 0.17 },
    ].entries()) {
      const resonator = filter('bandpass', formant.start, formant.q);
      resonator.frequency.setValueAtTime(formant.start, time);
      resonator.frequency.exponentialRampToValueAtTime(formant.end, time + length);
      resonator.frequency.linearRampToValueAtTime(formant.end * (index ? 1.03 : 1.06), time + duration + release);
      const bandLevel = gain(formant.level);
      excitation.connect(resonator);
      resonator.connect(bandLevel);
      bandLevel.connect(expression);
    }
    // The fundamental prevents thin notes when a harmonic falls between formants.
    const body = gain(0.038);
    body.connect(expression);
    oscillator('sine', fundamental, time, voiceEnd, body);
    const vibrato = scheduled(context.createOscillator());
    vibrato.frequency.value = 5.1 + random() * 0.35;
    const vibratoDepth = gain(0);
    vibratoDepth.gain.setValueAtTime(0, time);
    vibratoDepth.gain.linearRampToValueAtTime(8, time + Math.min(0.22, duration));
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(reed.detune);
    vibrato.start(time);
    vibrato.stop(time + voiceEnd);
    const breath = gain(0.011);
    const breathColor = filter('bandpass', 4600, 0.7);
    breathColor.connect(breath);
    breath.connect(expression);
    noiseSource(time, voiceEnd, breathColor, 0.91 + random() * 0.13);
  };

  const melodic = (midi: number, time: number, duration: number, velocity: number, sparkling = false) => {
    const envelope = gain(0);
    const color = filter('lowpass', sparkling ? 6400 : 3900, 0.64);
    const notePan = pan(sparkling ? 0.15 : -0.035);
    envelope.connect(color);
    color.connect(notePan);
    notePan.connect(leadBus);
    color.frequency.setValueAtTime(sparkling ? 6400 : 3900, time);
    color.frequency.exponentialRampToValueAtTime(sparkling ? 3300 : 2200, time + Math.min(0.26, duration));
    const release = sparkling ? 0.36 : 0.24;
    shape(envelope.gain, time, duration, velocity * (sparkling ? 0.09 : 0.15), {
      attack: sparkling ? 0.006 : 0.018, decay: sparkling ? 0.16 : 0.25, sustain: sparkling ? 0.05 : 0.34, release,
    });
    const fundamental = frequency(midi);
    oscillator(sparkling ? 'sine' : 'triangle', fundamental, time, duration + release + 0.02, envelope);
    const sheen = gain(sparkling ? 0.21 : 0.1);
    sheen.connect(envelope);
    oscillator('sine', fundamental * (sparkling ? 2.005 : 2), time, duration + release + 0.02, sheen, -3.5);
  };

  const pad = (midi: number, time: number, duration: number, velocity: number) => {
    const envelope = gain(0);
    shape(envelope.gain, time, duration, velocity * 0.055, { attack: 0.46, decay: 0.8, sustain: 0.68, release: 0.7 });
    const color = filter('lowpass', 1500, 0.6);
    const notePan = pan((midi % 7 - 3) * 0.045);
    envelope.connect(color);
    color.connect(notePan);
    notePan.connect(padBus);
    color.frequency.setValueAtTime(1200, time);
    color.frequency.linearRampToValueAtTime(1900, time + Math.min(duration, 0.85));
    const fundamental = frequency(midi);
    oscillator('triangle', fundamental, time, duration + 0.73, envelope, -5.5);
    const second = gain(0.48);
    second.connect(envelope);
    oscillator('sine', fundamental, time, duration + 0.73, second, 5.5);
  };

  const bass = (midi: number, time: number, duration: number, velocity: number, sub = false) => {
    const envelope = gain(0);
    const color = filter('lowpass', sub ? 150 : 930, 0.58);
    shape(envelope.gain, time, duration, velocity * (sub ? 0.12 : 0.25), { attack: 0.012, decay: 0.19, sustain: sub ? 0.78 : 0.66, release: sub ? 0.065 : 0.09 });
    envelope.connect(color);
    color.connect(bassDuck);
    const fundamental = frequency(midi);
    oscillator('sine', fundamental, time, duration + 0.12, envelope);
    if (!sub) {
      // A quiet octave and third partial make the bass readable on phone speakers.
      const octave = gain(0.26);
      const third = gain(0.105);
      octave.connect(envelope);
      third.connect(envelope);
      oscillator('sine', fundamental * 2, time, duration + 0.12, octave);
      oscillator('sine', fundamental * 3, time, duration + 0.12, third);
    }
  };

  const kick = (time: number, velocity: number) => {
    const envelope = gain(0);
    envelope.connect(drums);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(velocity * 0.7, time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(velocity * 0.16, time + 0.065);
    envelope.gain.exponentialRampToValueAtTime(0.00001, time + 0.24);
    envelope.gain.linearRampToValueAtTime(0, time + 0.25);
    const body = oscillator('sine', 139, time, 0.26, envelope);
    body.frequency.setValueAtTime(139, time);
    body.frequency.exponentialRampToValueAtTime(51, time + 0.026);
    body.frequency.exponentialRampToValueAtTime(44, time + 0.19);
    const tick = gain(0);
    const tickColor = filter('lowpass', 3200);
    tick.gain.setValueAtTime(velocity * 0.05, time);
    tick.gain.exponentialRampToValueAtTime(0.00001, time + 0.009);
    tickColor.connect(tick);
    tick.connect(drums);
    noiseSource(time, 0.01, tickColor);
  };

  const clap = (time: number, velocity: number) => {
    const color = filter('bandpass', 1480 + random() * 130, 0.62);
    color.connect(clapBus);
    for (const [index, offset] of [0, 0.01, 0.024].entries()) {
      const envelope = gain(0);
      envelope.connect(color);
      const start = time + offset;
      const end = index === 2 ? 0.17 : 0.035;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(velocity * (index === 2 ? 0.36 : 0.29), start + 0.0015);
      envelope.gain.exponentialRampToValueAtTime(0.00001, start + end);
      envelope.gain.linearRampToValueAtTime(0, start + end + 0.005);
      noiseSource(start, end + 0.008, envelope, 0.96 + random() * 0.08);
    }
  };

  let openHat: { gain: AudioParam; end: number } | undefined;
  const hat = (time: number, velocity: number, open = false, shaker = false) => {
    if (!open && !shaker && openHat && time < openHat.end) {
      openHat.gain.cancelAndHoldAtTime(time);
      openHat.gain.linearRampToValueAtTime(0, time + 0.012);
    }
    const seconds = open ? 0.34 : shaker ? 0.075 : 0.075;
    const envelope = gain(0);
    const position = pan(shaker ? 0.21 : open ? 0.12 : -0.065);
    envelope.connect(position);
    position.connect(hatsBus);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(velocity * (open ? 0.17 : shaker ? 0.11 : 0.135), time + (shaker ? 0.005 : 0.0015));
    envelope.gain.exponentialRampToValueAtTime(0.00001, time + seconds);
    envelope.gain.linearRampToValueAtTime(0, time + seconds + 0.005);
    noiseSource(time, seconds + 0.008, envelope, 0.92 + random() * 0.17);
    if (open) openHat = { gain: envelope.gain, end: time + seconds };
  };

  const percussion = (time: number, velocity: number, low = false) => {
    const envelope = gain(0);
    const position = pan(low ? -0.12 : 0.16);
    shape(envelope.gain, time, 0.035, velocity * (low ? 0.14 : 0.1), { attack: 0.002, decay: 0.024, sustain: 0.2, release: low ? 0.15 : 0.045 });
    envelope.connect(position);
    route(position, drums, 0.035, 0);
    const fundamental = low ? 184 : 1480;
    oscillator('sine', fundamental, time, low ? 0.2 : 0.09, envelope);
    const harmonic = gain(low ? 0.12 : 0.4);
    harmonic.connect(envelope);
    oscillator('sine', fundamental * (low ? 1.59 : 1.36), time, low ? 0.2 : 0.09, harmonic);
  };

  const texture = (time: number, duration: number, velocity: number, sweep = false) => {
    const release = sweep ? 0.17 : 0.4;
    const envelope = gain(0);
    const color = filter('bandpass', sweep ? 850 : 6800, sweep ? 0.58 : 0.43);
    color.connect(envelope);
    envelope.connect(airBus);
    if (sweep) {
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(velocity * 0.065, time + duration * 0.86);
      envelope.gain.exponentialRampToValueAtTime(0.00001, time + duration + release);
      color.frequency.setValueAtTime(850, time);
      color.frequency.exponentialRampToValueAtTime(7800, time + duration);
    } else {
      shape(envelope.gain, time, duration, velocity * 0.025, { attack: 0.22, decay: 0.4, sustain: 0.45, release });
    }
    noiseSource(time, duration + release + 0.02, color, 0.78);
  };

  const hit = (event: MusicalEvent, time: number): void => {
    if (disposed) throw new Error('音源已释放');
    const duration = Math.max(0.025, event.duration * beat);
    const velocity = Math.min(1, Math.max(0, event.velocity));
    const instrument: string = event.instrument;
    switch (instrument) {
      case 'kick': kick(time, velocity); return;
      case 'clap': clap(time, velocity); return;
      case 'hat': hat(time, velocity); return;
      case 'openHat': hat(time, velocity, true); return;
      case 'shaker': hat(time, velocity, false, true); return;
      case 'rim':
      case 'perc': percussion(time, velocity); return;
      case 'conga': percussion(time, velocity, true); return;
      case 'texture': texture(time, duration, velocity); return;
      case 'sweep':
      case 'riser': texture(time, duration, velocity, true); return;
      case 'impact': {
        percussion(time, velocity * 0.8, true);
        texture(time, 0.13, velocity * 0.8);
        return;
      }
    }
    if (!event.notes?.length) throw new Error(`音高缺失: ${instrument}`);
    for (const midi of event.notes) {
      switch (instrument) {
        case 'piano': piano(midi, time, duration, velocity); break;
        case 'chord':
        case 'organ': piano(midi, time, duration, velocity, true); break;
        case 'vocal': vowel(midi, time, duration, velocity); break;
        case 'lead': melodic(midi, time, duration, velocity); break;
        case 'spark':
        case 'pluck': melodic(midi, time, duration, velocity, true); break;
        case 'pad': pad(midi, time, duration, velocity); break;
        case 'bass': bass(midi, time, duration, velocity); break;
        case 'sub': bass(midi, time, duration, velocity, true); break;
        default: throw new Error(`流行电子音色未注册: ${instrument}`);
      }
    }
  };

  let lastDuck = -Infinity;
  const duck = (time: number): void => {
    const elapsed = time - lastDuck;
    const automate = (param: AudioParam, depth: number, recovery: number) => {
      const attack = 0.009;
      // A short repeat starts from the previous ramp's value instead of jumping.
      const previous = elapsed < attack
        ? 1 - (1 - depth) * Math.max(0, elapsed) / attack
        : elapsed < recovery ? depth + (1 - depth) * (elapsed - attack) / (recovery - attack) : 1;
      param.cancelScheduledValues(time);
      param.setValueAtTime(previous, time);
      param.linearRampToValueAtTime(depth, time + attack);
      param.linearRampToValueAtTime(1, time + recovery);
    };
    automate(bassDuck.gain, 0.46, beat * 0.4);
    automate(melodyDuck.gain, 0.82, beat * 0.32);
    lastDuck = time;
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const source of sources) {
      try { source.stop(); } catch { /* A completed one-shot has already stopped. */ }
    }
    for (const node of nodes.reverse()) node.disconnect();
    sources.length = 0;
    nodes.length = 0;
  };
  return { hit, duck, dispose };
}
