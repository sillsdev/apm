import path from 'path-browserify';
import {
  AlignmentBuilder,
  AlignmentGroup,
  AlignmentRecord,
} from './data/alignmentBuilder';
import { Burrito, BurritoIngredients, BurritoScopes } from './data/types';
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
import {
  chnumChapterFromRef,
  isBookLevelSection,
  resolveBurritoExportFolder,
} from './resolveBurritoExportFolder';
import { MainAPI } from '@model/main-api';
import { Stats } from 'fs';
import getMediaExt from '../utils/getMediaExt';
import getBurritoMediaExportStem from '../utils/burritoMediaFileStem';
import {
  BURRITO_AUDIO_FILE_EXTENSIONS,
  inferAudioContentType,
} from '../utils/mimeTypes';
const ipc = window?.api as MainAPI;

const truncateForMessage = (s: string, maxLen = 120): string => {
  const t = (s ?? '').trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
};

const primaryContentType = (m: MediaFileD): string =>
  (m.attributes.contentType || '').split(';')[0]?.trim().toLowerCase() ?? '';

const looksLikeHttpUrl = (s: string): boolean =>
  /^https?:\/\//i.test((s || '').trim());

const inlineTextExtension = (contentType: string): string => {
  const sub = contentType.split('/')[1]?.trim() || '';
  if (sub === 'html' || sub === 'xhtml+xml') return '.html';
  if (sub === 'markdown') return '.md';
  return '.txt';
};

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
  /** When true, transcode non-MP3 audio in the burrito tree to MP3 and update ingredient paths and metadata. */
  convertToMp3?: boolean;
}

