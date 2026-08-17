import path from 'path-browserify';
import { Burrito, BurritoIngredients, BurritoScopes } from './data/types';
import related from '../crud/related';
import { useFetchUrlNow } from '../crud/useFetchUrlNow';
import { useSnackBar } from '../hoc/SnackBar';
import { useOrbitData } from '../hoc/useOrbitData';
import {
  ArtifactCategoryD,
  BibleD,
  GraphicD,
  MediaFileD,
  PassageD,
  PlanD,
  ProjectD,
  SectionArray,
  SectionD,
  SharedResourceD,
} from '../model';
import dataPath, { PathType } from '../utils/dataPath';
import { sortChapters } from '../utils/sort';
import { pad3 } from '../utils/pad3';
import { useComputeRef } from '../components/PassageDetail/Internalization/useComputeRef';
import {
  ApmDim,
  CompressedImages,
  IGraphicInfo,
} from '../utils/useCompression';
import { MainAPI } from '@model/main-api';
import { RecordKeyMap } from '@orbit/records';
import {
  findRecord,
  remoteId,
  remoteIdGuid,
  remoteIdNum,
  useNotes,
} from '../crud';
import { useGlobal } from '../context/useGlobal';
import getMediaExt from '../utils/getMediaExt';
import {
  BURRITO_AUDIO_FILE_EXTENSIONS,
  inferAudioContentType,
} from '../utils/mimeTypes';
import {
  projDefSectionMap,
  useProjectDefaults,
} from '../crud/useProjectDefaults';
import { useRef } from 'react';
import cleanFileName from '../utils/cleanFileName';
import { AltBkSeq, BookSeq } from '../model/section';
import {
  resolveBurritoExportFolder,
  resolveChnumExportFolder,
} from './resolveBurritoExportFolder';
import {
  isPublishingTitle,
  passageTypeFromRef,
} from '../control/passageTypeFromRef';
import { PassageTypeEnum } from '../model/passageTypeEnum';

const ipc = window?.api as MainAPI;
const FullSize = 1024;

export interface NavigationGraphic {
  resourceType: string;
  remoteId: string;
  path: string;
}

export interface NavigationTitleMedia {
  resourceType: string;
  remoteId: string;
  path: string;
}

export interface NavigationManifest {
  titleMedia: NavigationTitleMedia[];
  graphics: NavigationGraphic[];
}

interface Props {
  metadata: Burrito;
  bible: BibleD;
  book: string;
  bookPath: string;
  preLen: number;
  sections: SectionD[];
  /** When true, transcode non-MP3 audio in the navigation tree to MP3. */
  convertToMp3?: boolean;
}

