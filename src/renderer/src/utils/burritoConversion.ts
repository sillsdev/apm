import { MainAPI } from '@model/main-api';
import { FilterData } from '../components/FilterContent';
import { BurritoWrapper } from 'burrito/data/wrapperBuilder';
import { AudioMetadata, readJson } from './parseBurritoMetadata';
import path from 'path';

const ipc = window?.api as MainAPI;

async function enumerateIngredients(
  burritoMetadataPath: string
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  const burrito = await readJson<AudioMetadata>(
    path.join(burritoMetadataPath, 'metadata.json')
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
        result[bookId].push(path.join(burritoMetadataPath, ingredientId));
      }
    }
  }

  return result;
}

async function getMediaData(
  wrapperMetadataPath: string
): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  const wrapper = await readJson<BurritoWrapper>(
    path.join(wrapperMetadataPath, 'metadata.json')
  );

  for (const burrito of wrapper.contents?.burritos ?? []) {
    const burritoPath = path.join(wrapperMetadataPath, burrito.path);

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

export async function convertWrapperToPTFs(
  filter: FilterData,
  dirPath: string
) {
  console.log(filter, dirPath);
  // Load up metadata
  // For each burrito in contents:
  //  Get the path
  //  Read metadata for that burrito
  //
  const data = await ipc.read(dirPath, { encoding: 'utf-8' });
  const json: BurritoWrapper = JSON.parse(data as string);
  console.log(json);
}

export function convertBookToPTF() {
  // make a new directory for ptf named after the project
  // Create SILTranscriber and Version
  console.log();
}
