// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { RecordTransformBuilder } from '@orbit/records';

const mockSetStepComplete = jest.fn().mockResolvedValue(undefined);
const mockGotoNextStep = jest.fn();
const mockMemoryUpdate = jest.fn().mockResolvedValue(undefined);

const PENDING_WARN_TEXT =
  'This passage already has a pending media upload. Continue anyway?';

let capturedMediaRecordProps: {
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  onRecordingCleared?: () => void | Promise<void>;
  allowRecord?: boolean;
  onBeforeStartRecord?: () => boolean | Promise<boolean>;
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
  chooserSize: 0,
  recording: false,
  setRecording: jest.fn(),
  currentstep: 'step-record',
  isBoldWorkflow: true,
  setStepComplete: mockSetStepComplete,
  gotoNextStep: mockGotoNextStep,
};

jest.mock(
  '../../context/usePassageDetailContext',
  () => () => passageDetailCtx
);

jest.mock('../MediaRecord', () => ({
  __esModule: true,
  default: (props: {
    afterUploadCb: (mediaId: string | undefined) => Promise<void>;
    onRecordingCleared?: () => void | Promise<void>;
    allowRecord?: boolean;
    onBeforeStartRecord?: () => boolean | Promise<boolean>;
  }) => {
    capturedMediaRecordProps = props;
    return <div data-testid="media-record" />;
  },
}));

jest.mock('../Uploader', () => (props: { isOpen?: boolean }) =>
  props.isOpen ? <div data-testid="uploader-open" /> : null
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
jest.mock('../Sheet/AudacityManager', () => () => null);
jest.mock('../../hoc/BigDialog', () => () => null);
jest.mock('../AudioTab/VersionDlg', () => () => null);
jest.mock('../SpeakerName', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const MockSpeakerName = (props: {
    onRights?: (hasRights: boolean) => void;
  }) => {
    ReactActual.useEffect(() => {
      props.onRights?.(true);
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

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [],
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'memory') {
      return [{ keyMap: {}, update: mockMemoryUpdate }, jest.fn()];
    }
    if (key === 'plan') return ['plan1', jest.fn()];
    if (key === 'offline') return [false, jest.fn()];
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
  VernacularTag: null,
  findRecord: jest.fn(),
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
  remoteIdNum: jest.fn(() => NaN),
  MediaSt: { FETCHED: 'FETCHED' },
  useFetchMediaUrl: () => ({
    fetchMediaUrl: jest.fn(),
    mediaState: { id: 'mf1', status: 'FETCHED' },
  }),
  useSharedResRead: () => ({ getSharedResource: () => undefined }),
}));

jest.mock('../../crud/useStepTool', () => ({
  useStepTool: () => ({ settings: {} }),
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoVernacular: () => true,
  }),
}));

jest.mock('../../utils', () => ({
  useMobile: () => ({ isMobile: false }),
}));

jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'file.ogg',
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

const renderRecord = () => render(<PassageDetailRecord width={400} />);

const seedPendingForCurrentPassage = () => {
  appendPendingMediaUpload({
    localAbsolutePath: '/pending/luke.mp3',
    fileSize: 100,
    uploadType: UploadType.Media,
    record: {
      planId: 'plan1',
      versionNumber: 1,
      originalFile: 'luke.mp3',
      contentType: 'audio/mpeg',
      artifactTypeId: '',
      passageId: 'p1',
      userId: 'user-1',
      recordedbyUserId: 'user-1',
      sourceMediaId: '',
      sourceSegments: '{}',
    } as PendingUploadMediaRecord,
  });
};

describe('PassageDetailRecord BOLD step completion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    capturedMediaRecordProps = null;
    passageDetailCtx.isBoldWorkflow = true;
    passageDetailCtx.mediafileId = 'mf1';
    passageDetailCtx.currentstep = 'step-record';
    passageDetailCtx.sharedResource = undefined;
  });

  it('auto-completes and advances after successful save when BOLD', async () => {
    renderRecord();
    expect(capturedMediaRecordProps).not.toBeNull();

    await act(async () => {
      await capturedMediaRecordProps!.afterUploadCb('new-media-id');
    });

    expect(mockSetStepComplete).toHaveBeenCalledWith('step-record', true);
    expect(mockGotoNextStep).toHaveBeenCalled();
  });

  it('does not auto-complete after save when not BOLD', async () => {
    passageDetailCtx.isBoldWorkflow = false;
    renderRecord();

    await act(async () => {
      await capturedMediaRecordProps!.afterUploadCb('new-media-id');
    });

    expect(mockSetStepComplete).not.toHaveBeenCalled();
    expect(mockGotoNextStep).not.toHaveBeenCalled();
  });

  it('marks step incomplete and deletes mediafile when recording cleared', async () => {
    renderRecord();
    expect(capturedMediaRecordProps?.onRecordingCleared).toBeDefined();

    await act(async () => {
      await capturedMediaRecordProps!.onRecordingCleared!();
    });

    expect(mockSetStepComplete).toHaveBeenCalledWith('step-record', false);
    expect(mockMemoryUpdate).toHaveBeenCalled();
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

  it('does not pass onRecordingCleared when not BOLD', () => {
    passageDetailCtx.isBoldWorkflow = false;
    renderRecord();
    expect(capturedMediaRecordProps?.onRecordingCleared).toBeUndefined();
  });
});

