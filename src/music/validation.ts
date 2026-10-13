import { versions, type RenderOptions, type TrackDefinition } from './types.ts';

export function validateOptions(options: RenderOptions): void {
  if (!versions.includes(options.version)) throw new RangeError('版本必须为 full / hook / loop');
  if (!Number.isInteger(options.bpm) || options.bpm < 90 || options.bpm > 170) throw new RangeError('BPM 必须为 90–170 的整数');
  if (!Number.isInteger(options.transpose) || Math.abs(options.transpose) > 12) throw new RangeError('移调必须为 -12–12 的整数');
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new RangeError('Seed 必须为 0–4294967295 的整数');
}

export function validateTrack(track: TrackDefinition): void {
  if (!track.harmony.length || !track.hook.length || !track.arrangement.length) throw new Error('曲目缺少和声、Hook 或编曲');
  if (track.grooveIntensity !== undefined && (track.production !== 'disco-house' || !Number.isFinite(track.grooveIntensity) || track.grooveIntensity <= 0 || track.grooveIntensity > 1)) {
    throw new RangeError('轻律动强度仅用于 disco-house，范围为大于 0 且不超过 1');
  }
  const midi = (note: number) => Number.isInteger(note) && note >= 0 && note <= 127;
  for (const bar of track.hook) {
    for (const note of bar) {
      if (!midi(note.note) || !Number.isFinite(note.offset) || note.offset < 0 || note.offset >= 4 || !Number.isFinite(note.length) || note.length <= 0 || !Number.isFinite(note.velocity) || note.velocity <= 0 || note.velocity > 1) {
        throw new RangeError('Hook 需要有效 MIDI 音高、0–4 拍内起音、正时值和 0–1 力度');
      }
    }
  }
  for (const harmony of track.harmony) {
    const minimum = track.production === undefined ? 1 : 4;
    if (!midi(harmony.root) || harmony.chord.length < minimum || !Array.from(harmony.chord).every(midi)) {
      throw new RangeError(`和声需要有效 MIDI 根音与至少 ${minimum} 个有效和弦音`);
    }
  }
  const energies = ['tease', 'groove', 'build', 'drop', 'air', 'final', 'outro'];
  for (const section of track.arrangement) {
    if (!Number.isInteger(section.bars) || section.bars < 1) throw new RangeError('小节数必须为正整数');
    if (!energies.includes(section.energy)) throw new RangeError(`未知段落能量: ${section.energy}`);
  }
  if (track.resolveHarmony !== undefined && (!Number.isInteger(track.resolveHarmony) || track.resolveHarmony < 0 || track.resolveHarmony >= track.harmony.length)) throw new RangeError('结束和声必须引用已有和声');
  if (track.production === 'emotional-pop' && !track.edits) throw new RangeError('情绪流行曲目需要指定精华与循环段落');
  if (track.edits) {
    if (track.production !== 'emotional-pop') throw new RangeError('段落裁剪目前用于 emotional-pop');
    const totalBars = track.arrangement.reduce((sum, section) => sum + section.bars, 0);
    for (const version of ['hook', 'loop'] as const) {
      const edit = track.edits[version];
      if (!edit || !Number.isInteger(edit.startBar) || edit.startBar < 0 || !Number.isInteger(edit.bars) || edit.bars < 1 || edit.startBar + edit.bars > totalBars) throw new RangeError(`${version} 必须引用完整编曲中的有效小节区间`);
    }
  }
}
