export function startEnd(
  subject: string | undefined
): { start: number; end: number } | undefined {
  const startEnd = (val: string): RegExpExecArray | null =>
    /^([0-9]+\.[0-9])-([0-9]+\.[0-9]) /.exec(val);

  const m = startEnd(subject || '');
  if (m) {
    return { start: parseFloat(m[1] || '0'), end: parseFloat(m[2] || '0') };
  }
  return undefined;
}
