import path from 'path-browserify';
import { Burrito, BurritoIngredients, BurritoScopes } from './data/types';
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
    let sectionId = '';
    let initialText = new Array<string>();
    const versions = parseInt(
      (getOrgDefault('burritoVersions', teamId) || '1') as string
    );

    for (const section of sections) {
      // get the passages files for the plan sorted by sequence number
      const planMedia = mediafiles.filter(
        (m) => related(section, 'plan') === related(m, 'plan')
      );

      let paraStart = '\\p';
      const passageRecs = passages
        .filter((p) => related(p, 'section') === section.id)
        .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
      for (const p of passageRecs) {
        // get additional passage info
        const passageType = passageTypeFromRef(p.attributes.reference, false);
        if (passageType !== PassageTypeEnum.PASSAGE) continue;

        // initialize the text for the passage
        const mediaSectionId = related(p, 'section');
        parseRef(p);
        const { startChapter, startVerse, endChapter, endVerse } = p.attributes;
        if (startChapter && startChapter !== chapter) {
          if (startChapter === 1) initialText.push(`\\id ${book}`);
          chapter = startChapter;
          initialText.push(`\\c ${chapter.toString()}`);
          chapters.add(chapter.toString());
        }
        if (sectionId !== mediaSectionId) {
          sectionId = mediaSectionId;
          if (paraStart) initialText.push(paraStart);
          paraStart = '';
          initialText.push(
            `\\s ${sectionDescription(section).trim().split('\u00A0\u00A0').slice(1).join('\u00A0\u00A0')}`
          );
        }

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

          textMap.set(
            i,
            textMap.has(i)
              ? (textMap.get(i) || []).concat(initialText)
              : initialText
          );

          // get the transcription for the usfm file
          if (attr?.transcription) {
            const text = textMap.get(i);
            if (text) {
              if (paraStart) text.push(paraStart);
              let verseRange = attr.transcription;
              if (!/\\v/.test(verseRange)) {
                let ref = startVerse?.toString();
                if (endChapter && endChapter !== startChapter) {
                  ref = `${ref}-${endChapter}:${endVerse?.toString()}`;
                } else if (endVerse && endVerse !== startVerse) {
                  ref = `${ref}-${endVerse?.toString()}`;
                }
                verseRange = `\\v ${ref} ${attr.transcription}`;
              }
              text.push(verseRange);
              textMap.set(i, text);
            }
          }
        }
        if (vernMedia.length > 0) {
          initialText = new Array<string>();
          paraStart = '\\p';
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
