import '@testing-library/jest-dom';
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

let mockCarefulSpeechComplete = new Set<number>();
let mockLwcComplete = new Set<number>();
let mockClauseRegions = [{ start: 0, end: 5, label: '' }];
let controlsProps: Record<string, unknown> | undefined;
let referenceProps: Record<string, unknown> | undefined;
const mockStartSave = jest.fn();

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'memory') return [{ keyMap: {}, update: jest.fn() }];
    if (key === 'plan') return ['plan1'];
    if (key === 'offline') return [false];
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
  passage: { id: 'p1', type: 'passage', attributes: {} },
  mediafileId: 'm1',
  rowData: [],
  currentstep: 'step1',
  section: { id: 's1', type: 'section' },
  forceRefresh: jest.fn(),
  isBoldWorkflow: true,
  setStepComplete: jest.fn(),
  stepComplete: jest.fn(() => false),
  setRecording: jest.fn(),
}));

jest.mock('../../crud', () => ({
  ArtifactTypeSlug: {
    CarefulSpeech: 'carefulspeech',
    PhraseBackTranslation: 'backtranslation',
  },
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  related: jest.fn(() => undefined),
  useArtifactType: () => ({
    getTypeId: (slug: string) =>
      slug === 'carefulspeech' ? 'cs-id' : 'pbt-id',
  }),
  useStepTool: () => ({ settings: { artifactTypeId: 'pbt-id' } }),
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: () => true }),
}));

jest.mock('../../context/UnsavedContext', () => ({
  UnsavedContext: React.createContext({
    state: {
      waitForSave: jest.fn().mockResolvedValue(undefined),
      startSave: (...args: unknown[]) => mockStartSave(...args),
    },
  }),
}));

jest.mock('../../selector', () => ({
  lwcTranslationSelector: { name: 'lwcTranslationSelector' },
  sharedSelector: { name: 'sharedSelector' },
  mediaTabSelector: { name: 'mediaTabSelector' },
  mediaTitleSelector: { name: 'mediaTitleSelector' },
}));
jest.mock('react-redux', () => ({
  useSelector: (selector: { name?: string }) => {
    if (selector.name === 'sharedSelector') {
      return { noAudio: 'No audio' };
    }
    if (selector.name === 'mediaTabSelector') {
      return { pendingUploadRetryOne: 'Retry' };
    }
    if (selector.name === 'mediaTitleSelector') {
      return { uploadFailed: 'Upload Failed!' };
    }
    return {
      boldOnly: 'BOLD only',
      noClauses: 'No clauses',
      prerequisite: 'Complete Careful Speech first',
      clauseIndex: 'Clause {0}/{1}',
      progress: '{0} of {1} clauses recorded',
    };
  },
  shallowEqual: jest.fn(),
}));

jest.mock('./lwcTranslation/useLwcTranslationClauses', () => ({
  useLwcTranslationClauses: jest.fn(() => ({
    clauseRegions: mockClauseRegions,
    bootstrapped: true,
    hasClauses: true,
  })),
}));

jest.mock('./carefulSpeech/carefulSpeechCompletion', () => ({
  getCompletedClauseIndices: jest.fn(
    (_regions: unknown[], _rows: unknown[], typeId: string) =>
      typeId === 'cs-id' ? mockCarefulSpeechComplete : mockLwcComplete
  ),
  getRecordingForClause: jest.fn(() => undefined),
  // Mirror the real helper so clause navigation actually advances.
  firstIncompleteClauseIndex: jest.fn(
    (regions: unknown[], completed: Set<number>) => {
      for (let i = 0; i < regions.length; i += 1) {
        if (!completed.has(i)) return i;
      }
      return regions.length;
    }
  ),
}));

jest.mock('./lwcTranslation/LwcTranslationReferencePlayer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    referenceProps = props;
    return <div data-cy="lwc-reference-player" />;
  },
}));

jest.mock('./lwcTranslation/LwcTranslationClauseNav', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    if (props.currentClauseRecorded) {
      return <div data-cy="lwc-clause-nav-recorded" />;
    }
    return <div data-cy="lwc-clause-nav" />;
  },
}));

jest.mock('./lwcTranslation/LwcTranslationControls', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    controlsProps = props;
    return <div data-cy="lwc-recorder" />;
  },
}));

jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'file.ogg',
}));

import { PassageDetailLwcTranslation } from './PassageDetailLwcTranslation';

describe('PassageDetailLwcTranslation', () => {
  beforeEach(() => {
    mockCarefulSpeechComplete = new Set<number>();
    mockLwcComplete = new Set<number>();
    mockClauseRegions = [{ start: 0, end: 5, label: '' }];
    controlsProps = undefined;
    referenceProps = undefined;
  });

  it('shows prerequisite when careful speech is incomplete', () => {
    render(<PassageDetailLwcTranslation width={400} />);
    expect(
      screen.getByText('Complete Careful Speech first')
    ).toBeInTheDocument();
  });

  it('shows the guided UI when careful speech is complete', () => {
    mockCarefulSpeechComplete = new Set([0]);
    render(<PassageDetailLwcTranslation width={400} />);
    expect(
      document.querySelector('[data-cy="lwc-reference-player"]')
    ).toBeTruthy();
    expect(document.querySelector('[data-cy="lwc-clause-nav"]')).toBeTruthy();
    expect(document.querySelector('[data-cy="lwc-recorder"]')).toBeTruthy();
  });

  it('opens on a recorded clause in review mode', async () => {
    mockCarefulSpeechComplete = new Set([0]);
    mockLwcComplete = new Set([0]);
    render(<PassageDetailLwcTranslation width={400} />);
    await waitFor(() => expect(controlsProps?.phase).toBe('recorded'));
    expect(controlsProps?.showRecorder).toBe(true);
    expect(
      document.querySelector('[data-cy="lwc-clause-nav-recorded"]')
    ).toBeTruthy();
  });
});

