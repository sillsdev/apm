/**
 * TT-7656: getArtifactCategorys must read from the local Orbit cache without
 * waiting for the remote request queue. A busy queue (normal mid-session) used
 * to stall the Note Details category picker for whole seconds.
 */
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import type { ArtifactCategoryD } from '../model';

const ORG_ID = 'org-1';
const USER_ID = 'user-1';

/** Deferreds that stand in for a remote queue that never drains. */
const pendingWaits: Array<() => void> = [];
const waitForRemoteQueue = jest.fn(
  () =>
    new Promise<void>((resolve) => {
      pendingWaits.push(resolve);
    })
);

jest.mock('../utils/useWaitForRemoteQueue', () => ({
  useWaitForRemoteQueue: () => waitForRemoteQueue,
}));

jest.mock('../model/baseModel', () => ({
  AddRecord: jest.fn(
    (
      _t: unknown,
      rec: { id?: string; type: string; attributes: Record<string, unknown> }
    ) => {
      if (!rec.id) rec.id = 'new-cat-id';
      return [{ op: 'addRecord', record: rec }];
    }
  ),
  ReplaceRelatedRecord: jest.fn(
    (
      _t: unknown,
      rec: { type?: string; id?: string },
      relationship: string,
      relatedType: string,
      newId: string | null | undefined
    ) => [
      {
        op: 'replaceRelatedRecord',
        record: { type: rec.type, id: rec.id },
        relationship,
        relatedRecord: newId ? { type: relatedType, id: newId } : null,
      },
    ]
  ),
  UpdateRecord: jest.fn(
    (
      _t: unknown,
      rec: { type?: string; id?: string; attributes?: Record<string, unknown> }
    ) => [{ op: 'updateRecord', record: rec }]
  ),
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => ({
    chapter: 'Chapter Number',
    title: 'Title',
    general: 'General Note',
    activity: 'Activity',
  })),
  shallowEqual: jest.fn(),
}));

/** All Orbit records (artifactcategory, sharedresource, …) for cache.query. */
let orbitRecords: any[] = [];

const transformBuilderStub = () => ({
  removeRecord: (rec: unknown) => ({
    toOperation: () => ({ op: 'removeRecord', record: rec }),
  }),
  replaceRelatedRecord: (
    rec: unknown,
    relationship: string,
    related: unknown
  ) => ({
    toOperation: () => ({
      op: 'replaceRelatedRecord',
      record: rec,
      relationship,
      relatedRecord: related,
    }),
  }),
  addRecord: (rec: unknown) => ({
    toOperation: () => ({ op: 'addRecord', record: rec }),
  }),
  updateRecord: (rec: unknown) => ({
    toOperation: () => ({ op: 'updateRecord', record: rec }),
  }),
  replaceAttribute: (rec: unknown, attribute: string, value: unknown) => ({
    toOperation: () => ({
      op: 'replaceAttribute',
      record: rec,
      attribute,
      value,
    }),
  }),
});

const mockMemory = {
  cache: {
    query: jest.fn((qFn: (q: unknown) => unknown) => {
      const builder = {
        findRecords: (type: string) => {
          const list = orbitRecords.filter((r) => r.type === type);
          return Object.assign([...list], {
            filter: (f: { attribute: string; value: unknown }) =>
              list.filter(
                (r) => (r.attributes as any)?.[f.attribute] === f.value
              ),
          });
        },
        findRecord: ({ type, id }: { type: string; id: string }) =>
          orbitRecords.find((r) => r.type === type && r.id === id),
      };
      return qFn(builder);
    }),
  },
  query: jest.fn(async (qFn: (q: unknown) => unknown) => {
    const builder = {
      findRecords: (type: string) => {
        const list = orbitRecords.filter((r) => r.type === type);
        return Object.assign([...list], {
          filter: (f: { attribute: string; value: unknown }) =>
            list.filter(
              (r) => (r.attributes as any)?.[f.attribute] === f.value
            ),
        });
      },
    };
    return qFn(builder);
  }),
  update: jest.fn(async (arg: unknown) => {
    // Invoke transform builders so AddRecord / consolidate ops are captured.
    if (typeof arg === 'function') {
      const ops = (
        arg as (t: ReturnType<typeof transformBuilderStub>) => unknown
      )(transformBuilderStub());
      lastTransformResult = Array.isArray(ops) ? ops : [];
      return ops;
    }
    lastTransformResult = [];
  }),
  schema: {},
};

/** Ops returned from the most recent memory.update transform callback. */
let lastTransformResult: Array<Record<string, unknown>> = [];

