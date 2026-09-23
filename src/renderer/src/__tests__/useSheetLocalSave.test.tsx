/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import {
  ISheet,
  IwsKind,
  IMediaShare,
  SheetLevel,
  SectionD,
  PassageD,
} from '../model';
import { useWfLocalSave } from '../components/Sheet/useSheetLocalSave';
import { memory, keyMap } from '../schema';
import { PassageTypeEnum } from '../model/passageType';
import DataProvider from '../hoc/DataProvider';
import { PublishDestinationEnum } from '../crud/usePublishDestination';
import { getSerializer } from '../serializers/getSerializer';

const defaultSheet: ISheet = {
  level: SheetLevel.Section,
  kind: IwsKind.SectionPassage,
  sectionSeq: 1,
  title: 'Jesus on trial before Pilate',
  passageSeq: 1,
  book: 'LUK',
  reference: '10:20-100',
  comment: '',
  deleted: false,
  mediaShared: IMediaShare.NotPublic,
  passageType: PassageTypeEnum.PASSAGE,
  filtered: false,
  discussionCount: 0,
  published: [] as PublishDestinationEnum[],
};

jest.mock('../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext(undefined) };
});
jest.mock('../utils/useDataChanges', () => ({
  useDataChanges: () => jest.fn().mockResolvedValue(undefined),
}));

// see https://jestjs.io/docs/mock-functions#mocking-modules
jest.mock('../schema', () => {
  const originalModule = jest.requireActual('../schema');

  return {
    __esModule: true,
    ...originalModule,
    memory: {
      ...originalModule.memory,
      query: originalModule.memory.query,
      on: originalModule.memory.on,
      cache: originalModule.memory?.cache,
      schema: originalModule.memory.schema,
      update: jest.fn(),
    },
  };
});

// see: https://kentcdodds.com/blog/how-to-test-custom-react-hooks
interface HookProps {
  globals: GlobalState;
  setComplete: (val: number) => void;
}
function setup(props: HookProps) {
  let returnVal: (
    ws: ISheet[],
    sections: SectionD[],
    passages: PassageD[],
    lastSaved?: string
  ) => Promise<void> = async () => {};
  const TestComponent = () => {
    const localSave = useWfLocalSave(props);
    returnVal = localSave;
    return null;
  };
  render(
    <GlobalProvider init={props.globals}>
      <DataProvider dataStore={memory}>
        <TestComponent />
      </DataProvider>
    </GlobalProvider>
  );
  return returnVal;
}

test('save one section and one passage', async () => {
  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      level: SheetLevel.Section,
      kind: IwsKind.SectionPassage,
      sectionSeq: 1,
      title: 'The Temptation of Jesus',
      passageSeq: 1,
      book: 'LUK',
      reference: '4:1-13',
      comment: '',
      deleted: false,
      mediaShared: IMediaShare.NotPublic,
    },
  ];

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, [], [], '2021-09-21');

  expect(setComplete).toHaveBeenCalled();
  const updateCalls = (memory.update as jest.Mock).mock.calls;
  expect(updateCalls.length).toBe(2);
  expect(updateCalls[0][0].length).toBe(4);
  // console.log(JSON.stringify(updateCalls[1][0], null, 2));
  expect(updateCalls[1][0].length).toBe(4);
});

interface TagValue {
  [key: string]: TagValue | string;
}

const expectTagValue = (ob: TagValue, tag: string, value: string) => {
  for (const key in ob) {
    if (key === tag) {
      expect(ob[key]).toBe(value);
    } else if (typeof ob[key] === 'object') {
      expectTagValue(ob[key] as TagValue, tag, value);
    }
  }
};

