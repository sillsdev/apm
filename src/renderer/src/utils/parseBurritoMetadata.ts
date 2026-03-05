import * as fs from 'fs';
import * as path from 'path';

interface BookStructure {
  label: string;
  chapters: string[];
  burritos: string[];
}

interface WrapperStructure {
  label: string;
  books: BookStructure[];
}

type LocalizedStringMap = Record<string, string>;

interface WrapperMetadata {
  meta: {
    name: LocalizedStringMap;
  };
}

interface AudioMetadata {
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

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function extractLabel(labels: LocalizedStringMap, lang: string): string {
  const label = labels[lang] ?? Object.values(labels)[0];

  if (!label) {
    throw new Error('Unable to resolve label');
  }

  return label.replace(/\s*Burrito Wrapper\s*$/i, '').trim();
}

export function buildStructure(
  burritoWrapperPath: string,
  lang: string
): WrapperStructure {
  try {
    const wrapper = readJson<WrapperMetadata>(
      path.join(burritoWrapperPath, 'metadata.json')
    );

    const audio = readJson<AudioMetadata>(
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