const mockErrorReporter = { notify: jest.fn() };
const mockLogError = jest.fn();

jest.mock('../utils/logErrorService', () => ({
  Severity: { info: 0, error: 1, retry: 2 },
  logError: (...args: unknown[]) => mockLogError(...args),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, unknown> = {
      memory: mockMemory,
      user: USER_ID,
      organization: ORG_ID,
      offlineOnly: false,
      errorReporter: mockErrorReporter,
    };
    return [mockValues[key], jest.fn()];
  }),
  useGetGlobal: jest.fn(() =>
    jest.fn((key: string) => {
      const mockValues: Record<string, unknown> = {
        memory: mockMemory,
        user: USER_ID,
        organization: ORG_ID,
        offlineOnly: false,
        errorReporter: mockErrorReporter,
      };
      return mockValues[key];
    })
  ),
}));

import {
  ArtifactCategoryType,
  useArtifactCategory,
} from './useArtifactCategory';
import {
  AddRecord,
  ReplaceRelatedRecord,
  UpdateRecord,
} from '../model/baseModel';
import { Severity } from '../utils/logErrorService';

const addRecordMock = AddRecord as jest.Mock;
const replaceRelatedMock = ReplaceRelatedRecord as jest.Mock;
const updateRecordMock = UpdateRecord as jest.Mock;

/** specialuse values passed to AddRecord during bootstrap / team-create ops. */
const specialusesFromAddRecord = (): string[] =>
  addRecordMock.mock.calls
    .map((call) => (call[1] as ArtifactCategoryD)?.attributes?.specialuse)
    .filter((s): s is string => Boolean(s));

const lastUpdateOps = (): Array<Record<string, unknown>> => lastTransformResult;

const noteCat = (
  id: string,
  name: string,
  opts: {
    remoteId?: string;
    specialuse?: string;
    color?: string;
    titleMediaId?: string;
    /** null = system (built-in) category */
    orgId?: string | null;
  } = {}
): ArtifactCategoryD =>
  ({
    id,
    type: 'artifactcategory',
    keys: opts.remoteId !== undefined ? { remoteId: opts.remoteId } : {},
    attributes: {
      categoryname: name,
      discussion: false,
      resource: false,
      note: true,
      color: opts.color !== undefined ? opts.color : '#ed071d',
      specialuse: opts.specialuse ?? '',
      dateCreated: '2020-01-01',
      dateUpdated: '2020-01-01',
      lastModifiedBy: 1,
    },
    relationships: {
      organization:
        opts.orgId === null
          ? { data: null }
          : { data: { type: 'organization', id: opts.orgId ?? ORG_ID } },
      titleMediafile: opts.titleMediaId
        ? { data: { type: 'mediafile', id: opts.titleMediaId } }
        : { data: null },
    },
  }) as unknown as ArtifactCategoryD;

const resourceCat = (id: string, name: string): ArtifactCategoryD =>
  ({
    id,
    type: 'artifactcategory',
    keys: { remoteId: id },
    attributes: {
      categoryname: name,
      discussion: false,
      resource: true,
      note: false,
      color: '',
      specialuse: '',
      dateCreated: '2020-01-01',
      dateUpdated: '2020-01-01',
      lastModifiedBy: 1,
    },
    relationships: {
      organization: { data: { type: 'organization', id: ORG_ID } },
      titleMediafile: { data: null },
    },
  }) as unknown as ArtifactCategoryD;

const sharedRes = (id: string, categoryId: string) =>
  ({
    id,
    type: 'sharedresource',
    keys: { remoteId: id },
    attributes: {
      note: true,
      dateCreated: '2020-01-01',
      dateUpdated: '2020-01-01',
    },
    relationships: {
      artifactCategory: { data: { type: 'artifactcategory', id: categoryId } },
      passage: { data: null },
      titleMediafile: { data: null },
    },
  }) as const;

const catGraphic = (id: string, resourceId: number) =>
  ({
    id,
    type: 'graphic',
    keys: { remoteId: id },
    attributes: {
      resourceType: 'category',
      resourceId,
      dateCreated: '2020-01-01',
      dateUpdated: '2020-01-01',
    },
  }) as const;

/**
 * Race `p` against a short timeout so a hung waitForRemoteQueue fails the
 * test cleanly instead of leaving Jest waiting on an open handle.
 */
const settleSoon = <T>(p: Promise<T>, ms = 100): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`timed out after ${ms}ms waiting for categories`)),
        ms
      )
    ),
  ]);

