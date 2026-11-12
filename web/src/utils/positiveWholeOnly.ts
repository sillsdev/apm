export const positiveWholeOnly = (n: number | undefined): string =>
  n && Math.floor(n) === n && n > 0 ? `${n}` : '';
