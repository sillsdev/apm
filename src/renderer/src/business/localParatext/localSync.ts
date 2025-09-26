import Memory from '@orbit/memory';
import {
  ActivityStates,
  MediaFileD,
  Passage,
  PassageD,
  SectionArray,
} from '../../model';
import { PassageInfo } from './PassageInfo';
import { related } from '../../crud/related';
import { parseRef } from '../../crud/passage';
import { crossChapterRefs } from './crossChapterRefs';
import { doChapter } from './doChapter';

interface IlocalSync {
  plan: string;
  ptProjName: string;
  mediafiles: MediaFileD[];
  passages: PassageD[];
  memory: Memory;
  userId: string;
  passage: Passage | undefined;
  exportNumbers: boolean;
  sectionArr: SectionArray | undefined;
  artifactId: string | null;
  getTranscription: (passId: string, artifactId: string | null) => string;
}

export const localSync = async ({
  plan,
  ptProjName,
  mediafiles,
  passages,
  memory,
  userId,
  passage,
  exportNumbers,
  sectionArr,
  artifactId,
  getTranscription,
}: IlocalSync): Promise<string> => {
  const chapChg: { [key: string]: PassageInfo[] } = {};
  let probablyready = mediafiles.filter(
    (m) =>
      related(m, 'plan') === plan &&
      related(m, 'artifactType') === artifactId && //will this find vernacular?
      m.attributes?.transcriptionstate === ActivityStates.Approved
  );
  if (passage) {
    probablyready = probablyready.filter(
      (m) => related(m, 'passage') === passage.id
    );
  }
  //ensure this is the latest mediafile for the passage
  const ready: PassageInfo[] = [];
  probablyready.forEach((pr) => {
    const passageId = related(pr, 'passage');
    const prVer = pr.attributes?.versionNumber;
    let newer: MediaFileD[] = [];
    if (!artifactId) {
      // only check version on vernacular
      newer = mediafiles.filter(
        (m) =>
          related(m, 'passage') === passageId &&
          related(m, 'artifactType') === artifactId &&
          m.attributes.versionNumber > prVer
      );
    }
    if (newer.length === 0) {
      const passage = passages.find((p) => p.id === passageId);
      if (passage)
        ready.push({
          passage: passage,
          mediaId: pr.id,
          transcription: getTranscription(passage.id, artifactId).replace(
            '\n',
            ' '
          ),
        });
    }
  });
  ready.forEach((r) => {
    r.passage.attributes.startChapter = undefined;
    parseRef(r.passage);
    const chap = crossChapterRefs(r.passage);
    if (chap) {
      const k = r.passage.attributes?.book + '-' + chap;
      if (Object.hasOwn(chapChg, k)) {
        chapChg[k].push(r);
      } else {
        chapChg[k] = [r];
      }
    }
    parseRef(r.passage);
    const { startChapter, endChapter } = r.passage.attributes;
    if (startChapter !== endChapter && r.transcription.indexOf('\\c') !== -1) {
      const k =
        r.passage.attributes?.book +
        '-' +
        (chap === startChapter ? endChapter : startChapter);
      if (Object.hasOwn(chapChg, k)) {
        chapChg[k].push(r);
      } else {
        chapChg[k] = [r];
      }
    }
  });
  for (const c of Object.keys(chapChg)) {
    try {
      await doChapter({
        chap: c,
        passInfo: chapChg[c],
        ptProjName,
        memory,
        userId,
        exportNumbers,
        sectionArr,
      });
    } catch (errResult: unknown) {
      const error = errResult as Error;
      return error.message.replace(
        'Missing Localizer implementation. English text will be used instead.',
        ''
      );
    }
  }
  return '';
};
