import { extractLabel } from '../parseBurritoMetadata';
import { LocalizedString } from 'burrito/data/types';

jest.mock('path-browserify', () => ({
  __esModule: true,
  default: {
    join: (...args: string[]) => args.join('/'),
  },
}));

jest.mock('../parseBurritoMetadata', () => {
  const mockReadJson = jest.fn();
  return {
    extractLabel: jest.requireActual('../parseBurritoMetadata').extractLabel,
    buildStructure: jest.fn(),
  };
});

import { buildStructure } from '../parseBurritoMetadata';

describe('parseBurritoMetadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractLabel', () => {
    it('should extract label for specified language', () => {
      const labels: LocalizedString = {
        en: 'English Name',
        es: 'Nombre Español',
      };
      expect(extractLabel(labels, 'en')).toBe('English Name');
    });

    it('should fallback to first value if language not found', () => {
      const labels: LocalizedString = {
        en: 'English Name',
        fr: 'Nom Français',
      };
      expect(extractLabel(labels, 'de')).toBe('English Name');
    });

    it('should remove "Burrito Wrapper" suffix', () => {
      const labels: LocalizedString = {
        en: 'Test Project Burrito Wrapper',
      };
      expect(extractLabel(labels, 'en')).toBe('Test Project');
    });

    it('should throw error for empty labels', () => {
      const labels: LocalizedString = {};
      expect(() => extractLabel(labels, 'en')).toThrow(
        'Unable to resolve label'
      );
    });

    it('should trim whitespace', () => {
      const labels: LocalizedString = {
        en: '  Test Project  ',
      };
      expect(extractLabel(labels, 'en')).toBe('Test Project');
    });

    it('should handle case insensitive removal of Burrito Wrapper', () => {
      const labels: LocalizedString = {
        en: 'Test Project BURRITO WRAPPER',
      };
      expect(extractLabel(labels, 'en')).toBe('Test Project');
    });
  });

  describe('buildStructure', () => {
    it('should build structure from valid burrito wrapper', async () => {
      const mockBuildStructure = buildStructure as jest.MockedFunction<
        typeof buildStructure
      >;
      mockBuildStructure.mockResolvedValueOnce({
        label: 'Test Wrapper',
        books: [
          {
            label: 'The Gospel According to Matthew',
            chapters: [],
            burritos: [],
          },
          { label: 'The Gospel According to Luke', chapters: [], burritos: [] },
        ],
      });

      const result = await mockBuildStructure('/test/path', 'en');

      expect(result.label).toBe('Test Wrapper');
      expect(result.books).toHaveLength(2);
    });

    it('should return empty books when no books found', async () => {
      const mockBuildStructure = buildStructure as jest.MockedFunction<
        typeof buildStructure
      >;
      mockBuildStructure.mockResolvedValueOnce({
        label: 'Test Wrapper',
        books: [],
      });

      const result = await mockBuildStructure('/test/path', 'en');

      expect(result.books).toHaveLength(0);
    });

    it('should propagate errors from buildStructure', async () => {
      const mockBuildStructure = buildStructure as jest.MockedFunction<
        typeof buildStructure
      >;
      mockBuildStructure.mockRejectedValueOnce(new Error('Invalid burrito'));

      await expect(mockBuildStructure('/invalid/path', 'en')).rejects.toThrow(
        'Invalid burrito'
      );
    });
  });
});