export const useBurritoAudio = (teamId: string) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<PassageD[]>('passage');
  const sectionsAll = useOrbitData<SectionD[]>('section');
  const sectionResources = useOrbitData<SectionResourceD[]>('sectionresource');
  const sharedResources = useOrbitData<SharedResourceD[]>('sharedresource');
  const { slugFromId } = useArtifactType(teamId);
  const { getOrgDefault } = useOrgDefaults();
  const fetchUrl = useFetchUrlNow();
  const { showMessage } = useSnackBar();
  const { computeSectionRef, computeMovementRef } = useComputeRef();

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
    convertToMp3 = false,
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

    const stripTrailingExtension = (filePath: string): string => {
      const ext = path.extname(filePath);
      return ext ? filePath.slice(0, -ext.length) : filePath;
    };

    const ensureParentDir = async (filePath: string) => {
      const dir = path.dirname(filePath);
      if (!dir || dir === '.' || dir === '/') return;
      await ipc?.createFolder(dir);
    };

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
        showMessage(
          `No media URL for ${truncateForMessage(contextLabel)} (${truncateForMessage(attr.originalFile)})`
        );
        return;
      }
      const local = { localname: '' };
      await dataPath(attr.audioUrl, PathType.MEDIA, local);
      const mediaName = local.localname;
      if (!(await ipc?.exists(mediaName))) {
        const id = m.keys?.remoteId || m.id;
        await fetchUrl({ id, cancelled: () => false });
        if (!(await ipc?.exists(mediaName))) {
          showMessage(
            `Failed to download ${truncateForMessage(attr.audioUrl)}`
          );
          return;
        }
      }
      await ensureParentDir(destPath);
      await ipc?.copyFile(mediaName, destPath);
      let finalPath = destPath;
      if (convertToMp3) {
        const ext = path.extname(destPath).toLowerCase();
        if (BURRITO_AUDIO_FILE_EXTENSIONS.has(ext) && ext !== '.mp3') {
          const mp3Path = ext
            ? destPath.slice(0, -ext.length) + '.mp3'
            : `${destPath}.mp3`;
          const convResult = await ipc?.convertToMp3(destPath, mp3Path);
          if (typeof convResult === 'string') {
            showMessage(
              `Failed to convert ${truncateForMessage(contextLabel)} to mp3`
            );
            return;
          }
          await ipc?.delete(destPath);
          finalPath = mp3Path;
        }
      }
      const docid = finalPath.substring(preLen);
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
      const stat = JSON.parse(await ipc?.stat(finalPath)) as Stats;
      const size = stat?.size ?? 0;
      const outputExt = path.extname(finalPath).toLowerCase();
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(finalPath) },
        // When we transcode to MP3, the source MediaFile contentType may still be
        // e.g. `audio/ogg;codecs=opus`. Ingredient mimeType must reflect the output.
        mimeType:
          outputExt === '.mp3'
            ? 'audio/mpeg'
            : inferAudioContentType(finalPath, attr.contentType),
        size,
        scope: { [book]: scopeRef ? [scopeRef] : [] },
        properties: {
          'x-apmId': m.keys?.remoteId || m.id,
        },
      };
    };

    const processMarkdownFile = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string
    ) => {
      const attr = m.attributes;
      const finalPath = destPath.toLowerCase().endsWith('.md')
        ? destPath
        : `${stripTrailingExtension(destPath)}.md`;
      await ensureParentDir(finalPath);
      await ipc?.write(finalPath, attr.originalFile);
      const docid = finalPath.substring(preLen);
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(finalPath) },
        mimeType: attr.contentType,
        size: attr.originalFile.length,
        scope: { [book]: scopeRef ? [scopeRef] : [] },
        properties: {
          'x-apmId': m.keys?.remoteId || m.id,
        },
      };
    };

    const processInlineTextFile = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string
    ) => {
      const attr = m.attributes;
      const ct = primaryContentType(m);
      const ext = inlineTextExtension(ct);
      const base = stripTrailingExtension(destPath);
      const finalPath = `${base}${ext}`;
      await ensureParentDir(finalPath);
      await ipc?.write(finalPath, attr.originalFile);
      const docid = finalPath.substring(preLen);
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(finalPath) },
        mimeType: attr.contentType || 'text/plain',
        size: attr.originalFile.length,
        scope: { [book]: scopeRef ? [scopeRef] : [] },
        properties: {
          'x-apmId': m.keys?.remoteId || m.id,
        },
      };
    };

    const processLinkUrlFile = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string
    ) => {
      const url = m.attributes.originalFile.trim();
      const base = stripTrailingExtension(destPath);
      const finalPath = `${base}.link.txt`;
      await ensureParentDir(finalPath);
      await ipc?.write(finalPath, `${url}\n`);
      const docid = finalPath.substring(preLen);
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(finalPath) },
        mimeType: 'text/plain',
        size: url.length + 1,
        scope: { [book]: scopeRef ? [scopeRef] : [] },
        properties: {
          'x-apmId': m.keys?.remoteId || m.id,
        },
      };
    };

    const processExportableMedia = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string,
      contextLabel: string,
      buildAlignment: boolean
    ) => {
      const attr = m.attributes;
      const ct = primaryContentType(m);
      if (ct === 'text/markdown') {
        await processMarkdownFile(m, destPath, scopeRef);
        return;
      }
      if (ct.startsWith('text/')) {
        await processInlineTextFile(m, destPath, scopeRef);
        return;
      }
      if (!attr.audioUrl && looksLikeHttpUrl(attr.originalFile || '')) {
        await processLinkUrlFile(m, destPath, scopeRef);
        return;
      }
      await processMediaFile(
        m,
        destPath,
        scopeRef,
        contextLabel,
        buildAlignment
      );
    };

    let chapter = 0;
    let chapterPath = '';
    let plan: string | undefined;
    /** Avoid duplicating section-level resources into the book folder (plan-attached, passage-null loop below). */
    const mediaIdsExportedAsSectionResources = new Set<string>();

    for (const section of sections) {
      const refCount = new Map<string, number>();
      const nextRef = (lastReference: string) => {
        refCount.set(lastReference, (refCount.get(lastReference) || 0) + 1);
        return `${refCount.get(lastReference) || 0}`;
      };

      // get the passage files for the plan sorted by sequence number
      plan = related(section, 'plan') as string;
      const planMedia = mediafiles.filter((m) => plan === related(m, 'plan'));
      const passageRecs = passages
        .filter((p) => related(p, 'section') === section.id)
        .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
      const exportFolder = resolveBurritoExportFolder({
        section,
        bookPath,
        sections: sectionsAll,
        passages,
        computeSectionRef,
        computeMovementRef,
      });
      let sectionRef = exportFolder.scopeRef;
      let sectionChapter = exportFolder.chapter
        ? parseInt(exportFolder.chapter, 10)
        : 0;
      let sectionChapterPath = exportFolder.folderPath;
      await ipc?.createFolder(sectionChapterPath);
      if (exportFolder.chapter) {
        chapters.add(exportFolder.chapter);
      }
      chapter = sectionChapter;
      chapterPath = sectionChapterPath;

      if (
        passageRecs.length > 0 &&
        !isBookLevelSection(section) &&
        !exportFolder.chapter
      ) {
        const firstP = passageRecs[0];
        sectionRef = computeSectionRef(section.id);
        parseRef(firstP);
        const pt = passageTypeFromRef(firstP.attributes.reference, false);
        if (pt === PassageTypeEnum.CHAPTERNUMBER) {
          sectionChapter = chnumChapterFromRef(firstP.attributes.reference) ?? 1;
        } else {
          sectionChapter = firstP.attributes.startChapter || 1;
        }
        if (!isNaN(sectionChapter) && sectionChapter > 0) {
          sectionChapterPath = path.join(bookPath, pad3(sectionChapter));
          chapters.add(sectionChapter.toString());
          await ipc?.createFolder(sectionChapterPath);
          chapter = sectionChapter;
          chapterPath = sectionChapterPath;
        }
      }

      // when using artifactTypeFilter (e.g. Resources), include section-level resources (one copy each)
      if (artifactTypeFilter) {
        const sectionLevelSecRes = sectionResources
          .filter(
            (sr) =>
              related(sr, 'section') === section.id && !related(sr, 'passage')
          )
          .sort(
            (a, b) =>
              (a.attributes.sequenceNum ?? 0) - (b.attributes.sequenceNum ?? 0)
          );
        const exportedSectionMediaIds = new Set<string>();
        let sectionRefCount: string | null = null;
        for (const sr of sectionLevelSecRes) {
          const m = planMedia.find((x) => x.id === related(sr, 'mediafile'));
          if (!m || !makeArtifactFilter()(m)) continue;
          if (exportedSectionMediaIds.has(m.id)) continue;
          exportedSectionMediaIds.add(m.id);
          mediaIdsExportedAsSectionResources.add(m.id);
          if (sectionRefCount === null) {
            sectionRefCount = nextRef(sectionRef);
          }
          const seq = sr.attributes.sequenceNum ?? 0;
          const attr = m.attributes;
          const destName = `${bibleId}-${book}-section-${cleanFileName(sectionRef) + `${nType}${sectionRefCount}`}r${seq}v${attr.versionNumber}.${getMediaExt(m)}`;
          const destPath = path.join(sectionChapterPath, destName);
          await processExportableMedia(
            m,
            destPath,
            sectionRef,
            'section resource',
            false
          );
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
        if (!startChapter && chapter === 0 && !isBookLevelSection(section)) {
          startChapter = 1;
        }
        if (passageType === PassageTypeEnum.CHAPTERNUMBER) {
          startChapter = chnumChapterFromRef(p.attributes.reference) ?? 1;
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
          await processExportableMedia(
            m,
            destPath,
            lastReference,
            contextLabel,
            true
          );
        }
      }
    }
    // filters by plan set in the section records
    const planMedia = mediafiles
      .filter(
        (m) => related(m, 'plan') === plan && related(m, 'passage') === null
      )
      .filter(makeArtifactFilter());
    for (const m of planMedia) {
      if (mediaIdsExportedAsSectionResources.has(m.id)) continue;
      const stem = getBurritoMediaExportStem(m);
      const destName = `${bibleId}-${book}-${stem}.${getMediaExt(m)}`;
      const destPath = path.join(bookPath, destName);
      await processExportableMedia(m, destPath, '', '', false);
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
