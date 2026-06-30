import type { Burrito } from './data/types';
import type Memory from '@orbit/memory';
import {
  JAMES_SPEAKER_HOLDERS,
  JAMES_SPEAKER_TEAM_ID,
  buildJamesSpeakerRightsFixture,
  buildSpeakerRightsMemoryStub,
  releaseMediaDests,
  speakerRightsHolders,
} from './jamesSpeakerRightsFixture';

jest.mock('../store/importexport/projectDataExport', () => ({
  getOrganizationIntellectualPropertyFiles: jest.fn(),
}));

jest.mock('../utils/dataPath', () => ({
  __esModule: true,
  PathType: { MEDIA: 'MEDIA' },
  default: jest.fn(async (_url: string, _pathType: unknown, local: any) => {
    local.localname = '/local/source.dat';
    return local.localname;
  }),
}));

function defaultExportPayload(fixture = buildJamesSpeakerRightsFixture()) {
  const ipJson = JSON.stringify({
    data: fixture.intellectualproperties.map((ip) => ({
      type: 'intellectualproperties',
      id: ip.id,
      attributes: { rightsHolder: ip.attributes.rightsHolder },
      relationships: ip.relationships,
    })),
  });
  const mediaJson = JSON.stringify({
    data: fixture.mediafiles.map((m) => ({
      type: 'mediafiles',
      id: m.id,
      attributes: m.attributes,
    })),
  });
  return {
    dataFiles: {
      'data/I_intellectualpropertys.json': ipJson,
      'data/H_mediafiles.json': mediaJson,
    },
    releaseMediafiles: fixture.mediafiles,
  };
}

/**
 * `useBurritoIntellectualProperty` reads `window.api` at module load.
 * `jest.resetModules()` plus dynamic `import()` (not top-level import of the
 * hook) keeps `renderHook` and the hook on one React instance.
 */
async function loadIpHookForApi(
  api: unknown,
  exportPayload = defaultExportPayload()
) {
  jest.resetModules();
  (window as unknown as { api?: unknown }).api = api;
  const { renderHook, act } = await import('@testing-library/react/pure');
  const { getOrganizationIntellectualPropertyFiles } =
    await import('../store/importexport/projectDataExport');
  (getOrganizationIntellectualPropertyFiles as jest.Mock).mockReturnValue(
    exportPayload
  );
  const memoryStub = buildSpeakerRightsMemoryStub(
    buildJamesSpeakerRightsFixture()
  ) as unknown as Memory;
  const { useBurritoIntellectualProperty } =
    await import('./useBurritoIntellectualProperty');
  return {
    renderHook,
    act,
    useBurritoIntellectualProperty,
    getOrganizationIntellectualPropertyFiles,
    memoryStub,
  };
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
        name: 'typeName',
        flavor: { name: 'flavorName' },
        currentScope: {},
      },
    },
  };
}

describe('useBurritoIntellectualProperty', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('exports team-level speaker JSON, release media, and metadata (TT-7187)', async () => {
    const createFolder = jest.fn().mockResolvedValue(undefined);
    const write = jest.fn().mockResolvedValue(undefined);
    const copyFile = jest.fn().mockResolvedValue(undefined);
    const md5File = jest.fn().mockResolvedValue('deadbeef');
    const exists = jest.fn().mockResolvedValue(true);
    const stat = jest.fn().mockResolvedValue(JSON.stringify({ size: 1024 }));

    const fixture = buildJamesSpeakerRightsFixture();
    const {
      renderHook,
      act,
      useBurritoIntellectualProperty,
      getOrganizationIntellectualPropertyFiles,
      memoryStub,
    } = await loadIpHookForApi(
      { createFolder, write, copyFile, md5File, exists, stat },
      defaultExportPayload(fixture)
    );

    const { result } = renderHook(() =>
      useBurritoIntellectualProperty(memoryStub, JAMES_SPEAKER_TEAM_ID)
    );

    let updated: Burrito;
    await act(async () => {
      updated = await result.current({
        metadata: burritoFixture(),
        partPath: '/burrito/TST/intellectualproperty',
        preLen: 0,
      });
    });

    expect(getOrganizationIntellectualPropertyFiles).toHaveBeenCalledWith(
      memoryStub,
      JAMES_SPEAKER_TEAM_ID
    );

    const ipWrite = write.mock.calls.find((c) =>
      String(c[0]).endsWith(
        'intellectualproperty/data/I_intellectualpropertys.json'
      )
    );
    expect(ipWrite).toBeDefined();
    expect(speakerRightsHolders(ipWrite![1] as string)).toEqual(
      expect.arrayContaining([...JAMES_SPEAKER_HOLDERS])
    );

    const mediaJsonWrite = write.mock.calls.find((c) =>
      String(c[0]).endsWith('intellectualproperty/data/H_mediafiles.json')
    );
    expect(mediaJsonWrite).toBeDefined();
    const mediaData = JSON.parse(mediaJsonWrite![1] as string) as {
      data: Array<{ id: string }>;
    };
    expect(mediaData.data.map((r) => r.id)).toEqual(
      expect.arrayContaining(fixture.mediafiles.map((m) => m.id))
    );

    expect(copyFile).toHaveBeenCalledTimes(fixture.mediafiles.length);
    const dests = releaseMediaDests({ copyFile });
    expect(dests.some((d) => d.includes('greg-rights'))).toBe(true);
    expect(dests.some((d) => d.includes('fred-release'))).toBe(true);

    const ipIngredient =
      updated!.ingredients[
        '/burrito/TST/intellectualproperty/data/I_intellectualpropertys.json'
      ];
    expect(ipIngredient).toMatchObject({
      checksum: { md5: 'deadbeef' },
      mimeType: 'application/json',
    });
    expect(ipIngredient.scope).toBeUndefined();

    expect(updated!.type!.flavorType!.name).toBe('x-intellectualproperty');
    expect(updated!.type!.flavorType!.flavor.name).toBe(
      'x-intellectualproperty'
    );

    const ingredientMime = (filename: string) => {
      const key = Object.keys(updated!.ingredients).find((k) =>
        k.includes(filename)
      );
      expect(key).toBeDefined();
      return updated!.ingredients[key!]!.mimeType;
    };
    expect(ingredientMime('greg-rights')).toBe('audio/mpeg');
    expect(ingredientMime('fred-release')).toBe('application/pdf');
    expect(ingredientMime('alex-consent')).toBe('image/png');
    expect(ingredientMime('sam-statement')).toBe('audio/mpeg');
    expect(ingredientMime('jane-rights')).toBe('application/pdf');
  });
});
