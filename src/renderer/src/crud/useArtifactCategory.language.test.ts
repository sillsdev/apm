/**
 * TT-7713: a note row's category name is localized, so it has to follow a
 * runtime language switch. fromLocalizedArtifactCategory maps a displayed name
 * back to its slug (useGraphicFind uses it to find the category, and with it
 * the row's artwork and color). That reverse map was built once and kept, so
 * after a language change it still answered in the old language.
 */
import { jest, beforeEach, describe, expect, test } from '@jest/globals';
import { renderHook } from '@testing-library/react';

const en = {
  chapter: 'Chapter Number',
  title: 'Title',
  devotional: 'Devotional',
};
const es = {
  chapter: 'Número de capítulo',
  title: 'Título',
  devotional: 'Devocional',
};

// localStrings hands out a new object identity per language, so the hook can
// key off the strings object itself.
let strings: Record<string, string> = en;

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => strings),
  shallowEqual: jest.fn(),
}));

jest.mock('../utils/useWaitForRemoteQueue', () => ({
  useWaitForRemoteQueue: () => jest.fn(),
}));

// the hook reaches logErrorService, whose barrel pulls in ESM localization
jest.mock('../utils/logErrorService', () => ({
  Severity: { info: 0, error: 1, retry: 2 },
  logError: jest.fn(),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, unknown> = {
      memory: { cache: { query: () => [] } },
      user: 'user-1',
      organization: 'org-1',
      offlineOnly: false,
      errorReporter: { notify: jest.fn() },
    };
    return [mockValues[key], jest.fn()];
  }),
}));

import { useArtifactCategory } from './useArtifactCategory';

describe('useArtifactCategory localization', () => {
  beforeEach(() => {
    strings = en;
  });

  test('maps a localized name back to its slug', () => {
    const { result } = renderHook(() => useArtifactCategory());
    expect(result.current.fromLocalizedArtifactCategory('Chapter Number')).toBe(
      'chapter'
    );
  });

  test('follows a language switch with no remount', () => {
    const { result, rerender } = renderHook(() => useArtifactCategory());
    //read once in English so any cached reverse map is already built
    expect(result.current.fromLocalizedArtifactCategory('Devotional')).toBe(
      'devotional'
    );

    strings = es;
    rerender();

    expect(result.current.localizedArtifactCategory('devotional')).toBe(
      'Devocional'
    );
    //the row now displays the Spanish name, so that is what has to map back
    expect(result.current.fromLocalizedArtifactCategory('Devocional')).toBe(
      'devotional'
    );
    expect(
      result.current.fromLocalizedArtifactCategory('Número de capítulo')
    ).toBe('chapter');
  });

  test('passes an unknown name through unchanged', () => {
    const { result } = renderHook(() => useArtifactCategory());
    //user-created categories are stored under their own name in every language
    expect(result.current.fromLocalizedArtifactCategory('Second Note')).toBe(
      'Second Note'
    );
  });
});
