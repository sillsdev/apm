import Bugsnag from '@bugsnag/js';
import { axiosPost } from '../utils/axios';
import { infoMsg, logError, Severity } from '../utils';

export async function logLoginAnalytics(
  token?: string | null,
  errorReporter?: typeof Bugsnag
): Promise<void> {
  if (!token) return;
  try {
    await axiosPost('useranalytics/track', undefined, token);
  } catch (error) {
    logError(
      Severity.error,
      errorReporter,
      infoMsg(error as Error, 'logLoginAnalytics failed')
    );
  }
}
