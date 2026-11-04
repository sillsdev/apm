/// <reference types="jest" />
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { RecordTransformBuilder } from '@orbit/records';

const mockSetStepComplete = jest.fn().mockResolvedValue(undefined);
const mockStepComplete = jest.fn(() => false);
const mockMemoryUpdate = jest.fn().mockResolvedValue(undefined);
const mockStartRecording = jest.fn().mockResolvedValue(undefined);
const mockIsAutosavePending = jest.fn();
const mockClearPendingUploads = jest.fn();

const PENDING_WARN_TEXT =
  'A recording for this passage is already pending upload. Recording it again will replace the existing pending recording. Do you want to continue?';

const CLEAR_ARGS = [expect.anything(), 'plan1', 'p1'];
// Pending upload rows store server ids, not the local ids the step holds.
const REMOTE_IDS: Record<string, string> = { plan1: '101', p1: '201' };

let capturedPlayerProps: {
  onAudioChange?: (audio: Blob | null) => void;
} | null = null;

let capturedUploaderProps: {
  finish?: (mediaRemoteIds?: string[]) => Promise<void>;
} | null = null;

const linkedSharedResource = {
  id: 'sr1',
  type: 'sharedresource',
  relationships: {
    passage: { data: { type: 'passage', id: 'source-p' } },
  },
};

const sourceOwnedSharedResource = {
  id: 'sr1',
  type: 'sharedresource',
  relationships: {
    passage: { data: { type: 'passage', id: 'p1' } },
  },
};

const passageDetailCtx = {
  passage: { id: 'p1', type: 'passage' },
  sharedResource: undefined as unknown,
  mediafileId: 'mf1',
  recording: false,
  currentstep: 'step-record',
  isBoldWorkflow: true,
  setStepComplete: mockSetStepComplete,
  stepComplete: mockStepComplete,
};

jest.mock(
  '../../context/usePassageDetailContext',
  () => () => passageDetailCtx
);

// The real player needs wavesurfer.js, whose ESM-only dist files jest can't load.
jest.mock('../AudioPlayer', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const MockAudioPlayer = ReactActual.forwardRef(
    (props: { onAudioChange?: (audio: Blob | null) => void }, ref) => {
      capturedPlayerProps = props;
      ReactActual.useImperativeHandle(ref, () => ({
        startRecording: mockStartRecording,
        setTime: jest.fn(),
      }));
      return <div data-testid="audio-player" />;
    }
  );
  MockAudioPlayer.displayName = 'MockAudioPlayer';
  return {
    __esModule: true,
    AudioPlayer: MockAudioPlayer,
  };
});

jest.mock('./usePassageAudioSave', () => ({
  usePassageAudioSave: () => ({
    save: jest.fn().mockResolvedValue(undefined),
    saving: false,
  }),
}));

jest.mock(
  '../Uploader',
  () =>
    function MockUploader(props: {
      isOpen?: boolean;
      finish?: (mediaRemoteIds?: string[]) => Promise<void>;
    }) {
      capturedUploaderProps = props;
      return props.isOpen ? <div data-testid="uploader-open" /> : null;
    }
);
jest.mock('../AlertDialog', () => ({
  __esModule: true,
  default: (props: {
    text: string;
    yesResponse: () => void;
    noResponse: () => void;
  }) => (
    <div data-testid="pending-warn-confirm">
      <span>{props.text}</span>
      <button id="alertYes" type="button" onClick={props.yesResponse}>
        Yes
      </button>
      <button id="alertNo" type="button" onClick={props.noResponse}>
        No
      </button>
    </div>
  ),
}));
jest.mock('../../hoc/BigDialog', () => () => null);
jest.mock('../AudioTab/VersionDlg', () => () => null);
// Recording needs a speaker, so name one as the real control would on load.
jest.mock('../SpeakerName', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const MockSpeakerName = (props: { onChange?: (name: string) => void }) => {
    ReactActual.useEffect(() => {
      props.onChange?.('Speaker');
    }, []);
    return null;
  };
  MockSpeakerName.displayName = 'MockSpeakerName';
  return {
    __esModule: true,
    default: MockSpeakerName,
  };
});
jest.mock('../AudioTab/usePassageVersionAudioRows', () => ({
  usePassageVernacularVersionCount: () => 1,
}));
jest.mock('../../control', () => ({
  Button: (props: {
    id?: string;
    children?: React.ReactNode;
    onClick?: () => void;
  }) =>
    props.id ? (
      <button id={props.id} type="button" onClick={props.onClick}>
        {props.children}
      </button>
    ) : null,
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'memory') {
      const keyMap = {
        idToKey: (_table: string, _key: string, id: string) => REMOTE_IDS[id],
      };
      return [{ keyMap, update: mockMemoryUpdate }, jest.fn()];
    }
    if (key === 'plan') return ['plan1', jest.fn()];
    if (key === 'errorReporter') return [jest.fn(), jest.fn()];
    if (key === 'importexportBusy') return [false, jest.fn()];
    return [undefined, jest.fn()];
  },
}));

