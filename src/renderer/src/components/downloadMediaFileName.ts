import path from 'path-browserify';
import { MediaFileD } from '../model';
import { mediaFileName } from '../crud/media';
import { removeExtension } from '../utils/removeExtension';
import getMediaExt from '../utils/getMediaExt';

/** Prefer originalFile basename; fall back to mediaFileName for stem. */
export const downloadMediaStem = (mediaRec: MediaFileD, id: string): string => {
  const original = mediaRec?.attributes?.originalFile || '';
  const fromOriginal = path.basename(
    (original.split('?')[0] || '').replace(/\\/g, '/')
  );
  if (fromOriginal) {
    const { name } = removeExtension(fromOriginal);
    if (name) return name;
  }
  const fullName = mediaFileName(mediaRec) || `media-${id}`;
  const base = path.basename(
    (fullName.split('?')[0] || '').replace(/\\/g, '/')
  );
  const { name } = removeExtension(base);
  return name || `media-${id}`;
};

/** Build a playable download filename (TT-7359). */
export const downloadMediaFileName = (
  mediaRec: MediaFileD,
  id: string
): string => {
  const name = downloadMediaStem(mediaRec, id);
  const ext = getMediaExt(mediaRec);
  const version = mediaRec?.attributes?.versionNumber || '1';
  return `${name}-ver${version}.${ext}`;
};
