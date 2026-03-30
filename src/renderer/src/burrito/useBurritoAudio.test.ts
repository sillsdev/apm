import type { Burrito } from './data/types';
import type { BibleD } from '../model';
import type { SectionD } from '../model';

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
});
