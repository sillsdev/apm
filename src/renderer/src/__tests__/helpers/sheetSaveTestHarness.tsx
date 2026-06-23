import React from 'react';
import { render } from '@testing-library/react';
import Coordinator from '@orbit/coordinator';
import {
  InitializedRecord,
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import Memory from '@orbit/memory';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import {
  ISheet,
  IwsKind,
  IMediaShare,
  SheetLevel,
  PassageD,
} from '../../model';
import { useWfOnlineSave } from '../../components/Sheet/useSheetOnlineSave';
import { isSectionRow } from '../../components/Sheet/isSectionPassage';
import { shtNumChanges } from '../../components/Sheet/shtNumChanges';
import DataProvider from '../../hoc/DataProvider';
import { PassageTypeEnum } from '../../model/passageType';
import { PublishDestinationEnum } from '../../crud/usePublishDestination';

export type SheetSaveMockMode =
  | 'brokenKeyMap'
  | 'happyPath'
  | 'deleteSyncFails'
  | 'slowDataChanges';

export interface SheetSaveHarnessOptions {
  mode?: SheetSaveMockMode;
  delayMs?: number;
  planId?: string;
  planRemoteId?: string;
}

interface SaveRec {
  id: string;
  issection: boolean;
}

interface MockKeyMap {
  idToKey: RecordKeyMap['idToKey'];
  keyToId: RecordKeyMap['keyToId'];
}

let forceDataChangesDelayMs = 0;
const remoteByLocal: Record<string, string> = {};
const localByRemote: Record<string, string> = {};

export function setForceDataChangesDelay(ms: number) {
  forceDataChangesDelayMs = ms;
}

export function getForceDataChangesDelay() {
  return forceDataChangesDelayMs;
}

function mapRemote(table: string, localId: string, remoteId: string) {
  remoteByLocal[`${table}:${localId}`] = remoteId;
  localByRemote[`${table}:${remoteId}`] = localId;
}

export function createTestKeyMap(): MockKeyMap {
  return {
    idToKey: (table: string, _field: string, localId: string) =>
      remoteByLocal[`${table}:${localId}`],
    keyToId: (table: string, _field: string, remoteId: string) =>
      localByRemote[`${table}:${remoteId}`],
  };
}

export function resetTestKeyMap() {
  Object.keys(remoteByLocal).forEach((k) => delete remoteByLocal[k]);
  Object.keys(localByRemote).forEach((k) => delete localByRemote[k]);
}

function buildResponseDataFromInput(inputRecs: SaveRec[][]): SaveRec[][] {
  let sectionCounter = 1000;
  let passageCounter = 2000;
  return inputRecs.map((rowRec) =>
    rowRec.map((rec) => {
      if (rec.issection) {
        if (rec.id) {
          return {
            ...rec,
            id: rec.id.startsWith('sec-r-') ? rec.id : `sec-r-${rec.id}`,
          };
        }
        return { ...rec, id: String(sectionCounter++) };
      }
      if (rec.id) {
        return {
          ...rec,
          id: rec.id.startsWith('psg-r-') ? rec.id : `psg-r-${rec.id}`,
        };
      }
      return { ...rec, id: String(passageCounter++) };
    })
  );
}

function seedPassageRecords(
  passageRecords: PassageD[],
  outrecs: SaveRec[][]
) {
  outrecs.forEach((rowRec) => {
    rowRec.forEach((rec) => {
      if (rec.issection) return;
      const localId = `passage-local-${rec.id}`;
      mapRemote('passage', localId, rec.id);
      passageRecords.push({
        type: 'passage',
        id: localId,
        attributes: {
          sequencenum: 1,
          book: 'LUK',
          reference: '1:1',
          title: '',
        },
      } as PassageD);
    });
  });
}

function populateKeyMapFromResponse(
  passageRecords: PassageD[],
  rec: InitializedRecord,
  outrecs: SaveRec[][]
) {
  mapRemote('sectionpassage', rec.id as string, `sp-remote-${rec.id}`);
  outrecs.forEach((rowRec) => {
    rowRec.forEach((item) => {
      if (item.issection) {
        mapRemote('section', `section-local-${item.id}`, item.id);
      } else {
        mapRemote('passage', `passage-local-${item.id}`, item.id);
      }
    });
  });
  seedPassageRecords(passageRecords, outrecs);
}

export function createSheetSaveMemory(
  mode: SheetSaveMockMode,
  opts: SheetSaveHarnessOptions = {}
): { memory: Memory; keyMap: MockKeyMap; backup: { sync: jest.Mock } } {
  resetTestKeyMap();
  const keyMap = createTestKeyMap();
  const planLocalId = opts.planId ?? 'plan-local-1';
  const planRemoteId = opts.planRemoteId ?? '42';
  mapRemote('plan', planLocalId, planRemoteId);
  mapRemote('passagetype', 'pt1', '99');

  const passageRecords: PassageD[] = [];
  const memory = {
    schema: (jest.requireActual('../../schema') as { schema: Memory['schema'] })
      .schema,
    keyMap,
    cache: {
      query: jest.fn((queryFn: (q: unknown) => unknown) => {
        const q = {
          findRecord: ({ type, id }: { type: string; id: string }) => {
            if (type === 'passage') {
              return passageRecords.find((rec) => rec.id === id);
            }
            return undefined;
          },
          findRecords: () => passageRecords,
        };
        return queryFn(q);
      }),
      update: jest.fn((fn: (t: RecordTransformBuilder) => unknown) => {
        const tb = new RecordTransformBuilder();
        const result = fn(tb);
        const op =
          result &&
          typeof result === 'object' &&
          '_operation' in (result as object)
            ? (result as { _operation: RecordOperation })._operation
            : undefined;
        if (op?.op === 'addRecord' && 'record' in op) {
          passageRecords.push(
            (op as unknown as { record: PassageD }).record
          );
        }
        return [];
      }),
    },
    update: jest.fn(),
    sync: jest.fn(),
  } as unknown as Memory;

  const backup = { sync: jest.fn().mockResolvedValue(undefined) };

  (memory.update as jest.Mock).mockImplementation(
    async (transformFn: (t: RecordTransformBuilder) => unknown) => {
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
        populateKeyMapFromResponse(
          passageRecords,
          spRecord as InitializedRecord,
          responseRecs
        );
      }

      return spRecord;
    }
  );

  if (mode === 'deleteSyncFails') {
    (memory.sync as jest.Mock).mockRejectedValue(
      new Error('removeRecord sync failed')
    );
  } else {
    (memory.sync as jest.Mock).mockResolvedValue(undefined);
  }

  return { memory, keyMap, backup };
}

