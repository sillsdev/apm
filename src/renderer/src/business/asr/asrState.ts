import { ILanguage } from '../../control/Language';

export interface IAsrState {
  target: string;
  language: ILanguage;
  mmsIso: string;
  /** Preferred ASR model for this language (w2v-bert, whisper, omnilingual, mms, …). */
  method?: string;
  dialect: string | undefined;
  selectRoman?: boolean;
}

const normalizeMethod = (method?: string) => method ?? 'mms';

/** Fields that affect the transcription API request in AsrProgress. */
export function asrStatesEqual(
  a: IAsrState | undefined,
  b: IAsrState | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.target === b.target &&
    a.mmsIso === b.mmsIso &&
    normalizeMethod(a.method) === normalizeMethod(b.method) &&
    (a.dialect ?? undefined) === (b.dialect ?? undefined) &&
    Boolean(a.selectRoman) === Boolean(b.selectRoman) &&
    (a.language?.bcp47 ?? 'und') === (b.language?.bcp47 ?? 'und')
  );
}
