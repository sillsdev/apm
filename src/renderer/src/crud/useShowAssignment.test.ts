import { renderHook } from '@testing-library/react';
import { useShowAssignment } from './useShowAssignment';
import { OrganizationD } from '../model';

let mockOfflineOnly = false;
let mockTeam = 'team-1';
let mockOrganizations: OrganizationD[] = [];

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'offlineOnly') return [mockOfflineOnly, jest.fn()];
    if (key === 'organization') return [mockTeam, jest.fn()];
    return [undefined, jest.fn()];
  }),
}));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: () => mockOrganizations,
}));

describe('useShowAssignment', () => {
  beforeEach(() => {
    mockOfflineOnly = false;
    mockTeam = 'team-1';
    mockOrganizations = [];
  });

  it('returns false when organizations are not loaded yet', () => {
    const { result } = renderHook(() => useShowAssignment());
    expect(result.current).toBe(false);
  });

  it('returns false for personal team org name', () => {
    mockOrganizations = [
      {
        id: 'team-1',
        type: 'organization',
        attributes: { name: '>User Personal<' },
      } as OrganizationD,
    ];
    const { result } = renderHook(() => useShowAssignment());
    expect(result.current).toBe(false);
  });

  it('returns true for non-personal team when org is loaded', () => {
    mockOrganizations = [
      {
        id: 'team-1',
        type: 'organization',
        attributes: { name: 'My Team' },
      } as OrganizationD,
    ];
    const { result } = renderHook(() => useShowAssignment());
    expect(result.current).toBe(true);
  });

  it('returns false when offlineOnly', () => {
    mockOfflineOnly = true;
    mockOrganizations = [
      {
        id: 'team-1',
        type: 'organization',
        attributes: { name: 'My Team' },
      } as OrganizationD,
    ];
    const { result } = renderHook(() => useShowAssignment());
    expect(result.current).toBe(false);
  });
});
