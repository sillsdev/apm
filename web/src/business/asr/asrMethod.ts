/** Stored when the user wants the preferred method rather than a specific one. */
export const asrMethodDefaultValue = 'default';

/** A user-chosen method. Default and empty values are omitted from the request. */
export function explicitAsrMethod(method: unknown): string | undefined {
  if (typeof method !== 'string') return undefined;
  const trimmed = method.trim();
  if (!trimmed || trimmed === asrMethodDefaultValue) return undefined;
  return trimmed;
}

/**
 * A chosen method that is still a choice for a language whose service methods
 * are `methods` (best first). A method no longer listed, or the one now listed
 * first (which Default already gives), becomes the service default. An empty
 * list (no language yet, or one the service doesn't support) has no valid
 * method, so none is returned. A caller whose lookup failed has no list and
 * should keep the method rather than pass [].
 */
export function listedAsrMethod(
  method: string | undefined,
  methods: string[]
): string | undefined {
  if (!method || methods.length === 0) return undefined;
  if (!methods.includes(method) || method === methods[0]) return undefined;
  return method;
}

/**
 * Method sent on the transcription request. Phonetic sends none. A method the
 * service no longer offers for this language is left off when its list is
 * already cached (`cachedMethods`). Uncached, the saved method is sent as is:
 * a lookup isn't worth delaying the run for a rare case.
 */
export function asrRequestMethod(
  method: unknown,
  phonetic: boolean,
  cachedMethods?: string[]
): string | undefined {
  if (phonetic) return undefined;
  const saved = explicitAsrMethod(method);
  return cachedMethods ? listedAsrMethod(saved, cachedMethods) : saved;
}
