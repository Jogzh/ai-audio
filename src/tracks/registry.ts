import { velvetHour } from './velvet-hour.ts';
import { amberTides } from './amber-tides.ts';
import { neonRebound } from './neon-rebound.ts';
import { moonlitSway } from './moonlit-sway.ts';

export const trackRegistry = [moonlitSway, velvetHour, amberTides, neonRebound];
export const defaultTrack = velvetHour;

export function findTrack(id: string) {
  return trackRegistry.find(track => track.meta.id === id);
}
