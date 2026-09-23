import { CompressedImages } from './useCompression';
import { getUrlNameAndExt } from './getUrlNameAndExt';
import { mimeMap } from './loadBlob';

/** Library picker image fields needed to build stored graphic slots. */
export interface LibraryGraphicSource {
  url?: string;
  thumbnailUrl?: string;
  thumbnailUrlSmall?: string;
}

/**
 * Build CompressedImages from library CDN URLs (no fetch).
 * Avoids CORS on CloudFront orig_url when setting a Library graphic (TT-7725).
 *
 * Dimension mapping:
 * - >= 1024 → orig_url
 * - >= 512 → thumb_url_large, else orig
 * - smaller → thumb_url_small, else large, else orig
 */
export function libraryGraphicToCompressedImages(
  img: LibraryGraphicSource,
  dimensions: number[]
): CompressedImages[] {
  const orig = img.url?.trim() ?? '';
  if (!orig) return [];

  const large = img.thumbnailUrl?.trim() || orig;
  const small = img.thumbnailUrlSmall?.trim() || large;

  const { base, ext } = getUrlNameAndExt(orig);
  const mimeType = mimeMap[ext.toLowerCase()] || 'image/jpeg';
  const fileBase = base || 'graphic';
  const fileExt = ext || 'jpg';

  return dimensions.map((dimension) => {
    const content = dimension >= 1024 ? orig : dimension >= 512 ? large : small;
    return {
      name: `${fileBase}-${dimension}.${fileExt}`,
      content,
      type: mimeType,
      dimension,
    };
  });
}
