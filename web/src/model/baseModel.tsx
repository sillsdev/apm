import {
  RecordOperation,
  UninitializedRecord,
  RecordTransformBuilder,
  RecordRelationship,
  RecordIdentity,
  StandardRecordNormalizer,
  InitializedRecord,
} from '@orbit/records';
import { Dict } from '@orbit/utils';
import Memory from '@orbit/memory';
import { schema } from '../schema';
import type { RelKey } from '../crud/related';
import { currentDateTime } from '../utils/currentDateTime';

export interface BaseModel extends UninitializedRecord {
  attributes: {
    dateCreated: string;
    dateUpdated: string;
    lastModifiedBy: number;
  };
  relationships?: {
    lastModifiedByUser: RecordRelationship;
  };
}

/** Initialized record whose relationships stay the model's own list, not Orbit's string dictionary. */
export type Loaded<T> = Omit<InitializedRecord, 'relationships'> & T;

export type BaseModelD = Loaded<BaseModel>;

export const UpdateRecord = (
  t: RecordTransformBuilder,
  rec: BaseModel & InitializedRecord,
  user: string
): RecordOperation[] => {
  return [
    t.updateRecord(rec).toOperation(),
    ...UpdateLastModifiedBy(t, rec, user),
  ];
};

export const AddRecord = (
  t: RecordTransformBuilder,
  rec: UninitializedRecord,
  user: string,
  memory: Memory,
  dateCreated?: string
): RecordOperation[] => {
  const rn = new StandardRecordNormalizer({ schema: memory?.schema });
  rec = rn.normalizeRecord(rec);
  if (!rec.attributes) rec.attributes = {} as Dict<unknown>;
  (rec.attributes as Dict<unknown>).dateCreated =
    dateCreated ?? currentDateTime();
  return [
    t.addRecord(rec).toOperation(),
    ...UpdateLastModifiedBy(t, rec as InitializedRecord, user),
  ];
};
export const UpdateLastModifiedBy = (
  t: RecordTransformBuilder,
  rec: RecordIdentity,
  user: string
): RecordOperation[] => {
  return [
    t.replaceAttribute(rec, 'dateUpdated', currentDateTime()).toOperation(),
    ...ReplaceRelatedRecord(t, rec, 'lastModifiedByUser', 'user', user),
  ];
};

// Update a single attribute without re-asserting the rest of the cached record
// (unlike UpdateRecord, which pushes every attribute). Refreshes dateUpdated and
// lastModifiedByUser via UpdateLastModifiedBy.
export const UpdateAttribute = (
  t: RecordTransformBuilder,
  rec: (BaseModel & InitializedRecord) | RecordIdentity,
  attribute: string,
  value: unknown,
  user: string
): RecordOperation[] => {
  return [
    t.replaceAttribute(rec, attribute, value).toOperation(),
    ...UpdateLastModifiedBy(t, rec, user),
  ];
};
// A bare identity has no relationship list, so the name stays a string.
// any and an open map do have one, and it names nothing.
type RelName<T> = [RelKey<T>] extends [never]
  ? 'relationships' extends keyof NonNullable<T>
    ? never
    : string
  : RelKey<T>;

export const ReplaceRelatedRecord = <T extends { type: string; id?: string }>(
  t: RecordTransformBuilder,
  rec: T,
  relationship: RelName<T>,
  relatedType: string,
  newId: string | undefined | null
): RecordOperation[] => {
  // Kind comes from the schema. A passed identity has no relationships, so it
  // cannot say whether the cached record already has this link.
  // A new row's id is optional until AddRecord normalizes it.
  const row = rec as RecordIdentity;
  const kind = schema.getRelationship(row.type, relationship).kind;
  if (kind === 'hasMany') {
    if (!newId) return [];
    return [
      t
        .addToRelatedRecords(row, relationship, {
          type: relatedType,
          id: newId,
        })
        .toOperation(),
    ];
  }
  return [
    t
      .replaceRelatedRecord(
        row,
        relationship,
        newId ? { type: relatedType, id: newId } : null
      )
      .toOperation(),
  ];
};

export const UpdateRelatedRecord = <T extends RecordIdentity>(
  t: RecordTransformBuilder,
  rec: T,
  relationship: RelName<T>,
  relatedType: string,
  newId: string | undefined,
  user: string
): RecordOperation[] => {
  return [
    ...UpdateLastModifiedBy(t, rec, user),
    ...ReplaceRelatedRecord(t, rec, relationship, relatedType, newId),
  ];
};
