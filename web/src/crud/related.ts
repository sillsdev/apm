export type RelKey<T> = [NonNullable<T>] extends [{ relationships?: infer R }]
  ? keyof NonNullable<R> & string
  : never;

export const related = <
  T extends { relationships?: object } | null | undefined,
>(
  rec: T,
  key: RelKey<T>
): any => {
  const record = rec as any;
  if (!record?.relationships || !(key in record.relationships)) return null;
  const data = record.relationships[key].data;
  if (data && !Array.isArray(data)) return data.id;
  if (data === undefined) return null;
  return data;
};
export default related;
