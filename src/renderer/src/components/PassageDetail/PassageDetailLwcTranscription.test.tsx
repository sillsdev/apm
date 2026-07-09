import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

let mockLwcRecordingComplete = new Set<number>();
let mockTranscribed = new Set<number>();
let editorProps: Record<string, unknown> | undefined;
let navProps: Record<string, unknown> | undefined;
let progressProps: Record<string, unknown> | undefined;
let mockStepSettings = JSON.stringify({ artifactTypeId: 'pbt-id' });
let mockCurrentStep = 'step1';
const mockSetStepComplete = jest.fn();
const mockStepComplete = jest.fn(() => false);

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'memory') return [{ keyMap: {}, update: jest.fn() }];
    if (key === 'user') return ['user1'];
    return [undefined];
  }),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => [
    {
      id: 'm1',
      type: 'mediafile',
      attributes: { versionNumber: 1, segments: '[]' },
    },
  ]),
}));

jest.mock('../../context/usePassageDetailContext', () => () => ({
  mediafileId: 'm1',
  rowData: [],
  currentstep: mockCurrentStep,
  setStepComplete: mockSetStepComplete,
  stepComplete: mockStepComplete,
  setRecording: jest.fn(),
  forceRefresh: jest.fn(),
}));

jest.mock('../../crud', () => ({
  ArtifactTypeSlug: {
    PhraseBackTranslation: 'backtranslation',
    CarefulSpeech: 'carefulspeech',
  },
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  useArtifactType: () => ({
    getTypeId: (slug: string) =>
      slug === 'backtranslation' ? 'pbt-id' : 'cs-id',
    slugFromId: (id: string) =>
      id === 'pbt-id'
        ? 'backtranslation'
        : id === 'cs-id'
          ? 'carefulspeech'
          : id,
  }),
  useStepTool: () => ({
    settings: mockStepSettings,
  }),
}));

jest.mock('../../context/UnsavedContext', () => ({
  UnsavedContext: React.createContext({
    state: {
      waitForSave: jest.fn().mockResolvedValue(undefined),
      startSave: jest.fn(),
      toolChanged: jest.fn(),
      saveCompleted: jest.fn(),
    },
  }),
}));

jest.mock('../../selector', () => ({
  lwcTranscriptionSelector: { name: 'lwcTranscriptionSelector' },
  carefulTranscriptionSelector: { name: 'carefulTranscriptionSelector' },
}));
jest.mock('react-redux', () => ({
  useSelector: (selector: { name?: string }) => {
    const strings = {
      prerequisite: 'Complete LWC Translation first',
      noClauses: 'No clauses',
      clauseIndex: 'Clause {0}/{1}',
      progress: '{0} of {1} transcribed',
      nextClause: 'Next Clause',
      noLwcLanguage: 'No LWC language',
      noRecordingLanguage: 'No recording language',
    };
    if (
      selector?.name === 'lwcTranscriptionSelector' ||
      selector?.name === 'carefulTranscriptionSelector'
    ) {
      return strings;
    }
    return {};
  },
  shallowEqual: jest.fn(),
}));

jest.mock('./lwcTranslation/useLwcTranslationClauses', () => ({
  useLwcTranslationClauses: jest.fn(() => ({
    clauseRegions: [{ start: 0, end: 5, label: '' }],
    bootstrapped: true,
    hasClauses: true,
  })),
}));

jest.mock('./carefulSpeech/carefulSpeechCompletion', () => ({
  getCompletedClauseIndices: jest.fn(() => mockLwcRecordingComplete),
  firstIncompleteClauseIndex: jest.requireActual(
    './carefulSpeech/carefulSpeechCompletion'
  ).firstIncompleteClauseIndex,
}));

