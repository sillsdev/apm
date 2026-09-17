import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ToolSlug } from '../../../crud/toolSlug';
import { ArtifactTypeSlug } from '../../../crud/artifactTypeSlug';

jest.mock('../../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'offline') return [false];
    if (key === 'project') return ['proj1'];
    if (key === 'organization') return ['org1'];
    if (key === 'mobileView') return [false, jest.fn()];
    return [undefined];
  }),
}));

jest.mock('../../../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => ({ currentstep: 'step1' }),
}));

let mockStepSettings: Record<string, unknown> = {
  artifactTypeId: 'pbt-type-id',
};

jest.mock('../../../crud', () => ({
  orgDefaultFeatures: 'features',
  useOrgDefaults: () => ({
    getOrgDefault: () => ({ aiTranscribe: true }),
  }),
  getFontData: jest.fn().mockResolvedValue({
    fontFamily: 'Arial',
    fontSize: '16px',
    fontDir: 'ltr',
    langTag: 'en',
    spellCheck: false,
    fontConfig: { custom: { families: [''], urls: [''] } },
  }),
  findRecord: jest.fn(() => ({ id: 'proj1', type: 'project' })),
  useStepTool: () => ({ settings: mockStepSettings }),
}));

jest.mock('../../../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => [{ id: 'org1', type: 'organization' }]),
}));

jest.mock('../../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({
    saveProjectAsrSettings: jest.fn(),
    saveTeamAsrSettings: jest.fn(),
  }),
}));

const mockUseBoldClauseTranscriptionAsrSettings = jest.fn(() => ({
  asrSettings: {
    target: 'language',
    language: { bcp47: 'ta', languageName: 'Tamil' },
  },
  asrIsoReady: true,
  needsSisterLanguage: () => false,
}));

jest.mock('../../../crud/getLwcTranslationAsrSettings', () => ({
  useBoldClauseTranscriptionAsrSettings: () =>
    mockUseBoldClauseTranscriptionAsrSettings(),
}));

jest.mock('../../../utils/useLocLangName', () => ({
  useLocLangName: () => [
    (bcp47: string) => {
      const names: Record<string, string> = {
        ta: 'Tamil',
        en: 'English',
        kn: 'Kannada',
      };
      return names[bcp47] ?? '';
    },
    jest.fn(),
  ],
}));

// Leaf-mock the ASR settings module: importing the real one pulls in the utils
// barrel (react-router) which the jsdom test env lacks a TextEncoder for. We
// only need its pure language-field parser here.
jest.mock('../../../crud/transcribeStepAsrSettings', () => ({
  parseStepLanguageField: (value: unknown) => {
    if (value == null || value === '') {
      return { languageName: '', bcp47: 'und' };
    }
    if (typeof value === 'object') {
      const obj = value as { languageName?: unknown; bcp47?: unknown };
      return {
        languageName: String(obj.languageName ?? ''),
        bcp47: String(obj.bcp47 ?? 'und'),
      };
    }
    const str = String(value);
    const trimmed = str.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed) as {
          languageName?: unknown;
          bcp47?: unknown;
        };
        return {
          languageName: String(obj.languageName ?? ''),
          bcp47: String(obj.bcp47 ?? 'und'),
        };
      } catch {
        // fall through
      }
    }
    const pipe = str.indexOf('|');
    if (pipe === -1) {
      return { languageName: '', bcp47: str || 'und' };
    }
    return {
      languageName: str.slice(0, pipe),
      bcp47: str.slice(pipe + 1) || 'und',
    };
  },
}));

jest.mock('../../../utils/useCheckOnline', () => ({
  useCheckOnline: () => (cb: (online: boolean) => void) => cb(true),
}));

jest.mock('../../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../../selector', () => ({
  lwcTranscriptionSelector: { name: 'lwcTranscriptionSelector' },
  carefulTranscriptionSelector: { name: 'carefulTranscriptionSelector' },
  sharedSelector: { name: 'sharedSelector' },
  transcriberSelector: { name: 'transcriberSelector' },
  wsAudioPlayerSelector: { name: 'wsAudioPlayerSelector' },
}));

jest.mock('../../../hoc/BigDialog', () => ({
  __esModule: true,
  default: ({
    children,
    isOpen,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
  }) =>
    isOpen ? <div data-testid="asr-progress-dialog">{children}</div> : null,
}));

jest.mock('react-redux', () => ({
  useSelector: (selector: { name?: string }) => {
    if (selector.name === 'transcriberSelector') {
      return { aiAutomaticTranscription: 'Auto Translation', run: 'Run' };
    }
    if (selector.name === 'wsAudioPlayerSelector') {
      return {
        autoTranscription: 'Auto Transcription...',
        recognizeProgress: 'Auto Transcription in Progress',
        recognizeSpeech: 'Auto Transcription {0}',
        recognizeSpeechSettings: 'Speech Settings',
      };
    }
    if (selector.name === 'sharedSelector') {
      return { mustBeOnline: 'Must be online', ai: 'AI' };
    }
    if (selector.name === 'carefulTranscriptionSelector') {
      return {
        nextClause: 'Next Clause',
        noRecordingLanguage: 'No recording language',
      };
    }
    return {
      nextClause: 'Next Clause',
      noLwcLanguage: 'No LWC language',
    };
  },
  shallowEqual: jest.fn(),
}));

jest.mock('../../../control/WebFontStyles', () => ({
  StyledTextAreaAutosize: ({
    value,
    onChange,
    overrides,
  }: {
    value: string;
    onChange: (e: { target: { value: string } }) => void;
    overrides?: React.CSSProperties;
  }) => (
    <textarea
      data-cy="lwc-transcription-text"
      value={value}
      onChange={onChange}
      style={overrides}
    />
  ),
}));

