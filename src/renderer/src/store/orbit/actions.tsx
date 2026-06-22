import {
  FETCH_ORBIT_DATA,
  ORBIT_ERROR,
  ORBIT_RETRY,
  IApiError,
  IFetchResults,
  RESET_ORBIT_ERROR,
  ORBIT_SAVING,
  FETCH_ORBIT_DATA_COMPLETE,
} from './types';
import Coordinator from '@orbit/coordinator';
import { Sources } from '../../Sources';
import {
  Severity,
  isOrbitQueueCancelled,
  orbitErr,
  getHttpStatus,
} from '../../utils';
import { OfflineProject, Plan, VProject } from '../../model';
import { ITokenContext } from '../../context/TokenProvider';
import { AlertSeverity } from '../../hoc/SnackBar';

export const orbitError = (ex: IApiError) => {
  const status = ex?.response?.status;
  return status !== Severity.retry
    ? {
        type: ORBIT_ERROR,
        payload: ex,
      }
    : {
        type: ORBIT_RETRY,
        payload: ex,
      };
};

export const orbitComplete = () => (dispatch: any) => {
  dispatch({
    type: FETCH_ORBIT_DATA_COMPLETE,
  });
};

export const doOrbitError = (ex: IApiError) => (dispatch: any) => {
  dispatch(orbitError(ex));
};

export const resetOrbitError = () => {
  return {
    type: RESET_ORBIT_ERROR,
  };
};

export const orbitSaving = (val: boolean) => {
  return {
    type: ORBIT_SAVING,
    payload: val,
  };
};

export interface IFetchOrbitData {
  coordinator: Coordinator;
  tokenCtx: ITokenContext;
  fingerprint: string;
  errorReporter: any;
  orbitRetries: number;
  setUser: (id: string) => void;
  setProjectsLoaded: (value: string[]) => void;
  setOrbitRetries: (r: number) => void;
  getOfflineProject: (plan: Plan | VProject | string) => OfflineProject;
  offlineSetup: () => Promise<void>;
  showMessage: (msg: string | React.JSX.Element, alert?: AlertSeverity) => void;
  forceDataChanges: () => Promise<void>;
}

const fetchOrbitDataFailed = (): IFetchResults => ({
  syncBuffer: undefined as unknown as Buffer,
  syncFile: '',
  goRemote: false,
});

export const fetchOrbitData =
  ({
    coordinator,
    tokenCtx,
    fingerprint,
    errorReporter,
    orbitRetries,
    setUser,
    setProjectsLoaded,
    setOrbitRetries,
    getOfflineProject,
    offlineSetup,
    showMessage,
    forceDataChanges,
  }: IFetchOrbitData) =>
  (dispatch: any) => {
    Sources(
      coordinator,
      tokenCtx,
      fingerprint,
      errorReporter,
      orbitRetries,
      setUser,
      setProjectsLoaded,
      (ex: IApiError) => dispatch(orbitError(ex)),
      setOrbitRetries,
      getOfflineProject,
      offlineSetup,
      showMessage,
      forceDataChanges
    )
      .then((fr) => {
        dispatch({ type: FETCH_ORBIT_DATA, payload: fr });
      })
      .catch((ex: unknown) => {
        const status = getHttpStatus(ex);
        if (isOrbitQueueCancelled(ex)) return;
        if (status === 401) return;
        dispatch({
          type: FETCH_ORBIT_DATA,
          payload: fetchOrbitDataFailed(),
        });
        const apiEx = ex as IApiError;
        if (apiEx?.response?.status != null) {
          dispatch(orbitError(apiEx));
        } else {
          dispatch(
            orbitError(
              orbitErr(ex instanceof Error ? ex : null, 'fetch orbit data')
            )
          );
        }
      });
  };