describe('useArtifactCategory (TT-7656)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogError.mockClear();
    lastTransformResult = [];
    pendingWaits.length = 0;
    waitForRemoteQueue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pendingWaits.push(resolve);
        })
    );
    orbitRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('note-2', 'activity', { remoteId: '12' }),
      resourceCat('res-1', 'scripture'),
    ];
  });

  afterEach(async () => {
    // Drain any deferred waits so Jest does not hang on open handles when a
    // test timed out against the unfixed (queue-blocking) implementation.
    while (pendingWaits.length) {
      pendingWaits.shift()?.();
    }
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  it('returns note categories while the remote queue is still busy', async () => {
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    expect(cats.map((c) => c.id).sort()).toEqual(['note-1', 'note-2']);
  });

  it('returns resource categories while the remote queue is still busy', async () => {
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Resource)
    );
    expect(cats.map((c) => c.id)).toEqual(['res-1']);
  });

  it('does not block on the special note-category bootstrap', async () => {
    // No chapter special-use record — bootstrap path used to await memory.query
    // and waitForRemoteQueue, stalling the picker.
    orbitRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('note-2', 'activity', { remoteId: '12' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    expect(cats.map((c) => c.id).sort()).toEqual(['note-1', 'note-2']);
  });

  it('does not recreate special note categories when chapter and title exist unsynced', async () => {
    // Both specials exist locally but have no remoteId yet (just created / still syncing).
    orbitRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('chapter-local', 'chapter', { specialuse: 'chapter' }),
      noteCat('title-local', 'title', { specialuse: 'title' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    expect(mockMemory.update).not.toHaveBeenCalled();
  });

  it('retries special note-category bootstrap after a failed Orbit write', async () => {
    // No chapter special — bootstrap must run. A transient memory.update failure
    // must not permanently suppress retries on the same hook instance (Devin).
    orbitRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('note-2', 'activity', { remoteId: '12' }),
    ];
    const boom = new Error('IndexedDB transform failed');
    mockMemory.update
      .mockRejectedValueOnce(boom)
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    // Let the detached bootstrap rejection settle (and clear the marker).
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    // Discriminating: failed bootstrap must not permanently suppress retries.
    expect(mockMemory.update).toHaveBeenCalledTimes(2);
    expect(mockLogError).toHaveBeenCalledWith(
      Severity.error,
      mockErrorReporter,
      boom
    );
  });

  it('waits for the remote queue only after creating a new category', async () => {
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    let settledId: string | undefined | 'pending' = 'pending';
    const p = result.current.addNewArtifactCategory(
      'Brand New Note Cat',
      ArtifactCategoryType.Note
    );
    p.then((id) => {
      settledId = id;
    });

    // Memory write happens first; create must not return until the queue wait
    // (needed so keys.remoteId fills in) resolves.
    await new Promise<void>((r) => setTimeout(r, 0));
    // Give isDuplicateCategory's getArtifactCategorys a chance to finish
    // (must not hang on the remote wait).
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 50));
    });
    expect(mockMemory.update).toHaveBeenCalled();
    expect(settledId).toBe('pending');
    expect(waitForRemoteQueue).toHaveBeenCalled();
    expect(pendingWaits.length).toBeGreaterThan(0);

    await act(async () => {
      while (pendingWaits.length) {
        pendingWaits.shift()?.();
      }
      await p;
    });
    expect(settledId).toBe('new-cat-id');
  });
});