test('delete one section and one passage', async () => {
  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      kind: IwsKind.SectionPassage,
      sectionSeq: 1,
      title: 'The Temptation of Jesus',
      sectionId: { type: 'section', id: 's1' },
      sectionUpdated: '2021-09-22',
      passageSeq: 1,
      book: 'LUK',
      reference: '4:1-13',
      comment: '',
      passage: { type: 'passage', id: 'pa1' } as PassageD,
      passageUpdated: '2021-09-22',
      deleted: true,
      mediaShared: IMediaShare.NotPublic,
    },
  ];

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, [], [], '2021-09-21');

  expect(setComplete).toHaveBeenCalled();
  const updateCalls = (memory.update as jest.Mock).mock.calls;
  expect(updateCalls.length).toBe(2);
  // console.log(JSON.stringify(updateCalls[0][0], null, 2));
  expectTagValue(updateCalls[0][0], 'op', 'removeRecord');
  expectTagValue(updateCalls[0][0], 'id', 's1');
  expectTagValue(updateCalls[1][0], 'id', 'pa1');
});

test('update section and passage', async () => {
  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      kind: IwsKind.SectionPassage,
      sectionSeq: 1,
      title: 'The Temptation of Jesus',
      sectionId: { type: 'section', id: 's1' },
      sectionUpdated: '2021-09-22',
      passageSeq: 1,
      book: 'LUK',
      reference: '4:1-13',
      comment: '',
      passage: { type: 'passage', id: 'pa1' } as PassageD,
      passageUpdated: '2021-09-22',
      deleted: false,
      mediaShared: IMediaShare.NotPublic,
    },
  ];

  const sections = [
    {
      type: 'section',
      id: 's1',
      attributes: {
        sequencenum: 2,
        name: 'old title',
        graphics: '{}',
        published: false,
        level: 1,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 1,
      },
    } as SectionD,
  ];

  const passages: PassageD[] = [
    {
      type: 'passage',
      id: 'pa1',
      attributes: {
        sequencenum: 3,
        book: 'HAB',
        reference: '1:10-20',
        title: 'old one',
        state: 'old passage stat',
        lastComment: 'no comment',
        hold: false,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 2,
      },
    } as PassageD,
  ];

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, sections, passages, '2021-09-21');

  expect(setComplete).toHaveBeenCalled();
  const updateCalls = (memory.update as jest.Mock).mock.calls;
  expect(updateCalls.length).toBe(2);
  expect(updateCalls[0][0].length).toBe(6);
  // console.log(JSON.stringify(updateCalls[1][0], null, 2));
  expect(updateCalls[1][0].length).toBe(10);
});

test('no update if same date', async () => {
  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      kind: IwsKind.SectionPassage,
      sectionSeq: 1,
      title: 'The Temptation of Jesus',
      sectionId: { type: 'section', id: 's1' },
      sectionUpdated: '2021-09-22',
      passageSeq: 1,
      book: 'LUK',
      reference: '4:1-13',
      comment: '',
      passage: { type: 'passage', id: 'pa1' } as PassageD,
      passageUpdated: '2021-09-22',
      deleted: false,
      mediaShared: IMediaShare.NotPublic,
    },
  ];

  const sections = [
    {
      type: 'section',
      id: 's1',
      attributes: {
        sequencenum: 2,
        name: 'old title',
        graphics: '{}',
        published: false,
        level: 1,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 1,
      },
    } as SectionD,
  ];

  const passages: PassageD[] = [
    {
      type: 'passage',
      id: 'pa1',
      attributes: {
        sequencenum: 3,
        book: 'HAB',
        reference: '1:10-20',
        title: 'old one',
        state: 'old passage stat',
        lastComment: 'no comment',
        hold: false,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 2,
      },
    } as PassageD,
  ];

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, sections, passages, '2021-09-22');

  expect(setComplete).toHaveBeenCalled();
  const updateCalls = (memory.update as jest.Mock).mock.calls;
  // console.log(JSON.stringify(updateCalls, null, 2));
  expect(updateCalls.length).toBe(0);
});

