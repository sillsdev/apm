import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { UploadType } from './UploadType';

type PassageRecordDlgProps = {
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
  beforeUpload?: () => Promise<void>;
};

let capturedDlg: PassageRecordDlgProps | undefined;

jest.mock('./PassageRecordDlg', () => ({
  __esModule: true,
  default: (props: PassageRecordDlgProps) => {
    capturedDlg = props;
    return <div data-testid="passage-record-dlg" />;
  },
}));

jest.mock('./MediaUpload', () => ({
  __esModule: true,
  default: () => null,
  FaithbridgeType: 'audio/mpeg/s3link',
}));

jest.mock('../store', () => ({
  uploadFiles: jest.fn(() => ({ type: 'UPLOAD_LIST' })),
  nextUpload: jest.fn(() => ({ type: 'NEXT_UPLOAD' })),
  uploadComplete: jest.fn(() => ({ type: 'UPLOAD_COMPLETE' })),
}));

jest.mock('../selector', () => ({
  mediaTabSelector: () => ({
    uploadComplete: '{0} of {1} files uploaded successfully.',
    unsupported: '{0}',
    toobig: '{0} {1} {2}',
    selectFiles: 'Select files',
  }),
  sharedSelector: () => ({
    mediaAttached: 'Media attached',
  }),
}));

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useDispatch: () => jest.fn((action: unknown) => action),
  useSelector: (sel: (state: { upload: { errmsg: string } }) => unknown) =>
    sel({ upload: { errmsg: '' } }),
}));

jest.mock('../context/TokenProvider', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: ReactActual.createContext({
      state: { accessToken: 'tok' },
    }),
  };
});

const mockMemory = { cache: { query: jest.fn(() => []) }, keyMap: {} };
const mockCoordinator = {
  getSource: jest.fn((name: string) => {
    if (name === 'memory') return mockMemory;
    return {};
  }),
};

jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, unknown> = {
      developer: false,
      coordinator: mockCoordinator,
      errorReporter: {},
      orbitRetries: 0,
      importexportBusy: false,
      plan: '',
      user: 'user-1',
      progress: 0,
    };
    return [mockValues[key], jest.fn()];
  }),
  useGetGlobal: jest.fn(() => (key: string) => {
    if (key === 'offline') return false;
    if (key === 'importexportBusy') return false;
    return undefined;
  }),
}));

jest.mock('../crud', () => ({
  findRecord: jest.fn(),
  pullTableList: jest.fn(),
  related: jest.fn(),
  remoteIdNum: jest.fn((_table: string, id: string) => id),
  useArtifactType: () => ({
    localizedArtifactTypeFromId: jest.fn(() => 'artifact-label'),
  }),
  useOfflnMediafileCreate: () => ({
    createMedia: jest.fn(),
  }),
  VernacularTag: null,
}));

jest.mock('../utils', () => ({
  restoreScroll: jest.fn(),
}));

jest.mock('../utils/passageDefaultFilename', () => ({
  passageDefaultSuffix: jest.fn(() => ''),
}));

jest.mock('../utils/typeLimit', () => ({
  typeLimit: jest.fn(() => 100),
}));

jest.mock('../utils/contentType', () => ({
  getContentType: jest.fn(() => 'audio/webm'),
}));

jest.mock('../store/upload/uploadTerminalMessages', () => ({
  formatUploadTerminalFailureMessage: jest.fn(() => 'upload failed'),
}));

import Uploader from './Uploader';

function renderUploader(beforeUpload: () => Promise<void>) {
  const cancelled = { current: false };
  return render(
    <Uploader
      audioUploadOrRecord
      isOpen
      onOpen={jest.fn()}
      showMessage={jest.fn()}
      cancelled={cancelled}
      defaultFilename="resource"
      uploadType={UploadType.Media}
      beforeUpload={beforeUpload}
      finish={jest.fn()}
    />
  );
}

describe('Uploader recorded path beforeUpload', () => {
  beforeEach(() => {
    capturedDlg = undefined;
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    cleanup();
  });

  /**
   * Recorded save goes MediaRecord → useMediaUpload (await beforeUpload, then
   * stage) → Uploader.afterUploadCb on success. Copilot r3919030521: the
   * after-upload hook must not commit again — SelectArtifactCategory.commit()
   * is not idempotent if React has not re-rendered the new category yet.
   */
  it('commits deferred metadata once when a recording upload succeeds', async () => {
    const created: string[] = [];
    const beforeUpload = jest.fn(async () => {
      created.push(`cat-${created.length + 1}`);
    });
    renderUploader(beforeUpload);
    expect(capturedDlg?.beforeUpload).toBe(beforeUpload);

    await act(async () => {
      await capturedDlg!.beforeUpload!();
      await capturedDlg!.afterUploadCb('media-1');
    });

    expect(created).toEqual(['cat-1']);
  });
});
