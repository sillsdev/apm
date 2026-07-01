import type { Burrito } from './data/types';
import { BookSeq, type BibleD } from '../model';
import type { MediaFileD } from '../model';
import type { SectionD } from '../model';
import type { MainAPI } from '../model/main-api';
import {
  JAMES_BOOK,
  JAMES_BOOK_PATH,
  JAMES_SECTION_REMOTE_NUM,
  buildJamesPublishingFixture,
  destForMediaSrc,
  isBookRootPath,
  jamesBibleFixture,
  type JamesPublishingFixture,
} from './jamesPublishingFixture';

jest.mock('../utils/useCompression', () => ({
  ApmDim: 40,
}));

let orbitMediafiles: MediaFileD[] = [];
let orbitPassages: any[] = [];
let orbitSharedResources: any[] = [];
let orbitGraphics: any[] = [];
let orbitArtifactCategories: any[] = [];
let orbitSectionsAll: SectionD[] = [];

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn((model: string) => {
    switch (model) {
      case 'mediafile':
        return orbitMediafiles;
      case 'passage':
        return orbitPassages;
      case 'sharedresource':
        return orbitSharedResources;
      case 'graphic':
        return orbitGraphics;
      case 'artifactcategory':
        return orbitArtifactCategories;
      case 'section':
        return orbitSectionsAll;
      default:
        return [];
    }
  }),
}));

jest.mock('../crud/related', () => ({
  __esModule: true,
  default: (record: any, relName: string) =>
    record?.relationships?.[relName]?.data?.id,
}));

jest.mock('../utils/getMediaExt', () => ({
  __esModule: true,
  default: () => 'mp3',
}));

jest.mock('../utils/dataPath', () => ({
  __esModule: true,
  default: jest.fn(async (url: string, _type: unknown, local?: any) => {
    if (local && typeof local === 'object') local.localname = url;
    return url;
  }),
  PathType: { MEDIA: 'MEDIA' },
}));

jest.mock('../crud/useProjectDefaults', () => ({
  projDefSectionMap: 'sectionMap',
  useProjectDefaults: jest.fn(),
}));

jest.mock('../crud/useFetchUrlNow', () => ({
  useFetchUrlNow: () => jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({
    showMessage: jest.fn(),
  }),
}));

jest.mock('../components/PassageDetail/Internalization/useComputeRef', () => ({
  useComputeRef: () => ({
    computeSectionRef: jest.fn((id: string) => `1:1:${id}`),
    computeMovementRef: jest.fn(() => 'mov'),
  }),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'memory') {
      return [
        {
          keyMap: {},
          cache: { query: jest.fn(() => []) },
        },
        jest.fn(),
      ];
    }
    return [undefined, jest.fn()];
  }),
}));

jest.mock('../crud', () => ({
  findRecord: jest.fn(),
  remoteId: jest.fn(() => 'remote-1'),
  remoteIdGuid: jest.fn(() => 'guid-1'),
  remoteIdNum: jest.fn(() => 1),
  useNotes: () => ({
    curNoteRef: jest.fn(() => 'Note 1:1'),
  }),
}));

function burritoFixture(): Burrito {
  return {
    format: 'burrito',
    meta: {
      version: '0.1',
      category: 'scripture',
      generator: {
        softwareName: 'apm',
        softwareVersion: '1',
        userName: 'tester',
      },
      defaultLocale: 'en',
      dateCreated: '2020-01-01',
      comments: [],
    },
    ingredients: {},
    type: {
      flavorType: {
        name: 'before-nav',
        flavor: { name: 'nav' },
        currentScope: {},
      },
    },
  };
}

const bibleFixture = {
  id: 'bib-1',
  type: 'bible',
  attributes: {
    bibleId: 'TST',
    bibleName: 'Test',
    iso: 'eng',
  },
} as BibleD;

function makeIpc() {
  return {
    write: jest.fn().mockResolvedValue(undefined),
    md5File: jest.fn().mockResolvedValue('nav-md5'),
    exists: jest.fn().mockResolvedValue(true),
    copyFile: jest.fn().mockResolvedValue(undefined),
    downloadFile: jest.fn().mockResolvedValue(undefined),
    writeBuffer: jest.fn().mockResolvedValue(undefined),
    createFolder: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue(JSON.stringify({ size: 100 })),
  };
}

