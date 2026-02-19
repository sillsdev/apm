import path from 'path-browserify';
import {
  Burrito,
  BurritoIngredients,
  BurritoScopes,
} from './data/burritoBuilder';
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
} from '../components/GraphicUploader';
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
  projDefSectionMap,
  useProjectDefaults,
} from '../crud/useProjectDefaults';
import { useRef } from 'react';
import cleanFileName from '../utils/cleanFileName';

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
}

export const useBurritoNavigation = (teamId: string) => {
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const passages = useOrbitData<PassageD[]>('passage');
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
        resNum = `-${getSectionNum(section)}`;
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

  return async ({
    metadata,
    bible,
    book,
    bookPath,
    preLen,
    sections,
  }: Props) => {
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.name = 'x-nav';
    }
    const bibleId = bible?.attributes?.bibleId || teamId || '';
    const scopes: Map<string, string[]> = new Map();
    const ingredients: BurritoIngredients = {};
    const chapters = new Set<string>();
    const titleMediaManifest: NavigationTitleMedia[] = [];
    const graphicsManifest: NavigationGraphic[] = [];

    const sectionIds = new Set(sections.map((s) => s.id));
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
    ): Promise<boolean> => {
      const attr = m.attributes;
      let mediaPath = attr.audioUrl;
      if (!mediaPath) {
        const id = m.keys?.remoteId || m.id;
        mediaPath = await fetchUrl({ id, cancelled: () => false });
      }
      if (!mediaPath) {
        showMessage(`No media URL for navigation (${attr.originalFile})`);
        return false;
      }
      const local = { localname: '' };
      await dataPath(mediaPath, PathType.MEDIA, local);
      const mediaName = local.localname;
      if (!(await ipc?.exists(mediaName))) {
        const id = m.keys?.remoteId || m.id;
        await fetchUrl({ id, cancelled: () => false });
        if (!(await ipc?.exists(mediaName))) {
          showMessage(`Failed to download ${mediaPath}`);
          return false;
        }
      }
      await ipc?.copyFile(mediaName, destPath);
      const docid = destPath.substring(preLen);
      const statStr = await ipc?.stat(destPath);
      const stat = statStr ? JSON.parse(statStr as string) : null;
      const size = stat?.size ?? 0;
      ingredients[docid] = {
        checksum: { md5: await ipc?.md5File(destPath) },
        mimeType: attr.contentType || 'image/png',
        size,
        scope: { [book]: [scopeRef] },
        properties: {
          apmId: m.keys?.remoteId || m.id,
        },
      };
      return true;
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
          await ipc?.downloadFile(content, mediaName);
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
          const destName = `${bibleId}-${book}-${resourceType}${resNum}${ref}-nav-${remoteIdVal}-${g.keys?.remoteId || g.id}.${ext}`;
          const destPath = path.join(navChapterPath, destName);
          const ok = await processMediaFile(m, destPath, scopeRef);
          if (ok) {
            graphicsManifest.push({
              resourceType,
              remoteId: remoteIdVal,
              path: destPath.substring(preLen),
            });
          }
          return ok;
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
        const destName = `${bibleId}-${book}-${rType}${resNum}${ref}-nav-${remoteIdVal}-${g.keys?.remoteId || g.id}.${ext}`;
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
            scope: { [book]: [scopeRef] },
            properties: {
              apmId: g.keys?.remoteId || g.id,
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

    for (const section of sections) {
      loadSegionArr(section);
      const sectionRef = computeSectionRef(section.id);
      const sectionChapter = sectionRef.split(':')[0] || '1';
      navChapterPath = path.join(bookPath, pad3(parseInt(sectionChapter, 10)));
      await ipc?.createFolder(navChapterPath);
      chapters.add(sectionChapter);
      const sectionRemId = remoteId('section', section.id, keyMap);

      const titleMediaId = related(section, 'titleMediafile');
      if (titleMediaId && sectionRemId) {
        const m = mediafiles.find((mf) => mf.id === titleMediaId);
        if (m) {
          const ext = getMediaExt(m);
          const num = getSectionNum(section);
          const ref = getRef(num, section.id);
          const destName = `${bibleId}-${book}-section-${num}${ref}-title-${sectionRemId}.${ext}`;
          const destPath = path.join(navChapterPath, destName);
          const ok = await processMediaFile(m, destPath, sectionRef);
          if (ok) {
            titleMediaManifest.push({
              resourceType: 'section',
              remoteId: sectionRemId,
              path: destPath.substring(preLen),
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

      const titleMediaId = related(sr, 'titleMediafile');
      if (titleMediaId) {
        const m = mediafiles.find((mf) => mf.id === titleMediaId);
        if (m) {
          const ext = getMediaExt(m);
          const ref = passage ? getNoteRef(passage) : '';
          const destName = `${bibleId}-${book}-note${ref}-title-${cleanFileName(sr.attributes.title)}-${srRemId}.${ext}`;
          const destPath = path.join(navChapterPath, destName);
          const ok = await processMediaFile(m, destPath, sectionRef);
          if (ok) {
            titleMediaManifest.push({
              resourceType: 'sharedresource',
              remoteId: srRemId,
              path: destPath.substring(preLen),
            });
          }
        }
      }
    }

    for (const cat of artifactCategories.filter((c) => categoryIds.has(c.id))) {
      const catRemId = remoteId('artifactcategory', cat.id, keyMap);
      if (!catRemId) continue;

      const titleMediaId = related(cat, 'titleMediafile');
      if (titleMediaId) {
        const m = mediafiles.find((mf) => mf.id === titleMediaId);
        if (m) {
          const ext = getMediaExt(m);
          const destName = `${bibleId}-${book}-category-title-${cleanFileName(cat.attributes.categoryname)}-${catRemId}.${ext}`;
          const destPath = path.join(navChapterPath, destName);
          const ok = await processMediaFile(m, destPath, '');
          if (ok) {
            titleMediaManifest.push({
              resourceType: 'category',
              remoteId: catRemId,
              path: destPath.substring(preLen),
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
          'graphics',
          '',
          'category',
          catRemId
        );
      }
    }

    for (const p of passages.filter((p) =>
      sectionIds.has(related(p, 'section') as string)
    )) {
      const passRemId = remoteId('passage', p.id, keyMap);
      if (!passRemId) continue;
      const sectionId = related(p, 'section') as string;
      const sectionRef = computeSectionRef(sectionId);

      const passageGraphic = graphics.find(
        (g) =>
          g.attributes.resourceType === 'passage' &&
          g.attributes.resourceId === remoteIdNum('passage', p.id, keyMap)
      );
      if (passageGraphic) {
        await processGraphic(
          passageGraphic,
          navChapterPath,
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
