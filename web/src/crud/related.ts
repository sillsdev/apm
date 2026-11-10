type IsAny<T> = 0 extends 1 & T ? true : false;

type RelationshipKeys<R> = string extends keyof R ? never : keyof R & string;

// A missing record has no relationship names. `any` and an open string map
// (findRecord or the cache before a model cast) have none either.
export type RelKey<T> = [IsAny<T>] extends [true]
  ? never
  : [NonNullable<T>] extends [never]
    ? never
    : 'relationships' extends keyof NonNullable<T>
      ? RelationshipKeys<NonNullable<NonNullable<T>['relationships']>>
      : never;

// Result stays any: callers use an id, an array, or null. A generic
// relationship map has no index signature, so the read is untyped.
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
