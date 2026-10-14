import { buildEmotionalPopArrangement } from './arrangements/emotional-pop.ts';
import { buildCinematicGuofengArrangement } from './arrangements/cinematic-guofeng.ts';
import { buildInkTideArrangement } from './arrangements/ink-tide.ts';
import { buildGuofengClubArrangement } from './arrangements/guofeng-club.ts';
import { validateOptions, validateTrack } from './validation.ts';
import { validateMixer } from './mixer.ts';
import type { Arrangement, RenderOptions, TrackDefinition } from './types.ts';

export { validateOptions, validateTrack } from './validation.ts';

export function buildArrangement(track: TrackDefinition, options: RenderOptions): Arrangement {
  validateOptions(options);
  validateTrack(track);
  if (track.production === 'ink-tide' || track.production === 'guofeng-club') {
    const arrangement = track.production === 'guofeng-club' ? buildGuofengClubArrangement(track, options) : buildInkTideArrangement(track, options);
    validateMixer(arrangement);
    return arrangement;
  }
  return track.production === 'cinematic-guofeng'
    ? buildCinematicGuofengArrangement(track, options)
    : buildEmotionalPopArrangement(track, options);
}