test('persists titleMediafile for all three section title recordings', async () => {
  (memory.update as jest.Mock).mockClear();

  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      kind: IwsKind.Section,
      level: SheetLevel.Book,
      sectionSeq: -2,
      title: 'Luke',
      sectionId: { type: 'section', id: 's-book' },
      sectionUpdated: '2021-09-22',
      passageSeq: 0,
      reference: '',
      titleMediaId: { type: 'mediafile', id: 'media-title-1' },
      deleted: false,
    },
    {
      ...defaultSheet,
      kind: IwsKind.Section,
      level: SheetLevel.Movement,
      sectionSeq: -1,
      title: 'Movement 1',
      sectionId: { type: 'section', id: 's-mov' },
      sectionUpdated: '2021-09-22',
      passageSeq: 0,
      reference: '',
      titleMediaId: { type: 'mediafile', id: 'media-title-2' },
      deleted: false,
    },
    {
      ...defaultSheet,
      kind: IwsKind.Section,
      level: SheetLevel.Section,
      sectionSeq: 1,
      title: 'Section 1',
      sectionId: { type: 'section', id: 's-sec' },
      sectionUpdated: '2021-09-22',
      passageSeq: 0,
      reference: '',
      titleMediaId: { type: 'mediafile', id: 'media-title-3' },
      deleted: false,
    },
  ];

  const sections = worksheet.map(
    (w) =>
      ({
        type: 'section',
        id: w.sectionId!.id,
        attributes: {
          sequencenum: w.sectionSeq,
          name: 'old',
          graphics: '{}',
          published: false,
          level: w.level,
          dateCreated: '2021-09-21',
          dateUpdated: '2021-09-21',
          lastModifiedBy: 1,
        },
      }) as SectionD
  );

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, sections, [], '2021-09-21');

  expect(setComplete).toHaveBeenCalled();
  const updateCalls = (memory.update as jest.Mock).mock.calls;
  expect(updateCalls.length).toBe(3);

  const relatedMediaIds = updateCalls.flatMap((call) => {
    const ops = call[0] as Array<{
      op?: string;
      relationship?: string;
      relatedRecord?: { type?: string; id?: string };
    }>;
    return ops
      .filter(
        (op) =>
          op.op === 'replaceRelatedRecord' &&
          op.relationship === 'titleMediafile'
      )
      .map((op) => op.relatedRecord?.id);
  });

  expect(relatedMediaIds).toEqual([
    'media-title-1',
    'media-title-2',
    'media-title-3',
  ]);
});

// TT-7704b / PR #675 review: editing a passage reference must invalidate the
// persisted startChapter/endChapter/startVerse/endVerse, not just the
// in-memory sheet row's copy, and must recompute them immediately via
// parseRef rather than leaving them undefined (parseRef skips recalculation
// once startChapter is already a number, and an undefined value never
// reaches the online db — see the serializer test below).
test('save after reference edit recomputes stale parsed chapter/verse fields', async () => {
  (memory.update as jest.Mock).mockClear();

  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      kind: IwsKind.SectionPassage,
      sectionSeq: 1,
      title: 'The Temptation of Jesus',
      sectionId: { type: 'section', id: 's1' },
      sectionUpdated: '2021-09-22',
      passageSeq: 1,
      book: 'MAT',
      reference: '3:1-4', // changed from 1:1-4 to 3:1-4
      comment: '',
      passage: { type: 'passage', id: 'pa1' } as PassageD,
      passageUpdated: '2021-09-22',
      deleted: false,
      mediaShared: IMediaShare.NotPublic,
    },
  ];

  const sections = [
    {
      type: 'section',
      id: 's1',
      attributes: {
        sequencenum: 1,
        name: 'The Temptation of Jesus',
        graphics: '{}',
        published: false,
        level: 1,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 1,
      },
    } as SectionD,
  ];

  const passages: PassageD[] = [
    {
      type: 'passage',
      id: 'pa1',
      attributes: {
        sequencenum: 1,
        book: 'MAT',
        reference: '1:1-4', // stale reference before the edit
        title: '',
        state: '',
        lastComment: '',
        hold: false,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 1,
        // stale parsed fields calculated for the OLD reference (chapter 1)
        startChapter: 1,
        endChapter: 1,
        startVerse: 1,
        endVerse: 4,
      },
    } as PassageD,
  ];

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, sections, passages, '2021-09-21');

  expect(setComplete).toHaveBeenCalled();
  const updateCalls = (memory.update as jest.Mock).mock.calls;
  const passageUpdateOps = updateCalls[1][0] as Array<{
    op?: string;
    record?: { type?: string; attributes?: Record<string, unknown> };
  }>;
  const updateRecordOp = passageUpdateOps.find(
    (op) => op.op === 'updateRecord' && op.record?.type === 'passage'
  );

  expect(updateRecordOp).toBeDefined();
  expect(updateRecordOp?.record?.attributes?.reference).toBe('3:1-4');
  // Stale chapter 1 must not survive an edit to a reference now in chapter 3;
  // it must be recomputed to the real chapter 3, not merely cleared.
  expect(updateRecordOp?.record?.attributes?.startChapter).toBe(3);
  expect(updateRecordOp?.record?.attributes?.endChapter).toBe(3);
  expect(updateRecordOp?.record?.attributes?.startVerse).toBe(1);
  expect(updateRecordOp?.record?.attributes?.endVerse).toBe(4);
});

