import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';

// The team's saved segment settings. Like the real getter, each read parses a
// fresh object and the getter itself is new on every render.
let mockTeamParams: string | undefined;
jest.mock('../../../../crud/useOrgDefaults', () => ({
  useOrgDefaults: () => ({
    getOrgDefault: () =>
      mockTeamParams ? JSON.parse(mockTeamParams) : undefined,
  }),
}));

jest.mock('../../../../utils/namedSegments', () => ({
  NamedRegions: { Transcription: 'Transcription' },
}));

import { useTeamSegParams } from './useTeamSegParams';

const params = (segLenThreshold: number) => ({
  silenceThreshold: 0.004,
  timeThreshold: 0.02,
  segLenThreshold,
});

describe('useTeamSegParams', () => {
  beforeEach(() => {
    mockTeamParams = JSON.stringify(params(0.5));
  });

  it('starts from the team settings', () => {
    const { result } = renderHook(() => useTeamSegParams());
    expect(result.current[0]).toEqual(params(0.5));
  });

  it('keeps a local edit across renders while the team settings are unchanged', () => {
    const { result, rerender } = renderHook(() => useTeamSegParams());
    act(() => result.current[1](params(1)));
    rerender();
    rerender();
    expect(result.current[0]).toEqual(params(1));
  });

  it('adopts the team settings when they change', () => {
    const { result, rerender } = renderHook(() => useTeamSegParams());
    act(() => result.current[1](params(1)));
    mockTeamParams = JSON.stringify(params(2));
    rerender();
    expect(result.current[0]).toEqual(params(2));
  });

  it('uses built-in settings when the team has none', () => {
    mockTeamParams = undefined;
    const { result } = renderHook(() => useTeamSegParams());
    expect(result.current[0]).toEqual(params(0.5));
  });
});
