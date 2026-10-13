import { velvetHour } from './velvet-hour.ts';
import { amberTides } from './amber-tides.ts';
import { neonRebound } from './neon-rebound.ts';
import { moonlitSway } from './moonlit-sway.ts';
import { afterglow } from './afterglow.ts';

export const trackRegistry = [afterglow, moonlitSway, velvetHour, amberTides, neonRebound];
export const defaultTrack = afterglow;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
