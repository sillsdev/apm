import { preprocessTextTranslationBurritoToUsfm } from './preprocessTextTranslationBurritoToUsfm';

jest.mock('./normalizeTextToUsfm', () => ({
  normalizeTextToUsfm: jest.fn(async (_input: string, format: string) => {
    return `\\id GEN\n\\c 1\n\\v 1 from-${format}`;
  }),
}));

describe('preprocessTextTranslationBurritoToUsfm', () => {
  it('adds text/usfm ingredient derived from usj/usx and writes metadata first', async () => {
    const files = new Map<string, string>();
    const writes: Array<{ path: string; data: unknown }> = [];

    // `preprocessTextTranslationBurritoToUsfm` uses `path-browserify` which
    // emits POSIX separators, so keep fixture paths POSIX-like.
    const wrapperDir = '/wrapper';
    files.set(
      `${wrapperDir}/wrapper.json`,
      JSON.stringify({
        format: 'scripture burrito wrapper',
        meta: { name: { en: 'X' } },
        contents: { burritos: [{ path: 'text' }] },
      })
    );
    files.set(
      `${wrapperDir}/text/metadata.json`,
      JSON.stringify({
        type: { flavorType: { flavor: { name: 'textTranslation' } } },
        ingredients: {
          'ingredients/GEN.usj': {
            mimeType: 'application/usj+json',
            scope: { GEN: ['1'] },
          },
        },
      })
    );
    files.set(
      `${wrapperDir}/text/ingredients/GEN.usj`,
      JSON.stringify({ type: 'USJ', version: '0.3.0', content: [] })
    );

    const ipc = {
      exists: async (p: string) => files.has(p),
      read: async (p: string) => files.get(p) ?? '',
      write: async (p: string, data: unknown) => {
        writes.push({ path: p, data });
        files.set(p, String(data));
        return undefined as any;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      md5File: async (_p: string) => 'md5',
    };

    await preprocessTextTranslationBurritoToUsfm(wrapperDir, ipc as any);

    const metaPath = `${wrapperDir}/text/metadata.json`;
    const updated = JSON.parse(files.get(metaPath) ?? '{}');
    const keys = Object.keys(updated.ingredients ?? {});

    // generated usfm should be present and appear first
    expect(keys[0]).toBe('ingredients/GEN.usfm');
    expect(updated.ingredients['ingredients/GEN.usfm'].mimeType).toBe(
      'text/usfm'
    );
    expect(updated.ingredients['ingredients/GEN.usfm'].scope).toEqual({
      GEN: ['1'],
    });

    // file write for new usfm should exist
    expect(files.get(`${wrapperDir}/text/ingredients/GEN.usfm`)).toContain(
      '\\v 1 from-usj'
    );

    // and metadata should have been rewritten
    expect(writes.some((w) => w.path === metaPath)).toBe(true);
  });
});
