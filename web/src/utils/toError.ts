/** Rejections are unknown. A real Error is kept; anything else is wrapped so message can be read. */
export const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value ?? ''));
