import { isRetryableError } from './httpError';

/** ponytail: fixed 3 attempts / exponential backoff — raise retries if flaky links need more */
export async function withNetworkRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoffMs = 300
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (ex) {
      last = ex;
      if (!isRetryableError(ex) || i === retries - 1) throw ex;
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, i)));
    }
  }
  throw last;
}
