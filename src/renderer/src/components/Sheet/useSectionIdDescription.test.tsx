/**
 * Test suite for useSectionIdDescription hook
 *
 * This hook provides a function that takes a sheet row and returns
 * a formatted section description by:
 * 1. Extracting the sectionId from the row
 * 2. Finding the section record in memory
 * 3. Using the sectionDescription utility with a section map
 *
 * The hook uses useMemo to optimize the section map creation.
 */

import { renderHook } from '@testing-library/react';
import React from 'react';

// Mock all external dependencies BEFORE importing the hook
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useContext: jest.fn(),
  useMemo: jest.fn(),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));

jest.mock('../../crud', () => ({
  findRecord: jest.fn(),
  sectionDescription: jest.fn(),
}));

jest.mock('../../context/PlanContext', () => ({
  PlanContext: {},
}));

// Import the hook after mocking
import { useSectionIdDescription } from './useSectionIdDescription';
import {
  ISheet,
  SectionD,
  SheetLevel,
  IwsKind,
  PassageTypeEnum,
} from '../../model';

// Get references to the mocked functions
const { useContext, useMemo } = React;
import { useGlobal } from '../../context/useGlobal';
import { findRecord, sectionDescription } from '../../crud';

describe('useSectionIdDescription', () => {
  const mockMemory = {
    cache: {
      query: jest.fn(),
    },
  } as any;

  const mockSectionArr: [number, string][] = [
    [1, 'Section One'],
    [2, 'Section Two'],
    [3, 'Section Three'],
  ];

  const mockPlanContext = {
    state: {
      sectionArr: mockSectionArr,
    },
  };

  const mockSection: SectionD = {
    type: 'section',
    id: 'section-1',
    attributes: {
      name: 'Test Section',
      sequencenum: 1,
    },
  } as SectionD;

  const createMockRow = (overrides: Partial<ISheet> = {}): ISheet => ({
    level: SheetLevel.Section,
    kind: IwsKind.Section,
    sectionSeq: 1,
    passageSeq: 0,
    passageType: PassageTypeEnum.PASSAGE,
    deleted: false,
    filtered: false,
    published: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mocks
    (useGlobal as jest.Mock).mockReturnValue([mockMemory, jest.fn()]);
    (useContext as jest.Mock).mockReturnValue(mockPlanContext);
    (findRecord as jest.Mock).mockReturnValue(undefined);
    (sectionDescription as jest.Mock).mockReturnValue(
      'Mocked Section Description'
    );

    // Mock useMemo to return the Map directly
    (useMemo as jest.Mock).mockImplementation((factory) => factory());
  });

  it('should return a function that gets section description', () => {
    const { result } = renderHook(() => useSectionIdDescription());

    expect(typeof result.current).toBe('function');
  });

  it('should create a sectionMap from sectionArr', () => {
    const { result } = renderHook(() => useSectionIdDescription());

    // The hook should have created a Map from the sectionArr
    expect(result.current).toBeDefined();
  });

  it('should return section description when given a valid row with sectionId', () => {
    const mockRow = createMockRow({
      sectionId: { type: 'section', id: 'section-1' },
    });

    (findRecord as jest.Mock).mockReturnValue(mockSection);
    (sectionDescription as jest.Mock).mockReturnValue('1  Test Section');

    const { result } = renderHook(() => useSectionIdDescription());

    const getSectionDescription = result.current;
    const description = getSectionDescription(mockRow);

    expect(findRecord).toHaveBeenCalledWith(mockMemory, 'section', 'section-1');
    expect(sectionDescription).toHaveBeenCalledWith(
      mockSection,
      expect.any(Map)
    );
    expect(description).toBe('1  Test Section');
  });

  it('should handle empty sectionId gracefully', () => {
    const mockRow = createMockRow({
      sectionId: { type: 'section', id: '' },
    });

    (findRecord as jest.Mock).mockReturnValue(undefined);
    (sectionDescription as jest.Mock).mockReturnValue('');

    const { result } = renderHook(() => useSectionIdDescription());

    const getSectionDescription = result.current;
    const description = getSectionDescription(mockRow);

    expect(findRecord).toHaveBeenCalledWith(mockMemory, 'section', '');
    expect(sectionDescription).toHaveBeenCalledWith(undefined, expect.any(Map));
    expect(description).toBe('');
  });

  it('should handle undefined sectionId', () => {
    const mockRow = createMockRow({
      sectionId: undefined,
    });

    (findRecord as jest.Mock).mockReturnValue(undefined);
    (sectionDescription as jest.Mock).mockReturnValue('');

    const { result } = renderHook(() => useSectionIdDescription());

    const getSectionDescription = result.current;
    const description = getSectionDescription(mockRow);

    expect(findRecord).toHaveBeenCalledWith(mockMemory, 'section', '');
    expect(sectionDescription).toHaveBeenCalledWith(undefined, expect.any(Map));
    expect(description).toBe('');
  });

  it('should handle when findRecord returns undefined', () => {
    const mockRow = createMockRow({
      sectionId: { type: 'section', id: 'nonexistent-section' },
    });

    (findRecord as jest.Mock).mockReturnValue(undefined);
    (sectionDescription as jest.Mock).mockReturnValue('');

    const { result } = renderHook(() => useSectionIdDescription());

    const getSectionDescription = result.current;
    const description = getSectionDescription(mockRow);

    expect(findRecord).toHaveBeenCalledWith(
      mockMemory,
      'section',
      'nonexistent-section'
    );
    expect(sectionDescription).toHaveBeenCalledWith(undefined, expect.any(Map));
    expect(description).toBe('');
  });

  it('should create a new Map when sectionArr changes', () => {
    const initialSectionArr: [number, string][] = [[1, 'Initial Section']];

    const updatedSectionArr: [number, string][] = [
      [1, 'Updated Section'],
      [2, 'New Section'],
    ];

    // Setup initial context
    (useContext as jest.Mock).mockReturnValue({
      state: {
        sectionArr: initialSectionArr,
      },
    });

    const { result, rerender } = renderHook(() => useSectionIdDescription());

    // Update context for rerender
    (useContext as jest.Mock).mockReturnValue({
      state: {
        sectionArr: updatedSectionArr,
      },
    });

    // Rerender with updated context
    rerender();

    // Test that the updated sectionArr is being used (function may change due to useMemo)
    const mockRow = createMockRow({
      sectionId: { type: 'section', id: 'section-1' },
    });

    (findRecord as jest.Mock).mockReturnValue(mockSection);
    (sectionDescription as jest.Mock).mockReturnValue(
      'Description with updated map'
    );

    const getSectionDescription = result.current;
    getSectionDescription(mockRow);

    // Verify that sectionDescription was called with the expected Map
    const callArgs = (sectionDescription as jest.Mock).mock.calls[
      (sectionDescription as jest.Mock).mock.calls.length - 1
    ];
    const passedMap = callArgs[1] as Map<number, string>;
    expect(passedMap.size).toBe(updatedSectionArr.length);
    expect(passedMap.get(1)).toBe('Updated Section');
    expect(passedMap.get(2)).toBe('New Section');
  });

  it('should pass the correct parameters to sectionDescription', () => {
    const mockRow = createMockRow({
      sectionId: { type: 'section', id: 'section-1' },
    });

    (findRecord as jest.Mock).mockReturnValue(mockSection);

    const { result } = renderHook(() => useSectionIdDescription());

    const getSectionDescription = result.current;
    getSectionDescription(mockRow);

    expect(sectionDescription).toHaveBeenCalledWith(
      mockSection,
      expect.any(Map)
    );

    // Verify the Map contains the expected values
    const callArgs = (sectionDescription as jest.Mock).mock.calls[0];
    const passedMap = callArgs[1] as Map<number, string>;
    expect(passedMap.get(1)).toBe('Section One');
    expect(passedMap.get(2)).toBe('Section Two');
    expect(passedMap.get(3)).toBe('Section Three');
  });

  it('should handle memory being undefined', () => {
    (useGlobal as jest.Mock).mockReturnValue([undefined as any, jest.fn()]);

    const mockRow = createMockRow({
      sectionId: { type: 'section', id: 'section-1' },
    });

    const { result } = renderHook(() => useSectionIdDescription());

    const getSectionDescription = result.current;
    getSectionDescription(mockRow);

    expect(findRecord).toHaveBeenCalledWith(undefined, 'section', 'section-1');
  });
});