describe('PassageDetailRecord linked note play-only (TT-5873)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    capturedMediaRecordProps = null;
    passageDetailCtx.isBoldWorkflow = true;
    passageDetailCtx.mediafileId = 'mf1';
    passageDetailCtx.currentstep = 'step-record';
    passageDetailCtx.sharedResource = undefined;
  });

  it('keeps Load File and recording enabled on the source note', async () => {
    passageDetailCtx.sharedResource = sourceOwnedSharedResource;
    renderRecord();

    await waitFor(() => {
      expect(document.getElementById('pdRecordLoadFile')).not.toBeNull();
      expect(capturedMediaRecordProps?.allowRecord).toBe(true);
    });
    expect(document.querySelector('[data-testid="media-record"]')).not.toBeNull();
  });

  it('disables Load File and recording on a linked note while keeping playback', async () => {
    passageDetailCtx.sharedResource = linkedSharedResource;
    renderRecord();

    await waitFor(() => {
      expect(capturedMediaRecordProps).not.toBeNull();
    });
    expect(document.getElementById('pdRecordLoadFile')).toBeNull();
    expect(capturedMediaRecordProps?.allowRecord).toBe(false);
    expect(document.querySelector('[data-testid="media-record"]')).not.toBeNull();
  });
});

describe('PassageDetailRecord pending upload warn (TT-7366)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    capturedMediaRecordProps = null;
    passageDetailCtx.isBoldWorkflow = true;
    passageDetailCtx.mediafileId = 'mf1';
    passageDetailCtx.currentstep = 'step-record';
    passageDetailCtx.sharedResource = undefined;
  });

  it('opens Load File immediately when there is no pending upload', async () => {
    renderRecord();
    await act(async () => {
      document.getElementById('pdRecordLoadFile')?.click();
    });
    expect(document.querySelector('[data-testid="pending-warn-confirm"]')).toBeNull();
    expect(document.querySelector('[data-testid="uploader-open"]')).not.toBeNull();
  });

  it('warns on Load File when a pending upload exists; No cancels; Yes opens Uploader', async () => {
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
      expect(document.querySelector('[data-testid="uploader-open"]')).not.toBeNull();
    });
  });

  it('allows onBeforeStartRecord immediately when there is no pending upload', async () => {
    renderRecord();
    expect(capturedMediaRecordProps?.onBeforeStartRecord).toBeDefined();
    let allowed: boolean | undefined;
    await act(async () => {
      allowed = await capturedMediaRecordProps!.onBeforeStartRecord!();
    });
    expect(allowed).toBe(true);
    expect(document.querySelector('[data-testid="pending-warn-confirm"]')).toBeNull();
  });

  it('warns before record start when pending exists; No blocks; Yes allows', async () => {
    seedPendingForCurrentPassage();
    renderRecord();
    expect(capturedMediaRecordProps?.onBeforeStartRecord).toBeDefined();

    let blockedPromise: Promise<boolean>;
    await act(async () => {
      blockedPromise = Promise.resolve(
        capturedMediaRecordProps!.onBeforeStartRecord!()
      );
    });
    await waitFor(() => {
      expect(document.getElementById('alertNo')).not.toBeNull();
    });
    await act(async () => {
      document.getElementById('alertNo')?.click();
    });
    expect(await blockedPromise!).toBe(false);

    let allowedPromise: Promise<boolean>;
    await act(async () => {
      allowedPromise = Promise.resolve(
        capturedMediaRecordProps!.onBeforeStartRecord!()
      );
    });
    await waitFor(() => {
      expect(document.getElementById('alertYes')).not.toBeNull();
    });
    await act(async () => {
      document.getElementById('alertYes')?.click();
    });
    expect(await allowedPromise!).toBe(true);
  });
});
