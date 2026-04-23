import type { Burrito } from './data/types';
import type { BibleD } from '../model';
import type { SectionD } from '../model';

jest.mock('../crud/related', () => ({
  __esModule: true,
  default: (rec: any, rel: string) => {
    const r = rec?.relationships?.[rel];
    if (!r) return null;
    const data = r?.data;
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object' && 'id' in data) return data.id;
    return data ?? null;
  },
}));

jest.mock('../utils/dataPath', () => ({
  __esModule: true,
  PathType: { MEDIA: 'MEDIA' },
  default: jest.fn(async (_url: string, _pathType: unknown, local: any) => {
    local.localname = '/local/source.ogg';
    return local.localname;
  }),
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => []),
}));

jest.mock('../crud/useArtifactType', () => ({
  useArtifactType: () => ({
    slugFromId: jest.fn(() => 'vernacular'),
  }),
  VernacularTag: null,
}));

jest.mock('../crud/useOrgDefaults', () => ({
  useOrgDefaults: jest.fn(),
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
    computeSectionRef: jest.fn(() => 'GEN 1:1'),
  }),
}));

function defaultOrgDefaults() {
  return {
    getOrgDefault: jest.fn((key: string) =>
      key === 'burritoVersions' ? '1' : undefined
    ),
    setOrgDefault: jest.fn(),
    getDefault: jest.fn(),
    setDefault: jest.fn(),
    canSetOrgDefault: true,
  };
}

/**
 * `useBurritoAudio` reads `window.api` at module load. `jest.isolateModules`
 * would give the hook a second React copy and break hooks; `resetModules` +
 * requiring RTL before the hook keeps a single React for `renderHook`.
 */
function loadAudioForApi(api: unknown) {
  /* eslint-disable @typescript-eslint/no-require-imports -- resetModules + RTL pure + hook in one registry cycle */
  jest.resetModules();
  (window as unknown as { api?: unknown }).api = api;
  const { renderHook, act } = require('@testing-library/react/pure');
  const { useOrgDefaults } = require('../crud/useOrgDefaults');
  useOrgDefaults.mockReturnValue(defaultOrgDefaults());
  const { useBurritoAudio } = require('./useBurritoAudio');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { renderHook, act, useBurritoAudio };
}

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
        name: 'originalFlavorType',
        flavor: { name: 'audio' },
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
    md5File: jest.fn().mockResolvedValue('deadbeef'),
    exists: jest.fn().mockResolvedValue(true),
    copyFile: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    convertToMp3: jest.fn(),
    createFolder: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue(JSON.stringify({ size: 99 })),
  };
}

describe('useBurritoAudio', () => {
  const teamId = 'team-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies flavorTypeName, writes alignment.json, and merges alignment ingredient', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(ipc);

    const { result } = renderHook(() => useBurritoAudio(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        bible: bibleFixture,
        book: 'GEN',
        bookPath: '/burrito/GEN',
        preLen: 0,
        sections: [] as SectionD[],
        flavorTypeName: 'x-notes',
      });
    });

    expect(metadata.type?.flavorType?.name).toBe('x-notes');
    expect(ipc.write).toHaveBeenCalled();
    const writePaths = (ipc.write as jest.Mock).mock.calls.map((c) => c[0]);
    expect(writePaths.some((p: string) => p.includes('alignment.json'))).toBe(
      true
    );
    expect(ipc.md5File).toHaveBeenCalled();

    const alignKey = writePaths.find((p: string) =>
      p.includes('alignment.json')
    )!;
    expect(metadata.ingredients[alignKey]).toMatchObject({
      checksum: { md5: 'deadbeef' },
      mimeType: 'application/json',
      role: 'timing',
    });
    expect(metadata.type?.flavorType?.currentScope).toMatchObject({
      GEN: [],
    });
  });

  it('does not throw when window.api is missing (empty sections)', async () => {
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(undefined);

    const { result } = renderHook(() => useBurritoAudio(teamId));
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

    const alignIngredient = Object.values(metadata.ingredients).find(
      (ing) => ing.role === 'timing'
    );
    expect(alignIngredient).toBeDefined();
    expect(alignIngredient!.checksum.md5).toBeUndefined();
  });

  it('uses audio/mpeg when converting .ogg to .mp3', async () => {
    const ipc = makeIpc();
    ipc.convertToMp3 = jest.fn().mockResolvedValue(undefined);
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(ipc);

    // Configure orbit data for this test case.
    const { useOrbitData } = require('../hoc/useOrbitData');
    // Use stable references to avoid re-render churn in hooks under test.
    const orbitMedia = [
      {
        id: 'm1',
        type: 'mediafile',
        keys: { remoteId: '35928' },
        attributes: {
          audioUrl: 'https://example.test/audio',
          originalFile: 'ENGSEB2-RUT-v1.ogg',
          contentType: 'audio/ogg;codecs=opus',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: { type: 'passage', id: 'p1' } },
          artifactType: { data: null },
        },
      },
    ];
    const orbitPassages = [
      {
        id: 'p1',
        type: 'passage',
        attributes: {
          book: 'GEN',
          reference: 'GEN 1:1',
          startChapter: 1,
          sequencenum: 1,
        },
        relationships: {
          section: { data: { type: 'section', id: 's1' } },
          sharedResource: { data: null },
        },
      },
    ];
    const orbitSectionResources: unknown[] = [];
    const orbitSharedResources: unknown[] = [];

    useOrbitData.mockImplementation((type: string) => {
      if (type === 'mediafile') return orbitMedia;
      if (type === 'passage') return orbitPassages;
      if (type === 'sectionresource') return orbitSectionResources;
      if (type === 'sharedresource') return orbitSharedResources;
      return [];
    });

    const metadata = burritoFixture();
    const { result } = renderHook(() => useBurritoAudio(teamId));

    await act(async () => {
      await result.current({
        metadata,
        bible: bibleFixture,
        book: 'GEN',
        bookPath: '/burrito/GEN',
        preLen: 0,
        sections: [
          {
            id: 's1',
            type: 'section',
            relationships: {
              plan: { data: { type: 'plan', id: 'plan1' } },
            },
          } as SectionD,
        ],
        convertToMp3: true,
      });
    });

    const audioIngredient = Object.entries(metadata.ingredients).find(
      ([, ing]) => ing?.properties?.apmId === '35928'
    );
    expect(audioIngredient).toBeDefined();
    expect(audioIngredient![0].toLowerCase().endsWith('.mp3')).toBe(true);
    expect(audioIngredient![1].mimeType).toBe('audio/mpeg');
  });
});
