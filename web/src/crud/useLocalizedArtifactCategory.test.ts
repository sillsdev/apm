import { jest, describe, expect, test } from '@jest/globals';
import { renderHook } from '@testing-library/react';

// Stand-in for LocalizedStrings: the string table as own properties, plus a
// getString that, like the real one, reads a dotted key as a nested path.
const table: Record<string, string> = {
  chapter: 'Número de capítulo',
  scripture: 'Escritura',
};
const strings = {
  ...table,
  _language: 'es',
  getString: (key: string) => {
    let n: unknown = table;
    for (const part of key.split('.')) {
      const next = (n as Record<string, unknown>)[part];
      if (next === undefined) return null;
      n = next;
    }
    return n;
  },
};

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => strings),
  shallowEqual: jest.fn(),
}));

import { useLocalizedArtifactCategory } from './useLocalizedArtifactCategory';

describe('useLocalizedArtifactCategory', () => {
  const localize = () =>
    renderHook(() => useLocalizedArtifactCategory()).result.current;

  test('translates a built-in category slug', () => {
    expect(localize()('scripture')).toBe('Escritura');
  });

  test('shows a user-defined name as typed', () => {
    expect(localize()('Sermon notes')).toBe('Sermon notes');
  });

  test('shows a dotted name as typed, not a character of a built-in label', () => {
    expect(localize()('chapter.1')).toBe('chapter.1');
    expect(localize()('scripture.length')).toBe('scripture.length');
  });

  test("does not return LocalizedStrings' own members", () => {
    expect(localize()('_language')).toBe('_language');
    expect(localize()('getString')).toBe('getString');
  });
});
