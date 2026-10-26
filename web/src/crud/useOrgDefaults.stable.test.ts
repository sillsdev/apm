import { jest, describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react';

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    const values: Record<string, unknown> = {
      memory: undefined,
      user: 'u',
      organization: 'org-1',
      offline: false,
      offlineOnly: false,
      orgRole: 'Admin',
    };
    return [values[key], () => undefined];
  },
}));

jest.mock('../utils', () => {
  const params = jest.requireActual(
    '../utils/useJsonParams'
  ) as typeof import('../utils/useJsonParams');
  return { useJsonParams: params.useJsonParams };
});

import { useOrgDefaults } from './useOrgDefaults';

describe('useOrgDefaults', () => {
  it('keeps getOrgDefault the same function across renders', () => {
    const { result, rerender } = renderHook(() => useOrgDefaults());
    const first = result.current.getOrgDefault;
    rerender();
    expect(result.current.getOrgDefault).toBe(first);
  });
});
