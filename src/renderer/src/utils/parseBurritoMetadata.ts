import { MainAPI } from '@model/main-api';
import { Burrito, BurritoWrapper, LocalizedString } from 'burrito/data/types';
import path from 'path-browserify';

const ipc = window?.api as MainAPI;

export interface BookStructure {
  id: string;
  label: string;
  chapters: string[];
  burritos: string[];
}

export interface WrapperStructure {
  label: string;
  books: BookStructure[];
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse((await ipc.read(filePath, 'utf8')) as string) as T;
}

export function extractLabel(labels: LocalizedString, lang: string): string {
  const label = labels[lang] ?? Object.values(labels)[0];

  if (!label) {
    throw new Error('Unable to resolve label');
  }

  return label.replace(/\s*Burrito Wrapper\s*$/i, '').trim();
}

export async function buildStructure(
  burritoWrapperPath: string,
  lang: string
): Promise<WrapperStructure> {
  try {
    const wrapper = await readJson<BurritoWrapper>(
      path.join(burritoWrapperPath, 'metadata.json')
    );

    const audio = await readJson<Burrito>(
      path.join(burritoWrapperPath, 'audio', 'metadata.json')
    );

    const bookIds = new Set<string>();

    for (const ingredient of Object.values(audio.ingredients)) {
      if (!ingredient.scope) continue;
      for (const bookId of Object.keys(ingredient.scope)) {
        bookIds.add(bookId);
      }
    }

    const books: BookStructure[] = [];

    for (const bookId of bookIds) {
      if (!audio.localizedNames) continue;

      const entry = audio.localizedNames[`book-${bookId.toLowerCase()}`];

      if (!entry?.long) continue;

      books.push({
        id: bookId,
        label: extractLabel(entry.long, lang),
        chapters: [],
        burritos: [],
      });
    }

    return {
      label: extractLabel(wrapper.meta.name, lang),
      books,
    };
  } catch (err) {
    throw new Error(
      `Invalid Scripture Burrito for import: ${(err as Error).message}`
    );
  }
}
