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
