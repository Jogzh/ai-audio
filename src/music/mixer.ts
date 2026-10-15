import type { Arrangement, RenderSelection } from './types.ts';

/** Validate routing before constructing Web Audio nodes. */
export function validateMixer(arrangement: Arrangement): void {
  if (!arrangement.tracks) return;
  const tracks = new Map(arrangement.tracks.map(track => [track.id, track]));
  if (tracks.size !== arrangement.tracks.length) throw new RangeError('混音轨道 ID 必须唯一');
  for (const track of tracks.values()) {
    const mix = track.mix;
    if (!/^[a-z][a-z0-9-]*$/.test(track.id) || !track.name.trim()
      || !['foreground', 'reply', 'harmony', 'texture', 'bass', 'rhythm', 'transition'].includes(track.role)
      || !Number.isFinite(mix.gain) || mix.gain < 0 || mix.gain > 2
      || !Number.isFinite(mix.pan) || Math.abs(mix.pan) > 1
      || !Number.isFinite(mix.highpass) || mix.highpass < 0 || mix.highpass >= mix.lowpass
      || !Number.isFinite(mix.lowpass) || mix.lowpass > 22000
      || ![mix.reverb, mix.delay].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new RangeError(`轨道混音参数无效: ${track.id}`);
    }
    let previous = -1;
    for (const point of track.automation ?? []) {
      if (!Number.isFinite(point.beat) || point.beat < 0 || point.beat > arrangement.beats || point.beat <= previous
        || !Number.isFinite(point.gain) || point.gain < 0 || point.gain > 2) throw new RangeError(`轨道自动化无效: ${track.id}`);
      previous = point.beat;
    }
  }
  for (const event of arrangement.events) {
    const track = event.trackId ? tracks.get(event.trackId) : undefined;
    if (!track || track.instrument !== event.instrument) throw new RangeError(`音符未连接匹配的混音轨道: ${event.trackId ?? event.instrument}`);
  }
}

/** Solo and mute operate on score events; kick-driven bass automation stays intact. */
export function selectedTrackIds(arrangement: Arrangement, selection: RenderSelection): Set<string> | undefined {
  if (selection.processing !== undefined && !['master', 'raw'].includes(selection.processing)) throw new RangeError('音频处理必须为 master / raw');
  const ids = new Set(arrangement.tracks?.map(track => track.id) ?? []);
  for (const list of [selection.soloTrackIds, selection.muteTrackIds]) {
    if (list !== undefined && (!Array.isArray(list) || new Set(list).size !== list.length || list.some(id => !ids.has(id)))) {
      throw new RangeError('独奏或静音必须引用已存在且不重复的轨道 ID');
    }
  }
  if (!selection.soloTrackIds?.length && !selection.muteTrackIds?.length) return undefined;
  const selected = new Set(selection.soloTrackIds?.length ? selection.soloTrackIds : ids);
  for (const id of selection.muteTrackIds ?? []) selected.delete(id);
  return selected;
}
