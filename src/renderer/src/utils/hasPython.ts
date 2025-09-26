import { getRegVal } from '.';
import { getWhereis } from './getWhereis';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

const key = 'HKCR\\Python.CompiledFile\\shell\\open\\command';
export const hasPython = async (): Promise<boolean> => {
  if (await ipc?.isWindows()) {
    return Boolean(await getRegVal(key, ''));
  } else {
    return (await getWhereis('python')).length > 0;
  }
};
