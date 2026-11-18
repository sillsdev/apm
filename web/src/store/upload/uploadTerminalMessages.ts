import { isElectron } from '../../../api-variable';
import type { IMediaTabStrings } from '../../model';
import type { UploadTerminalFailureInfo } from './actions';

export function formatUploadTerminalFailureMessage(
  t: IMediaTabStrings,
  info: UploadTerminalFailureInfo
): string {
  const lines: string[] = [];
  if (info.localAbsolutePath) {
    lines.push(t.pendingUploadPathLabel.replace('{0}', info.localAbsolutePath));
  } else if (!isElectron) {
    // Web Upload Pending: no media-folder path; the Local Media Blob is the
    // only copy until the cloud confirms (ADR 0016 / issue 28).
    lines.push(t.pendingUploadOnDeviceOnly);
    lines.push(t.pendingUploadRiskHint);
  }
  lines.push(t.pendingUploadRetryLater);
  lines.push(t.pendingUploadQueuedHint.replace('{0}', t.pendingUploadMenu));
  if (!info.cloudRowDeleted && info.failedRemoteMediaId !== undefined) {
    lines.push(
      t.pendingUploadDeleteFailed.replace(
        '{0}',
        String(info.failedRemoteMediaId)
      )
    );
  }
  return lines.join('\n');
}
