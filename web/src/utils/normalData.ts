/**
 * Helpers for reading persisted data (JSON strings, Orbit record attributes)
 * whose shape we cannot trust.
 */

/** A plain JSON object: not null and not an array. */
export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Each returns the normalized value, or undefined to drop the field. */
export type Normalize = (value: unknown) => unknown;

export const asString: Normalize = (value) =>
  typeof value === 'string' ? value : undefined;

// Older records saved some flags as "true" / "false".
export const asBoolean: Normalize = (value) => {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

/**
 * Read an object stored either as a JSON string or as an object (offline
 * records). Missing data (undefined, null, '') reads as {}. Returns undefined
 * when the data is present but is not a JSON object.
 */
export function parseJsonObject(
  data: unknown
): Record<string, unknown> | undefined {
  if (data === undefined || data === null || data === '') return {};
  let parsed: unknown = data;
  if (typeof data === 'string') {
    try {
      parsed = JSON.parse(data);
    } catch {
      return undefined;
    }
  }
  return isObject(parsed) ? parsed : undefined;
}

/**
 * Apply each field's normalizer. Fields without a normalizer pass through.
 * `onUnusable` is called for a field whose value its normalizer drops.
 */
export function normalizeFields(
  data: Record<string, unknown>,
  normalizers: Partial<Record<string, Normalize>>,
  onUnusable?: (key: string, value: unknown) => void
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const normalize = normalizers[key];
    const normalized = normalize ? normalize(value) : value;
    if (normalized !== undefined) result[key] = normalized;
    else if (normalize) onUnusable?.(key, value);
  }
  return result;
}
