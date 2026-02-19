import path from 'path-browserify';
import {
  Burrito,
  BurritoIngredients,
  BurritoScopes,
} from './data/burritoBuilder';
import related from '../crud/related';
import { VernacularTag } from '../crud/useArtifactType';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { useOrbitData } from '../hoc/useOrbitData';
import { MediaFileD, PassageD, SectionD } from '../model';
import { parseRef } from '../crud/passage';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';

import { sortChapters } from '../utils/sort';
import { MainAPI } from '@model/main-api';
import { sectionDescription } from '../crud/section';
const ipc = window?.api as MainAPI;

interface Props {
  metadata: Burrito;
  book: string;
  bookPath: string;
  preLen: number;
  sections: SectionD[];
}

export const useBurritoText = (teamId: string) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<PassageD[]>('passage');
  const { getOrgDefault } = useOrgDefaults();

  return async ({ metadata, book, bookPath, preLen, sections }: Props) => {
    // setup data structures to capture metadata from content
    const scopes: Map<string, string[]> = new Map(); // book scopes
    const ingredients: BurritoIngredients = {};
    const chapters = new Set<string>();
    const textNameMap = new Map<number, string>();
    const textMap = new Map<number, string[]>();

    let chapter = 0;
    let bookStart = '';
    let chapterStart = '';
    const versions = parseInt(
      (getOrgDefault('burritoVersions', teamId) || '1') as string
    );

    for (const section of sections) {
      let sectionStart = `\\s ${sectionDescription(section).trim()}\n`;

      // get the passages files for the plan sorted by sequence number
      const planMedia = mediafiles.filter(
        (m) => related(section, 'plan') === related(m, 'plan')
      );
      const passageRecs = passages
        .filter((p) => related(p, 'section') === section.id)
        .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
      for (const p of passageRecs) {
        // get additional passage info
        const passageType = passageTypeFromRef(p.attributes.reference, false);

        // parse the passage reference
        parseRef(p);
        let { startChapter } = p.attributes;
        // content before first passage with a chapter number is in chapter 1
        if (!startChapter && chapter === 0) startChapter = 1;
        if (passageType === PassageTypeEnum.CHAPTERNUMBER) {
          startChapter = parseInt(p.attributes.reference.split(' ')[1]);
        }

        // new chapter number create a new chapter folder and usfm chapter header if necessary
        if (startChapter && startChapter !== chapter) {
          chapter = startChapter;
          if (chapter === 1) bookStart = `\\id ${book}`;
          chapterStart = `\\c ${chapter.toString()}`;
          chapters.add(chapter.toString());
        }
        if (passageType !== PassageTypeEnum.PASSAGE) continue;

        // get the media files for the passage
        const media = planMedia.filter((m) => related(m, 'passage') === p.id);

        // get the vernacular media files for the passage and sort them by descending version number
        const vernMedia = media
          .filter(
            (m) =>
              related(m, 'artifactType') === VernacularTag ||
              !related(m, 'artifactType')
          )
          .sort(
            (a, b) => b.attributes.versionNumber - a.attributes.versionNumber
          );
        for (let i = 0; i < versions; i++) {
          if (i >= vernMedia.length) break;
          const attr = vernMedia[i].attributes;

          // initialize name and text maps
          if (!textNameMap.has(i)) {
            textNameMap.set(i, `${book}v${i + 1}.usfm`);
          }
          if (!textMap.has(i)) {
            const initialText = new Array<string>();
            if (bookStart) initialText.push(bookStart);
            if (sectionStart) initialText.push(sectionStart);
            if (chapterStart) initialText.push(chapterStart);
            textMap.set(i, initialText);
            chapterStart = '';
            sectionStart = '';
            bookStart = '';
          }

          // get the transcription for the usfm file
          if (attr?.transcription) {
            const text = textMap.get(i);
            if (text) {
              let verseRange = attr.transcription;
              if (!/\\v/.test(verseRange)) {
                verseRange = `\\v ${p.attributes.reference} ${attr.transcription}`;
              }
              text.push(verseRange);
              textMap.set(i, text);
            }
          }
        }
      }
    }
    for (let i = 0; i < versions; i++) {
      const name = textNameMap.get(i);
      if (!name) continue;
      const textPath = path.join(bookPath, name);
      const text = textMap.get(i);
      const content = text?.join('\n') as string;
      await ipc?.write(textPath, content);
      // add the alignment file to the metadata file
      const docid = textPath.substring(preLen);
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(textPath) },
        mimeType: 'application/json',
        size: content.length,
        scope: { [book]: sortChapters(chapters) },
      };
    }
    const curScopes = scopes.get(book) || [];
    scopes.set(book, [...curScopes, ...sortChapters(chapters)]);
    const newScopes: BurritoScopes = {};
    Array.from(scopes).forEach((scope) => {
      newScopes[scope[0]] = scope[1];
    });
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.currentScope = {
        ...metadata.type.flavorType.currentScope,
        ...newScopes,
      };
    }
    metadata.ingredients = { ...metadata.ingredients, ...ingredients };
    if (metadata.type?.flavorType?.flavor?.name) {
      metadata.type.flavorType.flavor.name = 'textTranslation';
    }
    return metadata;
  };
};
