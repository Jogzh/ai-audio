import { buildGarageArrangement } from './arrangements/garage.ts';
import { buildWarmArrangement } from './arrangements/warm-house.ts';
import { buildDiscoArrangement } from './arrangements/disco-house.ts';
import { buildEmotionalPopArrangement } from './arrangements/emotional-pop.ts';
import { validateOptions, validateTrack } from './validation.ts';
import type { Arrangement, RenderOptions, TrackDefinition } from './types.ts';

export { validateOptions, validateTrack } from './validation.ts';

export function buildArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  validateOptions(options);
  validateTrack(track);
  if (track.production === 'warm-house') return buildWarmArrangement(track, options);
  if (track.production === 'disco-house') return buildDiscoArrangement(track, options);
  if (track.production === 'emotional-pop') return buildEmotionalPopArrangement(track, options);
  if (track.production !== undefined) throw new Error(`未知制作风格: ${track.production}`);
  return buildGarageArrangement(track, options);
}
