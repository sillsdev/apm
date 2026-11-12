import { NetworkError } from '@orbit/jsonapi';

export const getHttpStatus = (ex: unknown): number | undefined => {
  if (ex && typeof ex === 'object' && 'response' in ex) {
    const status = (ex as { response?: { status?: number } }).response?.status;
    if (typeof status === 'number') return status;
  }
  return undefined;
};

/** 401 on Orbit/fetch errors, axios errStatus/status, or a bare status code */
export const isUnauthorized = (ex: unknown): boolean => {
  if (ex === 401) return true;
  if (getHttpStatus(ex) === 401) return true;
  if (ex && typeof ex === 'object') {
    const o = ex as { errStatus?: number; status?: number };
    return o.errStatus === 401 || o.status === 401;
  }
  return false;
};

export const isFetchNetworkError = (ex: unknown): boolean => {
  if (ex instanceof NetworkError) return true;
  if (!(ex instanceof Error)) return false;
  const msg = ex.message || '';
  const name = ex.name || '';
  // Chrome: Failed to fetch; Firefox: NetworkError when…; Safari: Load failed;
  // axios: Network Error
  return (
    msg === 'Failed to fetch' ||
    /^load failed$/i.test(msg) ||
    /network/i.test(msg) ||
    /network/i.test(name)
  );
};

/** axios / fetch timeout shapes */
export const isTimeoutError = (ex: unknown): boolean => {
  if (!ex || typeof ex !== 'object') return false;
  const o = ex as { code?: string; message?: string };
  if (
    o.code === 'ECONNABORTED' ||
    o.code === 'ETIMEDOUT' ||
    o.code === 'ERR_TIMED_OUT'
  )
    return true;
  return typeof o.message === 'string' && /timeout/i.test(o.message);
};

/** 408 + gateway blips that are often transient on GETs */
const RETRYABLE_STATUS = new Set([408, 502, 503, 504]);

export const isRetryableHttpStatus = (status: number): boolean =>
  RETRYABLE_STATUS.has(status);

export const isRetryableError = (ex: unknown): boolean =>
  isFetchNetworkError(ex) ||
  isTimeoutError(ex) ||
  RETRYABLE_STATUS.has(getHttpStatus(ex) ?? -1);

/** Turn a fetch Response with a retryable status into a throw so withNetworkRetry can retry */
export const retryableHttpError = (status: number): Error =>
  Object.assign(new Error(`HTTP ${status}`), {
    response: { status },
  });
