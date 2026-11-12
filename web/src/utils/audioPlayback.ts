import { inferAudioContentType } from './mimeTypes';

export const isIOSSafari = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ may report a desktop Macintosh UA; touch points distinguish iPad.
  const isIOS =
    /iPhone|iPod|iPad/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  // Exclude non-Safari iOS browsers (Chrome, Firefox, Edge, etc.)
  return !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
};

export const guessMimeFromUrl = (url: string): string => {
  if (!url) return '';
  const path = url.split('?')[0] ?? '';
  return inferAudioContentType(path, '');
};

const normalizeMime = (mime: string): string =>
  (mime ?? '').split(';')[0].trim().toLowerCase();

export const isOggFormat = (mime: string, url: string): boolean => {
  const base = normalizeMime(mime);
  if (base === 'audio/ogg' || base === 'audio/opus') return true;
  const path = (url ?? '').split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.ogg') || path.endsWith('.opus');
};

export const canPlayNativeAudio = (mime: string): boolean => {
  if (typeof document === 'undefined') return true;
  const base = normalizeMime(mime);
  if (!base) return true;
  const audio = document.createElement('audio');
  const result = audio.canPlayType(mime);
  return result === 'probably' || result === 'maybe';
};

export interface WaveSurferPlaybackInput {
  url?: string;
  contentType?: string;
}

export const resolvePlaybackMime = ({
  url = '',
  contentType = '',
}: WaveSurferPlaybackInput): string => {
  const fromContent = normalizeMime(contentType);
  if (fromContent.startsWith('audio/')) {
    return contentType.trim() || fromContent;
  }
  return guessMimeFromUrl(url);
};

export const shouldUseWaveSurferPlayback = (
  input: WaveSurferPlaybackInput
): boolean => {
  const mime = resolvePlaybackMime(input);
  if (isIOSSafari() && isOggFormat(mime, input.url ?? '')) {
    return true;
  }
  if (!mime) return false;
  return !canPlayNativeAudio(mime);
};
