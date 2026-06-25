import { MainAPI } from '@model/main-api';
import {
  Burrito,
  BurritoIngredient,
  BurritoWrapper,
  BurritoIngredients,
  LocalizedString,
} from '../burrito/data/types';
import path from 'path-browserify';
import { resolvePathUnderRoot } from './resolvePathUnderRoot';
import { sortChapters } from './sort';

const ipc = window?.api as MainAPI;

function getFlavorName(metadata: Burrito): string | null {
  return metadata?.type?.flavorType?.flavor?.name ?? null;
}

/** Extract chapter numbers from scope tokens (e.g. "1:1-2", "2", "3"). */
function chaptersFromScopesForBook(
  ingredients: BurritoIngredients | undefined,
  bookId: string
): string[] {
  const chapters = new Set<string>();
  for (const ing of Object.values(ingredients ?? {}) as BurritoIngredient[]) {
    if (!ing.scope) continue;
    const scopeForBook = ing.scope[bookId];
    if (!scopeForBook?.length) continue;
    for (const token of scopeForBook) {
      if (token === null || token === undefined) continue;
      const s = String(token).trim();
      if (!s) continue;
      const chMatch = s.match(/^(\d+)/);
      if (chMatch) {
        chapters.add(chMatch[1]);
      }
    }
  }
  return sortChapters(chapters);
}

function isScriptureTextIngredient(
  ingredientPath: string,
  ing: BurritoIngredient
): boolean {
  const ext = path.extname(ingredientPath).toLowerCase();
  if (
    ['.usfm', '.sfm', '.txt', '.usx', '.xml', '.json', '.usj'].includes(ext)
  ) {
    return true;
  }
  const mt = String(ing?.mimeType ?? '').toLowerCase();
  return (
    mt.includes('usfm') ||
    mt.includes('usx') ||
    mt.includes('usj') ||
    mt.includes('text/plain') ||
    mt.includes('text/xml') ||
    mt.includes('application/json')
  );
}

/**
 * Enumerate chapter numbers actually present in scripture bytes (USFM \\c, USX
 * chapter elements, USJ chapter nodes). Metadata scope often under-lists
 * chapters (e.g. one ingredient per chapter 1–2 only).
 */
function extractChapterNumbersFromScripture(raw: string): string[] {
  const chapters = new Set<string>();
  if (!raw || typeof raw !== 'string') {
    return [];
  }
  const reUsfm = /\\c\s+(\d+)/gi;
  let m;
  while ((m = reUsfm.exec(raw)) !== null) {
    chapters.add(m[1]);
  }
  const reUsx = /<chapter[^>]*\bnumber=["'](\d+)["']/gi;
  while ((m = reUsx.exec(raw)) !== null) {
    chapters.add(m[1]);
  }
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const doc = JSON.parse(raw) as unknown;
      const walk = (node: unknown): void => {
        if (node === null || node === undefined) {
          return;
        }
        if (Array.isArray(node)) {
          node.forEach(walk);
          return;
        }
        if (typeof node !== 'object') {
          return;
        }
        const o = node as Record<string, unknown>;
        if (o.type === 'chapter' && o.number != null) {
          const num = String(o.number).match(/^(\d+)/);
          if (num) {
            chapters.add(num[1]);
          }
        }
        for (const v of Object.values(o)) {
          walk(v);
        }
      };
      walk(doc);
    } catch {
      /* not JSON or too large — regex paths above still applied */
    }
  }
  return sortChapters(chapters);
}

async function chaptersFromScriptureFilesForBook(
  wrapperPath: string,
  burritoRelFolder: string,
  metadata: Burrito,
  bookId: string
): Promise<string[]> {
  const chapters = new Set<string>();
  for (const [relPath, ing] of Object.entries(metadata.ingredients ?? {}) as [
    string,
    BurritoIngredient,
  ][]) {
    if (!ing?.scope?.[bookId]?.length) {
      continue;
    }
    if (!isScriptureTextIngredient(relPath, ing)) {
      continue;
    }
    const absPath = resolvePathUnderRoot(
      wrapperPath,
      burritoRelFolder,
      relPath
    );
    if (!absPath || !(await ipc.exists(absPath))) {
      continue;
    }
    try {
      const raw = (await ipc.read(absPath, 'utf8')) as string;
      for (const ch of extractChapterNumbersFromScripture(raw)) {
        chapters.add(ch);
      }
    } catch {
      /* skip unreadable */
    }
  }
  return sortChapters(chapters);
}

