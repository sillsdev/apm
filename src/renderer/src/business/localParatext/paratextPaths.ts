import { getReadWriteProg } from '../../utils/paratextPath';
import path from 'path-browserify';
const ipc = window?.electron;

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
