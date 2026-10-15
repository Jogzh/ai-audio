import { versions, type DrumExpression, type HookBar, type RenderOptions, type TrackDefinition } from './types.ts';

export function validateDrumExpression(expression: DrumExpression): void {
  if (!expression || !['large', 'medium', 'small'].includes(expression.body)
    || !['open', 'rim', 'mute'].includes(expression.stroke)
    || !['left', 'right'].includes(expression.hand)
    || !Number.isFinite(expression.position) || expression.position < 0 || expression.position > 1
    || !Number.isFinite(expression.tension) || expression.tension < 0 || expression.tension > 1) {
    throw new RangeError('中国鼓需要有效鼓体、击法、左右手及 0–1 的位置和张力');
  }
}

export function validateOptions(options: RenderOptions): void {
  if (!versions.includes(options.version)) throw new RangeError('版本必须为 full / hook / loop');
  if (!Number.isInteger(options.bpm) || options.bpm < 90 || options.bpm > 170) throw new RangeError('BPM 必须为 90–170 的整数');
  if (!Number.isInteger(options.transpose) || Math.abs(options.transpose) > 12) throw new RangeError('移调必须为 -12–12 的整数');
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffffffff) throw new RangeError('Seed 必须为 0–4294967295 的整数');
  if (options.sampleRate !== undefined && ![44100, 48000].includes(options.sampleRate)) throw new RangeError('采样率必须为 44100 或 48000');
}

export function validateTrack(track: TrackDefinition): void {
  if (!['emotional-pop', 'cinematic-guofeng', 'guofeng-club'].includes(track.production)) throw new RangeError(`未知制作风格: ${track.production}`);
  if (!track.harmony.length || !track.hook.length || !track.arrangement.length) throw new Error('曲目缺少和声、Hook 或编曲');
  const midi = (note: number) => Number.isInteger(note) && note >= 0 && note <= 127;
  const validatePhrase = (phrase: HookBar[], name: string, withinBar = false) => {
    for (const bar of phrase) {
      if (!Array.isArray(bar)) throw new RangeError(`${name} 需要有效小节`);
      for (const note of bar) {
        if (!note || !midi(note.note) || !Number.isFinite(note.offset) || note.offset < 0 || note.offset >= 4 || !Number.isFinite(note.length) || note.length <= 0 || !Number.isFinite(note.velocity) || note.velocity <= 0 || note.velocity > 1) {
          throw new RangeError(`${name} 需要有效 MIDI 音高、0–4 拍内起音、正时值和 0–1 力度`);
        }
        if (withinBar && note.offset + note.length > 4) throw new RangeError(`${name} 音符必须在小节内结束`);
      }
    }
  };
  validatePhrase(track.hook, 'Hook');
  if (track.guofengClub !== undefined) {
    if (track.production !== 'guofeng-club') throw new RangeError('guofengClub 配置需要对应制作风格');
    validatePhrase(track.hook, 'Hook', true);
    for (const name of ['finalHook', 'bridgeHook'] as const) {
      const phrase = track.guofengClub[name];
      if (!Array.isArray(phrase) || phrase.length !== track.hook.length) throw new RangeError(`${name} 小节数必须与 Hook 一致`);
      validatePhrase(phrase, name, true);
    }
  }
  if (track.cinematicGuofeng !== undefined) {
    if (track.production !== 'cinematic-guofeng' || !track.cinematicGuofeng || typeof track.cinematicGuofeng !== 'object') throw new RangeError('cinematic-guofeng 需要有效旋律发展配置');
    validatePhrase(track.hook, 'Hook', true);
    for (const name of ['finalHook', 'bridgeHook'] as const) {
      const phrase = track.cinematicGuofeng[name];
      if (phrase === undefined) continue;
      if (!Array.isArray(phrase) || phrase.length !== track.hook.length) throw new RangeError(`${name} 小节数必须与 Hook 主题一致`);
      validatePhrase(phrase, name, true);
    }
  }
  if (track.emotionalPop !== undefined) {
    const development = track.emotionalPop;
    if (!development || typeof development !== 'object') throw new RangeError('emotional-pop 需要有效旋律发展配置');
    if (development.groove !== undefined && development.groove !== 'syncopated') throw new RangeError('emotional-pop 律动必须为 syncopated');
    for (const name of ['response', 'finalHook', 'bridgeHook'] as const) {
      const phrase = development[name];
      if (phrase === undefined) continue;
      if (!Array.isArray(phrase) || phrase.length !== track.hook.length) throw new RangeError(`${name} 小节数必须与 Hook 主题一致`);
      validatePhrase(phrase, name, true);
    }
    if (development.response) {
      validatePhrase(track.hook, 'Hook', true);
      // A response belongs to the rests in both chorus versions, never a doubled lead.
      for (const melody of [track.hook, development.finalHook].filter((phrase): phrase is HookBar[] => phrase !== undefined)) {
        melody.forEach((bar, index) => {
          for (const reply of development.response![index]) {
            if (bar.some(note => reply.offset < note.offset + note.length && reply.offset + reply.length > note.offset)) {
              throw new RangeError('response 应答必须位于主旋律留白');
            }
          }
        });
      }
    }
  }
  for (const harmony of track.harmony) {
    if (!midi(harmony.root) || harmony.chord.length < 4 || !Array.from(harmony.chord).every(midi)) {
      throw new RangeError('和声需要有效 MIDI 根音与至少 4 个有效和弦音');
    }
  }
  const energies = ['tease', 'groove', 'build', 'drop', 'air', 'final', 'outro'];
  for (const section of track.arrangement) {
    if (!Number.isInteger(section.bars) || section.bars < 1) throw new RangeError('小节数必须为正整数');
    if (!energies.includes(section.energy)) throw new RangeError(`未知段落能量: ${section.energy}`);
  }
  if (track.resolveHarmony !== undefined && (!Number.isInteger(track.resolveHarmony) || track.resolveHarmony < 0 || track.resolveHarmony >= track.harmony.length)) throw new RangeError('结束和声必须引用已有和声');
  if (!track.edits) throw new RangeError('曲目需要指定精华与循环段落');
  if (track.edits) {
    const totalBars = track.arrangement.reduce((sum, section) => sum + section.bars, 0);
    for (const version of ['hook', 'loop'] as const) {
      const edit = track.edits[version];
      if (!edit || !Number.isInteger(edit.startBar) || edit.startBar < 0 || !Number.isInteger(edit.bars) || edit.bars < 1 || edit.startBar + edit.bars > totalBars) throw new RangeError(`${version} 必须引用完整编曲中的有效小节区间`);
    }
  }
}
