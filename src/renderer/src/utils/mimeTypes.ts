import path from 'path-browserify';

/** Burrito ingredients often omit mimeType; treat these extensions as audio. */
export const BURRITO_AUDIO_FILE_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.opus',
  '.m4a',
  '.aac',
  '.webm',
  '.flac',
]);

/** Primary audio MIME (no parameters) → filename extension when the basename has no safe extension. */
export const AUDIO_CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/webm': 'webm',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
};

/** Maps `audio/…` MIME (strips `;codecs=` etc.) to a burrito file extension, or undefined if unknown. */
export function extensionFromAudioContentType(mime: string): string | undefined {
  const base = (mime ?? '').split(';')[0].trim().toLowerCase();
  return AUDIO_CONTENT_TYPE_TO_EXTENSION[base];
}

export function inferAudioContentType(
  ingredientPath: string,
  declaredMime: string
) {
  const trimmed = (declaredMime ?? '').trim();
  if (trimmed.toLowerCase().startsWith('audio/')) {
    return trimmed;
  }
  const ext = path.extname(ingredientPath).toLowerCase();
  const byExt: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/opus',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
    '.flac': 'audio/flac',
  };
  return byExt[ext] ?? 'audio/mpeg';
}
