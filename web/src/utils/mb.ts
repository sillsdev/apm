/** Decimal megabyte. Limits here are MB times 1_000_000, not 1024 squared. */
export const MB = 1_000_000;

/** Byte count as "x.xxMB". */
export const mb = (bytes: number) => `${(bytes / MB).toFixed(2)}MB`;
