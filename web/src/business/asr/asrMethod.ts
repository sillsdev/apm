/** Stored when the user wants the preferred method rather than a specific one. */
export const asrMethodDefaultValue = 'default';

/** A user-chosen method. Default and empty values are omitted from the request. */
export function explicitAsrMethod(method: unknown): string | undefined {
  if (typeof method !== 'string') return undefined;
  const trimmed = method.trim();
  if (!trimmed || trimmed === asrMethodDefaultValue) return undefined;
  return trimmed;
}

/** Method sent on the transcription request. Phonetic sends none. */
export function asrRequestMethod(
  method: unknown,
  phonetic: boolean
): string | undefined {
  if (phonetic) return undefined;
  return explicitAsrMethod(method);
}
