/* eslint-disable @typescript-eslint/no-require-imports */
import type { BibleD, OrganizationBibleD, OrganizationD, UserD } from '../model';
import { BurritoType } from './BurritoType';

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('../store', () => ({
  fetchBooks: jest.fn((lang: string) => ({ type: 'FETCH_BOOKS', payload: lang })),
}));

jest.mock('../selector', () => ({
  burritoSelector: (state: any) => state.burritoStrings,
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => []),
}));

jest.mock('../utils/dataPath', () => ({
  __esModule: true,
  default: jest.fn(async (p: string) => `/abs/${p}`),
  PathType: { BURRITO: 'burrito' },
}));

jest.mock('../utils/cleanFileName', () => ({
  __esModule: true,
  default: (s: string) => s,
}));

jest.mock('./data/burritoBuilder', () => ({
  BurritoBuilder: class BurritoBuilder {
    private obj: any = {
      format: 'burrito',
      meta: { version: '0.1', category: 'scripture' },
      ingredients: {},
      type: { flavorType: { name: 'scripture', flavor: { name: 'base' }, currentScope: {} } },
    };
    withMeta(meta: any) {
      this.obj.meta = { ...this.obj.meta, ...meta };
      return this;
    }
    withIdAuthority() {
      return this;
    }
    withIdentification() {
      return this;
    }
    withAgency() {
      return this;
    }
    withTargetArea() {
      return this;
    }
    withLocalizedNames() {
      return this;
    }
    withCopyright() {
      return this;
    }
    build() {
      return this.obj;
    }
  },
}));

jest.mock('./BurritoContents', () => ({
  burritoContents: 'burritoContents',
}));

jest.mock('./BurritoWrapper', () => ({
  burritoWrapper: 'burritoWrapper',
}));

jest.mock('./BurritoBooks', () => ({
  burritoBooks: 'burritoBooks',
  burritoProjects: 'burritoProjects',
}));

jest.mock('./burritoFormatParams', () => ({
  burritoFormat: 'burritoFormat',
}));

jest.mock('./useBurritoAudio', () => ({
  useBurritoAudio: jest.fn(() => jest.fn(async ({ metadata }: any) => metadata)),
}));
jest.mock('./useBurritoText', () => ({
  useBurritoText: jest.fn(() => jest.fn(async ({ metadata }: any) => metadata)),
}));
jest.mock('./useBurritoNavigation', () => ({
  useBurritoNavigation: jest.fn(() => jest.fn(async ({ metadata }: any) => metadata)),
}));
jest.mock('./useBurritoApmData', () => ({
  useBurritoApmData: jest.fn(() => jest.fn(async ({ metadata }: any) => metadata)),
}));

jest.mock('../crud', () => {
  const related = (rec: any, key: string) =>
    rec?.relationships?.[key]?.data && !Array.isArray(rec.relationships[key].data)
      ? rec.relationships[key].data.id
      : rec?.relationships?.[key]?.data ?? null;
  return {
    pubDataCopyright: 'copyright',
    related,
    remoteId: jest.fn(() => 'rem-1'),
    useBible: jest.fn(() => ({
      getPublishingData: jest.fn(() => 'Copyright'),
    })),
    useOrgDefaults: jest.fn(),
  };
});

function makeIpc() {
  return {
    createFolder: jest.fn().mockResolvedValue(undefined),
    deleteFolder: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
  };
}

type LoadOpts = {
  orgDefaults?: Record<string, any>;
  booksLoaded?: boolean;
  bookData?: Array<{ code: string; abbr?: string; short?: string; long?: string }>;
  orbit?: Partial<Record<string, unknown[]>>;
};

function loadCreateBurrito(api: typeof window.api, opts: LoadOpts = {}) {
  jest.resetModules();
  (window as unknown as { api?: typeof api }).api = api;

  const dispatch = jest.fn();
  const state = {
    strings: { lang: 'en' },
    books: {
      loaded: opts.booksLoaded ?? true,
      bookData:
        opts.bookData ?? [{ code: 'GEN', abbr: 'Gen', short: 'Genesis', long: 'Genesis' }],
    },
    burritoStrings: {
      preparing: 'Preparing',
      create: 'Create',
      open: 'Open',
      failed: 'Failed',
      success: 'Success',
      createAudio: 'Audio',
      createText: 'Text',
      createNotes: 'Notes',
      createResources: 'Resources',
      createIntellectualProperty: 'IP',
      createNavigation: 'Nav',
      createData: 'Data',
      createOther: 'Other {0}',
      getString: () => 'Cancel',
    },
  };

  const { useDispatch, useSelector } = require('react-redux');
  useDispatch.mockReturnValue(dispatch);
  useSelector.mockImplementation((sel: any) => sel(state));

  const { useGlobal } = require('../context/useGlobal');
  useGlobal.mockImplementation((key: string) => {
    if (key === 'memory') return [{ keyMap: {} }, jest.fn()];
    if (key === 'user') return ['user-1', jest.fn()];
    return [undefined, jest.fn()];
  });

  const { useOrgDefaults } = require('../crud');
  useOrgDefaults.mockReturnValue({
    getOrgDefault: jest.fn((k: string) => opts.orgDefaults?.[k]),
  });

  const { useOrbitData } = require('../hoc/useOrbitData');
  const orbit = opts.orbit ?? {};
  useOrbitData.mockImplementation((k: string) => orbit[k] ?? []);

  const { renderHook, act } = require('@testing-library/react/pure');
  const { useCreateBurrito } = require('./useCreateBurrito');
  return { renderHook, act, useCreateBurrito, dispatch };
}

