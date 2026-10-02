import { MediaFileD } from '@model/mediafile';
import { extensionFromAudioContentType } from './mimeTypes';
import { removeExtension } from './removeExtension';
import { safeFileBasename } from './safeFileBasename';

const isSafeExtensionSegment = (ext: string): boolean =>
  /^[a-z0-9]{1,10}$/i.test(ext);

const extFromContentType = (m: MediaFileD): string => {
  const ct = (m.attributes.contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const audioExt = extensionFromAudioContentType(
    m.attributes.contentType || ''
  );
  if (audioExt) return audioExt;
  if (ct === 'text/markdown') return 'md';
  if (ct.startsWith('text/')) return 'txt';
  if (ct.startsWith('audio/')) return 'dat';
  return 'dat';
};

const getMediaExt = (media: MediaFileD) => {
  const base = safeFileBasename(media.attributes.originalFile);
  let ext =
    removeExtension(base).ext?.split('?')[0]?.trim().toLowerCase() ?? '';
  if (!isSafeExtensionSegment(ext)) {
    ext = extFromContentType(media);
  }
  return ext;
};

export default getMediaExt;
