import type { IMediaTabStrings } from '../../model';
import type { UploadTerminalFailureInfo } from './actions';

export function formatUploadTerminalFailureMessage(
  t: IMediaTabStrings,
  info: UploadTerminalFailureInfo
): string {
  const lines: string[] = [];
  if (info.localAbsolutePath) {
    lines.push(t.pendingUploadPathLabel.replace('{0}', info.localAbsolutePath));
  }
  lines.push(t.pendingUploadRetryLater);
  lines.push(t.pendingUploadQueuedHint.replace('{0}', t.pendingUploadMenu));
  if (!info.cloudRowDeleted && info.failedRemoteMediaId !== undefined) {
    lines.push(
      t.pendingUploadDeleteFailed.replace('{0}', String(info.failedRemoteMediaId))
    );
  }
  return lines.join('\n');
}
