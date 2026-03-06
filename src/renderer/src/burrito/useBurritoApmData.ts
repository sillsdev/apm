import path from 'path-browserify';
import { Burrito, BurritoIngredients } from './data/burritoBuilder';
import { ProjectD } from '../model';
import { MainAPI } from '@model/main-api';
import { getProjectDataFiles } from '../store/importexport/projectDataExport';
import Memory from '@orbit/memory';
import { projDefBook, useProjectDefaults } from '../crud/useProjectDefaults';
import { useNum2BookCode } from '../utils';

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
  const { getProjectDefault } = useProjectDefaults();
  const num2BookCode = useNum2BookCode();

  const getBookCode = (project: ProjectD) => {
    const akuoBook =
      (getProjectDefault(projDefBook, project) as string) ?? 'B01';
    const bookParse = /^([AB])(\d\d)$/.exec(akuoBook);
    let bookCode: string | undefined;
    if (bookParse) {
      const bookNum =
        bookParse[1] === 'A'
          ? parseInt(bookParse[2], 10)
          : bookParse[1] === 'B'
            ? parseInt(bookParse[2], 10) + 39
            : 999;
      bookCode = num2BookCode(bookNum);
    }
    return bookCode;
  };

  return async ({
    metadata,
    project,
    projectPath,
    preLen,
  }: Props): Promise<Burrito> => {
    const dataFiles = await getProjectDataFiles(memory, project);
    const ingredients: BurritoIngredients = {};
    const bookCode = getBookCode(project);
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
        ...(bookCode ? { scope: { [bookCode]: [] } } : {}),
      };



    }

    metadata.ingredients = { ...metadata.ingredients, ...ingredients };
    if (bookCode && metadata.type?.flavorType) {
      const currentScope = metadata.type.flavorType.currentScope ?? {};
      metadata.type.flavorType.currentScope = {
        ...currentScope,
        [bookCode]: [],
      };
    }
    if (metadata.type?.flavorType?.flavor) {
      metadata.type.flavorType.flavor.name = 'x-apmdata';
    }
    if (metadata.type?.flavorType) {
      metadata.type.flavorType.name = 'x-apmdata';
    }
    return metadata;
  };
};
