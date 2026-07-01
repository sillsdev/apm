/* eslint-disable @typescript-eslint/no-require-imports */
import type {
  BibleD,
  OrganizationBibleD,
  OrganizationD,
  UserD,
} from '../model';
import { BurritoType } from './BurritoType';

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('../store', () => ({
  fetchBooks: jest.fn((lang: string) => ({
    type: 'FETCH_BOOKS',
    payload: lang,
  })),
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
  default: jest.fn(async (p: string, _pathType?: unknown, local?: any) => {
    if (local) {
      local.localname = `/local/${p}`;
      return local.localname;
    }
    return `/abs/${p}`;
  }),
  PathType: { BURRITO: 'burrito', MEDIA: 'MEDIA' },
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
      type: {
        flavorType: {
          name: 'scripture',
          flavor: { name: 'base' },
          currentScope: {},
        },
      },
      identification: {},
    };
    withMeta(meta: any) {
      this.obj.meta = { ...this.obj.meta, ...meta };
      return this;
    }
    withIdAuthority() {
      return this;
    }
    withIdentification(identification: any) {
      this.obj.identification = {
        ...this.obj.identification,
        ...identification,
      };
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
  useBurritoAudio: jest.fn(() =>
    jest.fn(async ({ metadata }: any) => metadata)
  ),
}));
jest.mock('./useBurritoText', () => ({
  useBurritoText: jest.fn(() => jest.fn(async ({ metadata }: any) => metadata)),
}));
jest.mock('./useBurritoNavigation', () => ({
  useBurritoNavigation: jest.fn(() =>
    jest.fn(async ({ metadata }: any) => metadata)
  ),
}));
jest.mock('./useBurritoApmData', () => ({
  useBurritoApmData: jest.fn(() =>
    jest.fn(async ({ metadata }: any) => metadata)
  ),
}));
jest.mock('./useBurritoIntellectualProperty', () => ({
  useBurritoIntellectualProperty: jest.fn(() =>
    jest.fn(async ({ metadata }: any) => metadata)
  ),
}));

