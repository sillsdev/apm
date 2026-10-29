import { act, renderHook, waitFor } from '@testing-library/react';
import jhn3 from './__fixtures__/BSB_JHN_3.simple.json';

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => [
    key === 'project' ? 'proj1' : undefined,
    jest.fn(),
  ],
}));
const mockProjects: { value: unknown[] } = { value: [] };
jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => mockProjects.value,
}));
jest.mock('../../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));
jest.mock('./referenceTextChapters', () => ({
  getChapters: jest.fn(),
}));

import {
  useProjectReferenceTexts,
  useReferenceTextPassage,
} from './useReferenceTextPassage';
import { getChapters } from './referenceTextChapters';
import { parseChapter } from './passageText';
import { ReferenceText } from './referenceText';
import { PassageD } from '../../model';
import { logError } from '../../utils/logErrorService';

const text = (id: string, books: string): ReferenceText => ({
  id,
  name: id,
  englishName: id,
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books,
});
const primary = text('BSB', 'JHN');
const secondary = text('eng_t4t', 'JHN');

const setProject = (referenceTexts: ReferenceText[]) => {
  mockProjects.value = [
    {
      id: 'proj1',
      type: 'project',
      attributes: { defaultParams: JSON.stringify({ referenceTexts }) },
    },
  ];
};

const passage = (reference: string) =>
  ({
    id: 'p1',
    type: 'passage',
    attributes: { book: 'JHN', reference },
  }) as PassageD; // only book and reference are read

const mockGetChapters = getChapters as jest.Mock;

beforeEach(() => {
  setProject([primary, secondary]);
  mockGetChapters.mockReset();
});

describe('useProjectReferenceTexts', () => {
  it('reads the Reference Texts, Primary then Secondary', () => {
    const { result } = renderHook(() => useProjectReferenceTexts());
    expect(result.current).toEqual([primary, secondary]);
  });

  it('is empty when the project has none', () => {
    setProject([]);
    const { result } = renderHook(() => useProjectReferenceTexts());
    expect(result.current).toEqual([]);
  });
});

describe('useReferenceTextPassage', () => {
  it('reads the Primary Reference Text', async () => {
    mockGetChapters.mockResolvedValue([parseChapter(jhn3)]);
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3:1'), primary)
    );
    expect(result.current).toEqual({
      status: 'loading',
      referenceText: primary,
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toEqual({
      status: 'ready',
      referenceText: primary,
      text: 'Now there was a man of the Pharisees named Nicodemus, a leader of the Jews.',
    });
    expect(mockGetChapters).toHaveBeenCalledWith('BSB', 'JHN', [3]);
  });

  it('reads the Secondary Reference Text', async () => {
    mockGetChapters.mockResolvedValue([parseChapter(jhn3)]);
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3:1'), secondary)
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockGetChapters).toHaveBeenCalledWith('eng_t4t', 'JHN', [3]);
  });

  it('is none without a Reference Text', () => {
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3:1'), undefined)
    );
    expect(result.current).toEqual({ status: 'none' });
    expect(mockGetChapters).not.toHaveBeenCalled();
  });

  it('reports fetchFailed and logs the error', async () => {
    mockGetChapters.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3:1'), primary)
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'error',
        referenceText: primary,
        error: 'fetchFailed',
        retry: expect.any(Function),
      })
    );
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('fetches again on retry after fetchFailed', async () => {
    mockGetChapters
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([parseChapter(jhn3)]);
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3:1'), primary)
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    const failed = result.current;
    act(() => {
      if (failed.status === 'error') failed.retry?.();
    });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockGetChapters).toHaveBeenCalledTimes(2);
  });

  it('offers no retry for errors a fetch cannot fix', () => {
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3'), primary)
    );
    expect(result.current).not.toHaveProperty('retry');
  });

  it('reports empty when no verse is in range', async () => {
    mockGetChapters.mockResolvedValue([parseChapter(jhn3)]);
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3:20-25'), primary)
    );
    await waitFor(() =>
      expect(result.current).toEqual({
        status: 'error',
        referenceText: primary,
        error: 'empty',
      })
    );
  });

  it('reports noRange without fetching', () => {
    const { result } = renderHook(() =>
      useReferenceTextPassage(passage('3'), primary)
    );
    expect(result.current).toEqual({
      status: 'error',
      referenceText: primary,
      error: 'noRange',
    });
    expect(mockGetChapters).not.toHaveBeenCalled();
  });

  it('shows loading again when the passage changes', async () => {
    mockGetChapters.mockResolvedValue([parseChapter(jhn3)]);
    const { result, rerender } = renderHook(
      ({ p }) => useReferenceTextPassage(p, primary),
      { initialProps: { p: passage('3:1') } }
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    mockGetChapters.mockReturnValue(new Promise(() => undefined));
    rerender({ p: passage('3:2') });
    expect(result.current.status).toBe('loading');
  });
});