function fixtures(teamId: string) {
  const user: UserD = { id: 'user-1', type: 'user', attributes: { name: 'Tester' } } as any;
  const team: OrganizationD = {
    id: teamId,
    type: 'organization',
    attributes: { name: 'My Team' },
    keys: { remoteId: 'TEAMREM' } as any,
  } as any;
  const bible: BibleD = {
    id: 'bib-1',
    type: 'bible',
    attributes: { bibleName: 'Bible', bibleId: 'TST', iso: 'eng', description: '' },
  } as any;
  const teamBible: OrganizationBibleD = {
    id: 'ob-1',
    type: 'organizationbible',
    relationships: {
      organization: { data: { id: teamId } },
      bible: { data: { id: 'bib-1' } },
    },
  } as any;
  return { user, team, bible, teamBible };
}

describe('useCreateBurrito', () => {
  const teamId = 'team-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates wrapper + metadata and finishes with success', async () => {
    const ipc = makeIpc();
    const { user, team, bible, teamBible } = fixtures(teamId);

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(ipc as never, {
      orgDefaults: {
        burritoBooks: ['GEN'],
        burritoContents: [BurritoType.Text],
        burritoWrapper: { wrapper: true },
        burritoProjects: [],
        burritoFormat: { convertToMp3: false },
        burritoRevision: '1',
      },
      orbit: {
        user: [user],
        organization: [team],
        organizationbible: [teamBible],
        bible: [bible],
        project: [],
        plan: [],
        section: [],
        passage: [],
      },
    });

    const { result } = renderHook(() => useCreateBurrito(teamId));

    await act(async () => {
      await result.current.createBurrito();
    });

    expect(ipc.deleteFolder).toHaveBeenCalled();
    expect(ipc.createFolder).toHaveBeenCalled();
    const writePaths = ipc.write.mock.calls.map((c) => String(c[0]));
    expect(writePaths.some((p) => p.includes('wrapper.json'))).toBe(true);
    expect(writePaths.some((p) => p.includes('metadata.json'))).toBe(true);

    expect(result.current.result).toBe('success');
    expect(result.current.error).toBeNull();
    expect(result.current.isCreating).toBe(false);
  });

  it('can be cancelled mid-run (sets result=cancelled and error=Cancelled)', async () => {
    const ipc = makeIpc();
    const { user, team, bible, teamBible } = fixtures(teamId);

    let resolveText!: () => void;
    const textGate = new Promise<void>((r) => (resolveText = r));
    const { useBurritoText } = require('./useBurritoText');
    useBurritoText.mockImplementation(() => jest.fn(async ({ metadata }: any) => {
      await textGate;
      return metadata;
    }));

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(ipc as never, {
      orgDefaults: {
        burritoBooks: ['GEN'],
        burritoContents: [BurritoType.Text],
        burritoWrapper: { wrapper: true },
        burritoProjects: [],
        burritoFormat: { convertToMp3: false },
        burritoRevision: '1',
      },
      orbit: {
        user: [user],
        organization: [team],
        organizationbible: [teamBible],
        bible: [bible],
        project: [],
        plan: [],
        section: [],
        passage: [],
      },
    });

    const { result } = renderHook(() => useCreateBurrito(teamId));

    await act(async () => {
      const run = result.current.createBurrito();
      result.current.cancel();
      resolveText();
      await run;
    });

    expect(result.current.result).toBe('cancelled');
    expect(result.current.error).toBe('Cancelled');
    expect(result.current.isCreating).toBe(false);
  });

  it('dispatches fetchBooks when books are not loaded', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useCreateBurrito, dispatch } = loadCreateBurrito(ipc as never, {
      booksLoaded: false,
      orgDefaults: {
        burritoBooks: [],
        burritoContents: [],
      },
    });

    renderHook(() => useCreateBurrito(teamId));

    // effect runs after mount
    await act(async () => Promise.resolve());
    expect(dispatch).toHaveBeenCalled();
  });
});

