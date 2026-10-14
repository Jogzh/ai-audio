/** WSOLA speech fitting: preserve local pitch while following the score's tempo. */
export function fitVocalPcm(input: Float32Array, frames: number, sampleRate: number): Float32Array<ArrayBuffer> {
  if (frames < 1 || !Number.isInteger(frames) || !input.length) throw new RangeError('人声长度无效');
  if (frames === input.length) return input.slice();
  const output = new Float32Array(frames), weights = new Float32Array(frames);
  const size = Math.min(input.length, Math.round(sampleRate * .04));
  const hop = Math.max(1, Math.floor(size / 2)), search = Math.round(sampleRate * .004);
  const ratio = input.length / frames;
  const window = Float32Array.from({ length: size }, (_, i) => Math.sin(Math.PI * (i + .5) / size) ** 2);
  let previous = 0;
  for (let at = 0; at < frames; at += hop) {
    const expected = Math.min(input.length - size, Math.round(at * ratio));
    let chosen = Math.max(0, expected), best = -Infinity;
    if (at && expected >= search && expected + search + size < input.length) {
      for (let candidate = expected - search; candidate <= expected + search; candidate += 8) {
        let dot = 0, a2 = 1e-12, b2 = 1e-12;
        for (let i = 0; i < hop; i += 8) {
          const a = input[previous + hop + i] ?? 0, b = input[candidate + i];
          dot += a * b; a2 += a * a; b2 += b * b;
        }
        const score = dot / Math.sqrt(a2 * b2);
        if (score > best) { best = score; chosen = candidate; }
      }
    }
    for (let i = 0; i < size && at + i < frames; i++) {
      output[at + i] += input[chosen + i] * window[i];
      weights[at + i] += window[i];
    }
    previous = chosen;
  }
  for (let i = 0; i < frames; i++) output[i] /= Math.max(weights[i], 1e-8);
  return output;
}