export const useBurritoNavigation = (teamId: string) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<PassageD[]>('passage');
  const sectionsAll = useOrbitData<SectionD[]>('section');
  const sharedResources = useOrbitData<SharedResourceD[]>('sharedresource');
  const graphics = useOrbitData<GraphicD[]>('graphic');
  const artifactCategories =
    useOrbitData<ArtifactCategoryD[]>('artifactcategory');
  const [memory] = useGlobal('memory');
  const keyMap = memory?.keyMap as RecordKeyMap;
  const fetchUrl = useFetchUrlNow();
  const { showMessage } = useSnackBar();
  const { computeSectionRef, computeMovementRef } = useComputeRef();
  const { curNoteRef } = useNotes();
  const { getProjectDefault } = useProjectDefaults();
  const sectionMap = useRef<Map<number, string>>(new Map());

  const loadSegionArr = (section: SectionD) => {
    const planRec = findRecord(
      memory,
      'plan',
      related(section, 'plan')
    ) as PlanD;
    const projRec = findRecord(
      memory,
      'project',
      related(planRec, 'project')
    ) as ProjectD;
    if (projRec) {
      const sectionArr = getProjectDefault(projDefSectionMap, projRec) as
        | SectionArray
        | undefined;
      if (sectionArr) {
        sectionMap.current = new Map(sectionArr);
      }
    }
  };

  const getSectionNum = (section: SectionD) => {
    return (
      sectionMap.current.get(section.attributes.sequencenum) ??
      section.attributes.sequencenum.toString()
    );
  };

  const getResourceNum = (g: GraphicD) => {
    let resNum = '';
    if (g.attributes.resourceType === 'section') {
      const resLocalId = remoteIdGuid(
        'section',
        g.attributes.resourceId.toString(),
        memory?.keyMap as RecordKeyMap
      );
      if (resLocalId) {
        const section = findRecord(memory, 'section', resLocalId) as SectionD;
        resNum = getSectionNum(section);
      }
    }
    return resNum;
  };

  const getRef = (numSt: string, id: string) => {
    if (numSt.indexOf('.') > 0) {
      return `-${cleanFileName(computeMovementRef(id))}`;
    }
    const sectionRef = computeSectionRef(id);
    if (sectionRef) {
      return `-${cleanFileName(computeSectionRef(id))}`;
    }
    return '';
  };

  const getNoteRef = (passage: PassageD) => {
    let ref = cleanFileName(curNoteRef(passage));
    const lastSpace = ref.lastIndexOf(' ');
    if (lastSpace > 0) {
      ref = ref.substring(lastSpace + 1);
    }
    return ref ? `-${ref}` : '';
  };

  const getGraphicRef = (g: GraphicD, numSt: string) => {
    const resourceType = g.attributes.resourceType;
    const resourceId =
      remoteIdGuid(
        resourceType,
        g.attributes.resourceId.toString(),
        memory?.keyMap as RecordKeyMap
      ) ?? '';
    if (resourceType === 'section') {
      return getRef(numSt, resourceId);
    }
    const passage = passages.find((p) => p.id === resourceId);
    if (passage) {
      return getNoteRef(passage);
    }
    return '';
  };

  const getBookType = (rType: string, resNum: string) => {
    return resNum === BookSeq.toString()
      ? 'book'
      : resNum === AltBkSeq.toString()
        ? 'altbook'
        : rType + '-' + resNum;
  };

  const chapterPathForSectionRef = async (
    bookPath: string,
    sectionRef: string
  ) => {
    const chapter = sectionRef.split(':')[0] || '1';
    const chapterPath = path.join(bookPath, pad3(parseInt(chapter, 10)));
    await ipc?.createFolder(chapterPath);
    return { chapter, chapterPath };
  };

  return async ({
    metadata,
    bible,
    book,
    bookPath,
    preLen,
    sections,
    convertToMp3 = false,
  }: Props) => {
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.name = 'scripture';
      if (metadata.type.flavorType.flavor) {
        metadata.type.flavorType.flavor.name = 'x-nav';
      }
    }
    const bibleId = bible?.attributes?.bibleId || teamId || '';
    const scopes: Map<string, string[]> = new Map();
    const ingredients: BurritoIngredients = {};
    const chapters = new Set<string>();
    const titleMediaManifest: NavigationTitleMedia[] = [];
    const graphicsManifest: NavigationGraphic[] = [];

    // Navigation-level assets (like the book graphic / title) are stored as
    // special sections with negative sequence numbers. They are typically not
    // part of the normal section list collected for a book, so include them
    // here if they belong to this book.
    const planIdsForBook = new Set(
      sections.map((s) => related(s, 'plan') as string)
    );
    const specialBookSections = sectionsAll.filter((s) => {
      const seq = s.attributes?.sequencenum ?? 0;
      if (seq !== BookSeq && seq !== AltBkSeq) return false;
      const planId = related(s, 'plan') as string;
      if (!planId || !planIdsForBook.has(planId)) return false;
      return true;
    });
    const sectionsForNav = [
      ...sections,
      ...specialBookSections.filter(
        (s) => !sections.some((x) => x.id === s.id)
      ),
    ];

    const sectionIds = new Set(sectionsForNav.map((s) => s.id));
    const passageIds = new Set(
      passages
        .filter((p) => sectionIds.has(related(p, 'section') as string))
        .map((p) => p.id)
    );
    const categoryIds = new Set(
      sharedResources
        .filter((sr) => passageIds.has(related(sr, 'passage') as string))
        .map((sr) => related(sr, 'artifactCategory'))
        .filter((id): id is string => id != null)
    );

    const processMediaFile = async (
      m: MediaFileD,
      destPath: string,
      scopeRef: string
    ): Promise<string | null> => {
      const attr = m.attributes;
      let mediaPath = attr.audioUrl;
      if (!mediaPath) {
        const id = m.keys?.remoteId || m.id;
        mediaPath = await fetchUrl({ id, cancelled: () => false });
      }
      if (!mediaPath) {
        showMessage(`No media URL for navigation (${attr.originalFile})`);
        return null;
      }
      const local = { localname: '' };
      await dataPath(mediaPath, PathType.MEDIA, local);
      const mediaName = local.localname;
      if (!(await ipc?.exists(mediaName))) {
        const id = m.keys?.remoteId || m.id;
        await fetchUrl({ id, cancelled: () => false });
        if (!(await ipc?.exists(mediaName))) {
          showMessage(`Failed to download ${mediaPath}`);
          return null;
        }
      }
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
              `Failed to convert navigation audio (${attr.originalFile}) to mp3`
            );
            return null;
          }
          await ipc?.delete(destPath);
          finalPath = mp3Path;
        }
      }
      const docid = finalPath.substring(preLen);
      const statStr = await ipc?.stat(finalPath);
      const stat = statStr ? JSON.parse(statStr as string) : null;
      const size = stat?.size ?? 0;
      const outputExt = path.extname(finalPath).toLowerCase();
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(finalPath) },
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
      return finalPath;
    };

    const writeGraphicContent = async (
      content: string,
      destPath: string
    ): Promise<boolean> => {
      if (!content) return false;
      if (/^https?:\/\//.test(content)) {
        const local = { localname: '' };
        await dataPath(content, PathType.MEDIA, local);
        const mediaName = local.localname;
        if (!(await ipc?.exists(mediaName))) {
          const err = await ipc?.downloadFile(content, mediaName);
          if (err || !(await ipc?.exists(mediaName))) return false;
        }
        await ipc?.copyFile(mediaName, destPath);
        return true;
      }
      if (!content.startsWith('data:')) return false;
      const base64Data = content.split(',')[1];
      if (!base64Data) return false;
      try {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        await ipc?.writeBuffer(destPath, bytes);
        return true;
      } catch {
        return false;
      }
    };

    const processGraphic = async (
      g: GraphicD,
      navChapterPath: string,
      scopeRef: string,
      resourceType: string,
      remoteIdVal: string
    ): Promise<boolean> => {
      const mediafileId = related(g, 'mediafile');
      if (mediafileId) {
        const m = mediafiles.find((mf) => mf.id === mediafileId);
        if (m) {
          const ext = getMediaExt(m);
          const resNum = getResourceNum(g);
          const ref = getGraphicRef(g, resNum);
          const typeNum = getBookType(resourceType, resNum);
          const destName = `${bibleId}-${book}-${typeNum}${ref}-nav-${remoteIdVal}-${g.keys?.remoteId || g.id}.${ext}`;
          const destPath = path.join(navChapterPath, destName);
          const finalPath = await processMediaFile(m, destPath, scopeRef);
          if (finalPath) {
            graphicsManifest.push({
              resourceType,
              remoteId: remoteIdVal,
              path: finalPath.substring(preLen),
            });
          }
          return Boolean(finalPath);
        }
      }
      const infoStr = g.attributes?.info;
      if (!infoStr) return false;
      try {
        const info: IGraphicInfo = JSON.parse(infoStr);
        const fullSizeStr = `${FullSize}`;
        const apmDimStr = `${ApmDim}`;
        const imgInfo = (info[fullSizeStr] || info[apmDimStr]) as
          | CompressedImages
          | undefined;
        if (!imgInfo?.content) return false;
        const ext = imgInfo.type?.split('/')[1] || 'png';
        const resNum = getResourceNum(g);
        const ref = getGraphicRef(g, resNum);
        const rType = resourceType === 'passage' ? 'note' : resourceType;
        const typeNum = getBookType(rType, resNum);
        const destName = `${bibleId}-${book}-${typeNum}${ref}-nav-${remoteIdVal}-${g.keys?.remoteId || g.id}.${ext}`;
        const destPath = path.join(navChapterPath, destName);
        const ok = await writeGraphicContent(imgInfo.content, destPath);
        if (ok) {
          const docid = destPath.substring(preLen);
          const statStr = await ipc?.stat(destPath);
          const stat = statStr ? JSON.parse(statStr as string) : null;
          ingredients[docid] = {
            checksum: { md5: await ipc?.md5File(destPath) },
            mimeType: imgInfo.type || 'image/png',
            size: stat?.size ?? 0,
            scope: { [book]: scopeRef ? [scopeRef] : [] },
            properties: {
              'x-apmId': g.keys?.remoteId || g.id,
            },
          };
          graphicsManifest.push({
            resourceType,
            remoteId: remoteIdVal,
            path: docid,
          });
        }
        return ok;
      } catch {
        return false;
      }
    };

    let navChapterPath = '';

    for (const section of sectionsForNav) {
      loadSegionArr(section);
      const exportFolder = resolveBurritoExportFolder({
        section,
        bookPath,
        sections: sectionsAll,
        passages,
        computeSectionRef,
        computeMovementRef,
      });
      navChapterPath = exportFolder.folderPath;
      await ipc?.createFolder(navChapterPath);
      if (exportFolder.chapter) {
        chapters.add(exportFolder.chapter);
      }
      const sectionRef = exportFolder.scopeRef;
      const sectionRemId = remoteId('section', section.id, keyMap);

      const titleMediaId = related(section, 'titleMediafile');
      if (titleMediaId && sectionRemId) {
        const m = mediafiles.find((mf) => mf.id === titleMediaId);
        if (m) {
          const ext = getMediaExt(m);
          const num = getSectionNum(section);
          const ref = getRef(num, section.id);
          const typeNum = getBookType('section', num);
          const destName = `${bibleId}-${book}-${typeNum}${ref}-title-${sectionRemId}.${ext}`;
          const destPath = path.join(navChapterPath, destName);
          const finalPath = await processMediaFile(m, destPath, sectionRef);
          if (finalPath) {
            titleMediaManifest.push({
              resourceType: 'section',
              remoteId: sectionRemId,
              path: finalPath.substring(preLen),
            });
          }
        }
      }

      const sectionGraphic = graphics.find(
        (g) =>
          g.attributes.resourceType === 'section' &&
          g.attributes.resourceId === remoteIdNum('section', section.id, keyMap)
      );
      if (sectionGraphic && sectionRemId) {
        await processGraphic(
          sectionGraphic,
          navChapterPath,
          sectionRef,
          'section',
          sectionRemId
        );
      }
    }

    for (const sr of sharedResources.filter((sr) =>
      passageIds.has(related(sr, 'passage') as string)
    )) {
      const srRemId = remoteId('sharedresource', sr.id, keyMap);
      if (!srRemId) continue;
      const passage = passages.find((p) => p.id === related(sr, 'passage'));
      const sectionRef = passage
        ? computeSectionRef(related(passage, 'section') as string)
        : '';
      const { chapter, chapterPath } = sectionRef
        ? await chapterPathForSectionRef(bookPath, sectionRef)
        : { chapter: '1', chapterPath: path.join(bookPath, pad3(1)) };
      await ipc?.createFolder(chapterPath);
      chapters.add(chapter);

      const titleMediaId = related(sr, 'titleMediafile');
      if (titleMediaId) {
        const m = mediafiles.find((mf) => mf.id === titleMediaId);
        if (m) {
          const ext = getMediaExt(m);
          const ref = passage ? getNoteRef(passage) : '';
          const destName = `${bibleId}-${book}-note${ref}-title-${cleanFileName(sr.attributes.title)}-${srRemId}.${ext}`;
          const destPath = path.join(chapterPath, destName);
          const finalPath = await processMediaFile(m, destPath, sectionRef);
          if (finalPath) {
            titleMediaManifest.push({
              resourceType: 'sharedresource',
              remoteId: srRemId,
              path: finalPath.substring(preLen),
            });
          }
        }
      }
    }

    const categoryGraphicsPath = path.join(bookPath, 'graphics');
    const categoriesForExport = artifactCategories.filter((c) =>
      categoryIds.has(c.id)
    );
    const hasCategoryAssets = categoriesForExport.some((cat) => {
      if (related(cat, 'titleMediafile')) return true;
      return graphics.some(
        (g) =>
          g.attributes.resourceType === 'category' &&
          g.attributes.resourceId ===
            remoteIdNum('artifactcategory', cat.id, keyMap)
      );
    });

    if (hasCategoryAssets) {
      await ipc?.createFolder(categoryGraphicsPath);

      for (const cat of categoriesForExport) {
        const catRemId = remoteId('artifactcategory', cat.id, keyMap);
        if (!catRemId) continue;

        const titleMediaId = related(cat, 'titleMediafile');
        if (titleMediaId) {
          const m = mediafiles.find((mf) => mf.id === titleMediaId);
          if (m) {
            const ext = getMediaExt(m);
            const destName = `${bibleId}-${book}-category-title-${cleanFileName(cat.attributes.categoryname)}-${catRemId}.${ext}`;
            const destPath = path.join(categoryGraphicsPath, destName);
            const finalPath = await processMediaFile(m, destPath, '');
            if (finalPath) {
              titleMediaManifest.push({
                resourceType: 'category',
                remoteId: catRemId,
                path: finalPath.substring(preLen),
              });
            }
          }
        }

        const categoryGraphic = graphics.find(
          (g) =>
            g.attributes.resourceType === 'category' &&
            g.attributes.resourceId ===
              remoteIdNum('artifactcategory', cat.id, keyMap)
        );
        if (categoryGraphic) {
          await processGraphic(
            categoryGraphic,
            categoryGraphicsPath,
            '',
            'category',
            catRemId
          );
        }
      }
    }

    const latestPassageTitleMedia = (passageId: string) =>
      mediafiles
        .filter(
          (mf) =>
            related(mf, 'passage') === passageId && !related(mf, 'artifactType')
        )
        .sort(
          (a, b) => b.attributes.versionNumber - a.attributes.versionNumber
        )[0];

    for (const p of passages.filter((p) =>
      sectionIds.has(related(p, 'section') as string)
    )) {
      const passRemId = remoteId('passage', p.id, keyMap);
      if (!passRemId) continue;
      const sectionId = related(p, 'section') as string;
      const section = sectionsAll.find((s) => s.id === sectionId);
      const passageType = passageTypeFromRef(p.attributes.reference, false);
      const exportFolder =
        passageType === PassageTypeEnum.CHAPTERNUMBER
          ? resolveChnumExportFolder(p, bookPath)
          : section
            ? resolveBurritoExportFolder({
                section,
                bookPath,
                sections: sectionsAll,
                passages,
                computeSectionRef,
                computeMovementRef,
              })
            : {
                folderPath: path.join(bookPath, pad3(1)),
                chapter: '1',
                scopeRef: computeSectionRef(sectionId),
              };
      const chapterPath = exportFolder.folderPath;
      const sectionRef = exportFolder.scopeRef;
      await ipc?.createFolder(chapterPath);
      if (exportFolder.chapter) {
        chapters.add(exportFolder.chapter);
      }

      if (isPublishingTitle(p.attributes.reference, false)) {
        const m = latestPassageTitleMedia(p.id);
        if (m) {
          const ext = getMediaExt(m);
          const chSuffix =
            passageType === PassageTypeEnum.CHAPTERNUMBER
              ? (exportFolder.chapter ?? '1')
              : cleanFileName(sectionRef);
          const destName = `${bibleId}-${book}-chapter-${chSuffix}-title-${passRemId}.${ext}`;
          const destPath = path.join(chapterPath, destName);
          const finalPath = await processMediaFile(m, destPath, sectionRef);
          if (finalPath) {
            titleMediaManifest.push({
              resourceType: 'passage',
              remoteId: passRemId,
              path: finalPath.substring(preLen),
            });
          }
        }
      }

      const passageGraphic = graphics.find(
        (g) =>
          g.attributes.resourceType === 'passage' &&
          g.attributes.resourceId === remoteIdNum('passage', p.id, keyMap)
      );
      if (passageGraphic) {
        await processGraphic(
          passageGraphic,
          chapterPath,
          sectionRef,
          'passage',
          passRemId
        );
      }
    }

    const navManifest: NavigationManifest = {
      titleMedia: titleMediaManifest,
      graphics: graphicsManifest,
    };
    const navManifestPath = path.join(bookPath, 'navigation.json');
    await ipc?.write(navManifestPath, JSON.stringify(navManifest, null, 2));
    const navDocid = navManifestPath.substring(preLen);
    ingredients[navDocid] = {
      checksum: { md5: await ipc?.md5File(navManifestPath) },
      mimeType: 'application/json',
      size: JSON.stringify(navManifest).length,
      scope: { [book]: sortChapters(chapters) },
    };

    scopes.set(book, [...(scopes.get(book) || []), ...sortChapters(chapters)]);
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
    return metadata;
  };
};