/**
 * `useBurritoNavigation` reads `window.api` at module load. `jest.isolateModules`
 * would give the hook a second React copy and break hooks; `resetModules` +
 * dynamic `import()` before the hook keeps a single React for `renderHook`.
 */
async function loadNavigationForApi(api: MainAPI | undefined) {
  jest.resetModules();
  (window as unknown as { api?: typeof api }).api = api;
  const { renderHook, act } = await import('@testing-library/react/pure');
  const { useProjectDefaults } = await import('../crud/useProjectDefaults');
  (useProjectDefaults as jest.Mock).mockReturnValue({
    getProjectDefault: jest.fn(),
    setProjectDefault: jest.fn(),
    canSetProjectDefault: true,
    getLocalDefault: jest.fn(),
    setLocalDefault: jest.fn(),
  });
  const { useBurritoNavigation } = await import('./useBurritoNavigation');
  return { renderHook, act, useBurritoNavigation };
}

async function loadNavigationForJames(
  api: MainAPI | undefined,
  fixture: JamesPublishingFixture
) {
  jest.resetModules();
  (window as unknown as { api?: typeof api }).api = api;

  jest.doMock('../components/PassageDetail/Internalization/useComputeRef', () =>
    jest.requireActual(
      '../components/PassageDetail/Internalization/useComputeRef'
    )
  );

  const { renderHook, act } = await import('@testing-library/react/pure');
  const { useProjectDefaults, projDefSectionMap } =
    await import('../crud/useProjectDefaults');
  const { findRecord, remoteId, remoteIdGuid, remoteIdNum } =
    await import('../crud');
  const { useGlobal } = await import('../context/useGlobal');
  const { useOrbitData } = await import('../hoc/useOrbitData');

  (useProjectDefaults as jest.Mock).mockReturnValue({
    getProjectDefault: jest.fn((key: string) =>
      key === projDefSectionMap ? fixture.sectionMap : undefined
    ),
    setProjectDefault: jest.fn(),
    canSetProjectDefault: true,
    getLocalDefault: jest.fn(),
    setLocalDefault: jest.fn(),
  });

  const planRec = {
    id: fixture.planId,
    type: 'plan',
    relationships: { project: { data: { id: fixture.projectId } } },
  };
  const projectRec = { id: fixture.projectId, type: 'project' };

  (findRecord as jest.Mock).mockImplementation(
    (_memory: unknown, type: string, id: string) => {
      if (type === 'plan') return planRec;
      if (type === 'project') return projectRec;
      if (type === 'section') {
        return fixture.sectionsAll.find((s) => s.id === id);
      }
      return undefined;
    }
  );

  (remoteId as jest.Mock).mockImplementation(
    (_type: string, localId: string) => localId
  );
  (remoteIdNum as jest.Mock).mockImplementation(
    (type: string, localId: string) => {
      if (type === 'section') {
        return JAMES_SECTION_REMOTE_NUM[localId] ?? 0;
      }
      return 1;
    }
  );
  (remoteIdGuid as jest.Mock).mockImplementation(
    (type: string, numStr: string) => {
      if (type === 'section') {
        const num = parseInt(numStr, 10);
        const entry = Object.entries(JAMES_SECTION_REMOTE_NUM).find(
          ([, v]) => v === num
        );
        return entry?.[0];
      }
      return undefined;
    }
  );

  (useGlobal as jest.Mock).mockImplementation((key: string) => {
    if (key === 'memory') {
      return [{ keyMap: {} }, jest.fn()];
    }
    return [undefined, jest.fn()];
  });

  (useOrbitData as jest.Mock).mockImplementation((model: string) => {
    switch (model) {
      case 'mediafile':
        return fixture.mediafiles;
      case 'passage':
        return fixture.passages;
      case 'sharedresource':
        return fixture.sharedResources;
      case 'graphic':
        return fixture.graphics;
      case 'artifactcategory':
        return [];
      case 'section':
        return fixture.sectionsAll;
      default:
        return [];
    }
  });

  const { useBurritoNavigation } = await import('./useBurritoNavigation');
  return { renderHook, act, useBurritoNavigation };
}

