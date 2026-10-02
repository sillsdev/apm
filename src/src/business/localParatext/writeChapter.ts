import { XMLSerializer } from '@xmldom/xmldom';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;
const xmlSerializer = new XMLSerializer();

export const writeChapter = async (
  paths: {
    chapterFile: string;
    book: string | undefined;
    chapter: string | undefined;
    program: (args: string[]) => Promise<any>;
  },
  ptProjName: string,
  usxDom: Document
) => {
  const usxXml: string = xmlSerializer.serializeToString(usxDom);
  ipc?.write(paths.chapterFile, usxXml);
  return await paths.program([
    '-w',
    ptProjName,
    paths.book || '',
    paths.chapter || '',
    paths.chapterFile,
    '-x',
  ]);
};
