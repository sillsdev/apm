import path from 'path-browserify';
import { isElectron } from '../../../api-variable';
import { MainAPI } from '../../model/main-api';
import { HelloAoSimpleChapterBody } from '../../model/helloAoChapter';
import { dataPath, PathType } from '../../utils/dataPath';
import { logError, Severity } from '../../utils/logErrorService';
import { parseChapter } from './passageText';

export const HELLOAO_API = 'https://bible.helloao.org/api';

// Read at call time so tests can stub window.api
const ipc = () => window?.api as MainAPI;

const chapterFile = (id: string, book: string, chapter: number) =>
  `${id}/${book}/${chapter}.simple.json`;

/** Settled and in-flight chapter requests, shared by every view of a passage. */
const chapterCache = new Map<string, Promise<HelloAoSimpleChapterBody>>();

/** Forgets cached chapters; for tests. */
export const clearChapterCache = () => chapterCache.clear();

const localChapterPath = async (file: string) => {
  const out = { localname: '' };
  await dataPath(file, PathType.REFERENCE_TEXT, out);
  return out.localname;
};

const readLocalChapter = async (localPath: string) => {
  if (!(await ipc().exists(localPath))) return undefined;
  try {
    const text = await ipc().read(localPath, 'utf-8');
    return parseChapter(JSON.parse(text as string)); // utf-8 read gives a string
  } catch (err) {
    // A damaged file is fetched again and overwritten
    logError(Severity.info, undefined, err as Error);
    return undefined;
  }
};

const writeLocalChapter = async (localPath: string, json: unknown) => {
  try {
    await ipc().createFolder(path.dirname(localPath));
    await ipc().write(localPath, JSON.stringify(json));
  } catch (err) {
    // The text is still returned; it is fetched again next time
    logError(Severity.error, undefined, err as Error);
  }
};

const fetchChapter = async (file: string) => {
  const response = await fetch(`${HELLOAO_API}/${file}`);
  if (!response.ok)
    throw new Error(
      `HelloAO ${file}: ${response.status} ${response.statusText}`
    );
  const json: unknown = await response.json();
  const body = parseChapter(json);
  if (!body) throw new Error(`HelloAO ${file}: not a chapter`);
  return { json, body };
};

const loadChapter = async (file: string) => {
  if (!isElectron) return (await fetchChapter(file)).body;
  const localPath = await localChapterPath(file);
  const local = await readLocalChapter(localPath);
  if (local) return local;
  const { json, body } = await fetchChapter(file);
  await writeLocalChapter(localPath, json);
  return body;
};

/**
 * One chapter of a Reference Text from HelloAO, kept in memory and, on
 * desktop, in the offline data folder so it reads offline once fetched.
 */
export const getChapter = (id: string, book: string, chapter: number) => {
  const file = chapterFile(id, book, chapter);
  const cached = chapterCache.get(file);
  if (cached) return cached;
  const request = loadChapter(file).catch((err: unknown) => {
    chapterCache.delete(file); // let the next request retry
    throw err;
  });
  chapterCache.set(file, request);
  return request;
};

/** The chapters in order; rejects if any of them fails. */
export const getChapters = (id: string, book: string, chapters: number[]) =>
  Promise.all(chapters.map((c) => getChapter(id, book, c)));
