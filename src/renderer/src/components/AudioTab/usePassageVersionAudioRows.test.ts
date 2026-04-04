const mockMemory = { id: 'mem' };

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));

jest.mock('../../crud', () => ({
  findRecord: jest.fn(),
  related: jest.fn(),
  useArtifactType: jest.fn(),
  usePlan: jest.fn(),
  useRole: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

jest.mock('../../crud/useProjectDefaults', () => ({
  projDefSectionMap: 'sectionMap',
  useProjectDefaults: jest.fn(),
}));

jest.mock('./getMedia', () => ({
  getMedia: jest.fn(),
}));

import type { IState } from '../../model';
import type { IBookNameData } from '../../model/bookName';
import type { MediaFileD, Passage, Section } from '../../model';
import type { SectionArray } from '../../model';

import {
  usePassageVernacularVersionCount,
  usePassageVersionAudioRows,
} from './usePassageVersionAudioRows';
import { useGlobal } from '../../context/useGlobal';
import {
  findRecord,
  related,
  useArtifactType,
  usePlan,
  useRole,
} from '../../crud';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useSelector } from 'react-redux';
import { useProjectDefaults } from '../../crud/useProjectDefaults';
import { getMedia } from './getMedia';
import { renderHook, waitFor, act } from '@testing-library/react';

/** Matches ConsultantCheck / useStepPermission: keyed globals, setter stub per key. */
const setupUseGlobal = (overrides: Record<string, unknown> = {}) => {
  (useGlobal as jest.Mock).mockImplementation((key: string) => {
    const mockValues: Record<string, unknown> = {
      plan: 'plan-1',
      project: 'proj-1',
      memory: mockMemory,
      offline: false,
      offlineOnly: false,
      ...overrides,
    };
    return [mockValues[key], jest.fn()];
  });
};

/** Same pattern as useCreateBurrito.test.ts: run the real selector against a stub root state. */
const mockBooksSlice: IBookNameData = {
  loaded: true,
  suggestions: [],
  map: {},
  bookData: [],
};

const mockReduxState: Pick<IState, 'books'> = {
  books: mockBooksSlice,
};

const setupUseSelector = () => {
  const mockSel = useSelector as unknown as jest.Mock;
  mockSel.mockImplementation((sel: (s: IState) => unknown) =>
    sel(mockReduxState as IState)
  );
};

describe('usePassageVernacularVersionCount', () => {
  const passId = 'passage-a';

  const mediaForPassage = (id: string): Partial<MediaFileD> =>
    ({
      id: `mf-${id}`,
      type: 'mediafile',
    }) as MediaFileD;

  beforeEach(() => {
    jest.clearAllMocks();
    (related as jest.Mock).mockImplementation(
      (m: { __passage?: string }, rel: string) =>
        rel === 'passage' ? (m.__passage ?? '') : ''
    );
    (useArtifactType as jest.Mock).mockReturnValue({
      IsVernacularMedia: jest.fn(() => true),
    });
  });

  it('returns 0 when there are no media files', () => {
    (useOrbitData as jest.Mock).mockReturnValue([]);
    const { result } = renderHook(() =>
      usePassageVernacularVersionCount(passId)
    );
    expect(result.current).toBe(0);
  });

  it('counts only media linked to the passage that pass IsVernacularMedia', () => {
    const IsVernacularMedia = jest.fn((m: MediaFileD) => m.id === 'mf-match');
    (useArtifactType as jest.Mock).mockReturnValue({ IsVernacularMedia });
    (useOrbitData as jest.Mock).mockReturnValue([
      { ...mediaForPassage('x'), __passage: passId },
      { ...mediaForPassage('y'), __passage: 'other-pass' },
      { ...mediaForPassage('match'), __passage: passId },
    ]);

    const { result } = renderHook(() =>
      usePassageVernacularVersionCount(passId)
    );

    expect(result.current).toBe(1);
    expect(IsVernacularMedia).toHaveBeenCalled();
  });

  it('returns 0 when passage matches but none are vernacular', () => {
    (useArtifactType as jest.Mock).mockReturnValue({
      IsVernacularMedia: jest.fn(() => false),
    });
    (useOrbitData as jest.Mock).mockReturnValue([
      { ...mediaForPassage('1'), __passage: passId },
    ]);

    const { result } = renderHook(() =>
      usePassageVernacularVersionCount(passId)
    );

    expect(result.current).toBe(0);
  });
});

describe('usePassageVersionAudioRows', () => {
  const passId = 'passage-a';
  /** Stable array identities so useEffect deps do not change every render (real useOrbitData returns stable query results). */
  const mockSections: Section[] = [];
  const mockPassages: Passage[] = [];
  let mockMediaFiles: Array<Record<string, unknown>> = [];
  const mockSectionArr: SectionArray = [
    [1, 'Section One'],
    [2, 'Section Two'],
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    setupUseGlobal();
    setupUseSelector();
    (usePlan as jest.Mock).mockReturnValue({
      getPlan: jest.fn(() => ({
        id: 'plan-rec',
        attributes: { name: 'Plan Z' },
      })),
    });
    (useRole as jest.Mock).mockReturnValue({ userIsAdmin: true });
    (useProjectDefaults as jest.Mock).mockReturnValue({
      getProjectDefault: jest.fn(() => mockSectionArr),
    });
    (related as jest.Mock).mockImplementation(
      (m: { __passage?: string }, rel: string) =>
        rel === 'passage' ? (m.__passage ?? '') : ''
    );
    (useArtifactType as jest.Mock).mockReturnValue({
      IsVernacularMedia: jest.fn(() => true),
    });
    (getMedia as jest.Mock).mockImplementation(
      (media: unknown[], data: { playItem: string }) => {
        if (!media.length) return [];
        return [
          {
            id: 'row-1',
            index: 0,
            playIcon: data.playItem,
          },
        ];
      }
    );
    mockMediaFiles = [
      {
        id: 'mf-1',
        type: 'mediafile',
        __passage: passId,
      },
    ];
    (useOrbitData as jest.Mock).mockImplementation((model: string) => {
      if (model === 'mediafile') return mockMediaFiles;
      if (model === 'section') return mockSections;
      if (model === 'passage') return mockPassages;
      return [];
    });
  });

  it('returns sectionArr, shared, readonly, handleRefresh and builds rows via getMedia', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      id: 'proj-1',
      type: 'project',
      attributes: { isPublic: false, defaultParams: {} },
    });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    expect(result.current.data[0].id).toBe('row-1');
    expect(result.current.sectionArr).toEqual(mockSectionArr);
    expect(result.current.shared).toBe(false);
    expect(result.current.readonly).toBe(false);
    expect(typeof result.current.handleRefresh).toBe('function');

    expect(getMedia).toHaveBeenCalled();
    const [filteredMedia, mediaData] = (getMedia as jest.Mock).mock.calls.at(
      -1
    )!;
    expect(filteredMedia).toHaveLength(1);
    expect(filteredMedia[0].id).toBe('mf-1');
    expect(mediaData).toMatchObject({
      planName: 'Plan Z',
      passages: mockPassages,
      sections: mockSections,
      playItem: 'play-x',
      isPassageDate: false,
    });
    expect(mediaData.sectionMap.get(1)).toBe('Section One');
    expect(mediaData.allBookData).toBe(mockBooksSlice.bookData);
  });

  it('sets shared true when project is public', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      attributes: { isPublic: true, defaultParams: {} },
    });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(result.current.shared).toBe(true);
    });
  });

  it('uses empty sectionArr when findRecord returns no project', async () => {
    (findRecord as jest.Mock).mockReturnValue(undefined);

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    expect(result.current.sectionArr).toEqual([]);
    const [, mediaData] = (getMedia as jest.Mock).mock.calls.at(-1)!;
    expect(mediaData.sectionMap.size).toBe(0);
  });

  it('sets readonly when user is not admin', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      attributes: { isPublic: false, defaultParams: {} },
    });
    (useRole as jest.Mock).mockReturnValue({ userIsAdmin: false });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(result.current.readonly).toBe(true);
    });
  });

  it('sets readonly when offline and not offline-only', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      attributes: { isPublic: false, defaultParams: {} },
    });
    setupUseGlobal({ offline: true, offlineOnly: false });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(result.current.readonly).toBe(true);
    });
  });

  it('does not set readonly from offline when offlineOnly is true', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      attributes: { isPublic: false, defaultParams: {} },
    });
    setupUseGlobal({ offline: true, offlineOnly: true });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });

    expect(result.current.readonly).toBe(false);
  });

  it('handleRefresh triggers getMedia again', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      attributes: { isPublic: false, defaultParams: {} },
    });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(getMedia).toHaveBeenCalled();
    });
    const callsAfterMount = (getMedia as jest.Mock).mock.calls.length;

    await act(async () => {
      result.current.handleRefresh();
    });

    await waitFor(() => {
      expect((getMedia as jest.Mock).mock.calls.length).toBeGreaterThan(
        callsAfterMount
      );
    });
  });

  it('passes no media to getMedia when none match passage', async () => {
    (findRecord as jest.Mock).mockReturnValue({
      attributes: { isPublic: false, defaultParams: {} },
    });
    mockMediaFiles = [
      { id: 'mf-other', type: 'mediafile', __passage: 'other' },
    ];
    (useOrbitData as jest.Mock).mockImplementation((model: string) => {
      if (model === 'mediafile') return mockMediaFiles;
      if (model === 'section') return mockSections;
      if (model === 'passage') return mockPassages;
      return [];
    });

    const { result } = renderHook(() =>
      usePassageVersionAudioRows(passId, 'play-x')
    );

    await waitFor(() => {
      expect(getMedia).toHaveBeenCalled();
    });

    const [filtered] = (getMedia as jest.Mock).mock.calls.at(-1)!;
    expect(filtered).toEqual([]);
    expect(result.current.data).toEqual([]);
  });
});
