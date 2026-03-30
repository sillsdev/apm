import ffmpegPath from 'ffmpeg-static';

/** Path to ffmpeg binary; unpacked path when running from an ASAR build. */
export function getFfmpegPath(): string {
  return ffmpegPath
    ? ffmpegPath.replace('app.asar', 'app.asar.unpacked')
    : 'ffmpeg';
}
