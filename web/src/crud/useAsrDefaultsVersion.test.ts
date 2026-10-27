import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';

let mockTeamParams = '{}';
let mockProjectParams = '{}';

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => [
    key === 'organization' ? 'org-1' : key === 'project' ? 'proj-1' : undefined,
  ],
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: (table: string) =>
    table === 'organization'
      ? [{ id: 'org-1', attributes: { defaultParams: mockTeamParams } }]
      : [{ id: 'proj-1', attributes: { defaultParams: mockProjectParams } }],
}));

// The real module pulls in getOrgs, which Jest can't parse (import.meta).
jest.mock('./useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
}));

import { useAsrDefaultsVersion } from './useAsrDefaultsVersion';

describe('useAsrDefaultsVersion', () => {
  beforeEach(() => {
    mockTeamParams = JSON.stringify({ asr: { asrIso: 'eng' } });
    mockProjectParams = JSON.stringify({ ProjectFilter: 'a' });
  });

  it('changes when the team ASR changes', () => {
    const { result, rerender } = renderHook(() => useAsrDefaultsVersion());
    const first = result.current;
    mockTeamParams = JSON.stringify({ asr: { asrIso: 'fra' } });
    rerender();
    expect(result.current).not.toBe(first);
  });

  it('changes when the project ASR choice changes', () => {
    const { result, rerender } = renderHook(() => useAsrDefaultsVersion());
    const first = result.current;
    mockProjectParams = JSON.stringify({
      ProjectFilter: 'a',
      asr: { asrIso: 'spa' },
    });
    rerender();
    expect(result.current).not.toBe(first);
  });

  it('ignores other saved defaults', () => {
    const { result, rerender } = renderHook(() => useAsrDefaultsVersion());
    const first = result.current;
    mockProjectParams = JSON.stringify({ ProjectFilter: 'b' });
    rerender();
    expect(result.current).toBe(first);
  });
});
