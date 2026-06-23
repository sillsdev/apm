/**
 * Controllable remote mock for Sections & Passages sheet save Cypress CT.
 * Modes mirror Jest sheetSaveTestHarness (TT-7416 / TT-6918 / TT-6919).
 */
import Memory from '@orbit/memory';
import {
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
  InitializedRecord,
} from '@orbit/records';

export type SheetSaveMockMode =
  | 'brokenKeyMap'
  | 'happyPath'
  | 'deleteSyncFails'
  | 'slowDataChanges';

export interface SheetSaveMockOptions {
  mode?: SheetSaveMockMode;
  delayMs?: number;
}

interface SaveRec {
  id: string;
  issection: boolean;
}

const remoteByLocal: Record<string, string> = {};
const localByRemote: Record<string, string> = {};

function mapRemote(table: string, localId: string, remoteId: string) {
  remoteByLocal[`${table}:${localId}`] = remoteId;
  localByRemote[`${table}:${remoteId}`] = localId;
}

export function resetSheetSaveKeyMap() {
  Object.keys(remoteByLocal).forEach((k) => delete remoteByLocal[k]);
  Object.keys(localByRemote).forEach((k) => delete localByRemote[k]);
}

export function createSheetSaveKeyMap(): RecordKeyMap {
  return {
    idToKey: (table: string, _field: string, localId: string) =>
      remoteByLocal[`${table}:${localId}`],
    keyToId: (table: string, _field: string, remoteId: string) =>
      localByRemote[`${table}:${remoteId}`],
  } as unknown as RecordKeyMap;
}

function buildResponseDataFromInput(inputRecs: SaveRec[][]): SaveRec[][] {
  let sectionCounter = 1000;
  let passageCounter = 2000;
  return inputRecs.map((rowRec) =>
    rowRec.map((rec) => {
      if (rec.issection) {
        if (rec.id) return { ...rec, id: `sec-r-${rec.id}` };
        return { ...rec, id: String(sectionCounter++) };
      }
      if (rec.id) return { ...rec, id: `psg-r-${rec.id}` };
      return { ...rec, id: String(passageCounter++) };
    })
  );
}

export function installSheetSaveRemoteMock(
  memory: Memory,
  options: SheetSaveMockOptions = {}
): void {
  const mode = options.mode ?? 'brokenKeyMap';
  const delayMs = options.delayMs ?? 0;
  resetSheetSaveKeyMap();
  mapRemote('plan', 'plan-local-1', '42');
  mapRemote('passagetype', 'pt1', '99');
  mapRemote('section', 's1-local', '101');
  mapRemote('passage', 'p1-local', '201');
  mapRemote('section', 's2-local', '102');
  mapRemote('passage', 'p2-local', '202');

  const keyMap = createSheetSaveKeyMap();
  (memory as unknown as { keyMap: RecordKeyMap }).keyMap = keyMap;

  const passageRecords: unknown[] = [];
  (memory.cache as unknown as { query: (fn: (q: unknown) => unknown) => unknown }).query =
    (queryFn: (q: unknown) => unknown) => {
      const q = {
        findRecord: ({ type, id }: { type: string; id: string }) => {
          if (type === 'passage') {
            return passageRecords.find(
              (rec) => (rec as { id: string }).id === id
            );
          }
          return undefined;
        },
        findRecords: (type: string) => {
          if (type === 'plan') {
            return [
              {
                id: 'plan-local-1',
                type: 'plan',
                attributes: { organizedBy: 'section' },
              },
            ];
          }
          if (type === 'passage') return passageRecords;
          return [];
        },
      };
      return queryFn(q);
    };

  memory.update = async (transformFn: (t: RecordTransformBuilder) => unknown) => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      const tb = new RecordTransformBuilder();
      const result = transformFn(tb);
      const op =
        result &&
        typeof result === 'object' &&
        '_operation' in (result as object)
          ? (result as { _operation: RecordOperation & { record?: InitializedRecord } })
              ._operation
          : undefined;
      if (!op || op.op !== 'addRecord' || !('record' in op)) return null;
      const spRecord = { ...op.record } as InitializedRecord;
      const inputRecs = JSON.parse(
        spRecord.attributes?.data as string
      ) as SaveRec[][];
      const responseRecs = buildResponseDataFromInput(inputRecs);
      spRecord.attributes = {
        ...spRecord.attributes,
        data: JSON.stringify(responseRecs),
      };
      spRecord.id = spRecord.id || `sp-${Date.now()}`;

      if (
        mode === 'happyPath' ||
        mode === 'slowDataChanges' ||
        mode === 'deleteSyncFails'
      ) {
        mapRemote(
          'sectionpassage',
          spRecord.id as string,
          `sp-remote-${spRecord.id}`
        );
        responseRecs.forEach((rowRec) => {
          rowRec.forEach((item) => {
            if (item.issection) {
              mapRemote('section', `section-local-${item.id}`, item.id);
            } else {
              mapRemote('passage', `passage-local-${item.id}`, item.id);
              passageRecords.push({
                type: 'passage',
                id: `passage-local-${item.id}`,
                attributes: {},
              });
            }
          });
        });
      }

      return spRecord;
    };

  memory.sync = async () => {
      if (mode === 'deleteSyncFails') {
        throw new Error('removeRecord sync failed');
      }
    };
}

declare global {
  interface Window {
    __APM_TEST__?: {
      remoteBusy: boolean;
      changed: boolean;
      progress: number;
      firstSectionId?: string;
    };
  }
}

export function publishApmTestState(state: Window['__APM_TEST__']) {
  window.__APM_TEST__ = state;
}
