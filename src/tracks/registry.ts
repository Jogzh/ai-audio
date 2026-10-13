import { afterglow } from './afterglow.ts';

export const trackRegistry = [afterglow];
export const defaultTrack = afterglow;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
