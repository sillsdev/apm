import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const mockSetTeamLanguage = jest.fn();

// The crud barrel pulls in getOrgs, which Jest can't parse (import.meta).
jest.mock('../../crud', () => ({
  ArtifactTypeSlug: jest.requireActual('../../crud/artifactTypeSlug')
    .ArtifactTypeSlug,
  defaultSpellCheckForArtifact: () => false,
  resolveStepSpellCheck: () => false,
  // An empty artifactTypeId is the Vernacular step.
  useArtifactType: () => ({
    slugFromId: (id: string | null) => id || 'vernacular',
  }),
}));

jest.mock('../../crud/useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({
    getOrgDefault: (label: string) =>
      label === 'langProps'
        ? { bcp47: 'am', languageName: 'Amharic', font: '', rtl: false }
        : undefined,
    setOrgDefault: jest.fn(),
  }),
}));

jest.mock('../../crud/useSetTeamLanguage', () => ({
  useSetTeamLanguage: () => mockSetTeamLanguage,
}));

jest.mock('./useTranscribeStepAsr', () => ({
  useTranscribeStepAsr: () => ({
    asr: {},
    setAsr: jest.fn(),
    showSisterLanguage: false,
  }),
}));

jest.mock('../Sheet/SelectArtifactType', () => ({
  __esModule: true,
  default: () => null,
}));

// Like the real picker, report the current value once on mount, then the
// user's pick on click.
jest.mock('../../control', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  return {
    Language: (props: {
      bcp47?: string;
      languageName?: string;
      onChange: (lang: unknown) => void;
    }) => {
      ReactActual.useEffect(() => {
        props.onChange({
          bcp47: props.bcp47,
          languageName: props.languageName,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <button
          type="button"
          onClick={() =>
            props.onChange({ bcp47: 'en', languageName: 'English' })
          }
        >
          pick language
        </button>
      );
    },
  };
});

jest.mock('../../business/asr/AsrSettings', () => ({
  AsrSettings: () => null,
}));

jest.mock('../../business/asr/useRecommendAsrLanguage', () => ({
  useRecommendAsrLanguage: () => ({
    suggestions: [],
    loading: false,
    error: '',
    fetchRecommendations: jest.fn(),
    seedSuggestions: jest.fn(),
    reset: jest.fn(),
  }),
}));

jest.mock('../../business/asr/asrLanguages', () => ({
  isoFromBcp47: (bcp: string) => bcp,
  isValidAsrLanguage: async () => true,
  resolveAsrBcp47: async (bcp: string) => bcp,
}));

jest.mock('../../selector', () => ({
  transcriberSelector: 'transcriber',
  vProjectSelector: 'vProject',
}));

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({ spellCheck: 'Spell check' }),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [false],
}));

jest.mock('../../../api-variable', () => ({ isElectron: false }));

// The utils barrel loads modules that need app config; only these two are used.
jest.mock('../../utils', () => ({
  JSONParse: jest.requireActual('../../utils/jsonParse').JSONParse,
  isLangSet: jest.requireActual('../../utils/langTag').isLangSet,
}));

import { TranscribeStepSettings } from './TranscribeStepSettings';

describe('TranscribeStepSettings', () => {
  beforeEach(() => mockSetTeamLanguage.mockReset());

  it('changes the team language through the team-language helper', () => {
    render(
      <TranscribeStepSettings
        org="org-1"
        isOpen
        toolSettings='{"artifactTypeId":""}'
        onChange={jest.fn()}
      />
    );
    // Opening the picker only echoes the current language.
    expect(mockSetTeamLanguage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'pick language' }));

    expect(mockSetTeamLanguage).toHaveBeenCalledWith(
      expect.objectContaining({ bcp47: 'en' }),
      'org-1'
    );
  });
});