/** Sentinel in `chapters` for references whose leading segment is not numeric (filter UI + migration). */
export const BURRITO_CHAPTER_FILTER_OTHER = '__other__';

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
    const wrapperJsonPath = resolvePathUnderRoot(
      burritoWrapperPath,
      'wrapper.json'
    );
    if (!wrapperJsonPath) {
      throw new Error('Invalid wrapper path');
    }
    const wrapper = await readJson<BurritoWrapper>(wrapperJsonPath);

    const flavorNames = new Set<string>();
    let audioBurritoRel: string | null = null;
    let textBurritoRel: string | null = null;

    for (const burrito of wrapper.contents?.burritos ?? []) {
      if (burrito.path === 'apmdata') {
        continue;
      }
      const metaPath = resolvePathUnderRoot(
        burritoWrapperPath,
        burrito.path,
        'metadata.json'
      );
      if (!metaPath || !(await ipc.exists(metaPath))) {
        continue;
      }
      const meta = await readJson<Burrito>(metaPath);
      const fn = getFlavorName(meta);
      if (fn) {
        flavorNames.add(fn);
      }
      if (fn === 'audioTranslation') {
        audioBurritoRel = burrito.path;
      }
      if (fn === 'textTranslation') {
        textBurritoRel = burrito.path;
      }
    }

    if (!audioBurritoRel) {
      audioBurritoRel = 'audio';
    }

    const audioMetaPath = resolvePathUnderRoot(
      burritoWrapperPath,
      audioBurritoRel,
      'metadata.json'
    );
    if (!audioMetaPath) {
      throw new Error('Invalid audio burrito path');
    }
    const audio = await readJson<Burrito>(audioMetaPath);

    let text: Burrito | null = null;
    if (textBurritoRel) {
      const textMetaPath = resolvePathUnderRoot(
        burritoWrapperPath,
        textBurritoRel,
        'metadata.json'
      );
      if (textMetaPath && (await ipc.exists(textMetaPath))) {
        try {
          text = await readJson<Burrito>(textMetaPath);
        } catch {
          text = null;
        }
      }
    }

    const bookIds = new Set<string>();

    for (const ingredient of Object.values(
      audio.ingredients ?? {}
    ) as BurritoIngredient[]) {
      if (!ingredient.scope) continue;
      for (const bookId of Object.keys(ingredient.scope)) {
        bookIds.add(bookId);
      }
    }
    if (text) {
      for (const ingredient of Object.values(
        text.ingredients ?? {}
      ) as BurritoIngredient[]) {
        if (!ingredient.scope) continue;
        for (const bookId of Object.keys(ingredient.scope)) {
          bookIds.add(bookId);
        }
      }
    }

    const books: BookStructure[] = [];

    const availableBurritos = Array.from(flavorNames).sort();

    for (const bookId of bookIds) {
      const nameEntry =
        audio.localizedNames?.[`book-${bookId.toLowerCase()}`] ??
        text?.localizedNames?.[`book-${bookId.toLowerCase()}`];

      if (!nameEntry?.long) continue;

      const chaptersFromAudio = chaptersFromScopesForBook(
        audio.ingredients,
        bookId
      );
      const chaptersFromText = text
        ? chaptersFromScopesForBook(text.ingredients, bookId)
        : [];
      const chaptersFromAudioFiles = await chaptersFromScriptureFilesForBook(
        burritoWrapperPath,
        audioBurritoRel,
        audio,
        bookId
      );
      const chaptersFromTextFiles =
        text && textBurritoRel
          ? await chaptersFromScriptureFilesForBook(
              burritoWrapperPath,
              textBurritoRel,
              text,
              bookId
            )
          : [];
      const chapterUnion = new Set<string>([
        ...chaptersFromAudio,
        ...chaptersFromText,
        ...chaptersFromAudioFiles,
        ...chaptersFromTextFiles,
      ]);
      const chapterList = sortChapters(chapterUnion);
      if (!chapterList.includes(BURRITO_CHAPTER_FILTER_OTHER)) {
        chapterList.push(BURRITO_CHAPTER_FILTER_OTHER);
      }
      books.push({
        id: bookId,
        label: extractLabel(nameEntry.long, lang),
        chapters: chapterList,
        burritos: [...availableBurritos],
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
