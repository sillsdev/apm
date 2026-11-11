import { RelKey } from './related';

// A generic relationship map has no index signature, so the read is untyped.
export const hasAnyRelated = <
  T extends { relationships?: object } | null | undefined,
>(
  rec: T,
  key: RelKey<T>
): boolean => {
  const record = rec as {
    relationships?: Record<string, { data?: unknown }>;
  } | null;
  const data = record?.relationships?.[key]?.data;
  if (!data) return false;
  if (Array.isArray(data)) return data.length !== 0;
  return true;
};
