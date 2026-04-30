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

  it('skips burritos and ingredients that resolve outside the wrapper directory', async () => {
    const readPaths: string[] = [];
    const writePaths: string[] = [];
    const wrapperDir = '/wrapper';

    const ipc = {
      exists: async () => true,
      read: async (p: string) => {
        readPaths.push(p);
        if (p.endsWith('wrapper.json')) {
          return JSON.stringify({
            format: 'scripture burrito wrapper',
            contents: {
              burritos: [
                { path: 'text' },
                { path: '../outside' },
                { path: 'evilmeta' },
              ],
            },
          });
        }
        if (p.includes('/text/') && p.endsWith('metadata.json')) {
          return JSON.stringify({
            type: { flavorType: { flavor: { name: 'textTranslation' } } },
            ingredients: {
              'ingredients/GEN.usj': {
                mimeType: 'application/usj+json',
                scope: { GEN: ['1'] },
              },
              '../../escape/GEN.usj': {
                mimeType: 'application/usj+json',
                scope: { GEN: ['1'] },
              },
            },
          });
        }
        if (p.includes('/evilmeta/')) {
          return JSON.stringify({
            type: { flavorType: { flavor: { name: 'textTranslation' } } },
            ingredients: {},
          });
        }
        return '';
      },
      write: async (p: string) => {
        writePaths.push(p);
      },
      md5File: async () => 'md5',
    };

    const files = new Map<string, string>([
      [`${wrapperDir}/text/ingredients/GEN.usj`, '{}'],
    ]);
    (ipc as any).exists = async (p: string) =>
      p.startsWith(`${wrapperDir}/`) && (files.has(p) || p.endsWith('metadata.json') || p.endsWith('wrapper.json'));

    await preprocessTextTranslationBurritoToUsfm(wrapperDir, ipc as any);

    expect(readPaths.some((p) => p.includes('outside'))).toBe(false);
    expect(readPaths.every((p) => p.startsWith(`${wrapperDir}/`))).toBe(true);
    expect(writePaths.every((p) => p.startsWith(`${wrapperDir}/`))).toBe(true);
    expect(writePaths.some((p) => p.includes('escape'))).toBe(false);
  });
});
