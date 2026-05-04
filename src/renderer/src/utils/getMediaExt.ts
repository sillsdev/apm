import path from 'path-browserify';
import { MediaFileD } from '@model/mediafile';
import { removeExtension } from './removeExtension';

/** Last path segment only, so URL/path strings do not produce bogus "extensions" with separators. */
const safeFileBasename = (originalFile: string): string => {
  const noQuery = (originalFile || '').split('?')[0] ?? '';
  const unified = noQuery.replace(/\\/g, '/');
  return path.basename(unified);
};

const isSafeExtensionSegment = (ext: string): boolean =>
  /^[a-z0-9]{1,10}$/i.test(ext);

const extFromContentType = (m: MediaFileD): string => {
  const ct = (m.attributes.contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (ct === 'audio/mpeg') return 'mp3';
  if (ct === 'audio/mp4' || ct === 'audio/x-m4a' || ct === 'audio/m4a')
    return 'm4a';
  if (ct === 'audio/wav' || ct === 'audio/x-wav') return 'wav';
  if (ct === 'audio/ogg' || ct === 'audio/opus') return 'ogg';
  if (ct === 'text/markdown') return 'md';
  if (ct.startsWith('text/')) return 'txt';
  if (ct.startsWith('audio/')) return 'mp3';
  return 'dat';
};

const getMediaExt = (media: MediaFileD) => {
  const base = safeFileBasename(media.attributes.originalFile || '');
  let ext =
    removeExtension(base).ext?.split('?')[0]?.trim().toLowerCase() ?? '';
  if (!isSafeExtensionSegment(ext)) {
    ext = extFromContentType(media);
  }
  return ext;
};

export default getMediaExt;