jest.mock('../../context/UnsavedContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: ReactActual.createContext({
      state: {
        startSave: jest.fn(),
        saveCompleted: jest.fn(),
        toolChanged: jest.fn(),
        toolsChanged: 0,
        saveRequested: jest.fn(() => false),
        clearRequested: jest.fn(() => false),
        clearCompleted: jest.fn(),
        waitForSave: jest.fn(),
      },
    }),
  };
});

jest.mock('../../crud', () => ({
  getVernacularMediaRec: jest.fn(() => undefined),
  related: jest.fn(
    (
      rec: {
        relationships?: { passage?: { data?: { id?: string } } };
      } | null,
      rel: string
    ) => {
      if (!rec) return undefined;
      if (rel === 'passage') {
        return rec.relationships?.passage?.data?.id;
      }
      return 's1';
    }
  ),
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  MediaSt: { FETCHED: 'FETCHED', ERROR: 'ERROR' },
  useFetchMediaUrl: () => ({
    fetchMediaUrl: jest.fn(),
    mediaState: { id: 'mf1', status: 'FETCHED' },
  }),
}));

jest.mock('../../crud/autosaveMedia', () => ({
  isAutosaveMedia: () => false,
  isAutosavePending: mockIsAutosavePending,
}));

jest.mock('../../store/upload/pendingMediaUploads', () => ({
  ...jest.requireActual<
    typeof import('../../store/upload/pendingMediaUploads')
  >('../../store/upload/pendingMediaUploads'),
  clearPendingUploads: mockClearPendingUploads,
}));

jest.mock('../../crud/useStepTool', () => ({
  useStepTool: () => ({ settings: {} }),
}));

jest.mock('../../crud/useWavRecorder', () => ({
  parseRecordCaptureAudioProcessing: () => ({
    echoCancellation: false,
    noiseSuppression: false,
  }),
  parseRecordSaveAsWav: () => false,
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoVernacular: () => true,
  }),
}));

jest.mock('../../utils', () => ({
  loadBlobAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../selector', () => ({
  sharedSelector: jest.fn(() => ({
    loadFromFile: 'Load',
    save: 'Save',
    NoSaveWoMedia: 'No save',
    versionHistory: 'Versions',
  })),
  mediaTabSelector: jest.fn(() => ({
    pendingUploadExistsWarn: PENDING_WARN_TEXT,
  })),
}));

jest.mock('react-redux', () => ({
  useSelector: jest.fn((sel: (s: unknown) => unknown) =>
    sel({ books: { bookData: [] } })
  ),
  shallowEqual: jest.fn(),
}));

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

import { UploadType } from '../UploadType';
import {
  appendPendingMediaUpload,
  type PendingUploadMediaRecord,
} from '../../store/upload/pendingMediaUploads';
import { PassageDetailRecord } from './PassageDetailRecord';

const renderRecord = () => render(<PassageDetailRecord />);

