import path from 'path-browserify';
import { Burrito, BurritoIngredients } from './data/burritoBuilder';
import { ProjectD } from '../model';
import { MainAPI } from '@model/main-api';
import { getProjectDataFiles } from '../store/importexport/projectDataExport';
import Memory from '@orbit/memory';

const ipc = window?.api as MainAPI;

interface Props {
  metadata: Burrito;
  project: ProjectD;
  projectPath: string;
  preLen: number;
}

/**
 * Creates an ApmData burrito for a project containing the PTF-style data folder
 * (data/*.json files matching the structure used in PTF export).
 */
export const useBurritoApmData = (memory: Memory) => {
  return async ({
    metadata,
    project,
    projectPath,
    preLen,
  }: Props): Promise<Burrito> => {
    const dataFiles = await getProjectDataFiles(memory, project);
    const ingredients: BurritoIngredients = {};

    const dataDir = path.join(projectPath, 'data');
    await ipc?.createFolder(dataDir);

    for (const [filename, content] of Object.entries(dataFiles)) {
      const filePath = path.join(projectPath, filename);
      await ipc?.write(filePath, content);

      const relPath = filePath.substring(preLen);
      const md5 = await ipc?.md5File(filePath);
      ingredients[relPath] = {
        checksum: { md5 },
        mimeType: 'application/json',
        size: content.length,
      };
    }

    metadata.ingredients = { ...metadata.ingredients, ...ingredients };
    if (metadata.type?.flavorType?.flavor) {
      metadata.type.flavorType.flavor.name = 'x-apmdata';
    }
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.name = 'x-apmdata';
    }
    return metadata;
  };
};
