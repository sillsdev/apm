import { IOrbitState } from './types';

export const orbitCleanState = {
  status: undefined,
  message: '',
  details: '',
  saving: false,
  retry: 0,
  fetchResults: undefined,
} as IOrbitState;
