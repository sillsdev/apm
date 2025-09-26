import { getRegVal } from '.';
import { getWhereis } from './getWhereis';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

const key = 'HKCR\\Audacity.Project\\shell\\open\\command';

export const hasAudacity = async (): Promise<boolean> => {
  if (await ipc?.isWindows()) {
    return Boolean(await getRegVal(key, ''));
  } else {
    return (await getWhereis('audacity')).length > 0;
  }
};
