import path from 'path-browserify';

/**
 * Last path segment only, with any query string dropped, so URL- or
 * path-shaped values (originalFile is sometimes either) yield just the file
 * name and extension.
 */
export function safeFileBasename(filePath?: string | null) {
  const noQuery = (filePath ?? '').split('?')[0] ?? '';
  return path.basename(noQuery.replace(/\\/g, '/'));
}
