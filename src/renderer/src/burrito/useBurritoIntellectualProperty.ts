import path from 'path-browserify';
import { Burrito, BurritoIngredients } from './data/types';
import { MainAPI } from '@model/main-api';
import { getOrganizationIntellectualPropertyFiles } from '../store/importexport/projectDataExport';
import Memory from '@orbit/memory';
import { MediaFileD, ProjectD } from '../model';
import dataPath, { PathType } from '../utils/dataPath';
import getMediaExt from '../utils/getMediaExt';
import getBurritoMediaExportStem from '../utils/burritoMediaFileStem';
import cleanFileName from '../utils/cleanFileName';
import { inferAudioContentType } from '../utils/mimeTypes';
import { Stats } from 'fs';
import { useProjectDefaults } from '../crud/useProjectDefaults';
import { useNum2BookCode } from '../utils/useNum2BookCode';
import { burritoCurrentScopeForProjects } from './akuoBookToUsfm';

const ipc = window?.api as MainAPI;

interface Props {
  metadata: Burrito;
  partPath: string;
  preLen: number;
  /** Selected burrito projects; scope matches the ApmData burrito `currentScope`. */
  apmDataProjects: ProjectD[];
}

const stemForMedia = (
  m: MediaFileD,
  usedStems: Map<string, number>
): string => {
  let stem = getBurritoMediaExportStem(m);
  const count = usedStems.get(stem) ?? 0;
  usedStems.set(stem, count + 1);
  if (count > 0) stem = `${stem}-${count}`;
  return cleanFileName(stem);
};

/**
 * Exports team-level speaker intellectual property: PTF-style data JSON plus
 * release media files at the burrito intellectualproperty part root.
 */
export const useBurritoIntellectualProperty = (
  memory: Memory,
  organizationId: string
) => {
  const { getProjectDefault } = useProjectDefaults();
  const num2BookCode = useNum2BookCode();

  return async ({
    metadata,
    partPath,
    preLen,
    apmDataProjects,
  }: Props): Promise<Burrito> => {
    const { dataFiles, releaseMediafiles } =
      getOrganizationIntellectualPropertyFiles(memory, organizationId);
    const ingredients: BurritoIngredients = {};
    const dataDir = path.join(partPath, 'data');
    await ipc?.createFolder(dataDir);

    for (const [filename, content] of Object.entries(dataFiles)) {
      const filePath = path.join(partPath, filename);
      await ipc?.write(filePath, content);
      const relPath = filePath.substring(preLen);
      const md5 = await ipc?.md5File(filePath);
      ingredients[relPath] = {
        checksum: { md5 },
        mimeType: 'application/json',
        size: content.length,
      };
    }

    const usedStems = new Map<string, number>();
    for (const m of releaseMediafiles) {
      const attr = m.attributes;
      if (!attr.audioUrl) continue;
      const local = { localname: '' };
      await dataPath(attr.audioUrl, PathType.MEDIA, local);
      const mediaName = local.localname;
      if (!(await ipc?.exists(mediaName))) continue;

      const ext = getMediaExt(m);
      const stem = stemForMedia(m, usedStems);
      const destPath = path.join(partPath, `${stem}.${ext}`);
      await ipc?.createFolder(path.dirname(destPath));
      await ipc?.copyFile(mediaName, destPath);

      const relPath = destPath.substring(preLen);
      const stat = JSON.parse(await ipc?.stat(destPath)) as Stats;
      const size = stat?.size ?? 0;
      const outputExt = path.extname(destPath).toLowerCase();
      const declaredMime = (attr.contentType ?? '').trim();
      const mimeType =
        outputExt === '.mp3'
          ? 'audio/mpeg'
          : declaredMime && !declaredMime.toLowerCase().startsWith('audio/')
            ? declaredMime
            : inferAudioContentType(destPath, attr.contentType);
      ingredients[relPath] = {
        checksum: { md5: await ipc?.md5File(destPath) },
        mimeType,
        size,
        properties: {
          'x-apmId': m.keys?.remoteId || m.id,
        },
      };
    }

    metadata.ingredients = { ...metadata.ingredients, ...ingredients };
    const currentScope = burritoCurrentScopeForProjects(
      apmDataProjects,
      getProjectDefault,
      num2BookCode
    );
    if (Object.keys(currentScope).length && metadata.type?.flavorType) {
      metadata.type.flavorType.currentScope = {
        ...metadata.type.flavorType.currentScope,
        ...currentScope,
      };
    }
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.name = 'scripture';
      if (metadata.type.flavorType.flavor) {
        metadata.type.flavorType.flavor.name = 'x-intellectualproperty';
      }
    }
    return metadata;
  };
};
