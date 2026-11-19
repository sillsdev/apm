import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';

jest.mock('../../hoc/useOrbitData', () => ({ useOrbitData: jest.fn() }));
jest.mock('../../context/useGlobal', () => ({ useGlobal: jest.fn() }));

import { useOrbitData } from '../../hoc/useOrbitData';
import { useGlobal } from '../../context/useGlobal';
import { useUserProjectIds } from './useUserProjectIds';

const rel = (type: string, id: string) => ({ data: { type, id } });

const project = (id: string, group: string) => ({
  id,
  type: 'project',
  attributes: { name: id },
  relationships: { group: rel('group', group) },
});

const membership = (id: string, user: string, group: string) => ({
  id,
  type: 'groupmembership',
  attributes: {},
  relationships: { user: rel('user', user), group: rel('group', group) },
});

// Stable references so useMemo deps do not churn between renders.
let orbitProjects: unknown[] = [];
let orbitGroupMemberships: unknown[] = [];
let currentUser = 'user-a';

describe('useUserProjectIds', () => {
  beforeEach(() => {
    // A shared device: Orbit still holds user-b's project and membership
    // from an earlier sign-in, alongside user-a's.
    orbitProjects = [
      project('proj-a', 'group-a'),
      project('proj-b', 'group-b'),
    ];
    orbitGroupMemberships = [
      membership('gm-a', 'user-a', 'group-a'),
      membership('gm-b', 'user-b', 'group-b'),
    ];
    currentUser = 'user-a';
    (useOrbitData as jest.Mock).mockImplementation((model: unknown) => {
      if (model === 'project') return orbitProjects;
      if (model === 'groupmembership') return orbitGroupMemberships;
      return [];
    });
    (useGlobal as jest.Mock).mockImplementation((key: unknown) => [
      key === 'user' ? currentUser : undefined,
      jest.fn(),
    ]);
  });

  it("excludes another account's retained projects (CWE-862)", () => {
    const { result } = renderHook(() => useUserProjectIds());
    expect([...result.current].sort()).toEqual(['proj-a']);
  });

  it('follows an account switch without exposing the previous account', () => {
    const { result, rerender } = renderHook(() => useUserProjectIds());
    currentUser = 'user-b';
    rerender();
    expect([...result.current].sort()).toEqual(['proj-b']);
  });

  it('returns no projects before a user is signed in', () => {
    currentUser = '';
    const { result } = renderHook(() => useUserProjectIds());
    expect(result.current.size).toBe(0);
  });
});
