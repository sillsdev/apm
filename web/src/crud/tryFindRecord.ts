import Memory from '@orbit/memory';
import { InitializedRecord } from '@orbit/records';
import { RecordByType } from '../model/recordByType';

export function findRecord<Table extends keyof RecordByType>(
  memory: Memory,
  table: Table,
  id: string
): RecordByType[Table] | undefined;
export function findRecord(
  memory: Memory,
  table: string,
  id: string
): InitializedRecord | undefined;
export function findRecord(memory: Memory, table: string, id: string) {
  try {
    if ((id ?? '') === '') return undefined;
    return memory?.cache.query((q) =>
      q.findRecord({
        type: table,
        id: id,
      })
    ) as InitializedRecord;
  } catch {
    return undefined;
  }
}

export function findRecords<Table extends keyof RecordByType>(
  memory: Memory | undefined,
  table: Table
): RecordByType[Table][];
export function findRecords(
  memory: Memory | undefined,
  table: string
): InitializedRecord[];
export function findRecords(memory: Memory | undefined, table: string) {
  // Orbit's query result is an untyped record. The table selects the model.
  const rows = memory?.cache.query((q) => q.findRecords(table));
  return (rows ?? []) as InitializedRecord[];
}