async function runJamesNavigationExport(
  ipc: ReturnType<typeof makeIpc>,
  fixture: JamesPublishingFixture
) {
  const { renderHook, act, useBurritoNavigation } =
    await loadNavigationForJames(ipc as never, fixture);
  const { result } = renderHook(() => useBurritoNavigation('team-1'));
  const metadata = burritoFixture();
  await act(async () => {
    await result.current({
      metadata,
      bible: jamesBibleFixture,
      book: JAMES_BOOK,
      bookPath: JAMES_BOOK_PATH,
      preLen: 0,
      sections: fixture.sections,
    });
  });
  return metadata;
}

describe('useBurritoNavigation', () => {
  const teamId = 'team-1';

  beforeEach(() => {
    jest.clearAllMocks();
    orbitMediafiles = [];
    orbitPassages = [];
    orbitSharedResources = [];
    orbitGraphics = [];
    orbitArtifactCategories = [];
    orbitSectionsAll = [];
  });

  it('sets x-nav flavor, writes navigation.json, graphics folder, and merges manifest ingredient', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoNavigation } =
      await loadNavigationForApi(ipc as never);

    const { result } = renderHook(() => useBurritoNavigation(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        bible: bibleFixture,
        book: 'GEN',
        bookPath: '/burrito/GEN',
        preLen: 0,
        sections: [] as SectionD[],
      });
    });

    expect(metadata.type?.flavorType?.name).toBe('scripture');
    expect(metadata.type?.flavorType?.flavor?.name).toBe('x-nav');
    expect(
      ipc.createFolder.mock.calls.some((c) => c[0].includes('graphics'))
    ).toBe(false);
    expect(ipc.write).toHaveBeenCalled();
    const writePaths = (ipc.write as jest.Mock).mock.calls.map((c) => c[0]);
    expect(writePaths.some((p: string) => p.includes('navigation.json'))).toBe(
      true
    );
    expect(ipc.md5File).toHaveBeenCalled();

    const navPath = writePaths.find((p: string) =>
      p.includes('navigation.json')
    )!;
    expect(metadata.ingredients[navPath]).toMatchObject({
      checksum: { md5: 'nav-md5' },
      mimeType: 'application/json',
      scope: { GEN: [] },
    });
    const written = (ipc.write as jest.Mock).mock.calls.find((c) =>
      (c[0] as string).includes('navigation.json')
    )?.[1] as string;
    expect(written).toContain('"titleMedia"');
    expect(written).toContain('"graphics"');
  });

  it('does not throw when window.api is missing (empty sections)', async () => {
    const { renderHook, act, useBurritoNavigation } =
      await loadNavigationForApi(undefined);

    const { result } = renderHook(() => useBurritoNavigation(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        bible: bibleFixture,
        book: 'GEN',
        bookPath: '/burrito/GEN',
        preLen: 0,
        sections: [] as SectionD[],
      });
    });

    expect(metadata.type?.flavorType?.name).toBe('scripture');
    expect(metadata.type?.flavorType?.flavor?.name).toBe('x-nav');
    const manifestIngredient = Object.values(metadata.ingredients).find(
      (i) => i.mimeType === 'application/json' && !i.role
    );
    expect(manifestIngredient).toBeDefined();
    expect(manifestIngredient!.checksum.md5).toBeUndefined();
  });

  it('includes special book sections (BookSeq/AltBkSeq encded in the sequence number for each plan), even with no passages', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoNavigation } =
      await loadNavigationForApi(ipc as never);

    // normal section list passed into the hook: determines planIdsForBook
    const normalSection = {
      id: 'sec-normal',
      type: 'section',
      attributes: { sequencenum: 1, state: '' },
      relationships: { plan: { data: { id: 'plan-1' } } },
    } as unknown as SectionD;

    // special negative "book section" stored outside the normal list
    const specialBookSection = {
      id: 'sec-book',
      type: 'section',
      attributes: {
        sequencenum: BookSeq,
        state: 'BOOK GEN',
      },
      relationships: {
        plan: { data: { id: 'plan-1' } },
        titleMediafile: { data: { id: 'med-1' } },
      },
    } as unknown as SectionD;

    orbitSectionsAll = [normalSection, specialBookSection];
    orbitMediafiles = [
      {
        id: 'med-1',
        type: 'mediafile',
        attributes: {
          audioUrl: '/tmp/book-title.mp3',
          originalFile: 'book-title.mp3',
          contentType: 'audio/mpeg',
        },
      } as unknown as MediaFileD,
    ];

    const { result } = renderHook(() => useBurritoNavigation(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        bible: bibleFixture,
        book: 'GEN',
        bookPath: '/burrito/GEN',
        preLen: 0,
        sections: [normalSection],
      });
    });

    const written = (ipc.write as jest.Mock).mock.calls.find((c) =>
      (c[0] as string).includes('navigation.json')
    )?.[1] as string;
    const manifest = JSON.parse(written);
    expect(manifest.titleMedia).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceType: 'section',
          remoteId: 'remote-1',
        }),
      ])
    );
  });
});