const recordButton = () =>
  document.querySelector<HTMLElement>('[aria-label="record"]');

const seedPendingForCurrentPassage = () => {
  appendPendingMediaUpload({
    localAbsolutePath: '/pending/luke.mp3',
    fileSize: 100,
    uploadType: UploadType.Media,
    record: {
      planId: REMOTE_IDS.plan1,
      versionNumber: 1,
      originalFile: 'luke.mp3',
      contentType: 'audio/mpeg',
      artifactTypeId: '',
      passageId: REMOTE_IDS.p1,
      userId: 'user-1',
      recordedbyUserId: 'user-1',
      sourceMediaId: '',
      sourceSegments: '{}',
    } as PendingUploadMediaRecord,
  });
};

const resetState = () => {
  jest.clearAllMocks();
  localStorage.clear();
  capturedPlayerProps = null;
  capturedUploaderProps = null;
  mockStepComplete.mockReturnValue(false);
  passageDetailCtx.isBoldWorkflow = true;
  passageDetailCtx.mediafileId = 'mf1';
  passageDetailCtx.currentstep = 'step-record';
  passageDetailCtx.sharedResource = undefined;
};

describe('PassageDetailRecord BOLD step completion', () => {
  beforeEach(resetState);

  it('completes the step when audio changes when BOLD', () => {
    renderRecord();
    expect(capturedPlayerProps).not.toBeNull();

    act(() => {
      capturedPlayerProps!.onAudioChange!(new Blob(['audio']));
    });

    expect(mockSetStepComplete).toHaveBeenCalledWith('step-record', true);
  });

  it('does not complete the step when audio changes when not BOLD', () => {
    passageDetailCtx.isBoldWorkflow = false;
    renderRecord();

    act(() => {
      capturedPlayerProps!.onAudioChange!(new Blob(['audio']));
    });

    expect(mockSetStepComplete).not.toHaveBeenCalled();
  });

  it('does not complete a step that is already complete', () => {
    mockStepComplete.mockReturnValue(true);
    renderRecord();

    act(() => {
      capturedPlayerProps!.onAudioChange!(new Blob(['audio']));
    });

    expect(mockSetStepComplete).not.toHaveBeenCalled();
  });

  it('completes the step and clears pending uploads after Load File uploads media', async () => {
    renderRecord();

    await act(async () => {
      await capturedUploaderProps!.finish!(['new-media-id']);
    });

    expect(mockSetStepComplete).toHaveBeenCalledWith('step-record', true);
    expect(mockClearPendingUploads).toHaveBeenCalledWith(...CLEAR_ARGS);
  });

  it('does not complete the step when Load File uploads nothing', async () => {
    renderRecord();

    await act(async () => {
      await capturedUploaderProps!.finish!([]);
    });

    expect(mockSetStepComplete).not.toHaveBeenCalled();
    expect(mockClearPendingUploads).not.toHaveBeenCalled();
  });

  it('marks step incomplete and deletes mediafile when recording cleared', async () => {
    renderRecord();

    act(() => {
      capturedPlayerProps!.onAudioChange!(null);
    });

    expect(mockClearPendingUploads).toHaveBeenCalledWith(
      ...CLEAR_ARGS,
      mockIsAutosavePending
    );
    expect(mockSetStepComplete).toHaveBeenCalledWith('step-record', false);
    const updateFn = mockMemoryUpdate.mock.calls[0][0] as (
      tr: RecordTransformBuilder
    ) => unknown;
    const mockTr = {
      removeRecord: jest.fn().mockReturnValue({
        toOperation: () => ({ op: 'remove' }),
      }),
    };
    updateFn(mockTr as unknown as RecordTransformBuilder);
    expect(mockTr.removeRecord).toHaveBeenCalledWith({
      type: 'mediafile',
      id: 'mf1',
    });
  });
});