export function buildLargeAddingSheet(rowCount: number): ISheet[] {
  const rows: ISheet[] = [];
  const now = '2026-06-23T00:00:00.000Z';
  let sectionSeq = 1;
  for (let i = 0; i < rowCount; i += 1) {
    if (i % 4 === 0) {
      rows.push({
        level: SheetLevel.Section,
        kind: IwsKind.Section,
        sectionSeq,
        title: `Section ${sectionSeq}`,
        passageSeq: 0,
        book: 'LUK',
        reference: `Section ${sectionSeq}:1–10`,
        sectionUpdated: now,
        deleted: false,
        filtered: false,
        mediaShared: IMediaShare.NotPublic,
        published: [] as PublishDestinationEnum[],
        passageType: PassageTypeEnum.PASSAGE,
      });
      sectionSeq += 1;
    } else {
      rows.push({
        level: SheetLevel.Passage,
        kind: IwsKind.Passage,
        sectionSeq: sectionSeq - 1,
        passageSeq: i % 4,
        book: 'LUK',
        reference: `${sectionSeq - 1}:${i % 4}`,
        comment: `Passage ${i}`,
        passageUpdated: now,
        passageType: PassageTypeEnum.PASSAGE,
        deleted: false,
        filtered: false,
        published: [] as PublishDestinationEnum[],
        mediaShared: IMediaShare.NotPublic,
      });
    }
  }
  return rows;
}

