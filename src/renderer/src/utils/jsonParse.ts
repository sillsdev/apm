export const JSONParse = (
  json: string | undefined
): Record<string, unknown> | string | undefined => {
  try {
    return JSON.parse(json || '{}');
  } catch {
    return json;
  }
};