describe('useArtifactCategory (TT-7702 special note categories)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogError.mockClear();
    lastTransformResult = [];
    pendingWaits.length = 0;
    waitForRemoteQueue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pendingWaits.push(resolve);
        })
    );
    orbitRecords = [];
  });

  afterEach(async () => {
    while (pendingWaits.length) {
      pendingWaits.shift()?.();
    }
    await new Promise<void>((r) => setTimeout(r, 0));
  });

  it('bootstraps only the missing title special when chapter already exists', async () => {
    // TT-7702: chapter-only gate skipped title forever; slug chapter still
    // counts, so bootstrap must add title only — never a second chapter.
    orbitRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('chapter-local', 'chapter', { specialuse: 'chapter' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 0));
    });

    expect(mockMemory.update).toHaveBeenCalled();
    expect(specialusesFromAddRecord()).toEqual(['title']);
  });

  it('consolidates slug and localized chapter specials to one Chapter Number', async () => {
    // Both synced — hide loser in the returned list but do not removeRecord
    // (uncached server refs may still point at the synced loser).
    orbitRecords = [
      noteCat('chapter-slug', 'chapter', {
        remoteId: '21',
        specialuse: 'chapter',
      }),
      noteCat('chapter-localized', 'Chapter Number', {
        remoteId: '22',
        specialuse: 'chapter',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    const labels = cats.map((c) => c.category);
    expect(labels.filter((l) => l === 'Chapter Number')).toHaveLength(1);
    expect(labels.filter((l) => l === 'Title')).toHaveLength(1);
    expect(cats.filter((c) => c.specialuse === 'chapter')).toHaveLength(1);

    expect(
      lastUpdateOps().filter((op) => op.op === 'removeRecord')
    ).toHaveLength(0);
    expect(orbitRecords.some((r) => r.id === 'chapter-slug')).toBe(true);
    expect(orbitRecords.some((r) => r.id === 'chapter-localized')).toBe(true);
  });

  it('migrates sharedresource refs off a hidden duplicate chapter special', async () => {
    // Devin: hide-only dedupe leaves notes linked to the unreachable loser.
    // Winner prefers remoteId (chapter-new); loser chapter-old has the ref.
    orbitRecords = [
      noteCat('chapter-old', 'chapter', { specialuse: 'chapter' }),
      noteCat('chapter-new', 'Chapter Number', {
        remoteId: '99',
        specialuse: 'chapter',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
      sharedRes('sr-1', 'chapter-old'),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );

    expect(
      cats.filter((c) => c.specialuse === 'chapter').map((c) => c.id)
    ).toEqual(['chapter-new']);

    const ops = lastUpdateOps();
    expect(
      ops.some(
        (op) =>
          op.op === 'removeRecord' &&
          (op.record as { id: string }).id === 'chapter-old'
      )
    ).toBe(true);
    expect(replaceRelatedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'sr-1', type: 'sharedresource' }),
      'artifactCategory',
      'artifactcategory',
      'chapter-new'
    );
  });

  it('merges loser color and titleMedia onto the synced winner before remove', async () => {
    // Devin: remoteId-first winner must not discard local customizations.
    orbitRecords = [
      noteCat('chapter-old', 'chapter', {
        specialuse: 'chapter',
        color: '#00ff00',
        titleMediaId: 'media-1',
      }),
      noteCat('chapter-new', 'Chapter Number', {
        remoteId: '99',
        specialuse: 'chapter',
        color: '',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    expect(
      cats.filter((c) => c.specialuse === 'chapter').map((c) => c.id)
    ).toEqual(['chapter-new']);

    expect(updateRecordMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'chapter-new',
        attributes: expect.objectContaining({ color: '#00ff00' }),
      }),
      expect.anything()
    );
    expect(replaceRelatedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'chapter-new' }),
      'titleMediafile',
      'mediafile',
      'media-1'
    );
    expect(
      lastUpdateOps().some(
        (op) =>
          op.op === 'removeRecord' &&
          (op.record as { id: string }).id === 'chapter-old'
      )
    ).toBe(true);
    // Devin: this call must return merged presentation, not a stale empty color.
    const chapter = cats.find((c) => c.id === 'chapter-new');
    expect(chapter?.color).toBe('#00ff00');
    expect(chapter?.titleMediaId).toBe('media-1');
  });

  it('does not delete system chapter or rewrite other-org refs when team has its own', async () => {
    // Devin: team+system share specialuse — must not delete global or retarget
    // other teams' notes onto this team's category.
    orbitRecords = [
      noteCat('chapter-system', 'chapter', {
        remoteId: '1',
        specialuse: 'chapter',
        orgId: null,
      }),
      noteCat('chapter-team', 'Chapter Number', {
        remoteId: '99',
        specialuse: 'chapter',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
      sharedRes('sr-other', 'chapter-system'),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );

    expect(
      lastUpdateOps().some(
        (op) =>
          op.op === 'removeRecord' &&
          (op.record as { id: string }).id === 'chapter-system'
      )
    ).toBe(false);
    expect(replaceRelatedMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'sr-other' }),
      'artifactCategory',
      'artifactcategory',
      'chapter-team'
    );
    // Team view: one Chapter Number (team); system row hidden, not deleted.
    expect(
      cats.filter((c) => c.specialuse === 'chapter').map((c) => c.id)
    ).toEqual(['chapter-team']);
    expect(orbitRecords.some((r) => r.id === 'chapter-system')).toBe(true);
  });

  it('returns both team duplicate chapters when consolidate update fails', async () => {
    // Devin: catch must not hide losers still present in the cache.
    // Both need remoteId so the online list would include the loser if
    // consolidate returns it (without remoteId the post-filter hides it).
    orbitRecords = [
      noteCat('chapter-old', 'chapter', {
        remoteId: '98',
        specialuse: 'chapter',
      }),
      noteCat('chapter-new', 'Chapter Number', {
        remoteId: '99',
        specialuse: 'chapter',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
    ];
    mockMemory.update.mockRejectedValueOnce(new Error('IndexedDB failed'));
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );

    expect(mockLogError).toHaveBeenCalled();
    const chapterIds = cats
      .filter((c) => c.specialuse === 'chapter')
      .map((c) => c.id)
      .sort();
    expect(chapterIds).toEqual(['chapter-new', 'chapter-old']);
  });

  it('consolidates a later duplicate after a prior successful cleanup on the same hook', async () => {
    // Devin: permanent org marker left later sync dups hide-only / orphaned.
    orbitRecords = [
      noteCat('chapter-old', 'chapter', { specialuse: 'chapter' }),
      noteCat('chapter-new', 'Chapter Number', {
        remoteId: '99',
        specialuse: 'chapter',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    expect(
      lastUpdateOps().some(
        (op) =>
          op.op === 'removeRecord' &&
          (op.record as { id: string }).id === 'chapter-old'
      )
    ).toBe(true);

    // Simulate successful remove, then a later sync duplicate.
    orbitRecords = orbitRecords.filter((r) => r.id !== 'chapter-old');
    orbitRecords.push(
      noteCat('chapter-z', 'Chapter Number', {
        remoteId: '100',
        specialuse: 'chapter',
      }),
      sharedRes('sr-c', 'chapter-z')
    );
    mockMemory.update.mockClear();
    replaceRelatedMock.mockClear();
    lastTransformResult = [];

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );

    expect(mockMemory.update).toHaveBeenCalled();
    // Synced later dup: migrate refs and hide, but do not removeRecord.
    expect(
      lastUpdateOps().some(
        (op) =>
          op.op === 'removeRecord' &&
          (op.record as { id: string }).id === 'chapter-z'
      )
    ).toBe(false);
    expect(replaceRelatedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'sr-c', type: 'sharedresource' }),
      'artifactCategory',
      'artifactcategory',
      'chapter-new'
    );
  });

  it('does not removeRecord a synced loser so uncached refs stay valid', async () => {
    // Devin: only cached refs are migrated; deleting a synced loser orphans
    // unloaded plan media that still reference it on the server.
    orbitRecords = [
      noteCat('chapter-old', 'chapter', {
        remoteId: '98',
        specialuse: 'chapter',
      }),
      noteCat('chapter-new', 'Chapter Number', {
        remoteId: '99',
        specialuse: 'chapter',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
      sharedRes('sr-cached', 'chapter-old'),
      // Intentionally no second media/SR for another plan — simulates uncached.
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );

    expect(
      cats.filter((c) => c.specialuse === 'chapter').map((c) => c.id)
    ).toEqual(['chapter-new']);
    expect(replaceRelatedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'sr-cached', type: 'sharedresource' }),
      'artifactCategory',
      'artifactcategory',
      'chapter-new'
    );
    expect(
      lastUpdateOps().some(
        (op) =>
          op.op === 'removeRecord' &&
          (op.record as { id: string }).id === 'chapter-old'
      )
    ).toBe(false);
    expect(orbitRecords.some((r) => r.id === 'chapter-old')).toBe(true);
  });

  it('re-keys only one loser graphic onto the winner remoteId', async () => {
    // Devin: snapshotted graphics + winnerHasGraphic never updates → both
    // loser graphics get the winner resourceId and lookup is ambiguous.
    orbitRecords = [
      noteCat('chapter-a', 'Chapter Number', {
        remoteId: '30',
        specialuse: 'chapter',
        color: '',
      }),
      noteCat('chapter-b', 'chapter', {
        remoteId: '31',
        specialuse: 'chapter',
        color: '',
      }),
      noteCat('chapter-c', 'chapter', {
        remoteId: '32',
        specialuse: 'chapter',
        color: '',
      }),
      noteCat('title-1', 'title', { remoteId: '23', specialuse: 'title' }),
      catGraphic('g-b', 31),
      catGraphic('g-c', 32),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );

    const graphicUpdates = updateRecordMock.mock.calls
      .map(
        (call) =>
          call[1] as { type?: string; attributes?: { resourceId?: number } }
      )
      .filter((r) => r.type === 'graphic');
    const rekeyedToWinner = graphicUpdates.filter(
      (r) => r.attributes?.resourceId === 30
    );
    expect(rekeyedToWinner).toHaveLength(1);
  });
});
