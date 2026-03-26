export const burritoFormat = 'burritoFormat';

export type BurritoTextOutputFormat = 'usfm' | 'usj' | 'usx';

export type BurritoFormatParams = {
  convertToMp3: boolean;
  textOutputFormat: BurritoTextOutputFormat;
};

export function parseBurritoTextOutputFormat(
  raw: unknown
): BurritoTextOutputFormat {
  if (raw === 'usx' || raw === 'usj' || raw === 'usfm') return raw;
  return 'usfm';
}
