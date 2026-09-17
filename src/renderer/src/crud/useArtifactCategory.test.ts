/**
 * TT-7656: getArtifactCategorys must read from the local Orbit cache without
 * waiting for the remote request queue. A busy queue (normal mid-session) used
 * to stall the Note Details category picker for whole seconds.
 */
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
  ReplaceRelatedRecord: jest.fn(() => []),
  UpdateRecord: jest.fn(() => []),
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

let categoryRecords: ArtifactCategoryD[] = [];

const mockMemory = {
  cache: {
    query: jest.fn((qFn: (q: unknown) => unknown) => {
      const builder = {
        findRecords: (type: string) => {
          const list = categoryRecords.filter((r) => r.type === type);
          return Object.assign([...list], {
            filter: (f: { attribute: string; value: unknown }) =>
              list.filter(
                (r) => (r.attributes as any)?.[f.attribute] === f.value
              ),
          });
        },
        findRecord: ({ type, id }: { type: string; id: string }) =>
          categoryRecords.find((r) => r.type === type && r.id === id),
      };
      return qFn(builder);
    }),
  },
  query: jest.fn(async (qFn: (q: unknown) => unknown) => {
    const builder = {
      findRecords: (type: string) => {
        const list = categoryRecords.filter((r) => r.type === type);
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
  update: jest.fn(async () => undefined),
  schema: {},
};

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
import { Severity } from '../utils/logErrorService';

const noteCat = (
  id: string,
  name: string,
  opts: { remoteId?: string; specialuse?: string } = {}
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
      color: '#ed071d',
      specialuse: opts.specialuse ?? '',
      dateCreated: '2020-01-01',
      dateUpdated: '2020-01-01',
      lastModifiedBy: 1,
    },
    relationships: {
      organization: { data: { type: 'organization', id: ORG_ID } },
      titleMediafile: { data: null },
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
    pendingWaits.length = 0;
    waitForRemoteQueue.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          pendingWaits.push(resolve);
        })
    );
    categoryRecords = [
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
    categoryRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('note-2', 'activity', { remoteId: '12' }),
    ];
    const { result } = renderHook(() => useArtifactCategory(ORG_ID));

    const cats = await settleSoon(
      result.current.getArtifactCategorys(ArtifactCategoryType.Note)
    );
    expect(cats.map((c) => c.id).sort()).toEqual(['note-1', 'note-2']);
  });

  it('does not recreate special note categories that already exist unsynced', async () => {
    // chapter exists locally but has no remoteId yet (just created / still syncing).
    categoryRecords = [
      noteCat('note-1', 'general', { remoteId: '11' }),
      noteCat('chapter-local', 'chapter', { specialuse: 'chapter' }),
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
    categoryRecords = [
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