describe('PassageDetailLwcTranslation — rejected save (TT-7583)', () => {
  beforeEach(() => {
    mockCarefulSpeechComplete = new Set([0]);
    mockLwcComplete = new Set<number>();
    mockClauseRegions = [{ start: 0, end: 5, label: '' }];
    controlsProps = undefined;
    referenceProps = undefined;
    mockStartSave.mockClear();
  });

  // Play the reference clause through, which is what reveals the recorder.
  const openRecorder = async () => {
    render(<PassageDetailLwcTranslation width={400} />);
    await waitFor(() => expect(referenceProps).toBeDefined());
    await act(async () => {
      (referenceProps?.onPlaybackComplete as () => void)();
    });
    await waitFor(() => expect(controlsProps?.showRecorder).toBe(true));
  };

  // Record a take and request its auto-save, then have MediaRecord reject it.
  const recordAndRejectSave = async () => {
    await openRecorder();

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      (controlsProps?.setCanSave as (v: boolean) => void)(true);
    });
    await act(async () => {
      (controlsProps?.onSaveRejected as () => void)();
    });
  };

  it('shows the save failure message with a Retry button', async () => {
    await recordAndRejectSave();

    expect(screen.getByText('Upload Failed!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(controlsProps?.savingRecording).toBe(false);
  });

  it('does not re-request the doomed save on the next rising edge', async () => {
    await recordAndRejectSave();
    mockStartSave.mockClear();

    // canSave falls and rises again because the take is still dirty.
    await act(async () => {
      (controlsProps?.setCanSave as (v: boolean) => void)(false);
    });
    await act(async () => {
      (controlsProps?.setCanSave as (v: boolean) => void)(true);
    });

    expect(mockStartSave).not.toHaveBeenCalled();
  });

  it('Retry requests the save again and clears the message', async () => {
    await recordAndRejectSave();
    mockStartSave.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(mockStartSave).toHaveBeenCalledWith('LwcTranslationTool');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(controlsProps?.savingRecording).toBe(true);
  });

  it('clears the message when a new take starts', async () => {
    await recordAndRejectSave();

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('keeps the take discardable while the message is up', async () => {
    await recordAndRejectSave();

    // The take is unsaved but still in the recorder, so the clear button has to
    // stay available even though the phase went back to recordReady.
    expect(controlsProps?.saveRejected).toBe(true);
    expect(controlsProps?.phase).toBe('recordReady');
  });

  it('clearing the failed take drops the message and the completion', async () => {
    await recordAndRejectSave();

    await act(async () => {
      (controlsProps?.onClearRecording as () => void)();
    });

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(controlsProps?.allClausesComplete).toBe(false);
    expect(controlsProps?.resetMedia).toBe(true);
  });

  it('drops the message when the user moves to another clause', async () => {
    // Two clauses so Next Clause actually moves off the failed one.
    mockClauseRegions = [
      { start: 0, end: 5, label: '' },
      { start: 5, end: 9, label: '' },
    ];
    mockCarefulSpeechComplete = new Set([0, 1]);
    await recordAndRejectSave();
    expect(screen.getByText('Upload Failed!')).toBeInTheDocument();

    await act(async () => {
      (controlsProps?.onNextClause as () => void)();
    });

    // The take it referred to is gone, so a Retry here could only fail.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('stops counting the clause as recorded, so the step is not complete', async () => {
    await openRecorder();
    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    // Stopping the take marks it done optimistically.
    expect(controlsProps?.allClausesComplete).toBe(true);

    await act(async () => {
      (controlsProps?.onSaveRejected as () => void)();
    });

    // Nothing was stored, so that optimistic marking has to come back off.
    expect(controlsProps?.allClausesComplete).toBe(false);
    expect(
      document.querySelector('[data-cy="lwc-clause-nav-recorded"]')
    ).toBeNull();
    // ...and the clause must be recordable again, not just retryable.
    expect(controlsProps?.allowRecord).toBe(true);
  });

  it('does not count the clause as recorded when the upload returns no media id', async () => {
    await openRecorder();
    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });

    await act(async () => {
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )('');
    });

    expect(controlsProps?.allClausesComplete).toBe(false);
    expect(controlsProps?.allowRecord).toBe(true);
  });

  it('still counts the clause as recorded on a successful upload', async () => {
    await openRecorder();
    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });

    await act(async () => {
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )('media-new');
    });

    expect(controlsProps?.allClausesComplete).toBe(true);
    expect(controlsProps?.phase).toBe('recorded');
  });
});
