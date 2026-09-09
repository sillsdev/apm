import { MediaFileD } from '../../model';
import { related } from '../../crud/related';

/**
 * Same rules as backend AttachedMedia: file bytes to put in a PTF,
 * not which mediafile rows go in the JSON.
 */
export const isAttachedMediaFile = (mf: MediaFileD): boolean => {
  const attr = mf.attributes;
  if (!attr) return false;
  if (attr.contentType === 'text/markdown') return false;
  const resourceId = attr.resourcePassageId;
  if (typeof resourceId === 'number' && resourceId > 0) return false;
  if (related(mf, 'resourcePassage')) return false;
  return Boolean(related(mf, 'passage') || related(mf, 'artifactType'));
};
