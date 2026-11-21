import { jest, describe, it, beforeEach, expect } from '@jest/globals';

const mockGetOrgDefault = jest.fn();
const mockSetTeamLanguageForNewProject = jest.fn();

jest.mock('../../crud/useOrgDefaults', () => ({
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({ getOrgDefault: mockGetOrgDefault }),
}));
jest.mock('../../crud/useSetTeamLanguage', () => ({
  useSetTeamLanguageForNewProject: () => mockSetTeamLanguageForNewProject,
}));

import { renderHook } from '@testing-library/react';
import { initLang } from '../../control/initLang';
import { useNewProjectLanguage } from './useNewProjectLanguage';

const french = {
  bcp47: 'fr',
  languageName: 'French',
  font: 'charissil',
  rtl: false,
  spellCheck: false,
};

describe('useNewProjectLanguage (TT-7802)', () => {
  beforeEach(() => {
    mockGetOrgDefault.mockReset();
    mockSetTeamLanguageForNewProject.mockReset();
  });

  it('starts a new project in the team language', () => {
    mockGetOrgDefault.mockReturnValue(french);
    const { result } = renderHook(() => useNewProjectLanguage('team-1'));
    expect(result.current.teamLanguage()).toEqual(french);
    expect(mockGetOrgDefault).toHaveBeenCalledWith('langProps', 'team-1');
  });

  it('reads the team language when asked, not when first rendered', () => {
    mockGetOrgDefault.mockReturnValue(undefined);
    const { result } = renderHook(() => useNewProjectLanguage('team-1'));
    expect(result.current.teamLanguage()).toEqual(initLang);
    mockGetOrgDefault.mockReturnValue(french);
    expect(result.current.teamLanguage()).toEqual(french);
  });

  it('falls back to no language without a team', () => {
    const { result } = renderHook(() => useNewProjectLanguage(undefined));
    expect(result.current.teamLanguage()).toEqual(initLang);
    expect(mockGetOrgDefault).not.toHaveBeenCalled();
  });

  it('offers the created project language to the team', () => {
    const { result } = renderHook(() => useNewProjectLanguage('team-1'));
    result.current.rememberLanguage(french);
    expect(mockSetTeamLanguageForNewProject).toHaveBeenCalledWith(
      french,
      'team-1'
    );
  });

  it('remembers nothing without a team', () => {
    const { result } = renderHook(() => useNewProjectLanguage(undefined));
    result.current.rememberLanguage(french);
    expect(mockSetTeamLanguageForNewProject).not.toHaveBeenCalled();
  });
});