export function existingPopulatedSheet(): ISheet[] {
  const sectionUpdated = '2026-01-01T00:00:00.000Z';
  return [
    {
      level: SheetLevel.Section,
      kind: IwsKind.Section,
      sectionSeq: 1,
      title: 'Existing section one',
      passageSeq: 0,
      sectionId: { type: 'section', id: 's1-local' },
      sectionUpdated,
      deleted: false,
      filtered: false,
      mediaShared: IMediaShare.NotPublic,
      published: [] as PublishDestinationEnum[],
      passageType: PassageTypeEnum.PASSAGE,
    },
    {
      level: SheetLevel.Passage,
      kind: IwsKind.Passage,
      sectionSeq: 1,
      passageSeq: 1,
      book: 'GEN',
      reference: '1:1-5',
      comment: 'existing passage',
      passage: { type: 'passage', id: 'p1-local' } as PassageD,
      passageUpdated: sectionUpdated,
      passageType: PassageTypeEnum.PASSAGE,
      deleted: false,
      filtered: false,
      published: [] as PublishDestinationEnum[],
      mediaShared: IMediaShare.NotPublic,
    },
    {
      level: SheetLevel.Section,
      kind: IwsKind.Section,
      sectionSeq: 2,
      title: 'Existing section two',
      passageSeq: 0,
      sectionId: { type: 'section', id: 's2-local' },
      sectionUpdated,
      deleted: false,
      filtered: false,
      mediaShared: IMediaShare.NotPublic,
      published: [] as PublishDestinationEnum[],
      passageType: PassageTypeEnum.PASSAGE,
    },
    {
      level: SheetLevel.Passage,
      kind: IwsKind.Passage,
      sectionSeq: 2,
      passageSeq: 1,
      book: 'GEN',
      reference: '2:1-7',
      comment: 'existing passage two',
      passage: { type: 'passage', id: 'p2-local' } as PassageD,
      passageUpdated: sectionUpdated,
      passageType: PassageTypeEnum.PASSAGE,
      deleted: false,
      filtered: false,
      published: [] as PublishDestinationEnum[],
      mediaShared: IMediaShare.NotPublic,
    },
  ];
}

export function seedExistingRemoteIds() {
  mapRemote('section', 's1-local', '101');
  mapRemote('passage', 'p1-local', '201');
  mapRemote('section', 's2-local', '102');
  mapRemote('passage', 'p2-local', '202');
}

export async function runBatchedOnlineSave(
  sheet: ISheet[],
  onlineSave: (batch: ISheet[], lastSaved?: string) => Promise<boolean>,
  offlineOnly: boolean,
  lastSaved = ''
): Promise<number> {
  const numChanges = shtNumChanges(sheet, lastSaved);
  if (numChanges === 0) return 0;
  let calls = 0;
  const wrappedSave = async (batch: ISheet[]) => {
    calls += 1;
    await onlineSave(batch, lastSaved);
  };
  let start = 0;
  const newsht = [...sheet];
  if (!offlineOnly && numChanges > 10) {
    let end = 200;
    for (; start + 200 < newsht.length; start += end) {
      end = 200;
      while (!isSectionRow(newsht[start + end] as ISheet) && end > 0) {
        end -= 1;
      }
      if (end === 0) {
        end = 200;
        while (
          end < newsht.length &&
          !isSectionRow(newsht[start + end] as ISheet)
        ) {
          end++;
        }
      }
      await wrappedSave(newsht.slice(start, start + end));
    }
  }
  await wrappedSave(newsht.slice(start));
  return calls;
}

interface SetupResult {
  onlineSave: (sheet: ISheet[], lastSaved?: string) => Promise<boolean>;
  setComplete: jest.Mock;
  memory: Memory;
  keyMap: MockKeyMap;
}

export function setupOnlineSave(
  mode: SheetSaveMockMode,
  opts: SheetSaveHarnessOptions = {}
): SetupResult {
  const { memory, keyMap, backup } = createSheetSaveMemory(mode, opts);
  if (mode !== 'brokenKeyMap') {
    seedExistingRemoteIds();
  }

  const coordinator = {
    getSource: (name: string) => {
      if (name === 'backup') return backup;
      if (name === 'memory') return memory;
      return {};
    },
  } as unknown as Coordinator;

  const globals = {
    plan: opts.planId ?? 'plan-local-1',
    user: 'u1',
    offlineOnly: false,
    memory,
    coordinator,
  } as GlobalState;

  const setComplete = jest.fn();
  let onlineSaveFn: (
    sheet: ISheet[],
    lastSaved?: string
  ) => Promise<boolean> = async () => false;

  const TestComponent = () => {
    onlineSaveFn = useWfOnlineSave({ setComplete });
    return null;
  };

  render(
    <GlobalProvider init={globals}>
      <DataProvider dataStore={memory}>
        <TestComponent />
      </DataProvider>
    </GlobalProvider>
  );

  return {
    onlineSave: onlineSaveFn,
    setComplete,
    memory,
    keyMap,
  };
}

export async function advanceWaitForRemoteIdTimers(steps = 301) {
  for (let i = 0; i < steps; i += 1) {
    jest.advanceTimersByTime(1000);
    await Promise.resolve();
  }
}
