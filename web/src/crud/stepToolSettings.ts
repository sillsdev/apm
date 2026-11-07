import { JSONParse } from '../utils';

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validated object from a step tool's settings string or object. */
export function parseStepSettings(
  settings: unknown
): Record<string, unknown> | null {
  if (!settings) return null;
  if (typeof settings === 'string') {
    const parsed = JSONParse(settings);
    return isPlainObject(parsed) ? parsed : null;
  }
  return isPlainObject(settings) ? settings : null;
}

/**
 * Persisted `markDown` from orgworkflowstep `attributes.tool`, or undefined
 * when missing or not a string.
 */
export function stepToolMarkDown(
  toolJson: string | undefined
): string | undefined {
  const tool = parseStepSettings(toolJson);
  if (!tool) return undefined;
  const settings = parseStepSettings(tool.settings);
  if (!settings) return undefined;
  return typeof settings.markDown === 'string' ? settings.markDown : undefined;
}
