import { MainAPI } from '@model/main-api';
import path from 'path-browserify';

const ipc = window?.api as MainAPI;

export interface BookStructure {
  label: string;
  chapters: string[];
  burritos: string[];
}

export interface WrapperStructure {
  label: string;
  books: BookStructure[];
}

export interface BurritoEntry {
  id: string;
  path: string;
  role: 'source' | 'derived' | 'supplemental';
}

export interface BurritoContents {
  burritos: BurritoEntry[];
}

export type LocalizedStringMap = Record<string, string>;

export interface WrapperMetadata {
  meta: {
    name: LocalizedStringMap;
  };
  format: 'scripture burrito wrapper';
  contents: BurritoContents;
}

export interface AudioMetadata {
  ingredients: Record<
    string,
    {
      scope?: Record<string, string[]>;
    }
  >;
  localizedNames: Record<
    string,
    {
      long: LocalizedStringMap;
    }
  >;
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse((await ipc.read(filePath, 'utf8')) as string) as T;
}

export function extractLabel(labels: LocalizedStringMap, lang: string): string {
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
    const wrapper = await readJson<WrapperMetadata>(
      path.join(burritoWrapperPath, 'metadata.json')
    );

    const audio = await readJson<AudioMetadata>(
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
      const entry = audio.localizedNames[`book-${bookId.toLowerCase()}`];

      if (!entry?.long) continue;

      books.push({
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
