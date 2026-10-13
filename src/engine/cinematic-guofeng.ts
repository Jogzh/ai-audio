import * as Tone from 'tone';
import { createRandom } from '../music/random';
import type { MusicalEvent } from '../music/types';

type Envelope = { attack: number; decay: number; sustain: number; release: number };
type Modal = { hz: number; level: number; decay: number; phase?: number };

/**
 * Original Chinese-inspired orchestral/pop synthesis. These are deliberately
 * stylised instruments, not recordings or claims of acoustic reproduction.
 * Every PCM buffer, random stream and node belongs to this one Offline render.
 */
export function createCinematicGuofengInstruments(bpm: number, seed: number) {
  const context = Tone.getContext();
  const sampleRate = context.sampleRate;
  const beat = 60 / bpm;
  const random = createRandom(seed ^ 0x8a92cf35);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const buffers = new Map<string, AudioBuffer>();
  let disposed = false;
  const own = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };
  const gain = (level = 1) => {
    const node = own(context.createGain());
    node.gain.value = level;
    return node;
  };
  const filter = (type: BiquadFilterType, hz: number, q = 0.7) => {
    const node = own(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = Math.min(sampleRate * 0.45, hz);
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

  const highpass = filter('highpass', 28, 0.58);
  const glue = own(context.createDynamicsCompressor());
  glue.threshold.value = -14;
  glue.knee.value = 12;
  glue.ratio.value = 1.8;
  glue.attack.value = 0.025;
  glue.release.value = 0.17;
  const headroom = gain(0.77);
  highpass.connect(glue);
  glue.connect(headroom);
  headroom.connect(context.rawContext.destination);
  const drums = gain(0.9);
  const orchestraDuck = gain();
  const bassDuck = gain();
  drums.connect(highpass);
  orchestraDuck.connect(highpass);
  bassDuck.connect(highpass);

  // No feedback delays: finite, deterministic early reflections and dark hall.
  // A 1.55 s impulse plus the longest 0.68 s note release fits the full tail.
  const roomSend = gain();
  const room = own(context.createConvolver());
  room.normalize = false;
  const roomRandom = createRandom(seed ^ 0x4719acb3);
  const impulse = context.createBuffer(2, Math.ceil(sampleRate * 1.55), sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let previous = 0;
    for (let frame = 0; frame < data.length; frame++) {
      const time = frame / sampleRate;
      previous = previous * 0.69 + (roomRandom() * 2 - 1) * 0.31;
      const end = Math.min(1, (data.length - frame) / (sampleRate * 0.1));
      data[frame] = previous * 0.049 * Math.exp(-time * 5.7) * Math.min(1, time / 0.026) * end;
    }
    for (const [index, seconds] of [0.031, 0.058, 0.091, 0.137, 0.203].entries()) {
      data[Math.round((seconds + channel * 0.008) * sampleRate)] += (index % 2 ? -1 : 1) * 0.3 * 0.66 ** index;
    }
  }
  room.buffer = impulse;
  const roomLow = filter('highpass', 320);
  const roomHigh = filter('lowpass', 4700);
  const roomReturn = gain(0.28);
  roomSend.connect(room);
  room.connect(roomLow);
  roomLow.connect(roomHigh);
  roomHigh.connect(roomReturn);
  roomReturn.connect(orchestraDuck);
  const echoSend = gain();
  for (const [index, level] of [0.2, 0.035].entries()) {
    const tap = own(context.createDelay(3));
    tap.delayTime.value = beat * 0.5 * (index + 1);
    const dark = filter('lowpass', 2900 - index * 300);
    const tapLevel = gain(level);
    const position = pan(index % 2 ? 0.48 : -0.48);
    echoSend.connect(tap);
    tap.connect(dark);
    dark.connect(tapLevel);
    tapLevel.connect(position);
    position.connect(orchestraDuck);
  }
  const route = (input: AudioNode, destination: AudioNode, roomLevel = 0, echoLevel = 0) => {
    input.connect(destination);
    if (roomLevel) {
      const send = gain(roomLevel);
      input.connect(send);
      send.connect(roomSend);
    }
    if (echoLevel) {
      const send = gain(echoLevel);
      input.connect(send);
      send.connect(echoSend);
    }
  };
  const bus = (low: number, high: number, roomLevel: number, echoLevel = 0, destination = orchestraDuck) => {
    const first = filter('highpass', low);
    const last = filter('lowpass', high);
    first.connect(last);
    route(last, destination, roomLevel, echoLevel);
    return first;
  };
  const zhengBus = bus(165, 5200, 0.16, 0.055);
  const diziBus = bus(220, 4300, 0.13);
  const erhuBus = bus(180, 3400, 0.14);
  const stringBus = bus(245, 3100, 0.2);
  const brassBus = bus(280, 2900, 0.14);
  const granularBus = bus(340, 4000, 0.18, 0.06);
  const taikoBus = bus(55, 2300, 0.07, 0, drums);
  const gongBus = bus(250, 4000, 0.16, 0, drums);
  const clapBus = bus(570, 6900, 0.075, 0, drums);
  const hatBus = bus(4900, 11000, 0.025, 0, drums);
  const textureBus = bus(1600, 6200, 0.18);

  const noisePool = context.createBuffer(1, Math.ceil(sampleRate * 2), sampleRate);
  const noiseData = noisePool.getChannelData(0);
  for (let index = 0; index < noiseData.length; index++) noiseData[index] = random() * 2 - 1;
  const noise = (time: number, seconds: number, destination: AudioNode, rate = 1) => {
    const source = scheduled(context.createBufferSource());
    source.buffer = noisePool;
    source.loop = true;
    source.playbackRate.value = rate;
    source.connect(destination);
    source.start(time, random() * 1.4);
    source.stop(time + seconds);
    return source;
  };
  const periodic = (levels: number[]) => {
    const real = new Float32Array(levels.length + 1);
    const imaginary = new Float32Array(levels.length + 1);
    imaginary.set(levels, 1);
    return context.createPeriodicWave(real, imaginary);
  };
  const fluteWave = periodic([1, 0.11, 0.2, 0.06, 0.07, 0.025, 0.02]);
  const erhuWave = periodic([1, 0.53, 0.36, 0.21, 0.17, 0.1, 0.075, 0.045, 0.028]);
  const brassWave = periodic([1, 0.63, 0.43, 0.29, 0.16, 0.09, 0.055]);
  const oscillator = (wave: OscillatorType | PeriodicWave, hz: number, time: number, seconds: number, destination: AudioNode) => {
    const source = scheduled(context.createOscillator());
    if (typeof wave === 'string') source.type = wave as OscillatorType;
    else source.setPeriodicWave(wave);
    source.frequency.value = hz;
    source.connect(destination);
    source.start(time);
    source.stop(time + seconds);
    return source;
  };
  const shape = (param: AudioParam, time: number, duration: number, level: number, envelope: Envelope) => {
    const attack = Math.min(envelope.attack, duration * 0.4);
    const endAttack = time + attack;
    const endDecay = Math.min(time + duration, endAttack + envelope.decay);
    const sustain = Math.max(0.00001, level * envelope.sustain);
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(Math.max(0.00001, level), endAttack);
    param.exponentialRampToValueAtTime(sustain, endDecay);
    if (endDecay < time + duration) param.setValueAtTime(sustain, time + duration);
    param.exponentialRampToValueAtTime(0.00001, time + duration + envelope.release);
    param.linearRampToValueAtTime(0, time + duration + envelope.release + 0.008);
  };
  const vibrato = (target: AudioParam, time: number, seconds: number, depth: number, onset: number) => {
    const modulation = scheduled(context.createOscillator());
    modulation.frequency.value = 5.15 + random() * 0.28;
    const amount = gain(0);
    amount.gain.setValueAtTime(0, time);
    amount.gain.linearRampToValueAtTime(depth, time + Math.min(onset, seconds * 0.45));
    modulation.connect(amount);
    amount.connect(target);
    modulation.start(time);
    modulation.stop(time + seconds);
  };

  // Modal PCM uses trigonometric recurrences, not per-frame trigonometry or
  // thousands of oscillator nodes. Cache once for each pitch within this rig.
  const modalBuffer = (key: string, seconds: number, modes: Modal[], scrape: number, noiseSeed: number) => {
    const previous = buffers.get(key);
    if (previous) return previous;
    const buffer = context.createBuffer(1, Math.ceil(sampleRate * seconds), sampleRate);
    const data = buffer.getChannelData(0);
    const states = modes.filter(mode => mode.hz < sampleRate * 0.43).map(mode => {
      const angle = 2 * Math.PI * mode.hz / sampleRate;
      const attenuation = Math.exp(-1 / (sampleRate * mode.decay));
      const phase = mode.phase ?? 0;
      return { sine: Math.sin(phase) * mode.level, cosine: Math.cos(phase) * mode.level, rotateS: Math.sin(angle) * attenuation, rotateC: Math.cos(angle) * attenuation };
    });
    const noteRandom = createRandom(noiseSeed);
    let colored = 0;
    let peak = 0;
    for (let frame = 0; frame < data.length; frame++) {
      const t = frame / sampleRate;
      let value = 0;
      for (const state of states) {
        value += state.sine;
        const sine = state.sine * state.rotateC + state.cosine * state.rotateS;
        state.cosine = state.cosine * state.rotateC - state.sine * state.rotateS;
        state.sine = sine;
      }
      if (scrape && t < 0.09) {
        colored = colored * 0.56 + (noteRandom() * 2 - 1) * 0.44;
        value += colored * scrape * Math.exp(-t * 70);
      }
      const attack = Math.min(1, t / 0.0025);
      const release = Math.min(1, (data.length - frame) / (sampleRate * 0.09));
      data[frame] = value * attack * release;
      peak = Math.max(peak, Math.abs(data[frame]));
    }
    const normalization = 0.88 / Math.max(0.1, peak);
    for (let frame = 0; frame < data.length; frame++) data[frame] *= normalization;
    buffers.set(key, buffer);
    return buffer;
  };
  const oneShot = (buffer: AudioBuffer, time: number, seconds: number, level: number, destination: AudioNode, position = 0, hold?: number) => {
    const source = scheduled(context.createBufferSource());
    source.buffer = buffer;
    const expression = gain(level);
    const notePan = pan(position);
    source.connect(expression);
    expression.connect(notePan);
    notePan.connect(destination);
    if (hold !== undefined) {
      expression.gain.setValueAtTime(level, time);
      expression.gain.setValueAtTime(level, time + Math.min(hold, seconds * 0.6));
      expression.gain.exponentialRampToValueAtTime(0.00001, time + seconds - 0.006);
      expression.gain.linearRampToValueAtTime(0, time + seconds);
    }
    source.start(time);
    source.stop(time + seconds);
    return source;
  };

  const guzheng = (midi: number, time: number, duration: number, velocity: number) => {
    const hz = frequency(midi);
    const modes = Array.from({ length: 11 }, (_, index) => {
      const harmonic = index + 1;
      return {
        hz: hz * harmonic * Math.sqrt(1 + 0.000035 * harmonic * harmonic),
        level: 1 / harmonic ** 1.23 * (harmonic % 3 === 0 ? 0.78 : 1),
        decay: Math.max(0.07, 0.76 / harmonic ** 0.53),
      };
    });
    modes.push({ hz: 482, level: 0.05, decay: 0.055 }, { hz: 734, level: 0.027, decay: 0.035 });
    const buffer = modalBuffer(`zheng-${midi}`, 2.05, modes, 0.19, seed ^ Math.imul(midi + 1, 0x672985a7));
    const seconds = Math.min(buffer.duration, duration + 0.57);
    const source = oneShot(buffer, time, seconds, velocity * 0.23, zhengBus, -0.24 + (midi - 66) * 0.008, Math.min(duration, 0.3));
    // Finger pressure bends a sustained string after its clearly pitched attack.
    if (duration > 0.47) {
      source.playbackRate.setValueAtTime(1, time);
      source.playbackRate.linearRampToValueAtTime(2 ** (17 / 1200), time + Math.min(0.34, duration * 0.55));
      source.playbackRate.linearRampToValueAtTime(1, time + duration);
    }
  };
  const dizi = (midi: number, time: number, duration: number, velocity: number) => {
    const seconds = duration + 0.21;
    const expression = gain(0);
    const position = pan(0.07);
    shape(expression.gain, time, duration, velocity * 0.155, { attack: 0.021, decay: 0.15, sustain: 0.79, release: 0.19 });
    expression.connect(position);
    position.connect(diziBus);
    const reed = oscillator(fluteWave, frequency(midi), time, seconds, expression);
    reed.detune.setValueAtTime(-6, time);
    reed.detune.linearRampToValueAtTime(0, time + Math.min(0.045, duration * 0.35));
    vibrato(reed.detune, time, seconds, duration > 0.38 ? 6 : 2, 0.32);
    // Dimo-membrane buzz is in the asymmetric harmonic spectrum; breath is
    // separately band-limited so the tune remains clear on small speakers.
    const breathColor = filter('bandpass', 3400, 0.58);
    const breath = gain(0.045);
    breathColor.connect(breath);
    breath.connect(expression);
    noise(time, seconds, breathColor, 0.83 + random() * 0.12);
  };
  const erhu = (midi: number, time: number, duration: number, velocity: number) => {
    const seconds = duration + 0.28;
    const expression = gain(0);
    const color = filter('lowpass', 2900, 0.56);
    const position = pan(-0.1);
    shape(expression.gain, time, duration, velocity * 0.12, { attack: 0.068, decay: 0.2, sustain: 0.77, release: 0.26 });
    expression.connect(color);
    color.connect(position);
    position.connect(erhuBus);
    const bow = oscillator(erhuWave, frequency(midi), time, seconds, expression);
    bow.detune.setValueAtTime(-14, time);
    bow.detune.linearRampToValueAtTime(0, time + Math.min(0.12, duration * 0.45));
    vibrato(bow.detune, time, seconds, 9, 0.3);
    const friction = filter('bandpass', 2100, 0.62);
    const bowNoise = gain(0.027);
    friction.connect(bowNoise);
    bowNoise.connect(expression);
    noise(time, seconds, friction, 0.77);
  };

  // A single stereo buffer source per string note replaces a many-oscillator
  // supersaw. Integer cycles make the 1 s source wrap exactly; playbackRate
  // restores the requested pitch, including arbitrary semitone transposition.
  const stringWave = context.createBuffer(2, sampleRate, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = stringWave.getChannelData(channel);
    const detuned = channel === 0 ? [219, 221] : [221, 219];
    for (const [voice, hz] of detuned.entries()) {
      for (let harmonic = 1; harmonic <= 9; harmonic++) {
        const angle = 2 * Math.PI * hz * harmonic / sampleRate;
        const rotateS = Math.sin(angle);
        const rotateC = Math.cos(angle);
        let sine = Math.sin(harmonic * 0.37 + voice * 1.4) / harmonic ** 1.2 * (voice ? 0.21 : 0.52);
        let cosine = Math.cos(harmonic * 0.37 + voice * 1.4) / harmonic ** 1.2 * (voice ? 0.21 : 0.52);
        for (let frame = 0; frame < data.length; frame++) {
          data[frame] += sine;
          const next = sine * rotateC + cosine * rotateS;
          cosine = cosine * rotateC - sine * rotateS;
          sine = next;
        }
      }
    }
  }
  const strings = (midi: number, time: number, duration: number, velocity: number, soft = false) => {
    const expression = gain(0);
    const release = soft ? 0.68 : 0.52;
    shape(expression.gain, time, duration, velocity * (soft ? 0.039 : 0.065), { attack: soft ? 0.32 : 0.13, decay: 0.5, sustain: 0.76, release });
    expression.connect(stringBus);
    const source = scheduled(context.createBufferSource());
    source.buffer = stringWave;
    source.loop = true;
    source.playbackRate.value = frequency(midi) / 220;
    source.connect(expression);
    source.start(time, (midi % 7) * 0.07);
    source.stop(time + duration + release + 0.02);
  };
  const brass = (midi: number, time: number, duration: number, velocity: number) => {
    const expression = gain(0);
    const color = filter('lowpass', 1600, 0.57);
    shape(expression.gain, time, duration, velocity * 0.078, { attack: 0.055, decay: 0.17, sustain: 0.64, release: 0.2 });
    color.frequency.setValueAtTime(950, time);
    color.frequency.linearRampToValueAtTime(2700, time + Math.min(0.14, duration * 0.55));
    color.frequency.linearRampToValueAtTime(1700, time + duration + 0.2);
    expression.connect(color);
    const position = pan((midi % 5 - 2) * 0.1);
    color.connect(position);
    position.connect(brassBus);
    oscillator(brassWave, frequency(midi), time, duration + 0.22, expression);
  };
  const granular = (midi: number, time: number, duration: number, velocity: number) => {
    const key = `jade-${midi}`;
    let buffer = buffers.get(key);
    if (!buffer) {
      const hz = frequency(midi);
      const noteRandom = createRandom(seed ^ Math.imul(midi + 3, 0x56f892b1));
      // A frozen pluck/bronze spectrum with asynchronous, soft grain windows.
      // The grains are assembled into PCM, costing one source per played note.
      buffer = context.createBuffer(2, Math.ceil(sampleRate * 1.8), sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let grain = 0; grain < 9; grain++) {
          const start = Math.floor((grain * 0.15 + noteRandom() * 0.045) * sampleRate);
          const frames = Math.floor((0.24 + noteRandom() * 0.14) * sampleRate);
          const drift = 2 ** ((noteRandom() - 0.5) * 9 / 1200);
          const phase = noteRandom() * Math.PI * 2;
          for (let offset = 0; offset < frames && start + offset < data.length; offset++) {
            const t = offset / sampleRate;
            const window = Math.sin(Math.PI * offset / frames) ** 2;
            const cycle = 2 * Math.PI * hz * drift * t + phase;
            data[start + offset] += window * (Math.sin(cycle) + 0.23 * Math.sin(cycle * 2.003) + 0.09 * Math.sin(cycle * 2.69)) * 0.28 * Math.exp(-grain * 0.12);
          }
        }
      }
      buffers.set(key, buffer);
    }
    oneShot(buffer, time, Math.min(1.8, duration + 0.42), velocity * 0.19, granularBus, 0, Math.min(duration * 0.6, 0.4));
  };
  const bass = (midi: number, time: number, duration: number, velocity: number, sub = false) => {
    const expression = gain(0);
    const color = filter('lowpass', sub ? 135 : 670, 0.56);
    shape(expression.gain, time, duration, velocity * (sub ? 0.13 : 0.245), { attack: 0.014, decay: 0.17, sustain: 0.7, release: 0.085 });
    expression.connect(color);
    color.connect(bassDuck);
    oscillator(sub ? 'sine' : 'triangle', frequency(midi), time, duration + 0.11, expression);
  };

  const taikoBuffer = modalBuffer('taiko', 1.15, [
    { hz: 64, level: 1, decay: 0.36 }, { hz: 104, level: 0.62, decay: 0.24 },
    { hz: 149, level: 0.3, decay: 0.17 }, { hz: 214, level: 0.14, decay: 0.11 },
    { hz: 347, level: 0.08, decay: 0.08 },
  ], 0.62, seed ^ 0x217c539a);
  const gongBuffer = modalBuffer('gong', 1.8, [
    { hz: 132, level: 0.55, decay: 0.67 }, { hz: 201, level: 0.75, decay: 0.78 },
    { hz: 257, level: 0.59, decay: 0.66 }, { hz: 334, level: 0.39, decay: 0.7 },
    { hz: 412, level: 0.36, decay: 0.55 }, { hz: 567, level: 0.22, decay: 0.44 },
    { hz: 783, level: 0.2, decay: 0.38 }, { hz: 1083, level: 0.11, decay: 0.29 },
    { hz: 1487, level: 0.075, decay: 0.21 },
  ], 0.18, seed ^ 0x1da733b9);
  const taiko = (time: number, velocity: number) => {
    const source = oneShot(taikoBuffer, time, taikoBuffer.duration, velocity * 0.58, taikoBus, -0.035);
    source.playbackRate.setValueAtTime(1.09, time);
    source.playbackRate.exponentialRampToValueAtTime(1, time + 0.045);
  };
  const gong = (time: number, velocity: number) => {
    const source = oneShot(gongBuffer, time, gongBuffer.duration, velocity * 0.28, gongBus, 0.16);
    source.playbackRate.setValueAtTime(0.98, time);
    source.playbackRate.linearRampToValueAtTime(1.035, time + 0.7);
  };
  const kick = (time: number, velocity: number) => {
    const expression = gain(0);
    expression.connect(drums);
    shape(expression.gain, time, 0.065, velocity * 0.74, { attack: 0.003, decay: 0.06, sustain: 0.22, release: 0.16 });
    const source = oscillator('sine', 141, time, 0.245, expression);
    source.frequency.setValueAtTime(141, time);
    source.frequency.exponentialRampToValueAtTime(49, time + 0.027);
    source.frequency.exponentialRampToValueAtTime(43, time + 0.17);
    const click = gain(0);
    const color = filter('lowpass', 2400);
    shape(click.gain, time, 0.006, velocity * 0.04, { attack: 0.001, decay: 0.004, sustain: 0.03, release: 0.006 });
    color.connect(click);
    click.connect(drums);
    noise(time, 0.015, color);
  };
  const clap = (time: number, velocity: number) => {
    // A short snare body gives beats two and four a solid centre under the noise snap.
    const body = gain(0);
    shape(body.gain, time, 0.025, velocity * 0.12, { attack: 0.002, decay: 0.02, sustain: 0.27, release: 0.09 });
    body.connect(drums);
    oscillator('triangle', 185, time, 0.13, body);
    const expression = gain(0);
    const color = filter('bandpass', 1670, 0.58);
    color.connect(expression);
    expression.connect(clapBus);
    expression.gain.setValueAtTime(0, time);
    for (const offset of [0, 0.011, 0.024]) {
      expression.gain.linearRampToValueAtTime(velocity * 0.31, time + offset + 0.0015);
      expression.gain.exponentialRampToValueAtTime(0.00001, time + offset + 0.0095);
    }
    expression.gain.linearRampToValueAtTime(velocity * 0.22, time + 0.038);
    expression.gain.exponentialRampToValueAtTime(0.00001, time + 0.18);
    expression.gain.linearRampToValueAtTime(0, time + 0.19);
    noise(time, 0.2, color);
  };
  let openHat: { gain: AudioParam; end: number } | undefined;
  const hat = (time: number, velocity: number, open = false) => {
    if (!open && openHat && time < openHat.end) {
      openHat.gain.cancelAndHoldAtTime(time);
      openHat.gain.linearRampToValueAtTime(0, time + 0.012);
    }
    const seconds = open ? 0.32 : 0.065;
    const expression = gain(0);
    const position = pan(open ? 0.13 : -0.07);
    shape(expression.gain, time, 0.012, velocity * (open ? 0.16 : 0.105), { attack: 0.0018, decay: 0.009, sustain: 0.4, release: seconds - 0.012 });
    expression.connect(position);
    position.connect(hatBus);
    noise(time, seconds + 0.012, expression, 0.94 + random() * 0.1);
    if (open) openHat = { gain: expression.gain, end: time + seconds };
  };
  const percussion = (time: number, velocity: number) => {
    const buffer = modalBuffer('wood', 0.14, [{ hz: 970, level: 1, decay: 0.019 }, { hz: 1421, level: 0.4, decay: 0.012 }, { hz: 2187, level: 0.12, decay: 0.009 }], 0.12, seed ^ 0x67201ebc);
    oneShot(buffer, time, buffer.duration, velocity * 0.12, clapBus, 0.22);
  };
  const texture = (time: number, duration: number, velocity: number, sweep = false) => {
    const expression = gain(0);
    const color = filter('bandpass', sweep ? 900 : 3700, 0.6);
    color.connect(expression);
    expression.connect(textureBus);
    if (sweep) {
      expression.gain.setValueAtTime(0, time);
      expression.gain.linearRampToValueAtTime(velocity * 0.075, time + duration * 0.88);
      expression.gain.exponentialRampToValueAtTime(0.00001, time + duration + 0.16);
      expression.gain.linearRampToValueAtTime(0, time + duration + 0.17);
      color.frequency.setValueAtTime(900, time);
      color.frequency.exponentialRampToValueAtTime(6300, time + duration);
    } else {
      shape(expression.gain, time, duration, velocity * 0.039, { attack: 0.19, decay: 0.4, sustain: 0.46, release: 0.28 });
    }
    noise(time, duration + (sweep ? 0.18 : 0.3), color, 0.79);
  };

  const hit = (event: MusicalEvent, time: number): void => {
    if (disposed) throw new Error('音源已释放');
    if (!Number.isFinite(time) || time < 0) throw new RangeError('音源调度时间必须为非负有限数');
    if (!Number.isFinite(event.duration) || event.duration <= 0 || !Number.isFinite(event.velocity)) throw new RangeError('音符时值及力度无效');
    const duration = Math.max(0.025, event.duration * beat);
    const velocity = Math.min(1, Math.max(0, event.velocity));
    if (velocity === 0) return;
    const instrument: string = event.instrument;
    switch (instrument) {
      case 'kick': kick(time, velocity); return;
      case 'clap': clap(time, velocity); return;
      case 'hat': hat(time, velocity); return;
      case 'openHat': hat(time, velocity, true); return;
      case 'perc': percussion(time, velocity); return;
      case 'taiko': taiko(time, velocity); return;
      case 'gong': gong(time, velocity); return;
      case 'texture': texture(time, duration, velocity); return;
      case 'sweep': texture(time, duration, velocity, true); return;
      case 'impact': taiko(time, velocity * 0.73); gong(time, velocity * 0.52); return;
    }
    if (!event.notes?.length) throw new Error(`音高缺失: ${instrument}`);
    for (const midi of event.notes) {
      if (!Number.isFinite(midi) || midi < 0 || midi > 127) throw new RangeError(`音高越界: ${midi}`);
      switch (instrument) {
        case 'guzheng': guzheng(midi, time, duration, velocity); break;
        case 'dizi': dizi(midi, time, duration, velocity); break;
        case 'erhu': erhu(midi, time, duration, velocity); break;
        case 'strings': strings(midi, time, duration, velocity); break;
        case 'brass': brass(midi, time, duration, velocity); break;
        case 'granular': granular(midi, time, duration, velocity); break;
        case 'pad': strings(midi, time, duration, velocity, true); break;
        case 'bass': bass(midi, time, duration, velocity); break;
        case 'sub': bass(midi, time, duration, velocity, true); break;
        default: throw new Error(`国风交响音色未注册: ${instrument}`);
      }
    }
  };
  let lastDuck = -Infinity;
  const duck = (time: number): void => {
    if (disposed) throw new Error('音源已释放');
    if (!Number.isFinite(time) || time < 0 || time < lastDuck) throw new RangeError('侧链调度时间必须按非负时间顺序排列');
    const elapsed = time - lastDuck;
    const automate = (param: AudioParam, depth: number, recovery: number) => {
      const attack = 0.009;
      const previous = elapsed < attack
        ? 1 - (1 - depth) * elapsed / attack
        : elapsed < recovery ? depth + (1 - depth) * (elapsed - attack) / (recovery - attack) : 1;
      param.cancelScheduledValues(time);
      param.setValueAtTime(previous, time);
      param.linearRampToValueAtTime(depth, time + attack);
      param.linearRampToValueAtTime(1, time + recovery);
    };
    automate(bassDuck.gain, 0.44, beat * 0.42);
    automate(orchestraDuck.gain, 0.88, beat * 0.3);
    lastDuck = time;
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const source of sources) {
      try { source.stop(); } catch { /* Already-ended Offline one-shots. */ }
    }
    for (const node of nodes.reverse()) node.disconnect();
    room.buffer = null;
    sources.length = 0;
    nodes.length = 0;
    buffers.clear();
    openHat = undefined;
  };
  return { hit, duck, dispose };
}
