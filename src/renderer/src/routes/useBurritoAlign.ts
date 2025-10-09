import path from 'path-browserify';
import {
  Burrito,
  BurritoIngredients,
  BurritoScopes,
} from '../burrito/data/burritoBuilder';
import related from '../crud/related';
import { VernacularTag } from '../crud/useArtifactType';
import { useFetchUrlNow } from '../crud/useFetchUrlNow';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { useSnackBar } from '../hoc/SnackBar';
import { useOrbitData } from '../hoc/useOrbitData';
import { BibleD, MediaFileD, PassageD, SectionD } from '../model';
import dataPath, { PathType } from '../utils/dataPath';
import { removeExtension } from '../utils/removeExtension';
import cleanFileName from '../utils/cleanFileName';
import { parseRef } from '../crud/passage';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';
import { pad3 } from '../utils/pad3';

import { MainAPI } from '@model/main-api';
import {
  AlignmentBuilder,
  AlignmentGroup,
  AlignmentRecord,
} from '../burrito/data/alignmentBuilder';
import { getSegments, NamedRegions } from '../utils/namedSegments';
import { IRegion } from '../crud/useWavesurferRegions';
import { timeFmt } from '../utils/timeFmt';
const ipc = window?.api as MainAPI;

interface Props {
  metadata: Burrito;
  bible: BibleD;
  book: string;
  bookPath: string;
  preLen: number;
  sections: SectionD[];
}

export const useBurritoAlign = (teamId: string) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<PassageD[]>('passage');
  const { getOrgDefault } = useOrgDefaults();
  const fetchUrl = useFetchUrlNow();
  const { showMessage } = useSnackBar();

  return async ({
    metadata,
    bible,
    book,
    bookPath,
    preLen,
    sections,
  }: Props) => {
    // setup data structures to capture metadata from content
    const scopes: Map<string, string[]> = new Map(); // book scopes
    const compressions = new Set<string>();
    const ingredients: BurritoIngredients = {};
    const chapters = new Set<string>();

    let chapter = 0;
    let chapterPath = '';
    const alignPath = path.join(bookPath, 'alignment.json');
    const alignmentGroups: AlignmentGroup[] = [];

    for (const section of sections) {
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
          chapters.add(chapter.toString());
          chapterPath = path.join(bookPath, pad3(chapter));
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
        const versions = parseInt(
          (getOrgDefault('burritoVersions', teamId) || '1') as string
        );
        for (let i = 0; i < versions; i++) {
          if (i >= vernMedia.length) break;
          const attr = vernMedia[i].attributes;

          // get the "compression" for the metadata file
          const ext = removeExtension(attr.originalFile).ext?.toLowerCase();
          compressions.add(ext);

          // download the media file if necessary
          const mediaUrl = attr.audioUrl;
          const local = { localname: '' };
          await dataPath(mediaUrl, PathType.MEDIA, local);
          const mediaName = local.localname;
          if (!(await ipc?.exists(mediaName))) {
            const id = vernMedia[i].keys?.remoteId || vernMedia[i].id;
            await fetchUrl({ id, cancelled: () => false });
            if (!(await ipc?.exists(mediaName))) {
              showMessage(`Failed to download ${mediaUrl}`);
              continue;
            }
          }

          // create the destination file name and copy the media file
          const destName = `${
            bible?.attributes?.bibleId || teamId || ''
          }-${book}-${cleanFileName(p.attributes.reference)}v${
            attr.versionNumber
          }${path.extname(attr.originalFile)}`;
          const destPath = path.join(chapterPath, destName);
          const docid = destPath.substring(preLen);

          // get the verses for the timing file
          const alignmentRecords: AlignmentRecord[] = [];
          const regionstr = getSegments(
            NamedRegions.Verse,
            attr?.segments || '{}'
          );
          const segs = JSON.parse(regionstr ?? '{}')?.regions as
            | IRegion[]
            | undefined;
          segs?.forEach((s) => {
            alignmentRecords.push({
              references: [
                [`${timeFmt(s.start)} --> ${timeFmt(s.end)}`],
                [`${book} ${s.label}`],
              ],
            } as AlignmentRecord);
          });
          alignmentGroups.push({
            documents: [
              { scheme: 'vtt-timecode', docid },
              { scheme: 'u23003' },
            ],
            records: alignmentRecords,
          });
        }
      }
    }
    const alignment = new AlignmentBuilder()
      .withGroups(alignmentGroups)
      .build();
    const content = JSON.stringify(alignment, null, 2);
    await ipc?.write(alignPath, content);
    // add the alignment file to the metadata file
    const docid = alignPath.substring(preLen);
    ingredients[docid] = {
      checksum: { md5: await ipc?.md5File(alignPath) },
      mimeType: 'application/json',
      size: content.length,
      scope: { [book]: Array.from(chapters).sort() },
      role: ['timing'],
    };
    const curScopes = scopes.get(book) || [];
    scopes.set(book, [...curScopes, ...Array.from(chapters).sort()]);
    const newScopes: BurritoScopes = {};
    Array.from(scopes).forEach((scope) => {
      newScopes[scope[0]] = scope[1];
    });
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.currentScope = newScopes;
    }
    metadata.ingredients = ingredients;
    if (metadata.type?.flavorType?.flavor?.name) {
      metadata.type.flavorType.flavor.name = 'timing';
    }
    return metadata;
  };
};
