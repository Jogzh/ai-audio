import { createRandom } from '../music/random.ts';
import type { DrumBody, DrumExpression, DrumStroke } from '../music/types';

type BufferContext = Pick<BaseAudioContext, 'sampleRate' | 'createBuffer'>;
type MembraneMode = { order: number; zero: number; weight: number };

const bodies: Record<DrumBody, { hz: number; tail: number; t60: number; contact: number }> = {
  large: { hz: 68, tail: 1.08, t60: 0.83, contact: 860 },
  medium: { hz: 108, tail: 0.76, t60: 0.59, contact: 1150 },
  small: { hz: 175, tail: 0.49, t60: 0.36, contact: 1510 },
};

// Circular membrane modes have Bessel-zero ratios, not a harmonic/sine-kick stack.
// Slight construction irregularities below keep this a stylised skin drum rather
// than a perfectly tuned mathematical membrane or a claim of recorded realism.
const membraneModes: MembraneMode[] = [
  { order: 0, zero: 2.4048, weight: 1 },
  { order: 1, zero: 3.8317, weight: 0.82 },
  { order: 2, zero: 5.1356, weight: 0.57 },
  { order: 0, zero: 5.5201, weight: 0.39 },
  { order: 3, zero: 6.3802, weight: 0.38 },
  { order: 1, zero: 7.0156, weight: 0.31 },
  { order: 4, zero: 7.5883, weight: 0.23 },
  { order: 2, zero: 8.4172, weight: 0.22 },
  { order: 0, zero: 8.6537, weight: 0.15 },
  { order: 3, zero: 9.7610, weight: 0.14 },
  { order: 1, zero: 10.1735, weight: 0.11 },
  { order: 2, zero: 11.6198, weight: 0.085 },
];

const strokes: Record<DrumStroke, { tail: number; damp: number; contact: number; skin: number }> = {
  open: { tail: 1, damp: 1, contact: 0.115, skin: 1 },
  rim: { tail: 0.68, damp: 0.57, contact: 0.185, skin: 0.65 },
  mute: { tail: 0.29, damp: 0.23, contact: 0.095, skin: 0.71 },
};

const clamp = (value: number, fallback: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

function hashKey(value: string, seed: number): number {
  let hash = (seed ^ 0x4a67290d) >>> 0;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619) >>> 0;
  return hash;
}

/** Sufficient precision at the small radial arguments used by the drum modes. */
function bessel(order: number, argument: number): number {
  let factorial = 1;
  for (let step = 2; step <= order; step++) factorial *= step;
  let term = (argument / 2) ** order / factorial;
  let sum = term;
  for (let step = 1; step <= 22; step++) {
    term *= -(argument * argument / 4) / (step * (step + order));
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }
  return sum;
}

/**
 * Warm, original PCM drum palette: three bodies and three actual stroke types.
 * Position/tension accept 0..1; velocity chooses a timbre layer, while callers
 * apply velocity as playback gain. Each layer retains its own modal balance,
 * contact spectrum, attack and initial membrane relaxation after peak scaling.
 *
 * Cached mono PCM and per-mode recurrence avoid thousands of oscillator nodes.
 * The 96-entry LRU bounds retained PCM to at most ~18 MiB at 44.1 kHz; buffers
 * already assigned to active sources remain owned by those sources as usual.
 */
