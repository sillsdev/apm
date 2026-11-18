import { formatUploadTerminalFailureMessage } from './uploadTerminalMessages';

let mockIsElectron = false;
jest.mock('../../../api-variable', () => ({
  get isElectron() {
    return mockIsElectron;
  },
}));
import type { IMediaTabStrings } from '../../model';
import type { UploadTerminalFailureInfo } from './actions';

const t = {
  pendingUploadPathLabel: 'File saved at: {0}',
  pendingUploadOnDeviceOnly: 'Saved on this device only until cloud confirm.',
  pendingUploadRiskHint:
    'Clearing site data, private windows, or some Safari settings can erase these before they upload.',
  pendingUploadRetryLater: 'Retry later.',
  pendingUploadQueuedHint: 'Retry from Team → {0}.',
  pendingUploadMenu: 'Pending media uploads',
  pendingUploadDeleteFailed: 'Could not remove online row {0}.',
} as unknown as IMediaTabStrings;

const baseInfo = (
  over: Partial<UploadTerminalFailureInfo> = {}
): UploadTerminalFailureInfo =>
  ({
    localAbsolutePath: '',
    originalFileName: 'take.webm',
    pendingRecord: { id: 'p1' },
    cloudRowDeleted: true,
    ...over,
  }) as UploadTerminalFailureInfo;

describe('formatUploadTerminalFailureMessage', () => {
  beforeEach(() => {
    mockIsElectron = false;
  });

  it('does not claim on this device only for a desktop entry without a path', () => {
    mockIsElectron = true;
    const msg = formatUploadTerminalFailureMessage(t, baseInfo());
    expect(msg).not.toContain('Saved on this device only');
    expect(msg).toContain('Retry later.');
  });

  it('uses the desktop path label when a local path exists', () => {
    const msg = formatUploadTerminalFailureMessage(
      t,
      baseInfo({ localAbsolutePath: 'C:/media/take.webm' })
    );
    expect(msg).toContain('File saved at: C:/media/take.webm');
    expect(msg).not.toContain('Saved on this device only');
  });

  it('says on this device only and includes loss risk when there is no path (web)', () => {
    const msg = formatUploadTerminalFailureMessage(t, baseInfo());
    expect(msg).toContain('Saved on this device only until cloud confirm.');
    expect(msg).toContain(
      'Clearing site data, private windows, or some Safari settings can erase these before they upload.'
    );
    expect(msg).toContain('Retry later.');
    expect(msg).toContain('Retry from Team → Pending media uploads.');
  });
});
