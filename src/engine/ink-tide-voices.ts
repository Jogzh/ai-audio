import * as Tone from 'tone';
import { createRandom } from '../music/random';
import type { Instrument, MusicalEvent } from '../music/types';

type Envelope = { attack: number; decay: number; sustain: number; release: number };

export interface VoiceEnvironment {
  context: ReturnType<typeof Tone.getContext>;
  own: <T extends AudioNode>(node: T) => T;
  scheduled: <T extends AudioScheduledSourceNode>(node: T) => T;
  pianoSamples: ReadonlyMap<number, AudioBuffer>;
  acousticSamples: (instrument: 'flute' | 'strings' | 'cello' | 'harp') => ReadonlyMap<number, AudioBuffer>;
  acousticSampleGain: (instrument: 'flute' | 'strings' | 'cello' | 'harp', midi: number) => number;
}

/** Stable across browser runs and independent of another part's scheduling order. */
export function hashVoiceIdentity(identity: string): number {
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

/** Every track owns its colour, excitation, and random identity. Routing is external. */
export function createInkTideVoice(environment: VoiceEnvironment, instrument: Instrument, seed: number, destination: AudioNode) {
  const { context, own, scheduled, pianoSamples } = environment;
  const sampleRate = context.sampleRate;
  const pianoKeys = [...pianoSamples.keys()].sort((left, right) => left - right);
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
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
  const position = (amount: number) => {
    const node = own(context.createStereoPanner());
    node.pan.value = Math.max(-0.4, Math.min(0.4, amount));
    return node;
  };
  const periodic = (levels: number[]) => {
    const imaginary = new Float32Array(levels.length + 1);
    imaginary.set(levels, 1);
    return context.createPeriodicWave(new Float32Array(levels.length + 1), imaginary);
  };
  const fluteWave = periodic([1, 0.19, 0.055, 0.033, 0.017, 0.007]);
  const violinWave = periodic([1, 0.58, 0.32, 0.22, 0.16, 0.1, 0.068, 0.044]);
  const violaWave = periodic([1, 0.36, 0.24, 0.12, 0.065, 0.033, 0.019]);
  const celloWave = periodic([1, 0.39, 0.17, 0.11, 0.048, 0.025]);
  const bassWave = periodic([1, 0.24, 0.09, 0.035]);
  const oscillator = (wave: OscillatorType | PeriodicWave, frequency: number, time: number, seconds: number, output: AudioNode, cents = 0) => {
    const source = scheduled(context.createOscillator());
    if (typeof wave === 'string') source.type = wave as OscillatorType;
    else source.setPeriodicWave(wave);
    source.frequency.value = frequency;
    source.detune.value = cents;
    source.connect(output);
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
    param.exponentialRampToValueAtTime(sustain, Math.max(attackEnd + 0.001, decayEnd));
    if (decayEnd < time + duration) param.setValueAtTime(sustain, time + duration);
    param.exponentialRampToValueAtTime(0.00001, time + duration + envelope.release);
    param.linearRampToValueAtTime(0, time + duration + envelope.release + 0.008);
  };

  // Noise belongs to this track. Reverb has its own identity in the mixer.
  const noiseBuffer = context.createBuffer(1, sampleRate, sampleRate);
  const noiseRandom = createRandom(seed ^ 0x249613a7);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let frame = 0; frame < noiseData.length; frame++) noiseData[frame] = noiseRandom() * 2 - 1;
  const noise = (time: number, seconds: number, output: AudioNode, random: () => number, rate = 1) => {
    const source = scheduled(context.createBufferSource());
    source.buffer = noiseBuffer;
    source.loop = true;
    source.playbackRate.value = rate;
    source.connect(output);
    source.start(time, random() * 0.8);
    source.stop(time + seconds);
  };

  const piano = (midi: number, time: number, duration: number, velocity: number) => {
    const nearest = pianoKeys.reduce((closest, key) => Math.abs(key - midi) < Math.abs(closest - midi) ? key : closest, pianoKeys[0]);
    const sample = pianoSamples.get(nearest)!;
    const source = scheduled(context.createBufferSource());
    source.buffer = sample;
    const rate = 2 ** ((midi - nearest) / 12);
    source.playbackRate.value = rate;
    const level = velocity ** 1.1 * (midi < 57 ? 0.8 : 1);
    const expression = gain(level);
    const colour = filter('lowpass', 2600 + velocity * 3600, 0.53);
    const spread = position((midi - 64) * 0.008);
    source.connect(expression);
    expression.connect(colour);
    colour.connect(spread);
    spread.connect(destination);
    const naturalEnd = sample.duration / rate;
    const hold = Math.min(duration, Math.max(0.005, naturalEnd - 0.025));
    const end = Math.min(naturalEnd, duration + (midi < 60 ? 0.7 : 0.56));
    expression.gain.setValueAtTime(level, time);
    expression.gain.setValueAtTime(level, time + hold);
    if (end > hold + 0.005) {
      expression.gain.exponentialRampToValueAtTime(Math.max(0.00001, level * 0.002), time + end - 0.004);
      expression.gain.linearRampToValueAtTime(0, time + end);
    }
    source.start(time);
    source.stop(time + end);
  };

  const acoustic = (patch: 'flute' | 'strings' | 'cello' | 'harp', midi: number, time: number, duration: number, velocity: number) => {
    const bank = environment.acousticSamples(patch);
    const keys = [...bank.keys()];
    const nearest = keys.reduce((closest, key) => Math.abs(key - midi) < Math.abs(closest - midi) ? key : closest, keys[0]);
    const sample = bank.get(nearest);
    if (!sample) throw new Error(`实录音色尚未加载: ${patch}`);
    const source = scheduled(context.createBufferSource());
    source.buffer = sample;
    const rate = 2 ** ((midi - nearest) / 12);
    source.playbackRate.value = rate;
    const pluck = patch === 'harp';
    const release = pluck ? 0.65 : patch === 'flute' ? 0.105 : 0.32;
    const attack = pluck ? 0.003 : patch === 'flute' ? 0.009 : 0.08;
    const naturalEnd = sample.duration / rate;
    const hold = Math.min(duration, Math.max(attack + 0.005, naturalEnd - release));
    const end = Math.min(naturalEnd, hold + release);
    // Source microphone levels differ considerably. These are project mix
    // gains; limited per-key sustain compensation preserves the raw files.
    const level = velocity ** (pluck ? 1.15 : 0.9)
      * (patch === 'flute' ? 2.6 : patch === 'strings' ? 4.2 : patch === 'cello' ? 3.15 : 1.9)
      * environment.acousticSampleGain(patch, nearest);
    const expression = gain(0);
    source.connect(expression);
    expression.connect(destination);
    expression.gain.setValueAtTime(0, time);
    expression.gain.linearRampToValueAtTime(level, time + attack);
    // The recording supplies breath/bow variation; do not restart synthesized
    // vibrato on every note or sustain several independent lead tails together.
    expression.gain.setValueAtTime(level, time + hold);
    expression.gain.linearRampToValueAtTime(0, time + end);
    source.start(time);
    source.stop(time + end + 0.001);
  };

  const xiao = (midi: number, time: number, duration: number, velocity: number, random: () => number) => {
    const release = 0.24;
    const seconds = duration + release + 0.02;
    const expression = gain(0);
    const colour = filter('lowpass', 1650 + velocity * 700, 0.5);
    shape(expression.gain, time, duration, velocity * 0.13, { attack: 0.075, decay: 0.16, sustain: 0.82, release });
    expression.connect(colour);
    colour.connect(destination);
    const tone = oscillator(fluteWave, hz(midi), time, seconds, expression);
    tone.detune.setValueAtTime(-4 - random() * 3, time);
    tone.detune.linearRampToValueAtTime(0, time + Math.min(0.12, duration * 0.35));
    const vibrato = gain(0);
    vibrato.gain.setValueAtTime(0, time);
    vibrato.gain.linearRampToValueAtTime(4.2, time + Math.min(0.3, duration * 0.75));
    vibrato.connect(tone.detune);
    oscillator('sine', 4.4 + random() * 0.4, time, seconds, vibrato);
    const breath = gain(0);
    const breathColour = filter('bandpass', 1150 + random() * 180, 0.55);
    shape(breath.gain, time, duration, velocity * 0.024, { attack: 0.04, decay: 0.15, sustain: 0.65, release: 0.13 });
    breathColour.connect(breath);
    breath.connect(destination);
    noise(time, seconds, breathColour, random);
  };

  const plucks = new Map<string, { buffer: AudioBuffer; rate: number }>();
  const plucked = (midi: number, time: number, duration: number, velocity: number, random: () => number) => {
    const variant = Math.floor(random() * 3);
    const key = `${midi}:${variant}`;
    let recorded = plucks.get(key);
    if (!recorded) {
      const guzheng = instrument === 'guzheng';
      const frequency = hz(midi);
      const period = Math.max(3, Math.round(sampleRate / frequency - 0.5));
      const excitation = createRandom(seed ^ hashVoiceIdentity(key));
      const ring = new Float64Array(period);
      let mean = 0;
      for (let index = 0; index < period; index++) {
        ring[index] = excitation() * 2 - 1;
        mean += ring[index];
      }
      mean /= period;
      for (let index = 0; index < period; index++) ring[index] -= mean;
      // A soft pick and finger position suppress brittle high partials.
      for (let pass = 0; pass < (guzheng ? 1 : 3); pass++) {
        const copy = ring.slice();
        for (let index = 0; index < period; index++) ring[index] = copy[index] * 0.6 + copy[(index + 1) % period] * 0.4;
      }
      const seconds = guzheng ? 4.4 : 3.3;
      const buffer = context.createBuffer(1, Math.ceil(sampleRate * seconds), sampleRate);
      const data = buffer.getChannelData(0);
      const retention = Math.exp(-1 / (frequency * (guzheng ? 1.75 : 1.1)));
      let cursor = 0;
      let peak = 0;
      for (let frame = 0; frame < data.length; frame++) {
        const value = ring[cursor];
        const next = (cursor + 1) % period;
        ring[cursor] = (value + ring[next]) * 0.5 * retention;
        cursor = next;
        const secondsAt = frame / sampleRate;
        const body = Math.exp(-secondsAt * (guzheng ? 17 : 25))
          * (Math.sin(secondsAt * Math.PI * 2 * 184) * 0.025 + Math.sin(secondsAt * Math.PI * 2 * 310) * 0.018);
        data[frame] = (value + body) * Math.min(1, secondsAt / 0.003);
        peak = Math.max(peak, Math.abs(data[frame]));
      }
      const correction = 0.72 / Math.max(0.02, peak);
      for (let frame = 0; frame < data.length; frame++) data[frame] *= correction;
      recorded = { buffer, rate: frequency / (sampleRate / (period + 0.5)) };
      plucks.set(key, recorded);
    }
    const source = scheduled(context.createBufferSource());
    source.buffer = recorded.buffer;
    source.playbackRate.value = recorded.rate;
    const expression = gain(velocity ** 1.05 * (instrument === 'guzheng' ? 0.32 : 0.38));
    const colour = filter('lowpass', (instrument === 'guzheng' ? 2300 : 1700) + velocity * 2400, 0.53);
    source.connect(colour);
    colour.connect(expression);
    expression.connect(destination);
    const release = instrument === 'guzheng' ? 0.75 : 0.32;
    const end = Math.min(recorded.buffer.duration / recorded.rate, duration + release);
    expression.gain.setValueAtTime(expression.gain.value, time);
    expression.gain.setValueAtTime(expression.gain.value, time + Math.max(0.006, end - release));
    expression.gain.linearRampToValueAtTime(0, time + end);
    source.start(time);
    source.stop(time + end);
  };

  const bowed = (midi: number, time: number, duration: number, velocity: number, random: () => number, index: number) => {
    const solo = instrument === 'violin';
    const low = instrument === 'cello';
    const release = low ? 0.38 : solo ? 0.34 : 0.7;
    const seconds = duration + release + 0.02;
    const expression = gain(0);
    const colour = filter('lowpass', low ? 1050 + velocity * 900 : solo ? 1950 + velocity * 1300 : 1350 + velocity * 950, 0.55);
    const spread = position(solo || low ? 0 : [-0.13, 0.1, -0.05, 0.16][index % 4]);
    shape(expression.gain, time, duration, velocity * (low ? 0.17 : solo ? 0.16 : 0.10), {
      attack: low ? 0.075 : solo ? 0.055 : 0.23,
      decay: 0.23, sustain: solo ? 0.84 : 0.77, release,
    });
    expression.connect(colour);
    colour.connect(spread);
    spread.connect(destination);
    const wave = low ? celloWave : solo ? violinWave : violaWave;
    const detune = (random() - 0.5) * 1.7;
    const primary = oscillator(wave, hz(midi), time, seconds, expression, detune - (solo ? 0 : 1.7));
    const second = gain(low ? 0.22 : solo ? 0.16 : 0.38);
    second.connect(expression);
    const support = oscillator(low ? 'sine' : wave, hz(midi), time, seconds, second, detune + 1.7);
    const vibrato = gain(0);
    vibrato.gain.setValueAtTime(0, time);
    vibrato.gain.linearRampToValueAtTime(solo ? 5.3 : low ? 3.4 : 2.6, time + Math.min(duration * 0.65, 0.35));
    vibrato.connect(primary.detune);
    vibrato.connect(support.detune);
    oscillator('sine', (low ? 4.1 : solo ? 5.0 : 4.6) + random() * 0.35, time, seconds, vibrato);
    if (solo || low) {
      const bowColour = filter('bandpass', low ? 620 : 1550, 0.7);
      const bow = gain(0);
      shape(bow.gain, time, duration, velocity * (low ? 0.007 : 0.009), { attack: 0.03, decay: 0.12, sustain: 0.35, release: 0.1 });
      bowColour.connect(bow);
      bow.connect(destination);
      noise(time, seconds, bowColour, random);
    }
  };

  const pad = (midi: number, time: number, duration: number, velocity: number, random: () => number, index: number) => {
    const release = 1.15;
    const seconds = duration + release + 0.02;
    const expression = gain(0);
    const colour = filter('lowpass', 780 + velocity * 400, 0.5);
    const spread = position(index % 2 ? 0.2 : -0.2);
    shape(expression.gain, time, duration, velocity * 0.072, { attack: 0.65, decay: 0.5, sustain: 0.86, release });
    expression.connect(colour);
    colour.connect(spread);
    spread.connect(destination);
    oscillator('sine', hz(midi), time, seconds, expression, (random() - 0.5) * 2);
    const second = gain(0.28);
    second.connect(expression);
    oscillator('triangle', hz(midi) * 2, time, seconds, second, 1.3);
  };

  const bass = (midi: number, time: number, duration: number, velocity: number) => {
    const expression = gain(0);
    const colour = filter('lowpass', 360 + velocity * 300, 0.58);
    shape(expression.gain, time, duration, velocity * 0.16, { attack: 0.012, decay: 0.2, sustain: 0.65, release: 0.12 });
    expression.connect(colour);
    colour.connect(destination);
    oscillator(bassWave, hz(midi), time, duration + 0.14, expression);
  };

  const percussion = (event: MusicalEvent, time: number, duration: number, random: () => number) => {
    const velocity = event.velocity;
    if (instrument === 'kick') {
      const expression = gain(0);
      const colour = filter('lowpass', 850, 0.5);
      expression.connect(colour);
      colour.connect(destination);
      shape(expression.gain, time, 0.07, velocity * 0.34, { attack: 0.004, decay: 0.048, sustain: 0.33, release: 0.16 });
      const tone = oscillator('sine', 86 + random() * 4, time, 0.25, expression);
      tone.frequency.exponentialRampToValueAtTime(52, time + 0.045);
      tone.frequency.exponentialRampToValueAtTime(46, time + 0.2);
      const contactColour = filter('lowpass', 1350, 0.6);
      const contact = gain(0);
      shape(contact.gain, time, 0.008, velocity * 0.03, { attack: 0.002, decay: 0.006, sustain: 0.13, release: 0.018 });
      contactColour.connect(contact);
      contact.connect(destination);
      noise(time, 0.04, contactColour, random);
      return;
    }
    if (instrument === 'perc') {
      const brushColour = filter('bandpass', 1600 + random() * 330, 0.62);
      const brush = gain(0);
      // The wrist/body and longer brush sweep form different transients.
      const ghost = velocity < 0.28;
      shape(brush.gain, time, ghost ? 0.018 : 0.04, velocity * 0.48, { attack: 0.004, decay: 0.026, sustain: 0.33, release: ghost ? 0.085 : 0.16 });
      brushColour.connect(brush);
      brush.connect(destination);
      noise(time, ghost ? 0.13 : 0.22, brushColour, random, 0.91 + random() * 0.15);
      const body = gain(0);
      shape(body.gain, time, 0.016, velocity * (ghost ? 0.07 : 0.12), { attack: 0.002, decay: 0.012, sustain: 0.14, release: 0.07 });
      body.connect(destination);
      oscillator('sine', 176 + random() * 17, time, 0.1, body);
      return;
    }
    if (instrument === 'shaker' || instrument === 'hat') {
      const shaker = instrument === 'shaker';
      const colour = filter(shaker ? 'bandpass' : 'highpass', shaker ? 3900 + random() * 800 : 5500, shaker ? 0.64 : 0.55);
      const soften = filter('lowpass', shaker ? 7900 : 9600, 0.5);
      const expression = gain(0);
      shape(expression.gain, time, shaker ? 0.028 : 0.011, velocity * (shaker ? 0.34 : 0.34), {
        attack: shaker ? 0.012 : 0.002, decay: shaker ? 0.018 : 0.008, sustain: 0.25, release: shaker ? 0.058 : 0.042,
      });
      colour.connect(soften);
      soften.connect(expression);
      expression.connect(destination);
      noise(time, shaker ? 0.11 : 0.068, colour, random, 0.92 + random() * 0.16);
      return;
    }
    if (instrument === 'tom') {
      const drum = event.drum;
      const root = event.notes?.[0] !== undefined ? hz(event.notes[0]) : drum?.body === 'large' ? 82 : drum?.body === 'small' ? 156 : 112;
      const tension = drum?.tension ?? (0.44 + random() * 0.17);
      const centre = drum?.position ?? random() * 0.5;
      const muted = drum?.stroke === 'mute';
      const rim = drum?.stroke === 'rim';
      const tail = muted ? 0.17 : 0.28 + (1 - centre) * 0.18;
      const expression = gain(0);
      const colour = filter('lowpass', rim ? 3900 : 1900 + tension * 1300, 0.55);
      shape(expression.gain, time, 0.045, velocity * 0.21, { attack: 0.003, decay: 0.037, sustain: muted ? 0.15 : 0.4, release: tail });
      expression.connect(colour);
      colour.connect(destination);
      for (const [index, ratio] of [1, 1.58, 2.13, 2.92].entries()) {
        const mode = gain([1, 0.23 + centre * 0.14, 0.13 + centre * 0.1, rim ? 0.16 : 0.055][index]);
        mode.connect(expression);
        const tone = oscillator('sine', root * ratio * (1 + tension * 0.035), time, tail + 0.07, mode);
        tone.frequency.exponentialRampToValueAtTime(root * ratio, time + 0.09);
      }
      const skinColour = filter('bandpass', rim ? 2400 : 920 + random() * 370, 0.72);
      const skin = gain(0);
      shape(skin.gain, time, 0.011, velocity * (rim ? 0.08 : 0.045), { attack: 0.0015, decay: 0.008, sustain: 0.16, release: 0.04 });
      skinColour.connect(skin);
      skin.connect(destination);
      noise(time, 0.07, skinColour, random);
      return;
    }
    if (instrument === 'cymbal') {
      const seconds = Math.min(2.6, Math.max(0.9, duration + 0.8));
      const high = filter('highpass', 1600, 0.55);
      const low = filter('lowpass', 6700, 0.5);
      const expression = gain(0);
      shape(expression.gain, time, 0.09, velocity * 0.35, { attack: 0.014, decay: 0.07, sustain: 0.34, release: seconds - 0.11 });
      high.connect(low);
      low.connect(expression);
      expression.connect(destination);
      noise(time, seconds, high, random, 0.86 + random() * 0.08);
      // Small inharmonic modes live beneath the noise, avoiding a pointed ping.
      const metal = gain(0);
      shape(metal.gain, time, 0.07, velocity * 0.0027, { attack: 0.009, decay: 0.05, sustain: 0.22, release: seconds * 0.65 });
      metal.connect(destination);
      for (const frequency of [1813, 2459, 3161, 4217, 5363]) oscillator('sine', frequency * (0.98 + random() * 0.04), time, seconds, metal);
      return;
    }
    throw new Error(`墨潮音色未注册: ${instrument}`);
  };

  const play = (event: MusicalEvent, time: number, duration: number) => {
    const identity = `${event.beat.toFixed(6)}:${event.duration.toFixed(6)}:${event.notes?.join(',') ?? ''}:${event.velocity.toFixed(6)}`;
    const random = createRandom(seed ^ hashVoiceIdentity(identity));
    if (['kick', 'perc', 'shaker', 'hat', 'tom', 'cymbal'].includes(instrument)) {
      percussion(event, time, duration, random);
      return;
    }
    if (!event.notes?.length) throw new Error(`音高缺失: ${instrument}`);
    event.notes.forEach((midi, index) => {
      if (!Number.isFinite(midi) || midi < 0 || midi > 127) throw new RangeError(`音高越界: ${midi}`);
      if (['flute', 'harp', 'strings', 'cello'].includes(instrument)) acoustic(instrument as 'flute' | 'harp' | 'strings' | 'cello', midi, time, duration, event.velocity);
      else if (instrument === 'piano') piano(midi, time, duration, event.velocity);
      else if (instrument === 'xiao') xiao(midi, time, duration, event.velocity, random);
      else if (instrument === 'guitar' || instrument === 'guzheng') plucked(midi, time, duration, event.velocity, random);
      else if (instrument === 'violin') bowed(midi, time, duration, event.velocity, random, index);
      else if (instrument === 'pad') pad(midi, time, duration, event.velocity, random, index);
      else if (instrument === 'bass') bass(midi, time, duration, event.velocity);
      else throw new Error(`墨潮音色未注册: ${instrument}`);
    });
  };
  return { play, clear: () => plucks.clear() };
}
