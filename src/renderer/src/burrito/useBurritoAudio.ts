import path from 'path-browserify';
import {
  AlignmentBuilder,
  AlignmentGroup,
  AlignmentRecord,
} from './data/alignmentBuilder';
import {
  Burrito,
  BurritoIngredients,
  BurritoScopes,
} from './data/burritoBuilder';
import related from '../crud/related';
import { VernacularTag, useArtifactType } from '../crud/useArtifactType';
import { ArtifactTypeSlug } from '../crud/artifactTypeSlug';
import { useFetchUrlNow } from '../crud/useFetchUrlNow';
import { useOrgDefaults } from '../crud/useOrgDefaults';
import { useSnackBar } from '../hoc/SnackBar';
import { useOrbitData } from '../hoc/useOrbitData';
import {
  BibleD,
  MediaFileD,
  PassageD,
  SectionD,
  SectionResourceD,
  SharedResourceD,
} from '../model';
import dataPath, { PathType } from '../utils/dataPath';
import cleanFileName from '../utils/cleanFileName';
import { parseRef } from '../crud/passage';
import { passageTypeFromRef } from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageType';
import { pad3 } from '../utils/pad3';
import { sortChapters } from '../utils/sort';
import { getSegments, NamedRegions } from '../utils/namedSegments';
import { IRegion } from '../crud/useWavesurferRegions';
import { timeFmt } from '../utils/timeFmt';
import { useComputeRef } from '../components/PassageDetail/Internalization/useComputeRef';
import { MainAPI } from '@model/main-api';
import { Stats } from 'fs';
import getMediaExt from '../utils/getMediaExt';
const ipc = window?.api as MainAPI;

interface Props {
  metadata: Burrito;
  bible: BibleD;
  book: string;
  bookPath: string;
  preLen: number;
  sections: SectionD[];
  /** When set, only include passages of this type. When null, accept any passage type. Defaults to PASSAGE. */
  passageTypeFilter?: PassageTypeEnum | null;
  /** When set, overrides type.flavorType.name in metadata (e.g. 'x-notes' for Notes export). */
  flavorTypeName?: string;
  /** When set, only include media files whose artifact type slug is in this list (e.g. Resource, SharedResource, ProjectResource). */
  artifactTypeFilter?: ArtifactTypeSlug[];
}