jest.mock('../crud', () => {
  const related = (rec: any, key: string) =>
    rec?.relationships?.[key]?.data &&
    !Array.isArray(rec.relationships[key].data)
      ? rec.relationships[key].data.id
      : (rec?.relationships?.[key]?.data ?? null);
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

jest.mock('../crud/useProjectDefaults', () => ({
  projDefBook: 'book',
  useProjectDefaults: jest.fn(),
}));

jest.mock('../utils/useNum2BookCode', () => ({
  useNum2BookCode: jest.fn(),
}));

function makeIpc() {
  return {
    createFolder: jest.fn().mockResolvedValue(undefined),
    deleteFolder: jest.fn().mockResolvedValue(undefined),
    write: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined),
    md5File: jest.fn().mockResolvedValue('deadbeef'),
    exists: jest.fn().mockResolvedValue(true),
    stat: jest.fn().mockResolvedValue(JSON.stringify({ size: 1024 })),
  };
}

type LoadOpts = {
  orgDefaults?: Record<string, any>;
  booksLoaded?: boolean;
  bookData?: Array<{
    code: string;
    abbr?: string;
    short?: string;
    long?: string;
  }>;
  orbit?: Partial<Record<string, unknown[]>>;
  /** Akuo book slot per project id for projDefBook resolution in tests */
  projBookById?: Record<string, string>;
  num2BookCodeImpl?: (bookNum: number) => string | undefined;
  memoryStub?: Record<string, unknown>;
};

function loadCreateBurrito(api: typeof window.api, opts: LoadOpts = {}) {
  jest.resetModules();
  (window as unknown as { api?: typeof api }).api = api;

  const dispatch = jest.fn();
  const state = {
    strings: { lang: 'en' },
    books: {
      loaded: opts.booksLoaded ?? true,
      bookData: opts.bookData ?? [
        { code: 'GEN', abbr: 'Gen', short: 'Genesis', long: 'Genesis' },
      ],
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
    if (key === 'memory') return [opts.memoryStub ?? { keyMap: {} }, jest.fn()];
    if (key === 'user') return ['user-1', jest.fn()];
    return [undefined, jest.fn()];
  });

  const { useOrgDefaults } = require('../crud');
  useOrgDefaults.mockReturnValue({
    getOrgDefault: jest.fn((k: string) => opts.orgDefaults?.[k]),
  });

  const { useNum2BookCode } = require('../utils/useNum2BookCode');
  useNum2BookCode.mockReturnValue(
    opts.num2BookCodeImpl ??
      ((bookNum: number) =>
        (
          ({ 1: 'GEN', 4: 'NUM', 40: 'MAT', 43: 'JHN' }) as Record<
            number,
            string | undefined
          >
        )[bookNum])
  );

  const { useProjectDefaults } = require('../crud/useProjectDefaults');
  useProjectDefaults.mockReturnValue({
    getProjectDefault: jest.fn((label: string, proj: any) => {
      if (label !== 'book') return undefined;
      if (opts.projBookById && proj?.id)
        return opts.projBookById[proj.id] ?? 'A01';
      return 'A01';
    }),
  });

  const { useOrbitData } = require('../hoc/useOrbitData');
  const orbit = opts.orbit ?? {};
  useOrbitData.mockImplementation((k: string) => orbit[k] ?? []);

  const { renderHook, act } = require('@testing-library/react/pure');
  const { useCreateBurrito } = require('./useCreateBurrito');
  return { renderHook, act, useCreateBurrito, dispatch };
}

function fixtures(teamId: string) {
  const user: UserD = {
    id: 'user-1',
    type: 'user',
    attributes: { name: 'Tester' },
  } as any;
  const team: OrganizationD = {
    id: teamId,
    type: 'organization',
    attributes: { name: 'My Team' },
    keys: { remoteId: 'TEAMREM' } as any,
  } as any;
  const bible: BibleD = {
    id: 'bib-1',
    type: 'bible',
    attributes: {
      bibleName: 'Bible',
      bibleId: 'TST',
      iso: 'eng',
      description: '',
    },
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

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(
      ipc as never,
      {
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
      }
    );

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
    useBurritoText.mockImplementation(() =>
      jest.fn(async ({ metadata }: any) => {
        await textGate;
        return metadata;
      })
    );

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(
      ipc as never,
      {
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
      }
    );

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
    const { renderHook, act, useCreateBurrito, dispatch } = loadCreateBurrito(
      ipc as never,
      {
        booksLoaded: false,
        orgDefaults: {
          burritoBooks: [],
          burritoContents: [],
        },
      }
    );

    renderHook(() => useCreateBurrito(teamId));

    // effect runs after mount
    await act(async () => Promise.resolve());
    expect(dispatch).toHaveBeenCalled();
  });

  it('trims identification.name.en and language display names in metadata', async () => {
    const ipc = makeIpc();
    const { user, team, bible, teamBible } = fixtures(teamId);
    bible.attributes.bibleName = '  Trimmed Bible  ';
    const project = {
      id: 'proj-1',
      type: 'project',
      attributes: {
        name: 'Proj',
        language: 'eng',
        languageName: '  English  ',
      },
      relationships: {},
    } as any;
    const plan = {
      id: 'plan-1',
      type: 'plan',
      relationships: { project: { data: { id: 'proj-1' } } },
    } as any;

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(
      ipc as never,
      {
        orgDefaults: {
          burritoBooks: ['GEN'],
          burritoContents: [BurritoType.Text],
          burritoWrapper: { wrapper: true },
          burritoProjects: ['proj-1'],
          burritoFormat: { convertToMp3: false },
          burritoRevision: '  2  ',
        },
        orbit: {
          user: [user],
          organization: [team],
          organizationbible: [teamBible],
          bible: [bible],
          project: [project],
          plan: [plan],
          section: [],
          passage: [],
        },
      }
    );

    const { result } = renderHook(() => useCreateBurrito(teamId));

    await act(async () => {
      await result.current.createBurrito();
    });

    const metaWrites = ipc.write.mock.calls.filter((c) =>
      String(c[0]).includes('metadata.json')
    );
    expect(metaWrites.length).toBeGreaterThan(0);
    const metadata = JSON.parse(metaWrites[metaWrites.length - 1][1] as string);
    expect(metadata.identification?.name?.en).toBe('Trimmed Bible');
    expect(metadata.identification?.abbreviation?.en).toBe('TST');
    expect(metadata.languages).toEqual([
      { tag: 'eng', name: { en: 'English' } },
    ]);
    expect(metadata.identification?.primary?.apm?.['rem-1']?.revision).toBe(
      '2'
    );
  });

  it('includes General project sections in Text export via projDefBook when passages have no book', async () => {
    const ipc = makeIpc();
    const { user, team, bible, teamBible } = fixtures(teamId);

    const generalProject = {
      id: 'proj-g',
      type: 'project',
      attributes: {
        name: 'General Proj',
        language: 'eng',
        languageName: 'English',
        defaultParams: '{}',
      },
      relationships: { organization: { data: { id: teamId } } },
    } as any;
    const generalPlan = {
      id: 'plan-g',
      type: 'plan',
      relationships: { project: { data: { id: 'proj-g' } } },
    } as any;
    const generalSection = {
      id: 'sec-g',
      type: 'section',
      relationships: { plan: { data: { id: 'plan-g' } } },
      attributes: { sequencenum: 1 },
    } as any;
    const generalPassage = {
      id: 'pas-g',
      type: 'passage',
      relationships: { section: { data: { id: 'sec-g' } } },
      attributes: { sequencenum: 1, reference: 'p1' },
    } as any;

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(
      ipc as never,
      {
        orgDefaults: {
          burritoBooks: ['NUM'],
          burritoContents: [BurritoType.Text],
          burritoWrapper: { wrapper: true },
          burritoProjects: ['proj-g'],
          burritoFormat: { convertToMp3: false },
          burritoRevision: '1',
        },
        bookData: [
          { code: 'GEN', abbr: 'Gen', short: 'Genesis', long: 'Genesis' },
          { code: 'NUM', abbr: 'Nu', short: 'Numbers', long: 'Numbers' },
        ],
        projBookById: { 'proj-g': 'A04' },
        orbit: {
          user: [user],
          organization: [team],
          organizationbible: [teamBible],
          bible: [bible],
          project: [generalProject],
          plan: [generalPlan],
          section: [generalSection],
          passage: [generalPassage],
        },
      }
    );

    const { result } = renderHook(() => useCreateBurrito(teamId));

    await act(async () => {
      await result.current.createBurrito();
    });

    const { useBurritoText } = require('./useBurritoText');
    const innerText = useBurritoText.mock.results[0].value as jest.Mock;
    expect(innerText).toHaveBeenCalled();
    const textCall = innerText.mock.calls.find(
      (c: any[]) => c[0]?.book === 'NUM'
    );
    expect(textCall).toBeDefined();
    expect(textCall[0].sections.map((s: { id: string }) => s.id)).toContain(
      'sec-g'
    );
  });

  it('includes General project sections when book default is a 3-digit general code', async () => {
    const ipc = makeIpc();
    const { user, team, bible, teamBible } = fixtures(teamId);

    const generalProject = {
      id: 'proj-g2',
      type: 'project',
      attributes: {
        name: 'Shared Notes',
        language: 'eng',
        languageName: 'English',
        defaultParams: '{}',
      },
      relationships: { organization: { data: { id: teamId } } },
    } as any;
    const generalPlan = {
      id: 'plan-g2',
      type: 'plan',
      relationships: { project: { data: { id: 'proj-g2' } } },
    } as any;
    const generalSection = {
      id: 'sec-g2',
      type: 'section',
      relationships: { plan: { data: { id: 'plan-g2' } } },
      attributes: { sequencenum: 1 },
    } as any;
    const generalPassage = {
      id: 'pas-g2',
      type: 'passage',
      relationships: { section: { data: { id: 'sec-g2' } } },
      attributes: { sequencenum: 1, reference: 'p1' },
    } as any;

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(
      ipc as never,
      {
        orgDefaults: {
          burritoBooks: ['010'],
          burritoContents: [BurritoType.Text],
          burritoWrapper: { wrapper: true },
          burritoProjects: ['proj-g2'],
          burritoFormat: { convertToMp3: false },
          burritoRevision: '1',
        },
        bookData: [
          { code: 'GEN', abbr: 'Gen', short: 'Genesis', long: 'Genesis' },
          { code: 'NUM', abbr: 'Nu', short: 'Numbers', long: 'Numbers' },
        ],
        projBookById: { 'proj-g2': '010' },
        orbit: {
          user: [user],
          organization: [team],
          organizationbible: [teamBible],
          bible: [bible],
          project: [generalProject],
          plan: [generalPlan],
          section: [generalSection],
          passage: [generalPassage],
        },
      }
    );

    const { result } = renderHook(() => useCreateBurrito(teamId));

    await act(async () => {
      await result.current.createBurrito();
    });

    const { useBurritoText } = require('./useBurritoText');
    const innerText = useBurritoText.mock.results[0].value as jest.Mock;
    const textCall = innerText.mock.calls.find(
      (c: any[]) => c[0]?.book === '010'
    );
    expect(textCall).toBeDefined();
    expect(textCall[0].sections.map((s: { id: string }) => s.id)).toContain(
      'sec-g2'
    );
  });

  it('creates team-level intellectual property from org speaker rights (TT-7187)', async () => {
    const {
      buildJamesSpeakerRightsFixture,
      buildSpeakerRightsMemoryStub,
      JAMES_SPEAKER_TEAM_ID,
    } = require('./jamesSpeakerRightsFixture');

    const ipc = makeIpc();
    const speakerFixture = buildJamesSpeakerRightsFixture();
    const memoryStub = buildSpeakerRightsMemoryStub(speakerFixture);
    const { user, team, bible, teamBible } = fixtures(JAMES_SPEAKER_TEAM_ID);

    const ipJson = JSON.stringify({
      data: speakerFixture.intellectualproperties.map(
        (ip: {
          id: string;
          attributes: { rightsHolder: string };
          relationships: unknown;
        }) => ({
          type: 'intellectualproperties',
          id: ip.id,
          attributes: { rightsHolder: ip.attributes.rightsHolder },
          relationships: ip.relationships,
        })
      ),
    });

    const { renderHook, act, useCreateBurrito } = loadCreateBurrito(
      ipc as never,
      {
        orgDefaults: {
          burritoBooks: ['JAS'],
          burritoContents: [BurritoType.IntellectualProperty],
          burritoWrapper: { wrapper: true },
          burritoProjects: [speakerFixture.project.id],
          burritoFormat: { convertToMp3: false },
          burritoRevision: '1',
        },
        bookData: [{ code: 'JAS', abbr: 'Jas', short: 'James', long: 'James' }],
        memoryStub,
        orbit: {
          user: [user],
          organization: [team],
          organizationbible: [teamBible],
          bible: [bible],
          project: [speakerFixture.project],
          plan: [],
          section: [],
          passage: [],
          intellectualproperty: speakerFixture.intellectualproperties,
          mediafile: speakerFixture.mediafiles,
        },
      }
    );

    const {
      useBurritoIntellectualProperty,
    } = require('./useBurritoIntellectualProperty');
    useBurritoIntellectualProperty.mockImplementation(() =>
      jest.fn(async ({ metadata, partPath, preLen }: any) => {
        const dataDir = `${partPath}/data`;
        await ipc.createFolder(dataDir);
        const ipPath = `${dataDir}/I_intellectualpropertys.json`;
        await ipc.write(ipPath, ipJson);
        for (const m of speakerFixture.mediafiles) {
          const dest = `${partPath}/${m.attributes.originalFile}`;
          await ipc.copyFile('/local/source', dest);
        }
        const relIp = ipPath.substring(preLen);
        const relMedia = `${partPath}/greg-rights.mp3`.substring(preLen);
        return {
          ...metadata,
          ingredients: {
            ...metadata.ingredients,
            [relIp]: {
              checksum: { md5: 'deadbeef' },
              mimeType: 'application/json',
              size: ipJson.length,
            },
            [relMedia]: {
              checksum: { md5: 'deadbeef' },
              mimeType: 'audio/mpeg',
              size: 1024,
            },
          },
          type: {
            ...metadata.type,
            flavorType: {
              ...metadata.type?.flavorType,
              name: 'scripture',
              flavor: { name: 'x-intellectualproperty' },
            },
          },
        };
      })
    );

    const { result } = renderHook(() =>
      useCreateBurrito(JAMES_SPEAKER_TEAM_ID)
    );

    await act(async () => {
      await result.current.createBurrito();
    });

    const folderPaths = ipc.createFolder.mock.calls.map((c) => String(c[0]));
    expect(
      folderPaths.some((p) => /intellectualproperty[/\\]59JAS/i.test(p))
    ).toBe(false);
    expect(
      folderPaths.some((p) => /intellectualproperty[/\\]JAS/i.test(p))
    ).toBe(false);

    const writePaths = ipc.write.mock.calls.map((c) => String(c[0]));
    expect(
      writePaths.some((p) =>
        p.includes('intellectualproperty/data/I_intellectualpropertys.json')
      )
    ).toBe(true);
    expect(ipc.copyFile.mock.calls.length).toBeGreaterThanOrEqual(5);

    const ipMetaWrite = ipc.write.mock.calls.find(
      (c) =>
        String(c[0]).includes('intellectualproperty/metadata.json') &&
        String(c[1]).includes('x-intellectualproperty')
    );
    expect(ipMetaWrite).toBeDefined();
    const metadata = JSON.parse(ipMetaWrite![1] as string);
    const ingredientKeys = Object.keys(metadata.ingredients ?? {});
    expect(
      ingredientKeys.some((k) => k.includes('I_intellectualpropertys.json'))
    ).toBe(true);
    expect(ingredientKeys.some((k) => k.includes('greg-rights'))).toBe(true);

    expect(result.current.result).toBe('success');
  });
});
