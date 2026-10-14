import { afterglow } from './afterglow.ts';
import { whenTheWindRises } from './when-the-wind-rises.ts';
import { mountainsAwake } from './mountains-awake.ts';
import { inkTide } from './ink-tide.ts';
import { neonChangan } from './neon-changan.ts';
import { neonChanganVocal } from './neon-changan-vocal.ts';

export const trackRegistry = [neonChanganVocal, neonChangan, inkTide, mountainsAwake, whenTheWindRises, afterglow];
export const defaultTrack = afterglow;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
