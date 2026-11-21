/**
 * TT-7888: CIT comments must save as needing approval and mentors must see the
 * Approve checkbox. Both depend on usePermissions knowing the user's peer group
 * permissions, which come from usePeerGroups' myGroups.
 */
import { renderHook } from '@testing-library/react';
import { PermissionName, usePermissions } from './usePermissions';

const mockUser = 'user-cit';
let mockOrg = 'org-1';
let mockData: Record<string, unknown[]> = {};

jest.mock('../context/useGlobal', () => ({
  useGlobal: (prop: string) => {
    if (prop === 'user') return [mockUser, jest.fn()];
    if (prop === 'organization') return [mockOrg, jest.fn()];
    if (prop === 'offlineOnly') return [false, jest.fn()];
    return [undefined, jest.fn()];
  },
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({ getString: (s: string) => s }),
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({ permissionsSelector: jest.fn() }));

jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: (model: string) => mockData[model] ?? [],
}));

// usePeerGroups imports the crud barrel; keep the real `related` and enum.
jest.mock('./index', () => ({
  related: jest.requireActual('./related').related,
  PermissionName: { Mentor: 'mentor', CIT: 'consultantInTraining' },
  useAllUserGroup: () => () => ({ id: 'all-users' }),
  useUser: () => ({ getUserRec: () => undefined }),
}));

jest.mock('../utils', () => ({
  onlyUnique: jest.requireActual('../utils/onlyUnique').onlyUnique,
}));

jest.mock('./remoteId', () => ({
  __esModule: true,
  default: (_t: string, id: string) => id,
  remoteIdGuid: (_t: string, id: string) => id,
}));

const rel = (type: string, id: string) => ({ data: { type, id } });

const peerGroup = (id: string, owner: string, permission: string) => ({
  type: 'group',
  id,
  attributes: {
    name: id,
    permissions: JSON.stringify({ permissions: permission }),
    allUsers: false,
  },
  relationships: { owner: rel('organization', owner) },
});

const membership = (id: string, group: string) => ({
  type: 'groupmembership',
  id,
  attributes: {},
  relationships: {
    user: rel('user', mockUser),
    group: rel('group', group),
  },
});

const citGroup = peerGroup('grp-cit', 'org-1', PermissionName.CIT);

describe('usePermissions (TT-7888)', () => {
  beforeEach(() => {
    mockOrg = 'org-1';
    mockData = {
      user: [{ type: 'user', id: mockUser, attributes: {} }],
      group: [citGroup],
      groupmembership: [membership('gm-1', 'grp-cit')],
    };
  });

  it('reports CIT permission for a member of a CIT peer group', () => {
    const { result } = renderHook(() => usePermissions());
    expect(result.current.hasPermission(PermissionName.CIT)).toBe(true);
    expect(result.current.hasPermission(PermissionName.Mentor)).toBe(false);
  });

  it('picks up a peer group that loads after the membership', () => {
    mockData = { ...mockData, group: [] };
    const { result, rerender } = renderHook(() => usePermissions());
    expect(result.current.hasPermission(PermissionName.CIT)).toBe(false);

    mockData = { ...mockData, group: [citGroup] };
    rerender();

    expect(result.current.hasPermission(PermissionName.CIT)).toBe(true);
  });

  it('follows a peer group permission change made after mount', () => {
    mockData = {
      ...mockData,
      group: [peerGroup('grp-cit', 'org-1', '')],
    };
    const { result, rerender } = renderHook(() => usePermissions());
    expect(result.current.hasPermission(PermissionName.Mentor)).toBe(false);

    mockData = {
      ...mockData,
      group: [peerGroup('grp-cit', 'org-1', PermissionName.Mentor)],
    };
    rerender();

    expect(result.current.hasPermission(PermissionName.Mentor)).toBe(true);
  });

  it('uses the current team when the organization changes after mount', () => {
    mockData = {
      ...mockData,
      group: [
        citGroup,
        peerGroup('grp-mentor', 'org-2', PermissionName.Mentor),
      ],
      groupmembership: [membership('gm-2', 'grp-mentor')],
    };
    const { result, rerender } = renderHook(() => usePermissions());
    expect(result.current.hasPermission(PermissionName.Mentor)).toBe(false);

    mockOrg = 'org-2';
    rerender();

    expect(result.current.hasPermission(PermissionName.Mentor)).toBe(true);
  });

  it('knows the permission on the first render (no empty window)', () => {
    const seen: boolean[] = [];
    renderHook(() => {
      const p = usePermissions();
      seen.push(p.hasPermission(PermissionName.CIT));
      return p;
    });
    expect(seen[0]).toBe(true);
  });
});
