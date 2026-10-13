import { afterglow } from './afterglow.ts';
import { whenTheWindRises } from './when-the-wind-rises.ts';
import { mountainsAwake } from './mountains-awake.ts';

export const trackRegistry = [mountainsAwake, whenTheWindRises, afterglow];
export const defaultTrack = afterglow;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
