import { ILanguage } from '../../control/Language';
import { asrMethodDefaultValue } from '../../components/StepEditor/useAsrMethod';

export interface IAsrState {
  target: string;
  language: ILanguage;
  asrIso: string;
  /**
   * Set only when the user picked a method. Omitted means the service default.
   * Named asrMethod (not the legacy `method`) so methods auto-picked and saved
   * by older builds are ignored.
   */
  asrMethod?: string;
  dialect: string | undefined;
  selectRoman?: boolean;
}

/**
 * Coerce a persisted IAsrState read from org/project defaults. `asrIso` was once
 * stored as `mmsIso`; fall back to that legacy key so older saved data still
 * resolves a language instead of reading `undefined`. The legacy `method` was
 * auto-picked rather than chosen by the user, so it is dropped.
 */
export function normalizeAsrState(raw: unknown): IAsrState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const {
    method: _legacyMethod,
    mmsIso,
    ...obj
  } = raw as IAsrState & { method?: unknown; mmsIso?: string };
  return { ...obj, asrIso: obj.asrIso ?? mmsIso ?? 'und' };
}

const normalizeMethod = (method?: string) =>
  !method || method === asrMethodDefaultValue ? undefined : method;

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
    normalizeMethod(a.asrMethod) === normalizeMethod(b.asrMethod) &&
    (a.dialect ?? undefined) === (b.dialect ?? undefined) &&
    Boolean(a.selectRoman) === Boolean(b.selectRoman) &&
    (a.language?.bcp47 ?? 'und') === (b.language?.bcp47 ?? 'und')
  );
}
