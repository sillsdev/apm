import { getRegVal } from '.';
import { getWhereis } from './getWhereis';
const ipc = window?.electron;

const key = 'HKCR\\Audacity.Project\\shell\\open\\command';

export const hasAudacity = async (): Promise<boolean> => {
  if (await ipc?.isWindows()) {
    return Boolean(await getRegVal(key, ''));
  } else {
    return (await getWhereis('audacity')).length > 0;
  }
};
