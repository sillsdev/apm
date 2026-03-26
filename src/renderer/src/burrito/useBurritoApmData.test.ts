import type Memory from '@orbit/memory';
import type { Burrito } from './data/types';
import type { ProjectD } from '../model';
jest.mock('../store/importexport/projectDataExport', () => ({
  getProjectDataFiles: jest.fn(),
}));

jest.mock('../crud/useProjectDefaults', () => ({
  projDefBook: 'book',
  useProjectDefaults: jest.fn(),
}));

jest.mock('../utils', () => ({
  useNum2BookCode: () => () => 'GEN',
}));

function defaultProjectDefaults() {
  return {
    getProjectDefault: jest.fn(() => 'B01'),
    setProjectDefault: jest.fn(),
    canSetProjectDefault: true,
    getLocalDefault: jest.fn(),
    setLocalDefault: jest.fn(),
  };
}

/**
 * `useBurritoApmData` reads `window.api` at module load. `jest.isolateModules`
 * would give the hook a second React copy and break hooks; `resetModules` +
 * requiring RTL before the hook keeps a single React for `renderHook`.
 */
function loadApmDataForApi(
  api: unknown,
  projectDefaults = defaultProjectDefaults()
) {
  /* eslint-disable @typescript-eslint/no-require-imports -- resetModules + RTL pure + hook in one registry cycle */
  jest.resetModules();
  (window as unknown as { api?: unknown }).api = api;
  // `react` entry registers Jest hooks; `pure` does not (invalid inside `it`).
  const { renderHook, act } = require('@testing-library/react/pure');
  // After resetModules, re-bind mock implementations used by the re-required hook.
  const {
    getProjectDataFiles,
  } = require('../store/importexport/projectDataExport');
  getProjectDataFiles.mockResolvedValue({
    'data/test.json': 'hello',
  });
  const { useProjectDefaults } = require('../crud/useProjectDefaults');
  useProjectDefaults.mockReturnValue(projectDefaults);
  const { useBurritoApmData } = require('./useBurritoApmData');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { renderHook, act, useBurritoApmData, getProjectDataFiles };
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
    ingredients: {
      existing: { checksum: { md5: '0' }, mimeType: 'text/plain' },
    },
    type: {
      flavorType: {
        name: 'typeName',
        flavor: { name: 'flavorName' },
        currentScope: {},
      },
    },
  };
}

const projectFixture = {
  id: 'proj-1',
  type: 'project',
  attributes: {
    name: 'P',
    defaultParams: '{}',
  },
} as ProjectD;

describe('useBurritoApmData', () => {
  const memoryStub = {} as Memory;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports project data files to disk, merges ingredients, and sets x-apmdata flavor', async () => {
    const createFolder = jest.fn().mockResolvedValue(undefined);
    const write = jest.fn().mockResolvedValue(undefined);
    const md5File = jest.fn().mockResolvedValue('deadbeef');

    const { renderHook, act, useBurritoApmData, getProjectDataFiles } =
      loadApmDataForApi({
        createFolder,
        write,
        md5File,
      });

    const { result } = renderHook(() => useBurritoApmData(memoryStub));

    let updated: Burrito;
    await act(async () => {
      updated = await result.current({
        metadata: burritoFixture(),
        project: projectFixture,
        projectPath: '/myproj',
        preLen: 0,
      });
    });

    expect(getProjectDataFiles).toHaveBeenCalledWith(
      memoryStub,
      projectFixture
    );
    expect(createFolder).toHaveBeenCalled();
    expect(write).toHaveBeenCalled();
    expect(md5File).toHaveBeenCalled();

    expect(updated!.ingredients.existing).toBeDefined();
    const writtenRelPath = '/myproj/data/test.json';
    expect(updated!.ingredients[writtenRelPath]).toMatchObject({
      checksum: { md5: 'deadbeef' },
      mimeType: 'application/json',
      size: 'hello'.length,
      scope: { GEN: [] },
    });

    expect(updated!.type!.flavorType!.name).toBe('x-apmdata');
    expect(updated!.type!.flavorType!.flavor.name).toBe('x-apmdata');
    expect(updated!.type!.flavorType!.currentScope).toMatchObject({
      GEN: [],
    });
  });

  it('omits book scope when project default book code is not A##/B##', async () => {
    const { renderHook, act, useBurritoApmData } = loadApmDataForApi(
      undefined,
      {
        ...defaultProjectDefaults(),
        getProjectDefault: jest.fn(() => 'not-a-book-code'),
      }
    );

    const { result } = renderHook(() => useBurritoApmData(memoryStub));

    let updated: Burrito;
    await act(async () => {
      updated = await result.current({
        metadata: burritoFixture(),
        project: projectFixture,
        projectPath: '/myproj',
        preLen: 0,
      });
    });

    const ing = updated!.ingredients['/myproj/data/test.json'];
    expect(ing).toBeDefined();
    expect(ing.scope).toBeUndefined();
    expect(updated!.type!.flavorType!.currentScope).toEqual({});
  });

  it('does not throw when window.api is missing', async () => {
    const { renderHook, act, useBurritoApmData } = loadApmDataForApi(undefined);

    const { result } = renderHook(() => useBurritoApmData(memoryStub));

    await act(async () => {
      await result.current({
        metadata: burritoFixture(),
        project: projectFixture,
        projectPath: '/myproj',
        preLen: 0,
      });
    });
  });
});
