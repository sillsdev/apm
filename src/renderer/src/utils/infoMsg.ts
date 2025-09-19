import { IApiError } from '../model';
import { ServerError } from '@orbit/jsonapi';
import { Severity } from './logErrorService';
import { IAxiosStatus } from '../store/AxiosStatus';

export const infoMsg = (e: Error, info: string): IApiError => {
  return { ...e, name: info + e.name } as IApiError;
};

export const axiosError = (e: IAxiosStatus): Error =>
  ({
    name: e.statusMsg,
    message: `${e.errStatus}: ${e.errMsg}`,
  }) as Error;

const orbitMsg = (err: Error | IApiError | null, info: string): string =>
  err instanceof ServerError &&
  (err.data as { errors: { detail: string }[] }).errors?.length > 0
    ? info +
      ': ' +
      err.message +
      ((err.data as { errors: { detail: string }[] }).errors?.[0]?.detail || '')
    : info + (err ? ': ' + err.message : '');

export const orbitErr = (
  err: Error | IApiError | null,
  info: string
): IApiError =>
  ({
    ...err,
    message: orbitMsg(err, info),
    response: { status: 500 },
  }) as IApiError;

export const orbitInfo = (err: Error | null, info: string): IApiError =>
  ({
    ...err,
    message: orbitMsg(err, info),
    response: { status: Severity.info },
  }) as IApiError;

export const orbitRetry = (err: Error | null, info: string): IApiError =>
  ({
    ...err,
    message: orbitMsg(err, info),
    response: { status: Severity.retry },
  }) as IApiError;
