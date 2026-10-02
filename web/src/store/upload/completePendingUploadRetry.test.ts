import { completePendingUploadRetry } from './completePendingUploadRetry';
import type { PendingUploadRestore } from './pendingMediaUploads';

const mockPullTableList = jest.fn();
const mockRemoteIdGuid = jest.fn();
const mockRestoreAfterPendingUpload = jest.fn();

jest.mock('../../crud/pullTableList', () => ({
  pullTableList: (...args: unknown[]) => mockPullTableList(...args),
}));

jest.mock('../../crud/remoteId', () => ({
  remoteIdGuid: (...args: unknown[]) => mockRemoteIdGuid(...args),
}));

jest.mock('./restoreAfterPendingUpload', () => ({
  restoreAfterPendingUpload: (...args: unknown[]) =>
    mockRestoreAfterPendingUpload(...args),
}));

describe('completePendingUploadRetry (TT-7363)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPullTableList.mockResolvedValue(undefined);
    mockRestoreAfterPendingUpload.mockResolvedValue(undefined);
    mockRemoteIdGuid.mockReturnValue('local-media-1');
  });

  it('pulls the mediafile then restores secondary links when restore meta is present', async () => {
    const restore: PendingUploadRestore = {
      kind: 'intellectualproperty',
      rightsHolder: 'Speaker',
      organizationId: 'org-1',
    };
    const memory = { keyMap: {} } as never;
    const remote = {} as never;
    const backup = {} as never;

    await completePendingUploadRetry({
      stringId: '42',
      restore,
      memory,
      remote,
      backup,
      reporter: {},
      user: 'user-1',
    });

    expect(mockPullTableList).toHaveBeenCalledWith(
      'mediafile',
      ['42'],
      memory,
      remote,
      backup,
      {}
    );
    expect(mockRestoreAfterPendingUpload).toHaveBeenCalledWith({
      mediaId: 'local-media-1',
      restore,
      memory,
      user: 'user-1',
    });
  });

  it('skips restore when no restore meta is present', async () => {
    await completePendingUploadRetry({
      stringId: '42',
      memory: { keyMap: {} } as never,
      remote: {} as never,
      backup: {} as never,
      reporter: {},
      user: 'user-1',
    });

    expect(mockPullTableList).toHaveBeenCalled();
    expect(mockRestoreAfterPendingUpload).not.toHaveBeenCalled();
  });
});
