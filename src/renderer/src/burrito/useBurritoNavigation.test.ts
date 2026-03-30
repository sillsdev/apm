import type { Burrito } from './data/types';
import type { BibleD } from '../model';
import type { SectionD } from '../model';

jest.mock('../utils/useCompression', () => ({
  ApmDim: 40,
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => []),
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
 * requiring RTL before the hook keeps a single React for `renderHook`.
 */
function loadNavigationForApi(api: typeof window.api) {
  jest.resetModules();
  (window as unknown as { api?: typeof api }).api = api;
  // `react` entry registers Jest hooks; `pure` does not (invalid inside `it`).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderHook, act } = require('@testing-library/react/pure');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useProjectDefaults } = require('../crud/useProjectDefaults');
  useProjectDefaults.mockReturnValue({
    getProjectDefault: jest.fn(),
    setProjectDefault: jest.fn(),
    canSetProjectDefault: true,
    getLocalDefault: jest.fn(),
    setLocalDefault: jest.fn(),
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useBurritoNavigation } = require('./useBurritoNavigation');
  return { renderHook, act, useBurritoNavigation };
}

describe('useBurritoNavigation', () => {
  const teamId = 'team-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets x-nav flavor, writes navigation.json, graphics folder, and merges manifest ingredient', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoNavigation } = loadNavigationForApi(
      ipc as never
    );

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

    expect(metadata.type?.flavorType?.name).toBe('x-nav');
    expect(ipc.createFolder).toHaveBeenCalled();
    expect(ipc.createFolder.mock.calls.some((c) => c[0].includes('graphics'))).toBe(
      true
    );
    expect(ipc.write).toHaveBeenCalled();
    const writePaths = (ipc.write as jest.Mock).mock.calls.map((c) => c[0]);
    expect(writePaths.some((p: string) => p.includes('navigation.json'))).toBe(
      true
    );
    expect(ipc.md5File).toHaveBeenCalled();

    const navPath = writePaths.find((p: string) => p.includes('navigation.json'))!;
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
      loadNavigationForApi(undefined);

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

    expect(metadata.type?.flavorType?.name).toBe('x-nav');
    const manifestIngredient = Object.values(metadata.ingredients).find(
      (i) => i.mimeType === 'application/json' && !i.role
    );
    expect(manifestIngredient).toBeDefined();
    expect(manifestIngredient!.checksum.md5).toBeUndefined();
  });
});
