import { JSONParse } from '../../utils/jsonParse';

/** Stored when the user wants the preferred method rather than a specific one. */
export const asrMethodDefaultValue = 'default';

/** Empty, missing, and "default" mean the service default, so the chosen method stays unset. */
export function asrMethodFromSettings(settings: {
  asrMethod?: unknown;
}): string | undefined {
  if (typeof settings.asrMethod !== 'string' || !settings.asrMethod) {
    return undefined;
  }
  if (settings.asrMethod === asrMethodDefaultValue) return undefined;
  return settings.asrMethod;
}

export function withAsrMethod(
  settings: Record<string, unknown>,
  method: string | undefined
): Record<string, unknown> {
  const next = { ...settings };
  if (method) next.asrMethod = method;
  else delete next.asrMethod;
  return next;
}

/** The step's ASR method, written back into the settings JSON. */
export function useAsrMethod(toolSettings: string | undefined) {
  const parsed = JSONParse(toolSettings);
  const chosenMethod = asrMethodFromSettings(
    parsed && typeof parsed === 'object' ? parsed : {}
  );

  const replaceMethod = (
    settings: Record<string, unknown>,
    method: string | undefined
  ): Record<string, unknown> | undefined => {
    if ((method ?? '') === (chosenMethod ?? '')) return undefined;
    // Keep the key. A missing asrMethod inherits the team default, so an
    // explicit return to default has to be stored as "default".
    if (!method) return { ...settings, asrMethod: asrMethodDefaultValue };
    return withAsrMethod(settings, method);
  };

  const clearMethod = (settings: Record<string, unknown>) =>
    withAsrMethod(settings, undefined);

  return { chosenMethod, replaceMethod, clearMethod };
}