export const useBurritoAudio = (teamId: string) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<PassageD[]>('passage');
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const sharedResources = useOrbitData<SharedResourceD[]>('sharedresource');
  const { slugFromId } = useArtifactType(teamId);
  const { getOrgDefault } = useOrgDefaults();
  const fetchUrl = useFetchUrlNow();
  const { showMessage } = useSnackBar();
  const { computeSectionRef } = useComputeRef();

  return async ({
    metadata,
    bible,
    book,
    bookPath,
    preLen,
    sections,
    passageTypeFilter = PassageTypeEnum.PASSAGE,
    flavorTypeName,
    artifactTypeFilter,
  }: Props) => {
    if (flavorTypeName && metadata.type?.flavorType) {
      metadata.type.flavorType.name = flavorTypeName;
    }
    const bibleId = bible?.attributes?.bibleId || teamId || '';
    const scopes: Map<string, string[]> = new Map();
    // const compressions = new Set<string>();
    const ingredients: BurritoIngredients = {};
    const chapters = new Set<string>();
    const alignmentGroups: AlignmentGroup[] = [];
    const alignPath = path.join(bookPath, 'alignment.json');
    const nType =
      flavorTypeName === 'x-notes'
        ? 'f'
        : flavorTypeName && flavorTypeName.length > 2
          ? flavorTypeName?.[2].toLowerCase()
          : '';

    const makeArtifactFilter = () =>
      artifactTypeFilter
        ? (m: MediaFileD) => {
            const atId = related(m, 'artifactType');
            const slug = atId
              ? (slugFromId(atId) as ArtifactTypeSlug)
              : ArtifactTypeSlug.Vernacular;
            return artifactTypeFilter.includes(slug);
          }
        : (m: MediaFileD) =>
            related(m, 'artifactType') === VernacularTag ||
            !related(m, 'artifactType');

    const filterAndSortMedia = (media: MediaFileD[], takeLatestOnly = false) =>
      media
        .filter(makeArtifactFilter())
        .sort((a, b) => b.attributes.versionNumber - a.attributes.versionNumber)
        .filter(
          takeLatestOnly
            ? (m, i, arr) => arr.findIndex((x) => x.id === m.id) === i
            : () => true
        );

    const processMediaFile = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string,
      contextLabel: string,
      buildAlignment: boolean
    ): Promise<void> => {
      const attr = m.attributes;
      // const ext = getExtention(m);
      // compressions.add(ext ?? '');
      if (!attr.audioUrl) {
        showMessage(`No media URL for ${contextLabel} (${attr.originalFile})`);
        return;
      }
      const local = { localname: '' };
      await dataPath(attr.audioUrl, PathType.MEDIA, local);
      const mediaName = local.localname;
      if (!(await ipc?.exists(mediaName))) {
        const id = m.keys?.remoteId || m.id;
        await fetchUrl({ id, cancelled: () => false });
        if (!(await ipc?.exists(mediaName))) {
          showMessage(`Failed to download ${attr.audioUrl}`);
          return;
        }
      }
      const docid = destPath.substring(preLen);
      await ipc?.copyFile(mediaName, destPath);
      if (buildAlignment) {
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
        if (alignmentRecords.length) {
          alignmentGroups.push({
            documents: [
              { scheme: 'vtt-timecode', docid },
              { scheme: 'u23003' },
            ],
            records: alignmentRecords,
          });
        }
      }
      if (!attr.filesize || attr.filesize === 0) {
        const stat = JSON.parse(await ipc?.stat(destPath)) as Stats;
        attr.filesize = stat?.size || 0;
      }
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(destPath) },
        mimeType: attr.contentType,
        size: attr.filesize,
        scope: { [book]: [scopeRef] },
        properties: {
          apmId: m.keys?.remoteId || m.id,
        },
      };
    };

    const processMarkdownFile = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string
    ) => {
      const attr = m.attributes;
      destPath += '.md';
      ipc?.write(destPath, attr.originalFile);
      const docid = destPath.substring(preLen);
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(destPath) },
        mimeType: attr.contentType,
        size: attr.originalFile.length,
        scope: { [book]: [scopeRef] },
        properties: {
          apmId: m.keys?.remoteId || m.id,
        },
      };
    };

    let chapter = 0;
    let chapterPath = '';

    for (const section of sections) {
      const refCount = new Map<string, number>();
      const nextRef = (lastReference: string) => {
        refCount.set(lastReference, (refCount.get(lastReference) || 0) + 1);
        return `${refCount.get(lastReference) || 0}`;
      };

      // get the passage files for the plan sorted by sequence number
      const planMedia = mediafiles.filter(
        (m) => related(section, 'plan') === related(m, 'plan')
      );
      const passageRecs = passages
        .filter((p) => related(p, 'section') === section.id)
        .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
      let sectionRef = '';
      let sectionChapter = 0;
      let sectionChapterPath = '';
      if (passageRecs.length > 0) {
        const firstP = passageRecs[0];
        sectionRef = computeSectionRef(section.id);
        parseRef(firstP);
        const pt = passageTypeFromRef(firstP.attributes.reference, false);
        sectionChapter =
          pt === PassageTypeEnum.CHAPTERNUMBER
            ? parseInt(firstP.attributes.reference.split(' ')[1], 10) || 1
            : firstP.attributes.startChapter || 1;
        if (!isNaN(sectionChapter)) {
          sectionChapterPath = path.join(bookPath, pad3(sectionChapter));
          chapters.add(sectionChapter.toString());
          await ipc?.createFolder(sectionChapterPath);
        }
      }

      // when using artifactTypeFilter (e.g. Resources), include section-level resources (one copy each)
      if (artifactTypeFilter) {
        const sectionLevelSecRes = sectionResources.filter(
          (sr) =>
            related(sr, 'section') === section.id && !related(sr, 'passage')
        );
        const seenMediaIds = new Set<string>();
        const sectionResourceMedia = sectionLevelSecRes
          .map((sr) => planMedia.find((m) => m.id === related(sr, 'mediafile')))
          .filter(
            (m): m is MediaFileD =>
              m != null &&
              !seenMediaIds.has(m.id) &&
              (seenMediaIds.add(m.id), true)
          );
        const sectionFilteredMedia = filterAndSortMedia(
          sectionResourceMedia,
          true
        );
        if (sectionFilteredMedia.length > 0) {
          const sectionRefCount = nextRef(sectionRef);
          for (const m of sectionFilteredMedia) {
            const attr = m.attributes;
            const destName = `${bibleId}-${book}-section-${cleanFileName(sectionRef) + `${nType}${sectionRefCount}`}v${attr.versionNumber}.${getMediaExt(m)}`;
            const destPath = path.join(sectionChapterPath, destName);
            if (attr.contentType === 'text/markdown') {
              await processMarkdownFile(m, destPath, sectionRef);
            } else {
              await processMediaFile(
                m,
                destPath,
                sectionRef,
                'section resource',
                false
              );
            }
          }
        }
      }

      let lastReference = sectionRef;
      for (const p of passageRecs) {
        // get additional passage info
        const passageType = passageTypeFromRef(p.attributes.reference, false);
        if (passageType === PassageTypeEnum.PASSAGE) {
          lastReference = p.attributes.reference;
        }

        // parse the passage reference
        parseRef(p);
        let { startChapter } = p.attributes;
        // content before first passage with a chapter number is in chapter 1
        if (!startChapter && chapter === 0) startChapter = 1;
        if (passageType === PassageTypeEnum.CHAPTERNUMBER) {
          startChapter = parseInt(lastReference.split(' ')[1]);
        }

        // new chapter number create a new chapter folder and usfm chapter header if necessary
        if (startChapter && startChapter !== chapter) {
          chapter = startChapter;
          chapters.add(chapter.toString());
          chapterPath = path.join(bookPath, pad3(chapter));
          await ipc?.createFolder(chapterPath);
        }
        if (passageTypeFilter != null && passageType !== passageTypeFilter)
          continue;

        const media = planMedia.filter((m) => related(m, 'passage') === p.id);
        const vernMedia = filterAndSortMedia(media);
        const versions = parseInt(
          (getOrgDefault('burritoVersions', teamId) || '1') as string
        );
        const sharedResource = sharedResources.find(
          (sr) => related(sr, 'passage') === p.id
        );
        const sharedResourceTitle = sharedResource
          ? `_${sharedResource.attributes.title}_`
          : '';
        let lastReferenceCount = nextRef(lastReference);
        lastReferenceCount = nType ? `${nType}${lastReferenceCount}` : '';
        for (let i = 0; i < versions && i < vernMedia.length; i++) {
          const m = vernMedia[i];
          const destName = `${bibleId}-${book}-${cleanFileName(lastReference + lastReferenceCount + sharedResourceTitle)}v${m.attributes.versionNumber}.${getMediaExt(m)}`;
          const destPath = path.join(chapterPath, destName);
          const contextLabel = `${p.attributes.book} ${lastReference}`;
          await processMediaFile(
            m,
            destPath,
            lastReference,
            contextLabel,
            true
          );
        }
      }
    }
    const alignment = new AlignmentBuilder()
      .withGroups(alignmentGroups)
      .build();
    const alignmentContent = JSON.stringify(alignment, null, 2);
    await ipc?.write(alignPath, alignmentContent);
    const alignmentDocId = alignPath.substring(preLen);
    ingredients[alignmentDocId] = {
      checksum: { md5: await ipc?.md5File(alignPath) },
      mimeType: 'application/json',
      size: alignmentContent.length,
      scope: { [book]: sortChapters(chapters) },
      role: 'timing',
    };
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

    // add the formats to the metadata file
    // const formats: BurritoFormats = {};
    // let formatn = 0;
    // Array.from(compressions).forEach((c) => {
    //   formats[`format${++formatn}`] = {
    //     compression: c,
    //     trackConfiguration: 'mono',
    //   };
    // });
    // if (metadata.type?.flavorType?.flavor) {
    //   metadata.type.flavorType.flavor.formats = formats;
    // }
    return metadata;
  };
};
