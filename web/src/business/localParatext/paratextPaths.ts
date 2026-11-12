import { getReadWriteProg } from '../../utils/paratextPath';
import path from 'path-browserify';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const paratextPaths = async (chap: string) => {
  const ptProg = await getReadWriteProg();
  const pt = chap.split('-');
  const temp = (await ipc?.temp()) ?? '/tmp';
  return {
    chapterFile: path.join(temp, chap + '.usx') as string,
    book: pt[0],
    chapter: pt[1],
    program: ptProg,
  };
};
