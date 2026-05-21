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
  useArtifactType: jest.fn(() => ({
    slugFromId: jest.fn(() => 'vernacular'),
    VernacularTag: null,
  })),
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
    /* eslint-disable @typescript-eslint/no-require-imports -- resetModules pattern: re-require mocks from fresh module registry */
    const { useOrbitData } = require('../hoc/useOrbitData');
    /* eslint-enable @typescript-eslint/no-require-imports */
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
      ([, ing]) => ing?.properties?.['x-apmId'] === '35928'
    );
    expect(audioIngredient).toBeDefined();
    expect(audioIngredient![0].toLowerCase().endsWith('.mp3')).toBe(true);
    expect(audioIngredient![1].mimeType).toBe('audio/mpeg');
  });

  it('exports intellectual property media attached to a plan without a passage', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(ipc);

    /* eslint-disable @typescript-eslint/no-require-imports -- resetModules pattern */
    const { useOrbitData } = require('../hoc/useOrbitData');
    const { useArtifactType } = require('../crud/useArtifactType');
    const { ArtifactTypeSlug } = require('../crud/artifactTypeSlug');
    /* eslint-enable @typescript-eslint/no-require-imports */

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn((id: string | null | undefined) =>
        id === 'at-ip' ? 'intellectualproperty' : 'vernacular'
      ),
      VernacularTag: null,
    }));

    const orbitMedia = [
      {
        id: 'ip-media-1',
        type: 'mediafile',
        keys: { remoteId: 'remote-ip-1' },
        attributes: {
          audioUrl: 'https://example.test/ip-release.mp3',
          originalFile: 'rights-statement.mp3',
          contentType: 'audio/mpeg',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: null },
          artifactType: { data: { type: 'artifacttype', id: 'at-ip' } },
        },
      },
    ];

    useOrbitData.mockImplementation((type: string) => {
      if (type === 'mediafile') return orbitMedia;
      if (type === 'passage') return [];
      if (type === 'sectionresource') return [];
      if (type === 'sharedresource') return [];
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
        artifactTypeFilter: [ArtifactTypeSlug.IntellectualProperty],
      });
    });

    expect(ipc.copyFile).toHaveBeenCalled();
    const ipIngredient = Object.entries(metadata.ingredients).find(
      ([, ing]) => ing?.properties?.['x-apmId'] === 'remote-ip-1'
    );
    expect(ipIngredient).toBeDefined();
    expect(ipIngredient![0]).toContain('rights-statement');
    expect(ipIngredient![1].mimeType).toBe('audio/mpeg');
    expect(ipIngredient![1].scope).toEqual({ GEN: [] });
    expect(ipIngredient![1].scope?.GEN).not.toContain('');

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'vernacular'),
      VernacularTag: null,
    }));
  });

  it('section resources with same version and extension use distinct paths per sequenceNum', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(ipc);

    /* eslint-disable @typescript-eslint/no-require-imports -- resetModules pattern */
    const { useOrbitData } = require('../hoc/useOrbitData');
    const { useArtifactType } = require('../crud/useArtifactType');
    const { ArtifactTypeSlug } = require('../crud/artifactTypeSlug');
    /* eslint-enable @typescript-eslint/no-require-imports */

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'resource'),
      VernacularTag: null,
    }));

    const orbitMedia = [
      {
        id: 'm-a',
        type: 'mediafile',
        keys: { remoteId: 'remote-a' },
        attributes: {
          audioUrl: 'https://example.test/a.mp3',
          originalFile: 'a.mp3',
          contentType: 'audio/mpeg',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: null },
          artifactType: { data: { type: 'artifacttype', id: 'at-r' } },
        },
      },
      {
        id: 'm-b',
        type: 'mediafile',
        keys: { remoteId: 'remote-b' },
        attributes: {
          audioUrl: 'https://example.test/b.mp3',
          originalFile: 'b.mp3',
          contentType: 'audio/mpeg',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: null },
          artifactType: { data: { type: 'artifacttype', id: 'at-r' } },
        },
      },
    ];

    const orbitSectionResources = [
      {
        id: 'sr-2',
        type: 'sectionresource',
        attributes: {
          sequenceNum: 2,
          description: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          section: { data: { type: 'section', id: 's1' } },
          mediafile: { data: { type: 'mediafile', id: 'm-b' } },
        },
      },
      {
        id: 'sr-1',
        type: 'sectionresource',
        attributes: {
          sequenceNum: 1,
          description: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          section: { data: { type: 'section', id: 's1' } },
          mediafile: { data: { type: 'mediafile', id: 'm-a' } },
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

    useOrbitData.mockImplementation((type: string) => {
      if (type === 'mediafile') return orbitMedia;
      if (type === 'passage') return orbitPassages;
      if (type === 'sectionresource') return orbitSectionResources;
      if (type === 'sharedresource') return [];
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
        passageTypeFilter: null,
        flavorTypeName: 'x-resources',
        artifactTypeFilter: [ArtifactTypeSlug.Resource],
      });
    });

    const destPaths = (ipc.copyFile as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[1] as string
    );
    const sectionDestPaths = destPaths.filter((p) => p.includes('-section-'));
    expect(sectionDestPaths).toHaveLength(2);
    expect(sectionDestPaths.some((p) => p.includes('r1v1.'))).toBe(true);
    expect(sectionDestPaths.some((p) => p.includes('r2v1.'))).toBe(true);
    expect(sectionDestPaths[0]).not.toBe(sectionDestPaths[1]);

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'vernacular'),
      VernacularTag: null,
    }));
  });

  it('skips plan-root copy for media already exported as section resources', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(ipc);

    /* eslint-disable @typescript-eslint/no-require-imports -- resetModules pattern */
    const { useOrbitData } = require('../hoc/useOrbitData');
    const { useArtifactType } = require('../crud/useArtifactType');
    const { ArtifactTypeSlug } = require('../crud/artifactTypeSlug');
    /* eslint-enable @typescript-eslint/no-require-imports */

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'resource'),
      VernacularTag: null,
    }));

    const orbitMedia = [
      {
        id: 'm-section',
        type: 'mediafile',
        keys: { remoteId: 'remote-s' },
        attributes: {
          audioUrl: 'https://example.test/section.mp3',
          originalFile: 'section.mp3',
          contentType: 'audio/mpeg',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: null },
          artifactType: { data: { type: 'artifacttype', id: 'at-r' } },
        },
      },
      {
        id: 'm-plan-only',
        type: 'mediafile',
        keys: { remoteId: 'remote-p' },
        attributes: {
          audioUrl: 'https://example.test/plan-only.mp3',
          originalFile: 'plan-only.mp3',
          contentType: 'audio/mpeg',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: null },
          artifactType: { data: { type: 'artifacttype', id: 'at-r' } },
        },
      },
    ];

    const orbitSectionResources = [
      {
        id: 'sr-1',
        type: 'sectionresource',
        attributes: {
          sequenceNum: 1,
          description: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          section: { data: { type: 'section', id: 's1' } },
          mediafile: { data: { type: 'mediafile', id: 'm-section' } },
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

    useOrbitData.mockImplementation((type: string) => {
      if (type === 'mediafile') return orbitMedia;
      if (type === 'passage') return orbitPassages;
      if (type === 'sectionresource') return orbitSectionResources;
      if (type === 'sharedresource') return [];
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
        passageTypeFilter: null,
        flavorTypeName: 'x-resources',
        artifactTypeFilter: [ArtifactTypeSlug.Resource],
      });
    });

    const copyDests = (ipc.copyFile as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[1] as string
    );
    const sectionCopies = copyDests.filter((p) => p.includes('-section-'));
    const planRootCopies = copyDests.filter(
      (p) => p.includes('/burrito/GEN/') && !p.includes('/001/')
    );
    expect(sectionCopies).toHaveLength(1);
    expect(sectionCopies[0]).toMatch(/-section-/);
    expect(planRootCopies).toHaveLength(1);
    expect(planRootCopies[0]).toContain('plan-only');

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'vernacular'),
      VernacularTag: null,
    }));
  });

  it('writes inline text/plain to burrito without audioUrl', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoAudio } = loadAudioForApi(ipc);

    /* eslint-disable @typescript-eslint/no-require-imports */
    const { useOrbitData } = require('../hoc/useOrbitData');
    const { useArtifactType } = require('../crud/useArtifactType');
    const { ArtifactTypeSlug } = require('../crud/artifactTypeSlug');
    /* eslint-enable @typescript-eslint/no-require-imports */

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'resource'),
      VernacularTag: null,
    }));

    const longBody = `${'x'.repeat(500)}`;
    const orbitMedia = [
      {
        id: 'm-text',
        type: 'mediafile',
        keys: { remoteId: 'remote-t' },
        attributes: {
          audioUrl: '',
          originalFile: longBody,
          contentType: 'text/plain',
          versionNumber: 1,
          segments: '{}',
        },
        relationships: {
          plan: { data: { type: 'plan', id: 'plan1' } },
          passage: { data: null },
          artifactType: { data: { type: 'artifacttype', id: 'at-r' } },
        },
      },
    ];

    const orbitSectionResources = [
      {
        id: 'sr-t',
        type: 'sectionresource',
        attributes: {
          sequenceNum: 1,
          description: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          section: { data: { type: 'section', id: 's1' } },
          mediafile: { data: { type: 'mediafile', id: 'm-text' } },
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

    useOrbitData.mockImplementation((type: string) => {
      if (type === 'mediafile') return orbitMedia;
      if (type === 'passage') return orbitPassages;
      if (type === 'sectionresource') return orbitSectionResources;
      if (type === 'sharedresource') return [];
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
        passageTypeFilter: null,
        flavorTypeName: 'x-resources',
        artifactTypeFilter: [ArtifactTypeSlug.Resource],
      });
    });

    expect(ipc.copyFile).not.toHaveBeenCalled();
    expect(ipc.write).toHaveBeenCalled();
    const textWrite = (ipc.write as jest.Mock).mock.calls.find(
      (c: unknown[]) =>
        typeof c[1] === 'string' && (c[1] as string) === longBody
    );
    expect(textWrite).toBeDefined();
    expect((textWrite![0] as string).endsWith('.txt')).toBe(true);

    useArtifactType.mockImplementation(() => ({
      slugFromId: jest.fn(() => 'vernacular'),
      VernacularTag: null,
    }));
  });
});
