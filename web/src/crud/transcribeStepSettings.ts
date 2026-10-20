/** `languageName|bcp47`, or a legacy `ILanguage`-like object. */
export type StepLanguageField =
  string | { languageName?: unknown; bcp47?: unknown };

/** Transcribe workflow step `tool.settings`. Unknown keys (e.g. ASR) pass through. */
export interface TranscribeStepSettings extends Record<string, unknown> {
  artifactTypeId?: string;
  language?: StepLanguageField;
  sisterlanguage?: StepLanguageField;
  font?: string;
  fontSize?: string;
  rtl?: boolean;
  spellCheck?: boolean;
  namedRegion?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Each returns the normalized value, or undefined to drop the field. */
type Normalize = (value: unknown) => unknown;

const asLanguage: Normalize = (value) =>
  typeof value === 'string' || isObject(value) ? value : undefined;

const asString: Normalize = (value) =>
  typeof value === 'string' ? value : undefined;

// Older steps saved some flags as "true" / "false".
const asBoolean: Normalize = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

const fieldNormalizers: Partial<Record<string, Normalize>> = {
  artifactTypeId: asString,
  language: asLanguage,
  sisterlanguage: asLanguage,
  font: asString,
  fontSize: asString,
  rtl: asBoolean,
  spellCheck: asBoolean,
  namedRegion: asString,
};

/**
 * Parse transcribe step settings. Online steps store them as a JSON string;
 * offline Work Alone steps store an object. Settings come from persisted Orbit
 * records, so a known field with an unusable type is treated as unset.
 */
export function parseTranscribeStepSettings(
  settings: unknown
): TranscribeStepSettings {
  let parsed: unknown = settings;
  if (typeof settings === 'string') {
    try {
      parsed = JSON.parse(settings || '{}');
    } catch {
      return {};
    }
  }
  if (!isObject(parsed)) return {};
  const result: TranscribeStepSettings = {};
  for (const [key, value] of Object.entries(parsed)) {
    const normalize = fieldNormalizers[key];
    const normalized = normalize ? normalize(value) : value;
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
}
