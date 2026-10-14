import * as Tone from 'tone';
import { createRandom } from '../music/random';
import type { MusicalEvent } from '../music/types';

type Mode = { hz: number; level: number; decay: number; phase?: number };
type Envelope = { attack: number; decay: number; sustain: number; release: number };

/** Original, stylised Chinese plucks and a small electronic rhythm section. */
export function createInkTideInstruments(bpm: number, seed: number) {
  const context = Tone.getContext();
  const sampleRate = context.sampleRate;
  const beat = 60 / bpm;
  const random = createRandom(seed ^ 0x39e741ab);
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const buffers = new Map<string, AudioBuffer>();
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
  const filter = (type: BiquadFilterType, hz: number, q = 0.65) => {
    const node = own(context.createBiquadFilter());
    node.type = type;
    node.frequency.value = Math.min(sampleRate * 0.44, hz);
    node.Q.value = q;
    return node;
  };
  const pan = (position: number) => {
    const node = own(context.createStereoPanner());
    node.pan.value = Math.max(-1, Math.min(1, position));
    return node;
  };
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  const highpass = filter('highpass', 27, 0.55);
  // Fixed headroom preserves the pluck transients and seeded PCM repeatability.
  // finishAudio handles the peak ceiling; the export pipeline handles loudness.
  const master = gain(0.8);
  highpass.connect(master);
  master.connect(context.rawContext.destination);
  const drums = gain(0.87);
  const musicDuck = gain();
  const bassDuck = gain();
  drums.connect(highpass);
  musicDuck.connect(highpass);
  bassDuck.connect(highpass);

  // A finite dark room and one forward echo: no feedback state between renders.
  const roomSend = gain();
  const room = own(context.createConvolver());
  room.normalize = false;
  const impulse = context.createBuffer(2, Math.ceil(sampleRate * 0.92), sampleRate);
  const roomRandom = createRandom(seed ^ 0x60ae2139);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let previous = 0;
    for (let frame = 0; frame < data.length; frame++) {
      const seconds = frame / sampleRate;
      previous = previous * 0.73 + (roomRandom() * 2 - 1) * 0.27;
      data[frame] = previous * 0.047 * Math.exp(-seconds * 7.4)
        * Math.min(1, seconds / 0.02) * Math.min(1, (data.length - frame) / (sampleRate * 0.08));
    }
    for (const [index, seconds] of [0.027, 0.043, 0.071, 0.109].entries()) {
      data[Math.round((seconds + channel * 0.005) * sampleRate)] += (index % 2 ? -1 : 1) * 0.23 * 0.62 ** index;
    }
  }
  room.buffer = impulse;
  const roomLow = filter('highpass', 390);
  const roomHigh = filter('lowpass', 3900);
  const roomReturn = gain(0.29);
  roomSend.connect(room);
  room.connect(roomLow);
  roomLow.connect(roomHigh);
  roomHigh.connect(roomReturn);
  roomReturn.connect(musicDuck);
  const echoSend = gain();
  const echo = own(context.createDelay(2));
  echo.delayTime.value = beat * 0.75;
  const echoColor = filter('lowpass', 2500);
  const echoLow = filter('highpass', 450);
  const echoLevel = gain(0.12);
  const echoPan = pan(0.31);
  echoSend.connect(echo);
  echo.connect(echoLow);
  echoLow.connect(echoColor);
  echoColor.connect(echoLevel);
  echoLevel.connect(echoPan);
  echoPan.connect(musicDuck);
  const bus = (low: number, high: number, space = 0, delay = 0, destination = musicDuck) => {
    const first = filter('highpass', low);
    const last = filter('lowpass', high);
    first.connect(last);
    last.connect(destination);
    if (space) { const send = gain(space); last.connect(send); send.connect(roomSend); }
    if (delay) { const send = gain(delay); last.connect(send); send.connect(echoSend); }
    return first;
  };
  const qinBus = bus(135, 5300, 0.17, 0.14);
  const xiaoBus = bus(180, 2850, 0.23);
  const pianoBus = bus(190, 3100, 0.14);
  const leadBus = bus(190, 3600, 0.11, 0.09);
  const padBus = bus(310, 1800, 0.21);
  const jadeBus = bus(590, 6300, 0.23, 0.13);
  const rimBus = bus(340, 5300, 0.045, 0, drums);
  const shakerBus = bus(4300, 10000, 0.02, 0, drums);
  const sweepBus = bus(1000, 4800, 0.14);

  const noisePool = context.createBuffer(1, sampleRate, sampleRate);
  const noiseData = noisePool.getChannelData(0);
  for (let frame = 0; frame < noiseData.length; frame++) noiseData[frame] = random() * 2 - 1;
  const noise = (time: number, seconds: number, destination: AudioNode) => {
    const source = scheduled(context.createBufferSource());
    source.buffer = noisePool;
    source.loop = true;
    source.connect(destination);
    source.start(time, random() * 0.8);
    source.stop(time + seconds);
  };
  const periodic = (levels: number[]) => {
    const imaginary = new Float32Array(levels.length + 1);
    imaginary.set(levels, 1);
    return context.createPeriodicWave(new Float32Array(levels.length + 1), imaginary);
  };
  const xiaoWave = periodic([1, 0.19, 0.105, 0.025, 0.021, 0.008]);
  const bassWave = periodic([1, 0.21, 0.14, 0.045, 0.025]);
  const padWave = periodic([1, 0.15, 0.065, 0.017]);
  const oscillator = (wave: OscillatorType | PeriodicWave, frequency: number, time: number, seconds: number, destination: AudioNode) => {
    const source = scheduled(context.createOscillator());
    if (typeof wave === 'string') source.type = wave as OscillatorType;
    else source.setPeriodicWave(wave);
    source.frequency.value = frequency;
    source.connect(destination);
    source.start(time);
    source.stop(time + seconds);
    return source;
  };
  const shape = (param: AudioParam, time: number, duration: number, level: number, envelope: Envelope) => {
    const attackEnd = time + Math.min(envelope.attack, duration * 0.4);
    const decayEnd = Math.min(time + duration, attackEnd + envelope.decay);
    const sustain = Math.max(0.00001, level * envelope.sustain);
    param.setValueAtTime(0, time);
    param.linearRampToValueAtTime(Math.max(0.00001, level), attackEnd);
    param.exponentialRampToValueAtTime(sustain, decayEnd);
    if (decayEnd < time + duration) param.setValueAtTime(sustain, time + duration);
    param.exponentialRampToValueAtTime(0.00001, time + duration + envelope.release);
    param.linearRampToValueAtTime(0, time + duration + envelope.release + 0.008);
  };

  // Cached damped modes keep chord and loop rendering economical. Timbre varies
  // through three velocity layers and three pick positions, all seed-reproducible.
  const modal = (key: string, seconds: number, modes: Mode[], pickNoise: number, noteSeed: number) => {
    const cached = buffers.get(key);
    if (cached) return cached;
    const buffer = context.createBuffer(1, Math.ceil(sampleRate * seconds), sampleRate);
    const data = buffer.getChannelData(0);
    const modesBelowNyquist = modes.filter(mode => mode.hz < sampleRate * 0.43).map(mode => {
      const angle = 2 * Math.PI * mode.hz / sampleRate;
      const damping = Math.exp(-1 / (sampleRate * mode.decay));
      const phase = mode.phase ?? 0;
      return { sine: Math.sin(phase) * mode.level, cosine: Math.cos(phase) * mode.level, s: Math.sin(angle) * damping, c: Math.cos(angle) * damping };
    });
    const noteRandom = createRandom(noteSeed);
    let colored = 0;
    let maximum = 0;
    for (let frame = 0; frame < data.length; frame++) {
      const seconds = frame / sampleRate;
      let value = 0;
      for (const mode of modesBelowNyquist) {
        value += mode.sine;
        const next = mode.sine * mode.c + mode.cosine * mode.s;
        mode.cosine = mode.cosine * mode.c - mode.sine * mode.s;
        mode.sine = next;
      }
      if (pickNoise && seconds < 0.05) {
        colored = colored * 0.48 + (noteRandom() * 2 - 1) * 0.52;
        value += colored * pickNoise * Math.exp(-seconds * 115);
      }
      data[frame] = value * Math.min(1, seconds / 0.0018) * Math.min(1, (data.length - frame) / (sampleRate * 0.07));
      maximum = Math.max(maximum, Math.abs(data[frame]));
    }
    const normalization = 0.87 / Math.max(0.1, maximum);
    for (let frame = 0; frame < data.length; frame++) data[frame] *= normalization;
    buffers.set(key, buffer);
    return buffer;
  };
  const oneShot = (buffer: AudioBuffer, time: number, seconds: number, level: number, destination: AudioNode, position = 0, dampAt?: number) => {
    const source = scheduled(context.createBufferSource());
    source.buffer = buffer;
    const expression = gain(level);
    const positionNode = pan(position);
    source.connect(expression);
    expression.connect(positionNode);
    positionNode.connect(destination);
    const end = Math.min(buffer.duration, seconds);
    expression.gain.setValueAtTime(level, time);
    expression.gain.setValueAtTime(level, time + Math.min(dampAt ?? end - 0.035, end - 0.035));
    expression.gain.exponentialRampToValueAtTime(0.00001, time + end - 0.004);
    expression.gain.linearRampToValueAtTime(0, time + end);
    source.start(time);
    source.stop(time + end);
    return source;
  };

  const guqin = (midi: number, time: number, duration: number, velocity: number) => {
    const layer = velocity < 0.48 ? 0 : velocity < 0.76 ? 1 : 2;
    const variant = Math.floor(random() * 3);
    const pickPosition = [0.19, 0.225, 0.255][variant];
    const frequency = hz(midi);
    const modes: Mode[] = Array.from({ length: 12 }, (_, index) => {
      const partial = index + 1;
      const pick = Math.abs(Math.sin(Math.PI * partial * pickPosition));
      return {
        hz: frequency * partial * Math.sqrt(1 + 0.000009 * partial * partial),
        level: (partial === 1 ? 1.15 : 0.85 * pick + 0.1) / partial ** (1.33 - layer * 0.08),
        decay: (0.86 + (76 - midi) * 0.005) / partial ** 0.56,
        phase: partial * variant * 0.045,
      };
    });
    modes.push({ hz: 196, level: 0.027, decay: 0.055 }, { hz: 342, level: 0.035, decay: 0.043 }, { hz: 590, level: 0.016, decay: 0.027 });
    const buffer = modal(`qin-${midi}-${layer}-${variant}`, 2.05, modes, 0.055 + layer * 0.027, seed ^ Math.imul(midi * 9 + layer * 3 + variant + 1, 0x275aa75b));
    const seconds = Math.min(buffer.duration, duration + 0.47);
    const source = oneShot(buffer, time, seconds, velocity * 0.37, qinBus, -0.13 + (midi - 69) * 0.006, Math.min(duration, 0.48));
    if (duration > 0.34) {
      source.playbackRate.setValueAtTime(1, time);
      source.playbackRate.linearRampToValueAtTime(2 ** ((variant === 0 ? 6 : 3) / 1200), time + Math.min(duration * 0.62, 0.27));
      source.playbackRate.linearRampToValueAtTime(1, time + duration);
    }
  };
  const xiao = (midi: number, time: number, duration: number, velocity: number) => {
    const seconds = duration + 0.18;
    const expression = gain(0);
    const color = filter('lowpass', 2100, 0.5);
    const position = pan(0.11);
    shape(expression.gain, time, duration, velocity * 0.195, { attack: 0.047, decay: 0.14, sustain: 0.83, release: 0.16 });
    expression.connect(color);
    color.connect(position);
    position.connect(xiaoBus);
    color.frequency.setValueAtTime(1600, time);
    color.frequency.linearRampToValueAtTime(1900 + velocity * 1100, time + Math.min(duration * 0.45, 0.13));
    color.frequency.linearRampToValueAtTime(1900, time + duration + 0.16);
    const tone = oscillator(xiaoWave, hz(midi), time, seconds, expression);
    tone.detune.setValueAtTime(-7, time);
    tone.detune.linearRampToValueAtTime(0, time + Math.min(duration * 0.32, 0.075));
    if (duration > 0.4) {
      const depth = gain(0);
      const onset = Math.min(0.24, duration * 0.4);
      depth.gain.setValueAtTime(0, time + onset);
      depth.gain.linearRampToValueAtTime(4.2, time + Math.min(duration * 0.84, onset + 0.25));
      depth.connect(tone.detune);
      oscillator('sine', 4.65 + random() * 0.3, time, seconds, depth);
    }
    const breathColor = filter('bandpass', 1800, 0.6);
    const breath = gain(0.073);
    breathColor.connect(breath);
    breath.connect(expression);
    noise(time, seconds, breathColor);
  };
  const piano = (midi: number, time: number, duration: number, velocity: number) => {
    const frequency = hz(midi);
    const modes = [1, 2.001, 3.003, 4.006, 5.01, 7.02].map((ratio, index) => ({
      hz: frequency * ratio,
      level: [1, 0.23, 0.1, 0.045, 0.023, 0.01][index],
      decay: [0.82, 0.36, 0.19, 0.12, 0.09, 0.06][index],
    }));
    const buffer = modal(`piano-${midi}`, 2.15, modes, 0.018, seed ^ Math.imul(midi + 1, 0x42a395cb));
    oneShot(buffer, time, Math.min(2.15, duration + 0.24), velocity * 0.185, pianoBus, (midi - 64) * 0.012, Math.min(duration, 0.72));
  };
  const jade = (midi: number, time: number, duration: number, velocity: number) => {
    const frequency = hz(midi);
    const modes = [1, 2.003, 2.76, 4.08, 5.43].map((ratio, index) => ({
      hz: frequency * ratio, level: [1, 0.22, 0.09, 0.045, 0.015][index], decay: [0.58, 0.28, 0.19, 0.105, 0.07][index],
    }));
    const buffer = modal(`jade-${midi}`, 1.5, modes, 0.008, seed ^ midi);
    oneShot(buffer, time, Math.min(1.5, duration + 0.65), velocity * 0.17, jadeBus, 0.26, Math.min(duration + 0.15, 0.65));
  };
  const lead = (midi: number, time: number, duration: number, velocity: number) => {
    const expression = gain(0);
    const color = filter('lowpass', 3000, 0.52);
    // Match the plucked foreground's early RMS when the final phrase changes voice.
    shape(expression.gain, time, duration, velocity * 0.42, { attack: 0.008, decay: 0.18, sustain: 0.46, release: 0.14 });
    color.frequency.setValueAtTime(1800 + velocity * 2200, time);
    color.frequency.exponentialRampToValueAtTime(1250, time + Math.min(duration + 0.1, 0.36));
    expression.connect(color);
    color.connect(leadBus);
    oscillator('triangle', hz(midi), time, duration + 0.16, expression);
  };
  const pad = (midi: number, time: number, duration: number, velocity: number) => {
    const expression = gain(0);
    shape(expression.gain, time, duration, velocity * 0.061, { attack: 0.23, decay: 0.4, sustain: 0.74, release: 0.43 });
    expression.connect(padBus);
    for (const side of [-1, 1]) {
      const position = pan(side * 0.33);
      const level = gain(0.5);
      position.connect(level);
      level.connect(expression);
      const source = oscillator(padWave, hz(midi), time, duration + 0.45, position);
      source.detune.value = side * 3.1;
    }
  };
  const bass = (midi: number, time: number, duration: number, velocity: number) => {
    const expression = gain(0);
    const color = filter('lowpass', 950, 0.55);
    shape(expression.gain, time, duration, velocity * 0.31, { attack: 0.011, decay: 0.13, sustain: 0.58, release: 0.07 });
    color.frequency.setValueAtTime(950, time);
    color.frequency.exponentialRampToValueAtTime(430, time + Math.min(duration + 0.04, 0.22));
    expression.connect(color);
    color.connect(bassDuck);
    oscillator(bassWave, hz(midi), time, duration + 0.09, expression);
  };
  const kick = (time: number, velocity: number) => {
    const expression = gain(0);
    shape(expression.gain, time, 0.065, velocity * 0.82, { attack: 0.0025, decay: 0.055, sustain: 0.25, release: 0.13 });
    expression.connect(drums);
    const source = oscillator('sine', 139, time, 0.215, expression);
    source.frequency.setValueAtTime(139, time);
    source.frequency.exponentialRampToValueAtTime(53, time + 0.029);
    source.frequency.exponentialRampToValueAtTime(46, time + 0.15);
    const click = gain(0);
    const color = filter('lowpass', 2100);
    shape(click.gain, time, 0.005, velocity * 0.038, { attack: 0.001, decay: 0.004, sustain: 0.05, release: 0.008 });
    color.connect(click);
    click.connect(drums);
    noise(time, 0.023, color);
  };
  const rimBuffer = modal('rim', 0.19, [
    { hz: 410, level: 0.36, decay: 0.026 }, { hz: 820, level: 1, decay: 0.018 },
    { hz: 1470, level: 0.48, decay: 0.012 }, { hz: 2380, level: 0.16, decay: 0.008 },
  ], 0.21, seed ^ 0x7314e60b);
  const rim = (time: number, velocity: number) => {
    const source = oneShot(rimBuffer, time, 0.19, velocity * 0.39, rimBus, -0.03);
    source.playbackRate.value = 0.985 + random() * 0.03;
    const snap = gain(0);
    const color = filter('bandpass', 2500, 0.53);
    shape(snap.gain, time, 0.009, velocity * 0.16, { attack: 0.001, decay: 0.008, sustain: 0.14, release: 0.05 });
    color.connect(snap);
    snap.connect(rimBus);
    noise(time, 0.08, color);
  };
  const shaker = (time: number, velocity: number) => {
    const expression = gain(0);
    const position = pan(0.22);
    shape(expression.gain, time, 0.016, velocity * 0.23, { attack: 0.006, decay: 0.01, sustain: 0.28, release: 0.037 });
    expression.connect(position);
    position.connect(shakerBus);
    noise(time, 0.065, expression);
  };
  const sweep = (time: number, duration: number, velocity: number) => {
    const expression = gain(0);
    const color = filter('bandpass', 1250, 0.55);
    expression.gain.setValueAtTime(0, time);
    expression.gain.linearRampToValueAtTime(velocity * 0.12, time + duration * 0.82);
    expression.gain.linearRampToValueAtTime(0, time + duration + 0.045);
    color.frequency.setValueAtTime(1250, time);
    color.frequency.exponentialRampToValueAtTime(3600, time + duration);
    color.connect(expression);
    expression.connect(sweepBus);
    noise(time, duration + 0.05, color);
  };

  const hit = (event: MusicalEvent, time: number): void => {
    if (disposed) throw new Error('音源已释放');
    if (!Number.isFinite(time) || time < 0 || !Number.isFinite(event.duration) || event.duration <= 0 || !Number.isFinite(event.velocity) || event.velocity < 0 || event.velocity > 1) throw new RangeError('音符时间、时值及力度无效');
    const duration = Math.max(0.025, event.duration * beat);
    const velocity = event.velocity;
    if (velocity === 0) return;
    const instrument: string = event.instrument;
    switch (instrument) {
      case 'kick': kick(time, velocity); return;
      case 'rim': rim(time, velocity); return;
      case 'shaker': shaker(time, velocity); return;
      case 'sweep': sweep(time, duration, velocity); return;
    }
    if (!event.notes?.length) throw new Error(`音高缺失: ${instrument}`);
    for (const midi of event.notes) {
      if (!Number.isFinite(midi) || midi < 0 || midi > 127) throw new RangeError(`音高越界: ${midi}`);
      switch (instrument) {
        case 'guqin': guqin(midi, time, duration, velocity); break;
        case 'xiao': xiao(midi, time, duration, velocity); break;
        case 'jade': jade(midi, time, duration, velocity); break;
        case 'piano': piano(midi, time, duration, velocity); break;
        case 'lead': lead(midi, time, duration, velocity); break;
        case 'pad': pad(midi, time, duration, velocity); break;
        case 'bass': bass(midi, time, duration, velocity); break;
        default: throw new Error(`墨潮音色未注册: ${instrument}`);
      }
    }
  };
  let lastDuck = -Infinity;
  const duck = (time: number): void => {
    if (disposed) throw new Error('音源已释放');
    if (!Number.isFinite(time) || time < 0 || time < lastDuck) throw new RangeError('侧链调度时间必须按非负时间顺序排列');
    const elapsed = time - lastDuck;
    const automate = (param: AudioParam, depth: number, recovery: number) => {
      const attack = 0.007;
      const previous = elapsed < attack ? 1 - (1 - depth) * elapsed / attack
        : elapsed < recovery ? depth + (1 - depth) * (elapsed - attack) / (recovery - attack) : 1;
      param.cancelScheduledValues(time);
      param.setValueAtTime(previous, time);
      param.linearRampToValueAtTime(depth, time + attack);
      param.linearRampToValueAtTime(1, time + recovery);
    };
    automate(bassDuck.gain, 0.37, beat * 0.3);
    automate(musicDuck.gain, 0.87, beat * 0.25);
    lastDuck = time;
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const source of sources) {
      try { source.stop(); } catch { /* An Offline one-shot can already be stopped. */ }
    }
    for (const node of nodes.reverse()) node.disconnect();
    room.buffer = null;
    sources.length = 0;
    nodes.length = 0;
    buffers.clear();
  };
  return { hit, duck, dispose };
}
