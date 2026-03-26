import type { Burrito } from './data/types';
import type { MediaFileD, PassageD, SectionD } from '../model';

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => []),
}));

jest.mock('../crud/useOrgDefaults', () => ({
  useOrgDefaults: jest.fn(),
}));

jest.mock('./usfmTextConvert', () => ({
  convertBurritoText: jest.fn((content: string) => Promise.resolve(content)),
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
        name: 'scripture',
        flavor: { name: 'before-text' },
        currentScope: {},
      },
    },
  };
}

const planId = 'plan-1';

function sectionFixture(): SectionD {
  return {
    id: 'sec-1',
    type: 'section',
    attributes: {
      sequencenum: 1,
      name: 'Intro',
    },
    relationships: {
      plan: { data: { id: planId } },
    },
  } as unknown as SectionD;
}

function passageFixture(): PassageD {
  return {
    id: 'pas-1',
    type: 'passage',
    attributes: {
      sequencenum: 1,
      reference: 'GEN 1:1',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 1,
    },
    relationships: {
      section: { data: { id: 'sec-1' } },
      plan: { data: { id: planId } },
    },
  } as unknown as PassageD;
}

function mediaFixture(attrs: Partial<MediaFileD['attributes']>): MediaFileD {
  return {
    id: 'med-1',
    type: 'mediafile',
    attributes: {
      versionNumber: 1,
      transcription: 'In the beginning',
      ...attrs,
    } as MediaFileD['attributes'],
    relationships: {
      plan: { data: { id: planId } },
      passage: { data: { id: 'pas-1' } },
    },
  } as unknown as MediaFileD;
}

function makeIpc() {
  return {
    write: jest.fn().mockResolvedValue(undefined),
    md5File: jest.fn().mockResolvedValue('text-md5'),
  };
}

type LoadOpts = {
  passages?: PassageD[];
  mediafiles?: MediaFileD[];
  getOrgDefaultImpl?: (key: string, teamId?: string) => unknown;
};

function loadTextForApi(api: typeof window.api, opts: LoadOpts = {}) {
  jest.resetModules();
  (window as unknown as { api?: typeof api }).api = api;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderHook, act } = require('@testing-library/react/pure');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useOrgDefaults } = require('../crud/useOrgDefaults');
  const defaultGetOrg = (key: string) => {
    if (key === 'burritoVersions') return '1';
    if (key === 'burritoFormat') return { textOutputFormat: 'usfm' };
    return undefined;
  };
  useOrgDefaults.mockReturnValue({
    getOrgDefault: jest.fn((key: string, teamId?: string) =>
      (opts.getOrgDefaultImpl ?? defaultGetOrg)(key, teamId)
    ),
    setOrgDefault: jest.fn(),
    getDefault: jest.fn(),
    setDefault: jest.fn(),
    canSetOrgDefault: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useOrbitData } = require('../hoc/useOrbitData');
  useOrbitData.mockImplementation((key: string) => {
    if (key === 'mediafile') return opts.mediafiles ?? [];
    if (key === 'passage') return opts.passages ?? [];
    return [];
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { convertBurritoText } = require('./usfmTextConvert');
  convertBurritoText.mockImplementation((content: string, fmt: string) =>
    Promise.resolve(`${fmt}:${content}`)
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useBurritoText } = require('./useBurritoText');
  return { renderHook, act, useBurritoText, convertBurritoText };
}

describe('useBurritoText', () => {
  const teamId = 'team-1';
  const bookPath = '/data/burrito/GEN';
  const preLen = '/data'.length;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes USFM, sets textTranslation flavor, and merges ingredients', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoText } = loadTextForApi(ipc as never, {
      passages: [passageFixture()],
      mediafiles: [mediaFixture({})],
    });

    const { result } = renderHook(() => useBurritoText(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        book: 'GEN',
        bookPath,
        preLen,
        sections: [sectionFixture()],
      });
    });

    expect(metadata.type?.flavorType?.flavor?.name).toBe('textTranslation');
    expect(ipc.write).toHaveBeenCalled();
    const writeCall = ipc.write.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('GENv1.usfm')
    );
    expect(writeCall).toBeDefined();
    const written = writeCall![1] as string;
    expect(written).toContain('\\id GEN');
    expect(written).toContain('In the beginning');
    expect(ipc.md5File).toHaveBeenCalled();

    const docid = String(writeCall![0]).substring(preLen);
    expect(metadata.ingredients[docid]).toMatchObject({
      checksum: { md5: 'text-md5' },
      mimeType: 'text/usfm',
      scope: { GEN: ['1'] },
    });
  });

  it('runs convertBurritoText for usj output and sets application/usj+json', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoText, convertBurritoText } =
      loadTextForApi(ipc as never, {
        passages: [passageFixture()],
        mediafiles: [mediaFixture({})],
        getOrgDefaultImpl: (key: string) => {
          if (key === 'burritoVersions') return '1';
          if (key === 'burritoFormat') return { textOutputFormat: 'usj' };
          return undefined;
        },
      });

    const { result } = renderHook(() => useBurritoText(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        book: 'GEN',
        bookPath,
        preLen,
        sections: [sectionFixture()],
      });
    });

    expect(convertBurritoText).toHaveBeenCalled();
    const written = ipc.write.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('GENv1.usj')
    )?.[1] as string;
    expect(written.startsWith('usj:')).toBe(true);

    const ingredientKey = Object.keys(metadata.ingredients).find((k) =>
      k.includes('GENv1.usj')
    )!;
    expect(metadata.ingredients[ingredientKey].mimeType).toBe(
      'application/usj+json'
    );
  });

  it('does not throw when window.api is missing', async () => {
    const { renderHook, act, useBurritoText } = loadTextForApi(undefined, {
      passages: [passageFixture()],
      mediafiles: [mediaFixture({})],
    });

    const { result } = renderHook(() => useBurritoText(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        book: 'GEN',
        bookPath,
        preLen,
        sections: [sectionFixture()],
      });
    });

    expect(metadata.type?.flavorType?.flavor?.name).toBe('textTranslation');
    const ing = Object.values(metadata.ingredients)[0];
    expect(ing).toBeDefined();
    expect(ing!.checksum.md5).toBeUndefined();
  });

  it('with empty sections only updates flavor name', async () => {
    const ipc = makeIpc();
    const { renderHook, act, useBurritoText } = loadTextForApi(ipc as never, {});

    const { result } = renderHook(() => useBurritoText(teamId));
    const metadata = burritoFixture();

    await act(async () => {
      await result.current({
        metadata,
        book: 'GEN',
        bookPath,
        preLen,
        sections: [],
      });
    });

    expect(metadata.type?.flavorType?.flavor?.name).toBe('textTranslation');
    expect(ipc.write).not.toHaveBeenCalled();
    expect(Object.keys(metadata.ingredients)).toHaveLength(0);
  });
});
