import { ILanguage } from '../../control/Language';

export interface IAsrState {
  target: string;
  language: ILanguage;
  asrIso: string;
  /** Preferred ASR model for this language (w2v-bert, whisper, omnilingual, mms, …). */
  method?: string;
  dialect: string | undefined;
  selectRoman?: boolean;
}

/**
 * Coerce a persisted IAsrState read from org/project defaults. `asrIso` was once
 * stored as `mmsIso`; fall back to that legacy key so older saved data still
 * resolves a language instead of reading `undefined`.
 */
export function normalizeAsrState(raw: unknown): IAsrState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as IAsrState & { mmsIso?: string };
  return { ...obj, asrIso: obj.asrIso ?? obj.mmsIso ?? 'und' };
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
    a.asrIso === b.asrIso &&
    normalizeMethod(a.method) === normalizeMethod(b.method) &&
    (a.dialect ?? undefined) === (b.dialect ?? undefined) &&
    Boolean(a.selectRoman) === Boolean(b.selectRoman) &&
    (a.language?.bcp47 ?? 'und') === (b.language?.bcp47 ?? 'und')
  );
}
