import Memory from '@orbit/memory';
import { PassageInfo } from './PassageInfo';
import { paratextPaths } from './paratextPaths';
import { readChapter } from './readChapter';
import { postPass } from './postPass';
import { writeChapter } from './writeChapter';
import { RecordOperation, RecordTransformBuilder } from '@orbit/records';
import { ActivityStates, SectionArray } from '../../model';
import { UpdateMediaStateOps } from '../../crud/updatePassageState';
const ipc = window?.electron;

interface IDoChapter {
  chap: string;
  passInfo: PassageInfo[];
  ptProjName: string;
  memory: Memory;
  userId: string;
  exportNumbers: boolean;
  sectionArr: SectionArray | undefined;
}

export const doChapter = async ({
  chap,
  passInfo,
  ptProjName,
  memory,
  userId,
  exportNumbers,
  sectionArr,
}: IDoChapter) => {
  const paths = await paratextPaths(chap);

  const usxDom: Document = await readChapter(paths, ptProjName);

  passInfo = passInfo.sort(
    (i, j) =>
      (i.passage?.attributes.startVerse || 0) -
      (j.passage?.attributes.startVerse || 0)
  );

  passInfo.forEach((p) => {
    postPass({
      doc: usxDom,
      chap: chap.split('-')[1] || '',
      currentPI: p,
      exportNumbers,
      sectionArr,
      memory,
    });
  });

  const { stdout } = await writeChapter(paths, ptProjName, usxDom);
  if (stdout) console.log(stdout);
  const ops: RecordOperation[] = [];
  const tb = new RecordTransformBuilder();
  for (const p of passInfo) {
    const cmt = p.passage.attributes.lastComment;
    p.passage.attributes.lastComment = '';
    UpdateMediaStateOps(
      p.mediaId,
      p.passage.id,
      ActivityStates.Done,
      userId,
      tb,
      ops,
      memory,
      'Paratext-' + cmt
    );
  }
  await memory.update(ops);

  ipc?.delete(paths.chapterFile);
};
