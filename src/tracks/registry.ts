import { afterglow } from './afterglow.ts';
import { whenTheWindRises } from './when-the-wind-rises.ts';

export const trackRegistry = [whenTheWindRises, afterglow];
export const defaultTrack = afterglow;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
