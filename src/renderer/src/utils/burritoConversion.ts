import { MainAPI } from '@model/main-api';
import { FilterData } from '../components/FilterContent';
import { Burrito, BurritoWrapper } from 'burrito/data/types';
import { readJson } from './parseBurritoMetadata';
import path, { PathObject } from 'path-browserify';
import { getBookCode } from './useBookN';
import { pad2 } from './pad2';

const ipc = window?.api as MainAPI;

/**
 * Reads a burrito metadata file and enumerates all ingredients,
 * grouping them by book ID.
 * @param burritoDirPath - Path to the burrito metadata directory
 * @returns Record mapping book IDs to arrays of ingredient file paths
 */
async function enumerateIngredients(
  burritoDirPath: string
): Promise<Record<string, PathObject[]>> {
  const result: Record<string, PathObject[]> = {};

  const burrito = await readJson<Burrito>(
    path.join(burritoDirPath, 'metadata.json')
  );

  for (const [ingredientId, ingredient] of Object.entries(
    burrito.ingredients ?? {}
  )) {
    if (!ingredient.scope) continue;

    for (const bookId of Object.keys(ingredient.scope)) {
      if (!result[bookId]) {
        result[bookId] = [];
      }

      if (path.basename(ingredientId).toLowerCase() !== 'alignment.json') {
        result[bookId].push(
          path.parse(path.join(burritoDirPath, ingredientId))
        );
      }
    }
  }

  return result;
}

/**
 * Reads a wrapper metadata file and aggregates media data from all contained burritos.
 * @param wrapperDirPath - Path to the wrapper metadata directory
 * @returns Record mapping book IDs to arrays of media file paths from all burritos
 */
async function getMediaData(
  wrapperDirPath: string
): Promise<Record<string, PathObject[]>> {
  const result: Record<string, PathObject[]> = {};

  const wrapper = await readJson<BurritoWrapper>(
    path.join(wrapperDirPath, 'metadata.json')
  );

  for (const burrito of wrapper.contents?.burritos ?? []) {
    const burritoPath = path.join(wrapperDirPath, burrito.path);

    const burritoMedia = await enumerateIngredients(burritoPath);

    for (const [bookID, media] of Object.entries(burritoMedia)) {
      if (!result[bookID]) {
        result[bookID] = [];
      }

      result[bookID].push(...media);
    }
  }

  return result;
}

/**
 * Converts a Burrito wrapper directory to PTF (Paratext Import) format.
 * Reads the wrapper metadata and processes all contained burritos.
 * @param filter - Filter data for selective conversion
 * @param dirPath - Path to the wrapper directory
 */
export async function convertWrapperToPTFs(
  filter: FilterData,
  dirPath: string
) {
  const data = await getMediaData(dirPath);
  for (const book of filter.books) {
    const paddedCode = pad2(getBookCode(book.label));
    const bookName = `${paddedCode}${book.label}`;
    await convertBookToPTF(bookName, data[book.label]);
  }
}

/**
 * Converts a single book to PTF (Paratext Import) format.
 * Creates a new directory named after the project and generates
 * SILTranscriber and Version files.
 */
export async function convertBookToPTF(
  bookName: string,
  mediaList: PathObject[]
) {
  // make a new directory for ptf named after the project
  // Create SILTranscriber and Version
  const tempDir = await ipc.temp();
  const ptfDir = path.join(tempDir, `ptf-${bookName}-${Date.now()}`);
  await ipc.createFolder(ptfDir);
  await ipc.createFolder(path.join(ptfDir, 'media'));
  for (const mediaPath of mediaList) {
    await ipc.copyFile(
      path.format(mediaPath),
      path.join(ptfDir, 'media', mediaPath.base)
    );
  }
  await ipc.write(
    path.join(ptfDir, 'SILTranscriber'),
    new Date().toUTCString()
  );
  await ipc.write(path.join(ptfDir, 'Version'), '1');
  const zipPath = path.join(tempDir, `${bookName}.ptf`);
  await ipc.zipFolder(ptfDir, zipPath);
}