describe('PassageDetailRecord linked note play-only (TT-5873)', () => {
  beforeEach(resetState);

  it('keeps Load File and recording enabled on the source note', async () => {
    passageDetailCtx.sharedResource = sourceOwnedSharedResource;
    renderRecord();

    await waitFor(() => {
      expect(document.getElementById('pdRecordLoadFile')).not.toBeNull();
      expect(recordButton()).not.toBeNull();
    });
    expect(
      document.querySelector('[data-testid="audio-player"]')
    ).not.toBeNull();
  });

  it('disables Load File and recording on a linked note while keeping playback', async () => {
    passageDetailCtx.sharedResource = linkedSharedResource;
    renderRecord();

    await waitFor(() => {
      expect(capturedPlayerProps).not.toBeNull();
    });
    expect(document.getElementById('pdRecordLoadFile')).toBeNull();
    expect(recordButton()).toBeNull();
    expect(
      document.querySelector('[data-testid="audio-player"]')
    ).not.toBeNull();
  });
});

describe('PassageDetailRecord pending upload warn (TT-7366)', () => {
  beforeEach(resetState);

  it('opens Load File immediately when there is no pending upload', async () => {
    renderRecord();
    await act(async () => {
      document.getElementById('pdRecordLoadFile')?.click();
    });
    expect(
      document.querySelector('[data-testid="pending-warn-confirm"]')
    ).toBeNull();
    expect(
      document.querySelector('[data-testid="uploader-open"]')
    ).not.toBeNull();
    expect(mockClearPendingUploads).not.toHaveBeenCalled();
  });

  it('warns on Load File when a pending upload exists; No cancels; Yes opens Uploader and keeps pending', async () => {
    seedPendingForCurrentPassage();
    renderRecord();

    await act(async () => {
      document.getElementById('pdRecordLoadFile')?.click();
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="pending-warn-confirm"]')
      ).not.toBeNull();
    });
    expect(document.body.textContent).toContain(PENDING_WARN_TEXT);
    expect(document.querySelector('[data-testid="uploader-open"]')).toBeNull();

    await act(async () => {
      document.getElementById('alertNo')?.click();
    });
    expect(document.querySelector('[data-testid="uploader-open"]')).toBeNull();
    expect(mockClearPendingUploads).not.toHaveBeenCalled();

    await act(async () => {
      document.getElementById('pdRecordLoadFile')?.click();
    });
    await waitFor(() => {
      expect(document.getElementById('alertYes')).not.toBeNull();
    });
    await act(async () => {
      document.getElementById('alertYes')?.click();
    });
    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="uploader-open"]')
      ).not.toBeNull();
    });
    expect(mockClearPendingUploads).not.toHaveBeenCalled();
    expect(mockStartRecording).not.toHaveBeenCalled();
  });

  it('starts recording immediately when there is no pending upload', async () => {
    renderRecord();

    await act(async () => {
      recordButton()?.click();
    });

    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(
      document.querySelector('[data-testid="pending-warn-confirm"]')
    ).toBeNull();
  });

  it('warns before record start when pending exists; No blocks; Yes records and clears pending', async () => {
    seedPendingForCurrentPassage();
    renderRecord();

    await act(async () => {
      recordButton()?.click();
    });
    await waitFor(() => {
      expect(document.getElementById('alertNo')).not.toBeNull();
    });
    expect(document.body.textContent).toContain(PENDING_WARN_TEXT);
    expect(mockStartRecording).not.toHaveBeenCalled();

    await act(async () => {
      document.getElementById('alertNo')?.click();
    });
    expect(mockStartRecording).not.toHaveBeenCalled();
    expect(mockClearPendingUploads).not.toHaveBeenCalled();

    await act(async () => {
      recordButton()?.click();
    });
    await waitFor(() => {
      expect(document.getElementById('alertYes')).not.toBeNull();
    });
    await act(async () => {
      document.getElementById('alertYes')?.click();
    });

    expect(mockClearPendingUploads).toHaveBeenCalledWith(...CLEAR_ARGS);
    expect(mockStartRecording).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="uploader-open"]')).toBeNull();
  });
});
