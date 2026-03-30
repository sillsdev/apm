type LocalizedString = Record<string, string>;

jest.mock('path-browserify', () => ({
  __esModule: true,
  default: {
    join: (...args: string[]) => args.join('/'),
    extname: (p: string) => {
      const idx = p.lastIndexOf('.');
      return idx >= 0 ? p.slice(idx) : '';
    },
  },
}));

describe('parseBurritoMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractLabel', () => {
    it('should extract label for specified language', async () => {
      const { extractLabel } =
        await import('../parseBurritoMetadata');
      const labels: LocalizedString = {
        en: 'English Name',
        es: 'Nombre Español',
      };
      expect(extractLabel(labels, 'en')).toBe('English Name');
    });

    it('should fallback to first value if language not found', async () => {
      const { extractLabel } =
        await import('../parseBurritoMetadata');
      const labels: LocalizedString = {
        en: 'English Name',
        fr: 'Nom Français',
      };
      expect(extractLabel(labels, 'de')).toBe('English Name');
    });

    it('should remove "Burrito Wrapper" suffix', async () => {
      const { extractLabel } =
        await import('../parseBurritoMetadata');
      const labels: LocalizedString = {
        en: 'Test Project Burrito Wrapper',
      };
      expect(extractLabel(labels, 'en')).toBe('Test Project');
    });

    it('should throw error for empty labels', async () => {
      const { extractLabel } =
        await import('../parseBurritoMetadata');
      const labels: LocalizedString = {};
      expect(() => extractLabel(labels, 'en')).toThrow(
        'Unable to resolve label'
      );
    });

    it('should trim whitespace', async () => {
      const { extractLabel } =
        await import('../parseBurritoMetadata');
      const labels: LocalizedString = {
        en: '  Test Project  ',
      };
      expect(extractLabel(labels, 'en')).toBe('Test Project');
    });

    it('should handle case insensitive removal of Burrito Wrapper', async () => {
      const { extractLabel } =
        await import('../parseBurritoMetadata');
      const labels: LocalizedString = {
        en: 'Test Project BURRITO WRAPPER',
      };
      expect(extractLabel(labels, 'en')).toBe('Test Project');
    });
  });

  describe('buildStructure', () => {
    const setMockIpc = (files: Record<string, string>) => {
      (window as any).api = {
        exists: jest.fn(async (p: string) => Object.prototype.hasOwnProperty.call(files, p)),
        read: jest.fn(async (p: string) => {
          if (!Object.prototype.hasOwnProperty.call(files, p)) {
            throw new Error(`ENOENT: ${p}`);
          }
          return files[p];
        }),
      };
    };

    it('should build structure from valid burrito wrapper (real implementation)', async () => {
      jest.resetModules();

      const wrapperRoot = '/test/path';
      const wrapperJsonPath = `${wrapperRoot}/wrapper.json`;
      const audioMetaPath = `${wrapperRoot}/audio/metadata.json`;
      const textMetaPath = `${wrapperRoot}/text/metadata.json`;
      const audioUsfmPath = `${wrapperRoot}/audio/ingredients/MAT.usfm`;

      setMockIpc({
        [wrapperJsonPath]: JSON.stringify({
          meta: { name: { en: 'Test Project Burrito Wrapper' } },
          contents: { burritos: [{ path: 'apmdata' }, { path: 'audio' }, { path: 'text' }] },
        }),
        [audioMetaPath]: JSON.stringify({
          type: { flavorType: { flavor: { name: 'audioTranslation' } } },
          localizedNames: { 'book-mat': { long: { en: 'Matthew' } } },
          ingredients: {
            'ingredients/MAT.usfm': {
              mimeType: 'text/usfm',
              scope: { MAT: ['1:1-2'] },
            },
          },
        }),
        [textMetaPath]: JSON.stringify({
          type: { flavorType: { flavor: { name: 'textTranslation' } } },
          localizedNames: { 'book-mat': { long: { en: 'Matthew' } } },
          ingredients: {},
        }),
        [audioUsfmPath]: '\\id MAT\n\\c 1\n\\c 2\n\\c 3\n',
      });

      const { buildStructure, BURRITO_CHAPTER_FILTER_OTHER } =
        await import('../parseBurritoMetadata');

      const result = await buildStructure(wrapperRoot, 'en');

      expect(result.label).toBe('Test Project');
      expect(result.books).toHaveLength(1);
      expect(result.books[0].id).toBe('MAT');
      expect(result.books[0].label).toBe('Matthew');

      // Chapter union comes from both scope tokens and actual scripture bytes.
      expect(result.books[0].chapters).toEqual(
        expect.arrayContaining(['1', '2', '3', BURRITO_CHAPTER_FILTER_OTHER])
      );

      // Flavor names discovered by scanning metadata.json for each burrito.
      expect(result.books[0].burritos).toEqual(
        expect.arrayContaining(['audioTranslation', 'textTranslation'])
      );
    });

    it('should return empty books when no scopes found', async () => {
      jest.resetModules();

      const wrapperRoot = '/test/path';
      setMockIpc({
        [`${wrapperRoot}/wrapper.json`]: JSON.stringify({
          meta: { name: { en: 'Wrapper' } },
          contents: { burritos: [{ path: 'audio' }] },
        }),
        [`${wrapperRoot}/audio/metadata.json`]: JSON.stringify({
          type: { flavorType: { flavor: { name: 'audioTranslation' } } },
          localizedNames: {},
          ingredients: {},
        }),
      });

      const { buildStructure } =
        await import('../parseBurritoMetadata');

      const result = await buildStructure(wrapperRoot, 'en');
      expect(result.books).toHaveLength(0);
    });

    it('should wrap errors with Invalid Scripture Burrito message', async () => {
      jest.resetModules();

      const wrapperRoot = '/invalid/path';
      setMockIpc({
        [`${wrapperRoot}/wrapper.json`]: '{not valid json',
      });

      const { buildStructure } =
        await import('../parseBurritoMetadata');

      await expect(buildStructure(wrapperRoot, 'en')).rejects.toThrow(
        /Invalid Scripture Burrito for import:/
      );
    });
  });
});
