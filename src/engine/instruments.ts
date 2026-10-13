import * as Tone from 'tone';
import { createRandom } from '../music/random';
import type { Instrument, MusicalEvent, TrackDefinition } from '../music/types';
import type { SampleBank } from './sample-library';

/** Every render owns its nodes; samples are preloaded locally, with no global Transport or destination changes. */
export function createInstruments(bpm: number, seed: number, production?: TrackDefinition['production'], samples: SampleBank = {}) {
  const disco = production === 'disco-house';
  const warm = production === 'warm-house' || disco;
  const owned: { dispose(): unknown }[] = [];
  const own = <T extends { dispose(): unknown }>(node: T): T => { owned.push(node); return node; };
  const random = createRandom(seed ^ 0x12ab98);
  const rate = Tone.getContext().sampleRate;
  const beatDuration = 60 / bpm;

  const highpass = own(new Tone.Filter(28, 'highpass'));
  const compressor = own(new Tone.Compressor({ threshold: warm ? -14 : -19, ratio: warm ? 2 : 2.5, attack: warm ? 0.02 : 0.006, release: warm ? 0.18 : 0.12, knee: 12 }));
  const headroom = own(new Tone.Gain(0.85));
  const limiter = own(new Tone.Limiter(-1.8));
  highpass.chain(compressor, headroom, limiter, Tone.getDestination());
  const drumDestination = warm ? own(new Tone.Filter(7800, 'lowpass')).connect(highpass) : highpass;
  const drums = own(new Tone.Gain(0.9)).connect(drumDestination);
  const melodicDuck = own(new Tone.Gain(1)).connect(highpass);
  const bassDuck = own(new Tone.Gain(1)).connect(highpass);
  const delay = own(new Tone.PingPongDelay({ delayTime: beatDuration * 0.75, feedback: disco ? 0.2 : warm ? 0.16 : 0.22, wet: disco ? 0.13 : warm ? 0.1 : 0.17 })).connect(melodicDuck);
  const reverb = own(new Tone.JCReverb({ roomSize: disco ? 0.5 : warm ? 0.62 : 0.48, wet: disco ? 0.12 : warm ? 0.18 : 0.13 })).connect(delay);
  const chordPan = own(new Tone.Panner(warm ? -0.12 : -0.2)).connect(reverb);
  const sparkPan = own(new Tone.Panner(warm ? 0.22 : 0.3)).connect(reverb);
  const leadDestination = warm ? own(new Tone.Filter({ frequency: 3400, type: 'lowpass', rolloff: -12, Q: 0.5 })).connect(reverb) : reverb;
  const chordDestination = warm ? own(new Tone.Filter(2900, 'lowpass')).connect(chordPan) : chordPan;

  const kick = own(new Tone.MembraneSynth({
    pitchDecay: warm ? 0.024 : 0.045, octaves: warm ? 2.5 : 5,
    oscillator: { type: 'sine' },
    envelope: { attack: warm ? 0.003 : 0.001, decay: warm ? 0.23 : 0.18, sustain: 0, release: 0.08 },
    volume: disco ? -7.5 : warm ? -9 : -6,
  })).connect(drums);
  const bass = own(new Tone.MonoSynth({
    oscillator: warm ? { type: 'triangle' } : { type: 'fatsawtooth', count: 2, spread: 9 },
    filter: { type: 'lowpass', Q: warm ? 0.6 : 1.2, rolloff: -24 },
    envelope: warm ? { attack: 0.018, decay: 0.28, sustain: 0.55, release: 0.16 } : { attack: 0.005, decay: 0.12, sustain: 0.18, release: 0.09 },
    filterEnvelope: warm ? { attack: 0.01, decay: 0.22, sustain: 0.25, release: 0.12, baseFrequency: 240, octaves: 1.4 } : { attack: 0.002, decay: 0.14, sustain: 0.12, release: 0.09, baseFrequency: 160, octaves: 2.7 },
    volume: warm ? -12 : -14,
  })).connect(bassDuck);
  const sub = own(new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: warm ? 0.02 : 0.007, decay: 0.1, sustain: 0.7, release: warm ? 0.15 : 0.045 }, volume: warm ? -17 : -10,
  })).connect(bassDuck);
  const lead = warm ? own(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.024, decay: 0.3, sustain: 0.42, release: 0.32 },
    volume: -14,
  })).connect(leadDestination) : own(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2, modulationIndex: 2.3,
    oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
    envelope: { attack: 0.003, decay: 0.16, sustain: 0.12, release: 0.13 },
    modulationEnvelope: { attack: 0.002, decay: 0.08, sustain: 0.06, release: 0.09 },
    volume: -11,
  })).connect(reverb);
  const chord = warm ? own(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1, modulationIndex: 1.15,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: 0.009, decay: 1.6, sustain: 0.12, release: 0.48 },
    modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0.03, release: 0.2 },
    volume: -18,
  })).connect(chordDestination) : own(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.012, decay: 0.2, sustain: 0.2, release: 0.4 }, volume: -19,
  })).connect(chordPan);
  const spark = own(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: warm ? 2 : 3, modulationIndex: warm ? 0.45 : 0.8,
    envelope: { attack: warm ? 0.01 : 0.002, decay: warm ? 0.65 : 0.28, sustain: 0, release: warm ? 0.4 : 0.18 }, volume: warm ? -24 : -20,
  })).connect(sparkPan);
  const pad = warm ? own(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsine', count: 2, spread: 7 },
    envelope: { attack: 0.65, decay: 0.5, sustain: 0.7, release: 0.85 }, volume: -28,
  })) : undefined;
  if (pad) {
    const padHighpass = own(new Tone.Filter(320, 'highpass'));
    const padLowpass = own(new Tone.Filter(1800, 'lowpass'));
    pad.chain(padHighpass, padLowpass, reverb);
  }

  const organFilter = disco ? own(new Tone.Filter(2600, 'lowpass')).connect(chordPan) : undefined;
  const organ = disco ? own(new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.4, 0.16, 0, 0.06] },
    envelope: { attack: 0.008, decay: 0.24, sustain: 0.38, release: 0.14 }, volume: -22,
  })).connect(organFilter!) : undefined;
  const pluck = disco ? own(new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5, modulationIndex: 0.65,
    oscillator: { type: 'sine' }, modulation: { type: 'triangle' },
    envelope: { attack: 0.006, decay: 0.65, sustain: 0.03, release: 0.25 },
    modulationEnvelope: { attack: 0.002, decay: 0.18, sustain: 0.01, release: 0.12 }, volume: -23,
  })).connect(sparkPan) : undefined;
  const guitarFilter = samples.guitar ? own(new Tone.Filter(5200, 'lowpass')).connect(reverb) : undefined;
  const electricBassFilter = samples.electricBass ? own(new Tone.Filter(1400, 'lowpass')).connect(bassDuck) : undefined;
  // Parse source sample pitches once per render instead of rebuilding this
  // table for every guitar/electric-bass event.
  const sampleCandidates: Record<'guitar' | 'electricBass', { midi: number; buffer: AudioBuffer }[]> = {
    guitar: samples.guitar ? Object.entries(samples.guitar).map(([note, buffer]) => ({ midi: Tone.Frequency(note).toMidi(), buffer })) : [],
    electricBass: samples.electricBass ? Object.entries(samples.electricBass).map(([note, buffer]) => ({ midi: Tone.Frequency(note).toMidi(), buffer })) : [],
  };
  const sampleHit = (instrument: 'guitar' | 'electricBass', midi: number, duration: number, time: number, velocity: number): void => {
    const destination = instrument === 'guitar' ? guitarFilter : electricBassFilter;
    const candidates = sampleCandidates[instrument];
    if (!candidates.length || !destination) throw new Error(`本地采样未加载: ${instrument}`);
    const closest = candidates.reduce((best, entry) => Math.abs(entry.midi - midi) < Math.abs(best.midi - midi) ? entry : best);
    const playbackRate = 2 ** ((midi - closest.midi) / 12);
    // Own every source explicitly: Tone.Sampler releases its active-source list before Offline finishes.
    const source = own(new Tone.ToneBufferSource({
      url: closest.buffer, playbackRate, fadeIn: 0.004,
      fadeOut: instrument === 'guitar' ? 0.18 : 0.09, curve: 'exponential',
    })).connect(destination);
    source.start(time, 0, Math.min(duration, closest.buffer.duration / playbackRate), Tone.dbToGain(-11) * velocity);
  };

  // Seeded PCM noise is used instead of Tone.Noise's shared random buffer.
  const noise = (seconds: number, envelope: (time: number) => number, metallic = false): AudioBuffer => {
    const buffer = Tone.getContext().createBuffer(1, Math.ceil(seconds * rate), rate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index++) {
      const time = index / rate;
      const value = random() * 2 - 1;
      const high = (value - previous) * 0.5;
      previous = value;
      const texture = warm ? (metallic ? high * 0.65 : value * 0.72 + Math.sin(time * Math.PI * 2 * 185) * Math.exp(-time * 35) * 0.25) : (metallic ? high * 0.55 + Math.sin(time * Math.PI * 2 * 2870) * 0.15 : high);
      data[index] = texture * envelope(time);
    }
    return buffer;
  };
  const makePlayer = (buffer: AudioBuffer, volume: number, destination: Tone.InputNode) =>
    own(new Tone.Player({ url: buffer, volume, fadeOut: 0.004 })).connect(destination);
  const clap = makePlayer(noise(0.22, time => {
    const bursts = [0, 0.011, 0.022].reduce((sum, at) => sum + (time >= at ? Math.exp(-(time - at) * 180) * 0.5 : 0), 0);
    return Math.min(1, bursts + Math.exp(-time * 23) * 0.3);
  }), warm ? -10 : -7, drums);
  const hat = makePlayer(noise(warm ? 0.12 : 0.09, time => Math.exp(-time * (warm ? 48 : 70)), true), warm ? -16 : -13, drums);
  const openHat = makePlayer(noise(warm ? 0.38 : 0.3, time => Math.exp(-time * (warm ? 12 : 16)), true), warm ? -21 : -18, drums);
  const percFilter = own(new Tone.Filter(1600, 'bandpass')).connect(drums);
  const perc = makePlayer(noise(0.11, time => Math.exp(-time * 42), true), -5, percFilter);
  const impactFilter = own(new Tone.Filter(2200, 'lowpass')).connect(highpass);
  const impact = makePlayer(noise(0.8, time => Math.exp(-time * 6)), -20, impactFilter);
  const riserFilter = own(new Tone.Filter(800, 'highpass')).connect(reverb);
  const riser = makePlayer(noise(beatDuration * 16, time => {
    const progress = time / (beatDuration * 16);
    return Math.pow(progress, 2) * (0.55 + 0.45 * Math.sin(time * Math.PI * 2 * (3 + progress * 12)));
  }), -21, riserFilter);

  const shakerPan = disco ? own(new Tone.Panner(0.18)).connect(drums) : undefined;
  const rimPan = disco ? own(new Tone.Panner(-0.18)).connect(drums) : undefined;
  const congaPan = disco ? own(new Tone.Panner(0.12)).connect(drums) : undefined;
  const shaker = disco ? makePlayer(noise(0.105, time => Math.min(1, time / 0.007) * Math.exp(-time * 42), true), -18, shakerPan!) : undefined;
  const percussionBuffer = (seconds: number, shape: (time: number) => number): AudioBuffer => {
    const buffer = Tone.getContext().createBuffer(1, Math.ceil(seconds * rate), rate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) {
      const time = index / rate;
      data[index] = shape(time) * Math.min(1, time / 0.0015, (seconds - time) / 0.006);
    }
    return buffer;
  };
  const rim = disco ? makePlayer(percussionBuffer(0.095, time => (
    Math.sin(2 * Math.PI * 1760 * time) * 0.55 + Math.sin(2 * Math.PI * 2310 * time) * 0.25
  ) * Math.exp(-time * 95)), -19, rimPan!) : undefined;
  const conga = disco ? makePlayer(percussionBuffer(0.38, time => (
    Math.sin(2 * Math.PI * (165 * time + 1.8 * (1 - Math.exp(-time * 35)))) * Math.exp(-time * 13) * 0.7
    + Math.sin(2 * Math.PI * 290 * time) * Math.exp(-time * 28) * 0.18
  )), -17, congaPan!) : undefined;

  const synths = { bass, sub, lead, chord, spark };
  const players: Partial<Record<Instrument, Tone.Player>> = { clap, hat, openHat, perc, impact, riser, shaker, rim, conga };
  const hit = (event: MusicalEvent, time: number): void => {
    const duration = Math.max(0.01, event.duration * beatDuration);
    if (event.instrument === 'kick') {
      kick.triggerAttackRelease(warm ? 'G1' : 'C1', warm ? 0.12 : 0.1, time, event.velocity);
      return;
    }
    const player = players[event.instrument];
    if (player) {
      // BufferSource velocity is per hit; avoid global volume automation on overlapping players.
      const source = own(new Tone.ToneBufferSource({
        url: player.buffer, fadeOut: 0.004, curve: 'exponential',
      }));
      const destination = event.instrument === 'perc' ? percFilter : event.instrument === 'impact' ? impactFilter : event.instrument === 'riser' ? riserFilter : event.instrument === 'shaker' ? shakerPan! : event.instrument === 'rim' ? rimPan! : event.instrument === 'conga' ? congaPan! : drums;
      source.connect(destination);
      source.start(time, 0, Math.min(duration, player.buffer.duration), Tone.dbToGain(player.volume.value) * event.velocity);
      return;
    }
    const notes = event.notes?.map(note => Tone.Frequency(note, 'midi').toFrequency());
    if (!notes?.length) throw new Error(`音高缺失: ${event.instrument}`);
    if (event.instrument === 'bass' || event.instrument === 'sub') {
      synths[event.instrument].triggerAttackRelease(notes[0], duration, time, event.velocity);
    } else if (event.instrument === 'lead' || event.instrument === 'chord' || event.instrument === 'spark') {
      synths[event.instrument].triggerAttackRelease(notes, duration, time, event.velocity);
    } else if (event.instrument === 'pad') {
      if (!pad) throw new Error('当前制作风格没有铺底音色');
      pad.triggerAttackRelease(notes, duration, time, event.velocity);
    } else if (event.instrument === 'guitar' || event.instrument === 'electricBass') {
      for (const midi of event.notes!) sampleHit(event.instrument, midi, duration, time, event.velocity);
    } else if (event.instrument === 'organ' || event.instrument === 'pluck') {
      const synth = event.instrument === 'organ' ? organ : pluck;
      if (!synth) throw new Error(`音色未启用: ${event.instrument}`);
      synth.triggerAttackRelease(notes, duration, time, event.velocity);
    } else {
      throw new Error(`音色未注册: ${event.instrument}`);
    }
  };

  const duck = (time: number): void => {
    if (warm) {
      // Sustained voices need a short gain ramp, not a discontinuity at every kick.
      bassDuck.gain.setValueAtTime(1, time);
      bassDuck.gain.linearRampToValueAtTime(0.55, time + 0.008);
      bassDuck.gain.linearRampToValueAtTime(1, time + beatDuration * 0.32);
      melodicDuck.gain.setValueAtTime(1, time);
      melodicDuck.gain.linearRampToValueAtTime(0.92, time + 0.008);
      melodicDuck.gain.linearRampToValueAtTime(1, time + beatDuration * 0.26);
      return;
    }
    bassDuck.gain.setValueAtTime(0.35, time);
    bassDuck.gain.linearRampToValueAtTime(1, time + beatDuration * 0.42);
    melodicDuck.gain.setValueAtTime(0.75, time);
    melodicDuck.gain.linearRampToValueAtTime(1, time + beatDuration * 0.35);
  };

  return { hit, duck, dispose: () => { for (const node of owned.reverse()) node.dispose(); } };
}
