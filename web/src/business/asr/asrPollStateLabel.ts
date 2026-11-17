/** Localized labels for aero clip/task states shown in AsrProgress. */
export interface AsrPollStateLabels {
  asrQueued: string;
  asrPending: string;
  asrStarted: string;
  asrSuccess: string;
  asrFailure: string;
}

/**
 * User-visible status for a poll clip. Empty/missing → queued; never returns
 * a raw service token (unknown maps to pending).
 */
export function asrPollStateLabel(
  state: string | undefined,
  labels: AsrPollStateLabels
): string {
  switch ((state ?? '').trim().toUpperCase()) {
    case '':
    case 'QUEUED':
      return labels.asrQueued;
    case 'PENDING':
      return labels.asrPending;
    case 'STARTED':
      return labels.asrStarted;
    case 'SUCCESS':
      return labels.asrSuccess;
    case 'FAILURE':
      return labels.asrFailure;
    default:
      return labels.asrPending;
  }
}