jest.mock('../../../control', () => ({
  Button: ({
    children,
    id,
    title,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    id?: string;
    title?: string;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      id={id}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  ),
  LightTooltip: ({
    title,
    children,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <div data-testid="asr-tooltip">{title}</div>
      {children}
    </div>
  ),
}));

jest.mock('../../../control/TranscriptionLogo', () => ({
  __esModule: true,
  default: () => <span>logo</span>,
}));

jest.mock('../../../business/asr/AsrProgress', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../business/asr/SelectAsrLanguage', () => ({
  __esModule: true,
  default: () => <div data-testid="select-asr-language" />,
}));

jest.mock('./useTranscriptionAutosave', () => ({
  useTranscriptionAutosave: () => ({ flushSave: jest.fn() }),
}));

import BoldClauseTranscriptionEditor from './BoldClauseTranscriptionEditor';

const memory = { update: jest.fn() } as never;

const lwcConfig = {
  stringsLayout: 'lwcTranscription' as const,
  upstreamTool: ToolSlug.PhraseBackTranslate,
  idPrefix: 'lwc-transcription',
  toolId: 'LwcTranscriptionTool',
  defaultArtifactSlug: ArtifactTypeSlug.PhraseBackTranslation,
};

const baseProps: React.ComponentProps<typeof BoldClauseTranscriptionEditor> = {
  width: 400,
  mediafile: {
    id: 'mf1',
    type: 'mediafile',
    attributes: { transcription: '' },
  } as never,
  text: '',
  onTextChange: jest.fn(),
  memory,
  user: 'user1',
  onNextClause: jest.fn(),
  allClausesComplete: false,
  currentClauseTranscribed: false,
  navigationDisabled: false,
  onAsrActiveChange: jest.fn(),
  onTranscriptionSaved: jest.fn(),
  transcriptionConfig: lwcConfig,
};

describe('BoldClauseTranscriptionEditor', () => {
  beforeEach(() => {
    mockStepSettings = { artifactTypeId: 'pbt-type-id' };
    mockUseBoldClauseTranscriptionAsrSettings.mockReturnValue({
      asrSettings: {
        target: 'language',
        language: { bcp47: 'ta', languageName: 'Tamil' },
      },
      asrIsoReady: true,
      needsSisterLanguage: () => false,
    });
  });

  it('disables Auto Transcription when text is present', () => {
    render(
      <BoldClauseTranscriptionEditor {...baseProps} text="existing text" />
    );
    expect(
      screen.getByRole('button', { name: /Auto Transcription/i })
    ).toBeDisabled();
  });

  it('enables Auto Transcription when text is empty', () => {
    render(<BoldClauseTranscriptionEditor {...baseProps} text="" />);
    expect(
      screen.getByRole('button', { name: /Auto Transcription/i })
    ).not.toBeDisabled();
    expect(screen.queryByTestId('SettingsIcon')).not.toBeInTheDocument();
  });

  it('opens ASR language settings from the button when the language is not ready', () => {
    mockUseBoldClauseTranscriptionAsrSettings.mockReturnValueOnce({
      asrSettings: {
        target: 'language',
        language: { bcp47: 'ta', languageName: 'Tamil' },
      },
      asrIsoReady: false,
      needsSisterLanguage: () => false,
    });

    render(<BoldClauseTranscriptionEditor {...baseProps} text="" />);
    const asrButton = screen.getByRole('button', {
      name: /Auto Transcription/i,
    });
    expect(asrButton).not.toBeDisabled();
    expect(screen.queryByTestId('select-asr-language')).not.toBeInTheDocument();
    fireEvent.click(asrButton);
    expect(screen.getByTestId('select-asr-language')).toBeInTheDocument();
  });

  it('caps transcription field height so long text scrolls inside (TT-7516)', () => {
    render(
      <BoldClauseTranscriptionEditor
        {...baseProps}
        text={'line\n'.repeat(80)}
      />
    );
    const el = document.querySelector(
      '[data-cy="lwc-transcription-text"]'
    ) as HTMLTextAreaElement;
    expect(el).toBeTruthy();
    expect(el.style.maxHeight).toBe('240px');
    expect(el.style.overflowY).toBe('auto');
  });

  it('shows ASR language in tooltip on AI Automatic Transcription button (TT-7514)', () => {
    mockStepSettings = {
      artifactTypeId: 'pbt-type-id',
      language: 'Tamil|ta',
    };
    render(<BoldClauseTranscriptionEditor {...baseProps} text="" />);
    const tip = screen.getByRole('button', {
      name: /Auto Transcription/i,
    }).title;
    expect(tip).toMatch(/Auto Transcription/);
    expect(tip).toMatch(/Tamil/);
  });

  it('shows primary and sister language in tooltip when sister is used for ASR (TT-7514)', () => {
    mockStepSettings = {
      artifactTypeId: 'pbt-type-id',
      language: 'Kannada|kn',
      sisterlanguage: 'English|en',
    };
    mockUseBoldClauseTranscriptionAsrSettings.mockReturnValue({
      asrSettings: {
        target: 'language',
        language: { bcp47: 'en', languageName: 'English' },
      },
      asrIsoReady: true,
      needsSisterLanguage: () => false,
    });
    render(<BoldClauseTranscriptionEditor {...baseProps} text="" />);
    const tip = screen.getByRole('button', {
      name: /Auto Transcription/i,
    }).title;
    expect(tip).toMatch(/Kannada/);
    expect(tip).toMatch(/English/);
  });
});
