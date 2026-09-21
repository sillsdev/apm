import { jest, beforeEach, describe, expect, test } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type Memory from '@orbit/memory';
import type { SharedResourceD } from '../model';

const categories: Record<string, { categoryname: string } | undefined> = {
  ac1: { categoryname: 'devotional' },
  ac2: { categoryname: 'Verse by Verse' },
  ac3: undefined,
};

const mockMemory = {
  cache: {
    query: (fn: (q: any) => any) =>
      fn({
        findRecord: ({ id }: { id: string }) => {
          const attributes = categories[id];
          if (!attributes) throw new Error('not found');
          return { type: 'artifactcategory', id, attributes };
        },
      }),
  },
} as unknown as Memory;

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));
jest.mock('./useArtifactCategory', () => ({
  useArtifactCategory: jest.fn(),
}));

import { useGlobal } from '../context/useGlobal';
import { useArtifactCategory } from './useArtifactCategory';
import { useNoteCategory } from './useNoteCategory';

const sharedRes = (categoryId?: string) =>
  ({
    type: 'sharedresource',
    id: 'sr1',
    attributes: { note: true },
    relationships: {
      passage: { data: { type: 'passage', id: 'pn1' } },
      ...(categoryId
        ? {
            artifactCategory: {
              data: { type: 'artifactcategory', id: categoryId },
            },
          }
        : {}),
    },
  }) as unknown as SharedResourceD;

describe('useNoteCategory', () => {
  beforeEach(() => {
    // the hook only reads 'memory'
    (useGlobal as unknown as jest.Mock).mockReturnValue([
      mockMemory,
      jest.fn(),
    ]);
    (useArtifactCategory as unknown as jest.Mock).mockReturnValue({
      // the real hook localizes a slug and passes anything else through
      localizedArtifactCategory: (val: string) =>
        val === 'devotional' ? 'Devotional' : val,
    });
  });

  test('returns the localized category of the note', () => {
    const { result } = renderHook(() => useNoteCategory());
    expect(result.current(sharedRes('ac1'))).toBe('Devotional');
  });

  test('passes an unlocalized category name through', () => {
    const { result } = renderHook(() => useNoteCategory());
    expect(result.current(sharedRes('ac2'))).toBe('Verse by Verse');
  });

  test('returns undefined without a shared resource or category', () => {
    const { result } = renderHook(() => useNoteCategory());
    expect(result.current(undefined)).toBeUndefined();
    expect(result.current(sharedRes())).toBeUndefined();
  });

  test('returns undefined when the category record is missing', () => {
    const { result } = renderHook(() => useNoteCategory());
    expect(result.current(sharedRes('ac3'))).toBeUndefined();
  });
});
