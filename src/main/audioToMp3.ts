import { execa } from 'execa';
import { getFfmpegPath } from './ffmpegBin';

/** Transcode audio to MP3 (libmp3lame) using bundled ffmpeg-static. */
export async function convertToMp3(
  input: string,
  output: string
): Promise<void> {
  await execa(getFfmpegPath(), [
    '-hide_banner',
    '-i',
    input,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '2',
    '-y',
    output,
  ]);
}
