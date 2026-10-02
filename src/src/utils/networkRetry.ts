import {
  isRetryableError,
  isRetryableHttpStatus,
  retryableHttpError,
} from './httpError';

const isFetchLikeResponse = (
  result: unknown
): result is { status: number; ok: boolean } => {
  if (!result || typeof result !== 'object') return false;
  const r = result as { ok?: unknown; status?: unknown };
  return typeof r.ok === 'boolean' && typeof r.status === 'number';
};

/** ponytail: fixed 3 attempts / exponential backoff — raise retries if flaky links need more */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoffMs = 300
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const result = await fn();
      // fetch resolves on 502/503/504 — promote those to throws so we retry
      if (isFetchLikeResponse(result) && isRetryableHttpStatus(result.status)) {
        throw retryableHttpError(result.status);
      }
      return result;
    } catch (ex) {
      last = ex;
      if (!isRetryableError(ex) || i === retries - 1) throw ex;
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, i)));
    }
  }
  throw last;
}
