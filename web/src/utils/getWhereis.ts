import { IExeca } from '../model';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const getWhereis = async (
  key: string,
  scall?: typeof ipc.exec
): Promise<string> => {
  let val: string | undefined = undefined;
  try {
    // eslint-disable-next-line no-unsafe-optional-chaining
    const { stdout } = (await (scall || ipc?.exec)('whereis', [key], {
      env: { ...{ ...process }.env, DISPLAY: ':0' },
    })) as IExeca;
    if (typeof stdout === 'string') val = stdout;
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'ENOENT') throw err;
  }
  const res = val ? val : '';
  const opts = res.trim().split(' ');
  for (const item of opts) {
    if (item === '') continue;
    const itemName = item.split('/').pop();
    if (itemName === key) return item;
  }
  return '';
};
