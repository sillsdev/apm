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
