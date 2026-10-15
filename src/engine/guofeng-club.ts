import * as Tone from 'tone';
import { createRandom } from '../music/random';
import { clubTracks } from '../music/arrangements/guofeng-club';
import type { MixTrack, MusicalEvent } from '../music/types';

/** Seeded club synthesis built from reusable Chinese electronic instrument recipes. */
export function createGuofengClubInstruments(bpm: number, seed: number, tracks: MixTrack[] = clubTracks) {
  const context = Tone.getContext();
  const sr = context.sampleRate;
  const beat = 60 / bpm;
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  let disposed = false;
  const own = <T extends AudioNode>(n: T): T => { nodes.push(n); return n; };
  const source = <T extends AudioScheduledSourceNode>(n: T): T => { own(n); sources.push(n); return n; };
  const gain = (v = 1) => { const n = own(context.createGain()); n.gain.value = v; return n; };
  const filter = (type: BiquadFilterType, hz: number, q = .65) => {
    const n = own(context.createBiquadFilter()); n.type = type; n.frequency.value = Math.min(sr * .44, hz); n.Q.value = q; return n;
  };
  const pan = (v: number) => { const n = own(context.createStereoPanner()); n.pan.value = v; return n; };
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const envelope = (p: AudioParam, at: number, hold: number, level: number, attack: number, decay: number, sustain: number, release: number) => {
    const a = Math.min(attack, hold * .18);
    const d = Math.min(decay, Math.max(.001, hold - a));
    p.setValueAtTime(0, at);
    p.linearRampToValueAtTime(level, at + a);
    p.exponentialRampToValueAtTime(Math.max(.00001, level * sustain), at + a + d);
    p.setValueAtTime(Math.max(.00001, level * sustain), at + hold);
    p.exponentialRampToValueAtTime(.00001, at + hold + release);
    p.linearRampToValueAtTime(0, at + hold + release + .004);
  };
  const wave = (partials: number[]) => context.createPeriodicWave(new Float32Array(partials.length + 1), Float32Array.from([0, ...partials]));
  const reedWave = wave([1, .56, .64, .24, .31, .15, .19, .11, .1, .06, .07, .04]);
  const bambooWave = wave([1, .13, .28, .06, .13, .045, .065, .025]);
  const bassWave = wave([1, .38, .24, .11, .09, .04, .025]);
  const osc = (type: OscillatorType | PeriodicWave, f: number, at: number, seconds: number, out: AudioNode, cents = 0) => {
    const n = source(context.createOscillator());
    if (typeof type === 'string') n.type = type as OscillatorType; else n.setPeriodicWave(type);
    n.frequency.value = f; n.detune.value = cents; n.connect(out); n.start(at); n.stop(at + seconds); return n;
  };

  const master = filter('highpass', 25, .5);
  const masterLevel = gain(.72);
  master.connect(masterLevel); masterLevel.connect(context.rawContext.destination);
  const noiseBuffer = context.createBuffer(1, sr * 2, sr);
  const noiseRandom = createRandom(seed ^ 0x434c5542);
  const noiseData = noiseBuffer.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = noiseRandom() * 2 - 1;
  const noise = (at: number, seconds: number, out: AudioNode, random: () => number) => {
    const n = source(context.createBufferSource()); n.buffer = noiseBuffer; n.loop = true; n.connect(out); n.start(at, random() * 1.6); n.stop(at + seconds);
  };

  // Stereo room with filtered late energy and distinct early reflections.
  const roomInput = gain();
  const room = own(context.createConvolver()); room.normalize = false;
  const impulse = context.createBuffer(2, Math.ceil(sr * 1.35), sr);
  const roomRandom = createRandom(seed ^ 0x524f4f4d);
  for (let c = 0; c < 2; c++) {
    const data = impulse.getChannelData(c); let smooth = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / sr; smooth = smooth * .64 + (roomRandom() * 2 - 1) * .36;
      data[i] = smooth * .026 * Math.exp(-t * 5.4) * Math.min(1, t / .035);
    }
    for (const [i, t] of [.022, .043, .071, .107, .149].entries()) data[Math.round((t + c * .004) * sr)] += .22 * .6 ** i * (i % 2 ? -1 : 1);
  }
  room.buffer = impulse;
  const roomHP = filter('highpass', 600), roomLP = filter('lowpass', 4800), roomGain = gain(.45);
  roomInput.connect(room); room.connect(roomHP); roomHP.connect(roomLP); roomLP.connect(roomGain); roomGain.connect(master);
  const delayInput = filter('highpass', 720);
  const delayLP = filter('lowpass', 3400); delayInput.connect(delayLP);
  for (const [i, value] of [.75, 1.5, 2.25].entries()) {
    const delay = own(context.createDelay(3)); delay.delayTime.value = value * beat;
    const level = gain([.34, .15, .065][i]), spread = pan([.4, -.4, .22][i]);
    delayLP.connect(delay); delay.connect(level); level.connect(spread); spread.connect(master);
  }

  const ducks: { node: GainNode; floor: number }[] = [];
  const destinations = new Map<string, AudioNode>();
  for (const part of tracks) {
    const hp = filter('highpass', part.mix.highpass), lp = filter('lowpass', part.mix.lowpass);
    const level = gain(part.mix.gain), spread = pan(part.role === 'bass' || part.instrument === 'kick' ? 0 : part.mix.pan);
    hp.connect(lp); lp.connect(level);
    let post: AudioNode = level;
    if (['bass', 'harmony', 'texture'].includes(part.role)) {
      const duck = gain(); level.connect(duck); post = duck;
      ducks.push({ node: duck, floor: part.role === 'bass' ? .16 : part.role === 'harmony' ? .55 : .7 });
    }
    post.connect(spread); spread.connect(master);
    if (part.mix.reverb) { const send = gain(part.mix.reverb); spread.connect(send); send.connect(roomInput); }
    if (part.mix.delay) { const send = gain(part.mix.delay); spread.connect(send); send.connect(delayInput); }
    destinations.set(part.id, hp);
  }

  const plucks = new Map<number, AudioBuffer>();
  const zheng = (midi: number, at: number, hold: number, velocity: number, out: AudioNode) => {
    let buffer = plucks.get(midi);
    if (!buffer) {
      buffer = context.createBuffer(1, Math.ceil(sr * 2.7), sr);
      const data = buffer.getChannelData(0), f = hz(midi);
      const harmonics = Math.min(16, Math.floor(sr * .43 / f));
      const partials = Array.from({ length: harmonics }, (_, i) => {
        const h = i + 1;
        return { f: f * h * Math.sqrt(1 + .00009 * h * h), a: Math.sin(h * Math.PI * .21) / h ** .8, decay: 1.75 + h * .49 };
      });
      let peak = .01;
      for (let i = 0; i < data.length; i++) {
        const t = i / sr;
        let v = 0;
        for (const p of partials) v += Math.sin(2 * Math.PI * p.f * t) * p.a * Math.exp(-t * p.decay);
        // A wooden soundboard, below the string's pitched energy.
        v += .07 * Math.sin(2 * Math.PI * 187 * t) * Math.exp(-t * 32);
        data[i] = v * Math.min(1, t / .002); peak = Math.max(peak, Math.abs(data[i]));
      }
      for (let i = 0; i < data.length; i++) data[i] *= .72 / peak;
      plucks.set(midi, buffer);
    }
    const n = source(context.createBufferSource()); n.buffer = buffer;
    const level = gain(), colour = filter('lowpass', 4500 + velocity * 4200);
    n.connect(colour); colour.connect(level); level.connect(out);
    const end = Math.min(buffer.duration, hold + .32);
    level.gain.setValueAtTime(velocity ** 1.1 * .37, at);
    level.gain.setValueAtTime(velocity ** 1.1 * .37, at + Math.max(.006, end - .2));
    level.gain.linearRampToValueAtTime(0, at + end);
    n.start(at); n.stop(at + end + .005);
  };
  const wind = (midi: number, at: number, hold: number, velocity: number, out: AudioNode, bamboo: boolean, random: () => number) => {
    const release = bamboo ? .105 : .06, seconds = hold + release + .015;
    const level = gain(0), colour = filter('lowpass', bamboo ? 6500 : 3300 + velocity * 2200, .65);
    envelope(level.gain, at, hold, velocity * (bamboo ? .23 : .27), bamboo ? .025 : .007, .07, bamboo ? .78 : .64, release);
    level.connect(colour); colour.connect(out);
    const n = osc(bamboo ? bambooWave : reedWave, hz(midi), at, seconds, level);
    // Brief scoop, and delayed vibrato on long notes; short notes stay in tune.
    n.detune.setValueAtTime(bamboo ? -12 : -42, at);
    n.detune.linearRampToValueAtTime(0, at + Math.min(.05, hold * .25));
    if (hold > .25) {
      const vibrato = gain(0); vibrato.connect(n.detune);
      vibrato.gain.setValueAtTime(0, at + .14); vibrato.gain.linearRampToValueAtTime(bamboo ? 8 : 11, at + Math.min(hold * .72, .3));
      osc('sine', bamboo ? 5.05 : 5.7, at, seconds, vibrato);
    }
    if (!bamboo) {
      // Two restrained detuned voices give width without moving the core out of center.
      for (const [cents, stereo] of [[-7, -.32], [7, .32]]) {
        const support = gain(.11), spread = pan(stereo); support.connect(spread); spread.connect(level);
        osc(reedWave, hz(midi), at, seconds, support, cents);
      }
    }
    const breath = filter('bandpass', bamboo ? 2400 : 1700, .7), breathLevel = gain(0);
    breath.connect(breathLevel); breathLevel.connect(out);
    envelope(breathLevel.gain, at, hold, velocity * (bamboo ? .014 : .006), .02, .07, .4, .05);
    noise(at, seconds, breath, random);
  };
  const bass = (midi: number, at: number, hold: number, velocity: number, out: AudioNode) => {
    const level = gain(0), colour = filter('lowpass', 700, .7);
    envelope(level.gain, at, hold, velocity * .34, .004, .085, .62, .045);
    colour.frequency.setValueAtTime(1700, at); colour.frequency.exponentialRampToValueAtTime(420, at + Math.min(.13, hold));
    level.connect(colour); colour.connect(out);
    osc(bassWave, hz(midi), at, hold + .06, level);
  };
  const acid = (midi: number, at: number, hold: number, velocity: number, out: AudioNode) => {
    const level = gain(0), colour = filter('lowpass', 2400, 5.5);
    envelope(level.gain, at, hold, velocity * .21, .003, .045, .26, .045);
    colour.frequency.setValueAtTime(2800, at); colour.frequency.exponentialRampToValueAtTime(480, at + hold);
    level.connect(colour); colour.connect(out);
    const n = osc('sawtooth', hz(midi), at, hold + .055, level);
    n.frequency.setValueAtTime(hz(midi - 5), at); n.frequency.exponentialRampToValueAtTime(hz(midi), at + .028);
  };
  const harmony = (notes: number[], at: number, hold: number, velocity: number, out: AudioNode, pad: boolean) => {
    for (const [index, midi] of notes.entries()) {
      const level = gain(0), colour = filter('lowpass', pad ? 1500 : 1900 + velocity * 1500), spread = pan((index % 2 ? 1 : -1) * (pad ? .55 : .25));
      envelope(level.gain, at, hold, velocity * (pad ? .068 : .13), pad ? .28 : .006, pad ? .3 : .08, pad ? .76 : .28, pad ? .8 : .12);
      level.connect(colour); colour.connect(spread); spread.connect(out);
      osc(pad ? 'triangle' : 'sawtooth', hz(midi), at, hold + (pad ? .82 : .14), level, index % 2 ? -4 : 4);
    }
  };
  const percussion = (e: MusicalEvent, at: number, hold: number, out: AudioNode, random: () => number) => {
    const v = e.velocity;
    if (e.instrument === 'kick') {
      const body = gain(0); body.connect(out);
      body.gain.setValueAtTime(0, at); body.gain.linearRampToValueAtTime(v * .65, at + .002);
      body.gain.exponentialRampToValueAtTime(v * .36, at + .055); body.gain.exponentialRampToValueAtTime(.00001, at + .225); body.gain.linearRampToValueAtTime(0, at + .23);
      const n = osc('sine', 155, at, .24, body); n.frequency.exponentialRampToValueAtTime(54, at + .035); n.frequency.exponentialRampToValueAtTime(47, at + .2);
      const click = filter('bandpass', 3400, .6), level = gain(0); click.connect(level); level.connect(out);
      envelope(level.gain, at, .006, v * .09, .001, .003, .12, .018); noise(at, .034, click, random);
      return;
    }
    if (e.instrument === 'clap') {
      const colour = filter('bandpass', 1800, .6), hp = filter('highpass', 700), level = gain(0);
      colour.connect(hp); hp.connect(level); level.connect(out);
      // Three hand contacts and a short snare tail, rather than a single noise tick.
      for (const [i, t] of [0, .011, .023].entries()) {
        level.gain.setValueAtTime(.001, at + t); level.gain.linearRampToValueAtTime(v * [.21, .25, .32][i], at + t + .002); level.gain.exponentialRampToValueAtTime(.012, at + t + .009);
      }
      level.gain.setValueAtTime(v * .21, at + .035); level.gain.exponentialRampToValueAtTime(.00001, at + .16); level.gain.linearRampToValueAtTime(0, at + .165);
      noise(at, .17, colour, random);
      const body = gain(0); body.connect(out); envelope(body.gain, at, .015, v * .09, .002, .012, .3, .08); osc('triangle', 185, at, .105, body);
      return;
    }
    if (e.instrument === 'hat' || e.instrument === 'openHat') {
      const open = e.instrument === 'openHat', seconds = open ? .16 : .045;
      const hp = filter('highpass', 7100), lp = filter('lowpass', 14500), level = gain(0);
      hp.connect(lp); lp.connect(level); level.connect(out);
      envelope(level.gain, at, .009, v * .32, .001, .006, .38, seconds); noise(at, seconds + .024, hp, random); return;
    }
    if (e.instrument === 'rim') {
      const level = gain(0), colour = filter('bandpass', 1450, 1.1); level.connect(colour); colour.connect(out);
      envelope(level.gain, at, .006, v * .27, .001, .004, .5, .058);
      osc('sine', 865, at, .072, level); const overtone = gain(.29); overtone.connect(level); osc('sine', 1370, at, .072, overtone); return;
    }
    if (e.instrument === 'chineseDrum') {
      const f = hz(e.notes?.[0] ?? 43), seconds = Math.min(.62, hold + .25), level = gain(0);
      level.connect(out); envelope(level.gain, at, .045, v * .38, .003, .032, .52, seconds - .055);
      for (const [i, ratio] of [1, 1.59, 2.14, 2.91].entries()) {
        const mode = gain([1, .36, .18, .09][i]); mode.connect(level);
        const n = osc('sine', f * ratio * 1.18, at, seconds + .01, mode); n.frequency.exponentialRampToValueAtTime(f * ratio, at + .06);
      }
      const skin = filter('bandpass', 1800, .8), skinLevel = gain(0); skin.connect(skinLevel); skinLevel.connect(out);
      envelope(skinLevel.gain, at, .012, v * .09, .001, .008, .2, .04); noise(at, .064, skin, random); return;
    }
    if (e.instrument === 'gong') {
      const level = gain(0); level.connect(out); envelope(level.gain, at, .055, v * .12, .006, .04, .75, 1.2);
      for (const [i, f] of [416, 643, 917, 1229, 1697, 2311, 3047].entries()) {
        const mode = gain([1, .55, .42, .28, .2, .14, .08][i]); mode.connect(level);
        const n = osc('sine', f * .97, at, 1.28, mode); n.frequency.exponentialRampToValueAtTime(f, at + .11);
      } return;
    }
    if (e.instrument === 'sweep') {
      const down = e.gesture === 'fall', colour = filter('bandpass', down ? 8500 : 700, .7), level = gain(0), seconds = hold + .04;
      colour.connect(level); level.connect(out);
      if (down) {
        level.gain.setValueAtTime(v * .14, at); level.gain.exponentialRampToValueAtTime(.00001, at + hold);
        colour.frequency.exponentialRampToValueAtTime(1100, at + hold);
      } else {
        level.gain.setValueAtTime(.00001, at); level.gain.exponentialRampToValueAtTime(v * .18, at + Math.max(.01, hold - .1)); level.gain.linearRampToValueAtTime(0, at + hold);
        colour.frequency.exponentialRampToValueAtTime(8500, at + hold);
      }
      noise(at, seconds, colour, random); return;
    }
    throw new Error(`国风 DJ 音色缺失: ${e.instrument}`);
  };
  const hit = (e: MusicalEvent, at: number) => {
    if (disposed) throw new Error('音源已释放');
    const part = tracks.find(part => part.id === e.trackId), out = destinations.get(e.trackId ?? '');
    if (!part || !out || part.instrument !== e.instrument) throw new Error(`国风 DJ 轨道路由无效: ${e.trackId}`);
    if (![at, e.duration, e.velocity].every(Number.isFinite) || at < 0 || e.duration <= 0 || e.velocity < 0 || e.velocity > 1) throw new RangeError('音符时间或力度无效');
    const hold = Math.max(.02, e.duration * beat);
    const identity = `${e.trackId}:${e.beat}:${e.notes?.join(',') ?? ''}`;
    let eventSeed = seed >>> 0;
    for (const character of identity) eventSeed = Math.imul(eventSeed ^ character.charCodeAt(0), 16777619) >>> 0;
    const random = createRandom(eventSeed);
    if (e.instrument === 'vocal') throw new RangeError('国风 DJ 配方不包含人声事件');
    if (['guzheng', 'lead', 'dizi', 'bass', 'chord', 'pad'].includes(e.instrument)) {
      if (!e.notes?.length || e.notes.some(n => !Number.isFinite(n) || n < 0 || n > 127)) throw new RangeError('缺少有效音高');
      if (e.instrument === 'pad' || e.instrument === 'chord') harmony(e.notes, at, hold, e.velocity, out, e.instrument === 'pad');
      else for (const midi of e.notes) {
        if (e.instrument === 'guzheng') zheng(midi, at, hold, e.velocity, out);
        else if (e.instrument === 'bass') (e.trackId === 'acid' ? acid : bass)(midi, at, hold, e.velocity, out);
        else wind(midi, at, hold, e.velocity, out, e.instrument === 'dizi', random);
      }
    } else percussion(e, at, hold, out, random);
  };
  const duck = (at: number) => {
    for (const { node, floor } of ducks) {
      node.gain.setValueAtTime(1, at); node.gain.linearRampToValueAtTime(floor, at + .004);
      node.gain.setValueAtTime(floor, at + .04); node.gain.exponentialRampToValueAtTime(1, at + beat * .48);
    }
  };
  const dispose = () => {
    if (disposed) return; disposed = true;
    for (const s of sources) { try { s.stop(); } catch { /* finished source */ } }
    for (const n of nodes.reverse()) { try { n.disconnect(); } catch { /* release remaining nodes */ } }
    room.buffer = null; plucks.clear(); destinations.clear(); sources.length = 0; nodes.length = 0;
  };
  return { hit, duck, dispose };
}