// PR #675 review (r4087346106): same comment repeated on this file — "It
// would be better to parseRef immediately instead of setting these to
// undefined". Root cause: JSONAPIResourceSerializer.serializeAttribute skips
// any attribute whose value is `undefined` when building the outgoing PATCH
// (@orbit/jsonapi), so clearing startChapter/etc to undefined never reaches
// the online db — the stale chapter (1) survives there and reappears on the
// next refetch. Prove it by serializing the exact record this hook persists.
test('save after reference edit produces attributes the online db will actually receive', async () => {
  (memory.update as jest.Mock).mockClear();

  const globals = {
    plan: 'p1',
    user: 'u1',
    offlineOnly: false,
    memory,
  } as GlobalState;

  const setComplete = jest.fn((val: number) => {});
  const worksheet: ISheet[] = [
    {
      ...defaultSheet,
      kind: IwsKind.SectionPassage,
      sectionSeq: 1,
      title: 'The Temptation of Jesus',
      sectionId: { type: 'section', id: 's1' },
      sectionUpdated: '2021-09-22',
      passageSeq: 1,
      book: 'MAT',
      reference: '3:1-4', // changed from 1:1-4 to 3:1-4
      comment: '',
      passage: { type: 'passage', id: 'pa1' } as PassageD,
      passageUpdated: '2021-09-22',
      deleted: false,
      mediaShared: IMediaShare.NotPublic,
    },
  ];

  const sections = [
    {
      type: 'section',
      id: 's1',
      attributes: {
        sequencenum: 1,
        name: 'The Temptation of Jesus',
        graphics: '{}',
        published: false,
        level: 1,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 1,
      },
    } as SectionD,
  ];

  const passages: PassageD[] = [
    {
      type: 'passage',
      id: 'pa1',
      attributes: {
        sequencenum: 1,
        book: 'MAT',
        reference: '1:1-4', // stale reference before the edit
        title: '',
        state: '',
        lastComment: '',
        hold: false,
        dateCreated: '2021-09-21',
        dateUpdated: '2021-09-21',
        lastModifiedBy: 1,
        // stale parsed fields calculated for the OLD reference (chapter 1)
        startChapter: 1,
        endChapter: 1,
        startVerse: 1,
        endVerse: 4,
      },
    } as PassageD,
  ];

  const localSave = setup({ globals, setComplete });

  await localSave(worksheet, sections, passages, '2021-09-21');

  const updateCalls = (memory.update as jest.Mock).mock.calls;
  const passageUpdateOps = updateCalls[1][0] as Array<{
    op?: string;
    record?: PassageD;
  }>;
  const updateRecordOp = passageUpdateOps.find(
    (op) => op.op === 'updateRecord' && op.record?.type === 'passage'
  );
  expect(updateRecordOp?.record).toBeDefined();

  const resource = getSerializer({
    schema: memory.schema,
    keyMap,
  } as unknown as Parameters<typeof getSerializer>[0]).serialize(
    updateRecordOp!.record!
  );

  // The online db must receive the recomputed chapter 3, not silence
  // (an omitted attribute), or it keeps reporting the stale chapter 1.
  expect(resource.attributes?.['start-chapter']).toBe(3);
  expect(resource.attributes?.['end-chapter']).toBe(3);
  expect(resource.attributes?.['start-verse']).toBe(1);
  expect(resource.attributes?.['end-verse']).toBe(4);
});