jest.mock('./lwcTranscription/lwcTranscriptionCompletion', () => ({
  getTranscribedClauseIndices: jest.fn(() => mockTranscribed),
  getLwcRecordingRowForClause: jest.fn(() => ({
    mediafile: {
      id: 'pbt-mf1',
      type: 'mediafile',
      attributes: { transcription: '' },
    },
  })),
  firstIncompleteClauseIndex: jest.requireActual(
    './carefulSpeech/carefulSpeechCompletion'
  ).firstIncompleteClauseIndex,
}));

jest.mock('./boldClause/ClauseAudioPlayer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-cy="lwc-transcription-player" data-play-key={props.playKey} />
  ),
}));

jest.mock('./boldClause/BoldClauseNav', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    navProps = props;
    return (
      <div
        data-cy="lwc-transcription-clause-nav"
        data-complete={String(props.currentClauseComplete)}
        data-completed-count={String(props.completedCount)}
        data-current-index={String(props.currentIndex)}
      />
    );
  },
}));

jest.mock('./boldClause/ClauseProgress', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    progressProps = props;
    return (
      <div
        data-cy="clause-progress"
        data-completed-count={String(props.completedCount)}
      />
    );
  },
}));

jest.mock('./lwcTranscription/BoldClauseTranscriptionEditor', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    editorProps = props;
    return <div data-cy="lwc-transcription-editor" />;
  },
}));

import { PassageDetailLwcTranscription } from './PassageDetailLwcTranscription';