export function createChineseDrumBuffers(context: BufferContext, seed: number) {
  const sampleRate = context.sampleRate;
  const buffers = new Map<string, AudioBuffer>();
  const alternation = new Map<string, number>();
  const maxCacheEntries = 96;

  const synthesize = (
    expression: DrumExpression,
    positionLayer: number,
    tensionLayer: number,
    velocityLayer: number,
    variation: number,
    key: string,
  ): AudioBuffer => {
    const body = bodies[expression.body];
    const stroke = strokes[expression.stroke];
    const random = createRandom(hashKey(key, seed));
    const power = [0.28, 0.6, 0.93][velocityLayer];
    const radialPosition = [0.22, 0.5, 0.78][positionLayer];
    const position = expression.stroke === 'rim' ? 0.88 : radialPosition;
    const tension = [0.93, 1, 1.07][tensionLayer];
    const hand = expression.hand === 'left' ? -1 : 1;
    const fundamental = body.hz * tension * (1 + hand * 0.002 + (variation ? 0.0018 : -0.0018));
    const seconds = body.tail * stroke.tail;
    const buffer = context.createBuffer(1, Math.ceil(sampleRate * seconds), sampleRate);
    const data = buffer.getChannelData(0);
    const attack = (expression.stroke === 'rim' ? 0.0015 : 0.0025 + (1 - power) * 0.0029)
      * (expression.body === 'large' ? 1.2 : 0.9);
    const attackFrames = Math.max(1, Math.round(attack * sampleRate));
    const initialStretch = 0.003 + power * 0.012;
    const angularPosition = 0.39 + hand * 0.13 + variation * 0.09;

    const addMode = (hz: number, amplitude: number, t60: number, stretch = initialStretch) => {
      if (hz > sampleRate * 0.42 || Math.abs(amplitude) < 0.002) return;
      const decay = Math.exp(-Math.log(1000) / (Math.max(0.025, t60) * sampleRate));
      let amplitudeAtFrame = amplitude;
      let sine = 0;
      let cosine = 1;
      let rotationSine = 0;
      let rotationCosine = 1;
      for (let frame = 0; frame < data.length; frame++) {
        // Update a tiny, fast-decaying skin relaxation in 64-sample blocks. This
        // is a 0.3..1.4% initial drop, unlike an electronic bass-drum pitch sweep.
        if (frame % 64 === 0) {
          const pitch = hz * (1 + stretch * Math.exp(-(frame / sampleRate) / 0.014));
          const step = 2 * Math.PI * pitch / sampleRate;
          rotationSine = Math.sin(step);
          rotationCosine = Math.cos(step);
        }
        const nextSine = sine * rotationCosine + cosine * rotationSine;
        cosine = cosine * rotationCosine - sine * rotationSine;
        sine = nextSine;
        const onset = frame < attackFrames ? Math.sin(frame / attackFrames * Math.PI / 2) : 1;
        data[frame] += sine * amplitudeAtFrame * onset;
        amplitudeAtFrame *= decay;
        if (Math.abs(amplitudeAtFrame) < 0.000002) break;
      }
    };

    for (const [index, mode] of membraneModes.entries()) {
      const ratio = mode.zero / membraneModes[0].zero;
      const radialShape = bessel(mode.order, mode.zero * position);
      const spatialScale = mode.order === 0 ? 1 : [1, 1.78, 2.03, 2.19, 2.3][mode.order];
      const angularShape = mode.order === 0 ? 1 : 0.78 + 0.22 * Math.cos(mode.order * angularPosition);
      const brightness = ratio ** (-0.6 * (1 - power));
      const fundamentalDamping = expression.stroke === 'rim' && index === 0 ? 0.58 : 1;
      const amplitude = radialShape * spatialScale * angularShape * mode.weight * brightness
        * stroke.skin * fundamentalDamping * (0.965 + random() * 0.07);
      const detune = 1 + (random() - 0.5) * (index === 0 ? 0.002 : 0.009);
      const t60 = body.t60 * stroke.damp / ratio ** 0.69 * (0.97 + random() * 0.06);
      addMode(fundamental * ratio * detune, amplitude, t60);
    }

    // The wooden shell/cavity is quieter and loses energy sooner than the skin.
    // Rim strokes excite the shell strongly; muted skin suppresses its low body.
    const cavity = expression.stroke === 'mute' ? 0.065 : expression.stroke === 'rim' ? 0.105 : 0.17;
    addMode(fundamental * 0.73, cavity, body.t60 * stroke.damp * 0.56, initialStretch * 0.1);
    addMode(fundamental * 3.08, expression.stroke === 'rim' ? 0.17 : 0.035, body.t60 * 0.2, 0);
    addMode(fundamental * 5.24, expression.stroke === 'rim' ? 0.075 : 0.017, body.t60 * 0.12, 0);

    // A padded wood beater meeting leather: two filtered-noise bands and a
    // 9..19 ms contact envelope. The cutoff stays below a sharp click/woodblock.
    const contactHz = body.contact * (0.72 + power * 0.6) * (expression.stroke === 'rim' ? 1.13 : 1);
    const skinHz = contactHz * 0.33;
    const contactAlpha = 1 - Math.exp(-2 * Math.PI * Math.min(sampleRate * 0.25, contactHz) / sampleRate);
    const skinAlpha = 1 - Math.exp(-2 * Math.PI * skinHz / sampleRate);
    const contactSeconds = expression.stroke === 'rim' ? 0.009 : 0.011 + (1 - power) * 0.008;
    const contactLength = Math.min(data.length, Math.ceil(contactSeconds * 5 * sampleRate));
    let contactLow = 0;
    let skinLow = 0;
    for (let frame = 0; frame < contactLength; frame++) {
      const noise = random() * 2 - 1;
      contactLow += contactAlpha * (noise - contactLow);
      skinLow += skinAlpha * (noise - skinLow);
      const time = frame / sampleRate;
      const onset = Math.min(1, time / 0.0007);
      const envelope = Math.exp(-time / contactSeconds) * onset;
      data[frame] += (contactLow - skinLow * 0.64) * stroke.contact * (0.65 + power * 0.65) * envelope;
    }

    // A gentle 22 Hz DC blocker retains the large drum's body and a finite fade
    // gives each stroke an exact quiet end, even at unusual sample rates.
    const dcPole = Math.exp(-2 * Math.PI * 22 / sampleRate);
    const fadeFrames = Math.min(data.length, Math.round(sampleRate * 0.025));
    let previousInput = 0;
    let previousOutput = 0;
    let peak = 0;
    for (let frame = 0; frame < data.length; frame++) {
      const input = data[frame];
      const output = input - previousInput + dcPole * previousOutput;
      previousInput = input;
      previousOutput = output;
      const remaining = data.length - 1 - frame;
      const fade = remaining < fadeFrames ? Math.sin(remaining / fadeFrames * Math.PI / 2) ** 2 : 1;
      data[frame] = output * fade;
      peak = Math.max(peak, Math.abs(data[frame]));
    }
    // Fixed playback headroom; external velocity carries musical loudness.
    // Normalising each layer leaves spectral/attack/damping differences intact.
    const scale = peak > 0 ? 0.84 / peak : 0;
    for (let frame = 0; frame < data.length; frame++) data[frame] *= scale;
    return buffer;
  };

  return {
    getBuffer(expression: DrumExpression, velocity: number): AudioBuffer {
      if (!bodies[expression.body] || !strokes[expression.stroke]) throw new RangeError('未知中国鼓体或击法');
      const positionLayer = Math.round(clamp(expression.position, 0.4) * 2);
      const tensionLayer = Math.round(clamp(expression.tension, 0.5) * 2);
      const velocityLayer = clamp(velocity, 0.6) < 0.43 ? 0 : clamp(velocity, 0.6) < 0.75 ? 1 : 2;
      const family = `${expression.body}:${expression.stroke}:${expression.hand}`;
      const variation = alternation.get(family) ?? 0;
      alternation.set(family, 1 - variation);
      const key = `${family}:${positionLayer}:${tensionLayer}:${velocityLayer}:${variation}`;
      const cached = buffers.get(key);
      if (cached) {
        buffers.delete(key);
        buffers.set(key, cached);
        return cached;
      }
      const buffer = synthesize(expression, positionLayer, tensionLayer, velocityLayer, variation, key);
      if (buffers.size >= maxCacheEntries) buffers.delete(buffers.keys().next().value!);
      buffers.set(key, buffer);
      return buffer;
    },
    clear(): void {
      buffers.clear();
      alternation.clear();
    },
  };
}
