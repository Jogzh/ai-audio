import { buildEmotionalPopArrangement } from './arrangements/emotional-pop.ts';
import { validateOptions, validateTrack } from './validation.ts';
import type { Arrangement, RenderOptions, TrackDefinition } from './types.ts';

export { validateOptions, validateTrack } from './validation.ts';

export function buildArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  validateOptions(options);
  validateTrack(track);
  return buildEmotionalPopArrangement(track, options);
}