describe('James publishing hierarchy — navigation folder placement (TT-7189, TT-7190)', () => {
  let ipc: ReturnType<typeof makeIpc>;
  let fixture: JamesPublishingFixture;

  beforeEach(async () => {
    fixture = buildJamesPublishingFixture();
    ipc = makeIpc();
    await runJamesNavigationExport(ipc, fixture);
  });

  it('places Movement 2 title in chapter 014 folder', () => {
    const dest = destForMediaSrc(ipc, 'm2-title.mp3');
    expect(dest).toBeDefined();
    expect(dest).toContain('/014/');
  });

  it('places Movement 1 title in chapter 001 folder', () => {
    const dest = destForMediaSrc(ipc, 'm1-title.mp3');
    expect(dest).toBeDefined();
    expect(dest).toContain('/001/');
  });

  it('places Section 2 title in chapter 014 folder', () => {
    const dest = destForMediaSrc(ipc, 's2-title.mp3');
    expect(dest).toBeDefined();
    expect(dest).toContain('/014/');
  });

  it('places Movement 2 graphic in chapter 014 folder, not chapter 001', () => {
    const dest = destForMediaSrc(ipc, 'm2-graphic.png');
    expect(dest).toBeDefined();
    expect(dest).toContain('/014/');
    expect(dest).not.toContain('/001/');
  });

  it('places Book title at book root, not inside a chapter folder', () => {
    const dest = destForMediaSrc(ipc, 'book-title.mp3');
    expect(dest).toBeDefined();
    expect(isBookRootPath(dest!, JAMES_BOOK_PATH)).toBe(true);
  });

  it('places Alt Book title at book root, not inside a chapter folder', () => {
    const dest = destForMediaSrc(ipc, 'alt-title.mp3');
    expect(dest).toBeDefined();
    expect(isBookRootPath(dest!, JAMES_BOOK_PATH)).toBe(true);
  });

  it('exports Book and Alt Book section graphics to book root', () => {
    const bookGraphic = destForMediaSrc(ipc, 'book-graphic.png');
    const altGraphic = destForMediaSrc(ipc, 'alt-graphic.png');
    expect(bookGraphic).toBeDefined();
    expect(altGraphic).toBeDefined();
    expect(isBookRootPath(bookGraphic!, JAMES_BOOK_PATH)).toBe(true);
    expect(isBookRootPath(altGraphic!, JAMES_BOOK_PATH)).toBe(true);
  });

  it('exports CHNUM row title recordings into the matching chapter folder', () => {
    const ch1 = destForMediaSrc(ipc, 'chnum-1-title.ogg');
    const ch14 = destForMediaSrc(ipc, 'chnum-14-title.ogg');
    expect(ch1).toBeDefined();
    expect(ch14).toBeDefined();
    expect(ch1).toContain('/001/');
    expect(ch14).toContain('/014/');
  });

  it('does not create an empty book-level graphics folder without category assets', () => {
    const folderPaths = (ipc.createFolder as jest.Mock).mock.calls.map(
      (c) => c[0] as string
    );
    expect(
      folderPaths.some((p) => p.replace(/\\/g, '/').endsWith('/graphics'))
    ).toBe(false);
  });
});
