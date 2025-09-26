import { DOMParser } from '@xmldom/xmldom';
import { IExecResult } from '../../model';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;
const domParser = new DOMParser();

export const readChapter = async (
  paths: {
    chapterFile: string;
    book: string | undefined;
    chapter: string | undefined;
    program: (args: string[]) => Promise<IExecResult>;
  },
  ptProjName: string
) => {
  const temp = await ipc?.temp();
  if (!temp) throw new Error('Unable to find temp directory.'); //this is app.getPath('temp')
  const { stdout } = await paths.program([
    '-r',
    ptProjName,
    paths.book || '',
    paths.chapter || '',
    paths.chapterFile,
    '-x',
  ]);
  if (stdout) console.log(stdout);

  const usx: string = (await ipc?.read(paths.chapterFile, 'utf-8')) as string;
  return domParser.parseFromString(usx);
};
