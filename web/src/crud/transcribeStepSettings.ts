import bugsnagClient from '../auth/bugsnagClient';
import { logError, Severity } from '../utils/logErrorService';
import {
  asBoolean,
  asString,
  isObject,
  normalizeFields,
  parseJsonObject,
  type Normalize,
} from '../utils/normalData';

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

const asLanguage: Normalize = (value) =>
  typeof value === 'string' || isObject(value) ? value : undefined;

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

// Settings are parsed in render memos and per-step loops, so report each
// distinct problem once rather than on every call.
const reported = new Set<string>();
const report = (message: string) => {
  if (reported.has(message)) return;
  reported.add(message);
  logError(Severity.error, bugsnagClient, message);
};

const MAX_PREVIEW = 200;
const preview = (data: unknown) => {
  const text =
    typeof data === 'string' ? data : (JSON.stringify(data) ?? String(data));
  return text.length > MAX_PREVIEW ? `${text.slice(0, MAX_PREVIEW)}…` : text;
};

const typeName = (value: unknown) =>
  Array.isArray(value) ? 'array' : typeof value;

/**
 * Parse transcribe step settings. Online steps store them as a JSON string;
 * offline Work Alone steps store an object. Settings come from persisted Orbit
 * records, so a known field with an unusable type is treated as unset.
 */
export function parseTranscribeStepSettings(
  settings: unknown
): TranscribeStepSettings {
  const parsed = parseJsonObject(settings);
  if (!parsed) {
    report(`Unreadable transcribe step settings: ${preview(settings)}`);
    return {};
  }
  return normalizeFields(parsed, fieldNormalizers, (key, value) => {
    if (value !== null) {
      report(`Transcribe step setting ${key} has type ${typeName(value)}`);
    }
  });
}

/** Parse a workflow step `tool` attribute; unreadable data reads as {}. */
export function parseStepTool(tool: unknown): Record<string, unknown> {
  const parsed = parseJsonObject(tool);
  if (!parsed) {
    report(`Unreadable workflow step tool: ${preview(tool)}`);
    return {};
  }
  return parsed;
}

/**
 * Before a save replaces settings we could not read, log where they are (not
 * their content) so the original can be looked up in the data and recovered.
 */
export function reportReplacedStepSettings(
  settings: unknown,
  orgRemoteId: string | undefined,
  stepSeq: number
) {
  if (parseJsonObject(settings)) return;
  report(
    `Replacing unreadable transcribe step settings: organization ${
      orgRemoteId ?? 'not synced'
    }, step sequence ${stepSeq}`
  );
}
