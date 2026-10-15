import { afterglow } from './afterglow.ts';

/** The repository keeps one runnable composition; the rest of the code is reusable. */
export const trackRegistry = [afterglow];
export const defaultTrack = afterglow;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
