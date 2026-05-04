import path from 'path-browserify';
import { MediaFileD } from '@model/mediafile';
import { removeExtension } from './removeExtension';
import cleanFileName from './cleanFileName';

const MAX_STEM_LEN = 100;

const safeBasename = (originalFile: string): string => {
  const noQuery = (originalFile || '').split('?')[0] ?? '';
  return path.basename(noQuery.replace(/\\/g, '/'));
};

const looksLikeHttpUrl = (s: string): boolean =>
  /^https?:\/\//i.test((s || '').trim());

const idStem = (m: MediaFileD): string => {
  const id = m.keys?.remoteId || m.id;
  const safe = String(id).replace(/[^a-zA-Z0-9-]/g, '');
  return cleanFileName(`text-${safe.slice(0, 48)}`);
};

/**
 * When `originalFile` holds inline document body (formatted text, markdown content, etc.)
 * rather than a real file path, using `path.parse(originalFile).name` produces unusable paths.
 */
const inlineTextShouldUseIdStem = (m: MediaFileD): boolean => {
  const ct = (m.attributes.contentType || '').split(';')[0].trim().toLowerCase();
  if (!ct.startsWith('text/')) return false;
  const raw = m.attributes.originalFile || '';
  if (raw.length > MAX_STEM_LEN) return true;
  if (/[\r\n]/.test(raw)) return true;
  const base = safeBasename(raw);
  // Reasonable uploaded filename: short basename with a normal extension
  if (
    base.length <= MAX_STEM_LEN &&
    !/[\r\n]/.test(base) &&
    /\.[a-z0-9]{1,10}$/i.test(base)
  ) {
    return false;
  }
  // Long single-line body without a file-like extension
  if (raw.length > 48 && !/\.[a-z0-9]{1,10}$/i.test(base.trim())) return true;
  return false;
};

/**
 * Stable, filesystem-safe stem for burrito output names (no extension).
 * Callers append `.${getMediaExt(m)}` or rely on processExportableMedia to set the final extension.
 */
export const getBurritoMediaExportStem = (m: MediaFileD): string => {
  const raw = m.attributes.originalFile || '';

  if (looksLikeHttpUrl(raw)) {
    try {
      const u = new URL(raw.trim());
      const fromPath = safeBasename(u.pathname);
      if (
        fromPath &&
        fromPath !== '/' &&
        fromPath.length <= MAX_STEM_LEN &&
        !/[\r\n]/.test(fromPath)
      ) {
        const { name } = removeExtension(fromPath);
        if (name) return cleanFileName(name);
      }
      const host = (u.hostname || 'link').replace(/:/g, '_');
      return cleanFileName(host);
    } catch {
      /* fall through */
    }
  }

  if (inlineTextShouldUseIdStem(m)) {
    return idStem(m);
  }

  const base = safeBasename(raw);
  const { name } = removeExtension(base);
  let stem = name || 'media';

  if (stem.length > MAX_STEM_LEN) {
    return idStem(m);
  }

  return cleanFileName(stem);
};

export default getBurritoMediaExportStem;
