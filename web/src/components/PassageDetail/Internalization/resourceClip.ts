import { MediaFile } from '../../../model';
import { getSegments, NamedRegions } from '../../../utils/namedSegments';
import type { TimeRange } from '../../../control/formatTime';

/**
 * The part of a resource's media to play: its first ProjectResource segment
 * (a general resource assigned to just part of a recording), or all of it.
 */
export const resourceClip = (
  media: MediaFile | undefined
): TimeRange | undefined => {
  const segments = media?.attributes?.segments;
  if (!segments) return undefined;
  try {
    const regions = JSON.parse(
      getSegments(NamedRegions.ProjectResource, segments)
    );
    if (Array.isArray(regions) && regions.length > 0) {
      const { start, end } = regions[0];
      return { start, end };
    }
  } catch {
    // Unreadable segments: play the whole media.
  }
  return undefined;
};