describe('PassageDetailLwcTranscription', () => {
  beforeEach(() => {
    mockLwcRecordingComplete = new Set<number>();
    mockTranscribed = new Set<number>();
    mockStepSettings = JSON.stringify({ artifactTypeId: 'pbt-id' });
    mockCurrentStep = 'step1';
    editorProps = undefined;
    navProps = undefined;
    mockSetStepComplete.mockClear();
    mockStepComplete.mockReset();
    mockStepComplete.mockReturnValue(false);
    const { useLwcTranslationClauses } = jest.requireMock(
      './lwcTranslation/useLwcTranslationClauses'
    ) as { useLwcTranslationClauses: jest.Mock };
    useLwcTranslationClauses.mockReturnValue({
      clauseRegions: [{ start: 0, end: 5, label: '' }],
      bootstrapped: true,
      hasClauses: true,
    });
    const { getLwcRecordingRowForClause } = jest.requireMock(
      './lwcTranscription/lwcTranscriptionCompletion'
    ) as { getLwcRecordingRowForClause: jest.Mock };
    getLwcRecordingRowForClause.mockReturnValue({
      mediafile: {
        id: 'pbt-mf1',
        type: 'mediafile',
        attributes: { transcription: '' },
      },
    });
  });

  it('shows prerequisite when LWC translation recordings are incomplete', () => {
    render(<PassageDetailLwcTranscription width={400} />);
    expect(
      screen.getByText('Complete LWC Translation first')
    ).toBeInTheDocument();
  });

  it('shows the guided UI when LWC translation recordings are complete', async () => {
    mockLwcRecordingComplete = new Set([0]);
    render(<PassageDetailLwcTranscription width={400} />);
    expect(
      document.querySelector('[data-cy="lwc-transcription-player"]')
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        document.querySelector('[data-cy="lwc-transcription-clause-nav"]')
      ).toBeTruthy();
      expect(
        document.querySelector('[data-cy="lwc-transcription-editor"]')
      ).toBeTruthy();
    });
  });

  it('auto-plays on first untranscribed clause entry', async () => {
    mockLwcRecordingComplete = new Set([0]);
    render(<PassageDetailLwcTranscription width={400} />);
    await waitFor(() => {
      const player = document.querySelector(
        '[data-cy="lwc-transcription-player"]'
      );
      expect(player?.getAttribute('data-play-key')).toBe('1');
    });
  });

  it('enters review mode without auto-play when all transcribed', async () => {
    mockLwcRecordingComplete = new Set([0]);
    mockTranscribed = new Set([0]);
    render(<PassageDetailLwcTranscription width={400} />);
    await waitFor(() => {
      const player = document.querySelector(
        '[data-cy="lwc-transcription-player"]'
      );
      expect(player?.getAttribute('data-play-key')).toBe('0');
    });
    expect(
      document.querySelector('[data-cy="lwc-transcription-clause-nav"]')
    ).toHaveAttribute('data-complete', 'true');
  });

  it('passes editor props for ASR and save integration', async () => {
    mockLwcRecordingComplete = new Set([0]);
    render(<PassageDetailLwcTranscription width={400} />);
    await waitFor(() => expect(editorProps).toBeDefined());
    expect(editorProps?.artifactTypeId).toBe('pbt-id');
    expect(typeof editorProps?.onAsrActiveChange).toBe('function');
  });

  it('marks step complete when all clauses are transcribed', async () => {
    mockLwcRecordingComplete = new Set([0]);
    mockTranscribed = new Set([0]);
    render(<PassageDetailLwcTranscription width={400} />);
    await waitFor(() =>
      expect(mockSetStepComplete).toHaveBeenCalledWith('step1', true)
    );
  });

  it('shows the first clause transcription that loads after entry', async () => {
    // Enter in review mode (all recorded + transcribed) so we land on clause 0.
    mockLwcRecordingComplete = new Set([0]);
    mockTranscribed = new Set([0]);

    const { getLwcRecordingRowForClause } = jest.requireMock(
      './lwcTranscription/lwcTranscriptionCompletion'
    ) as { getLwcRecordingRowForClause: jest.Mock };

    // First read: the recording row's transcription hasn't loaded yet.
    getLwcRecordingRowForClause.mockReturnValue({
      mediafile: {
        id: 'pbt-mf1',
        type: 'mediafile',
        attributes: { transcription: '' },
      },
    });

    const { rerender } = render(<PassageDetailLwcTranscription width={400} />);
    await waitFor(() => expect(editorProps).toBeDefined());
    expect(editorProps?.text).toBe('');

    // Now the saved transcription for the same clause becomes available.
    getLwcRecordingRowForClause.mockReturnValue({
      mediafile: {
        id: 'pbt-mf1',
        type: 'mediafile',
        attributes: { transcription: 'existing transcription' },
      },
    });
    rerender(<PassageDetailLwcTranscription width={400} />);

    await waitFor(() =>
      expect(editorProps?.text).toBe('existing transcription')
    );
  });

  it('resets progress and clause position when switching artifact type', async () => {
    const twelveClauses = Array.from({ length: 12 }, (_, i) => ({
      start: i,
      end: i + 1,
      label: '',
    }));
    const { useLwcTranslationClauses } = jest.requireMock(
      './lwcTranslation/useLwcTranslationClauses'
    ) as { useLwcTranslationClauses: jest.Mock };
    useLwcTranslationClauses.mockReturnValue({
      clauseRegions: twelveClauses,
      bootstrapped: true,
      hasClauses: true,
    });

    mockStepSettings = JSON.stringify({ artifactTypeId: 'cs-id' });
    mockCurrentStep = 'careful-step';
    mockLwcRecordingComplete = new Set(Array.from({ length: 12 }, (_, i) => i));
    mockTranscribed = new Set(Array.from({ length: 11 }, (_, i) => i));

    const { rerender } = render(<PassageDetailLwcTranscription width={400} />);
    await waitFor(() => {
      expect(progressProps?.completedCount).toBe(11);
      expect(navProps?.currentIndex).toBe(11);
    });

    mockStepSettings = JSON.stringify({ artifactTypeId: 'pbt-id' });
    mockCurrentStep = 'lwc-step';
    mockTranscribed = new Set();
    rerender(<PassageDetailLwcTranscription width={400} />);

    await waitFor(() => {
      expect(progressProps?.completedCount).toBe(0);
      expect(navProps?.currentIndex).toBe(0);
    });
  });
});
