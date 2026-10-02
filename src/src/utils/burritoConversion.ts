import { MainAPI, BurritoToPtfOptions } from '@model/main-api';
import { BookStructure, WrapperStructure } from './parseBurritoMetadata';
import path from 'path-browserify';
import { getBookCode } from './useBookN';
import { pad2 } from './pad2';

const ipc = window?.api as MainAPI;

function bookWantsAudio(book: BookStructure): boolean {
  // `burritos` missing (legacy) means "include everything".
  // An empty array means the user explicitly deselected all content types.
  if (!book.burritos) {
    return true;
  }
  return book.burritos.includes('audioTranslation');
}

function bookWantsTranscription(book: BookStructure): boolean {
  if (!book.burritos) {
    return true;
  }
  return book.burritos.includes('textTranslation');
}

function buildBurritoToPtfOptions(book: BookStructure): BurritoToPtfOptions {
  return {
    include: {
      audio: bookWantsAudio(book),
      transcription: bookWantsTranscription(book),
    },
    sister: {
      transcriptionFlavorName: 'textTranslation',
    },
  };
}

export type BurritoConvertProgress =
  | { kind: 'book'; bookLabel: string; index: number; total: number }
  | { kind: 'reading'; index: number; total: number };

/**
 * Converts a Burrito wrapper directory to PTF (Paratext Import) format.
 * Reads the wrapper metadata and processes all contained burritos.
 * @param filter - Filter data for selective conversion
 * @param dirPath - Path to the wrapper directory
 * @param onProgress - Called before each book conversion and during file reads (optional)
 */
export async function convertWrapperToPTFs(
  filter: WrapperStructure,
  dirPath: string,
  onProgress?: (p: BurritoConvertProgress) => void
) {
  const books = filter.books;
  const total = books.length;
  const paths: string[] = [];
  for (let i = 0; i < total; i++) {
    const book = books[i];
    onProgress?.({
      kind: 'book',
      bookLabel: book.label,
      index: i + 1,
      total,
    });
    const paddedCode = pad2(getBookCode(book.id));
    const bookName = `${paddedCode}${book.id}`;
    const ptfPath = await convertBookToPTF(dirPath, book.id, bookName, book);
    if (ptfPath) {
      paths.push(ptfPath);
    }
  }
  return paths;
}

/**
 * Converts a single book to PTF via `migration/05-burrito-to-ptf.js` (IPC).
 */
export async function convertBookToPTF(
  wrapperDirPath: string,
  bookId: string,
  bookName: string,
  bookFilter: BookStructure
): Promise<string | null> {
  const tempDir = await ipc.temp();
  const outputDir = path.join(tempDir, `ptf-out-${bookName}-${Date.now()}`);
  await ipc.createFolder(outputDir);

  const options: BurritoToPtfOptions = {
    ...buildBurritoToPtfOptions(bookFilter),
    chapters: bookFilter.chapters,
  };

  const result = await ipc.burritoToPtf({
    wrapperDirPath,
    bookId,
    outputDir,
    options,
  });

  if (!result.ok || !result.ptfPath) {
    throw new Error(
      result.error ?? 'burritoToPtf failed without an error message'
    );
  }

  return result.ptfPath;
}
