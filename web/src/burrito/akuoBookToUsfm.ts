/**
 * Maps an Akuo-style project book slot (e.g. A01, B02 from project `book` default)
 * to a Paratext/USFM 3-letter book code using the same numbering as ApmData export.
 */
import type { PassageD, PlanD, ProjectD, SectionD } from '../model';
import related from '../crud/related';
import { projDefBook } from '../crud/useProjectDefaults';
import type { BurritoScopes } from './data/types';

export function akuoBookToUsfm(
  akuoBook: string,
  num2BookCode: (bookNum: number) => string | undefined
): string | undefined {
  const bookParse = /^([AB])(\d\d)$/.exec(akuoBook.trim());
  if (!bookParse) return undefined;
  const parsed = Number.parseInt(bookParse[2], 10);
  let bookNum = 999;
  if (bookParse[1] === 'A') {
    bookNum = parsed;
  } else if (bookParse[1] === 'B') {
    bookNum = parsed + 39;
  }
  return num2BookCode(bookNum);
}

/**
 * Maps a project's `book` default (Akuo A##/B## or a general-resource 3-digit code)
 * to the burrito book key used in `burritoBooks`, export folder names, and section grouping.
 */
export function projectDefaultToBurritoBookKey(
  projectBookDefault: string | undefined,
  num2BookCode: (bookNum: number) => string | undefined
): string | undefined {
  const def = (projectBookDefault ?? 'B01').trim();
  if (!def) return undefined;
  const mapped = akuoBookToUsfm(def, num2BookCode);
  if (mapped) return mapped;
  if (/^\d{3}$/.test(def)) return def;
  return undefined;
}

/**
 * Book keys for the checked projects on the burrito books screen.
 * Passage `book` values win. When a project has none (General projects),
 * the project `book` default is used instead.
 */
export function collectBurritoBooks({
  projects,
  plans,
  sections,
  passages,
  getProjectDefault,
  num2BookCode,
}: {
  projects: ProjectD[];
  plans: PlanD[];
  sections: SectionD[];
  passages: PassageD[];
  getProjectDefault: (key: string, project: ProjectD) => unknown;
  num2BookCode: (bookNum: number) => string | undefined;
}): string[] {
  const newBooks = new Set<string>();
  projects.forEach((proj) => {
    const planRec = plans.find((p) => related(p, 'project') === proj.id);
    const sectionRecs = sections.filter(
      (s) => related(s, 'plan') === planRec?.id
    );
    const passageRecs = sectionRecs.map((s) =>
      passages.find((p) => related(p, 'section') === s.id)
    );
    let book: string | undefined = undefined;
    passageRecs.forEach((p) => {
      const passageBook = p?.attributes?.book;
      if (!passageBook) return;
      if (book && book !== passageBook) {
        console.warn('multiple books in one project');
      }
      book = passageBook;
      newBooks.add(passageBook);
    });
    if (!book) {
      const projectBook = getProjectDefault(projDefBook, proj);
      if (typeof projectBook === 'string' && projectBook.trim()) {
        const fromDefault = projectDefaultToBurritoBookKey(
          projectBook,
          num2BookCode
        );
        if (fromDefault) newBooks.add(fromDefault);
      }
    }
  });
  return Array.from(newBooks);
}

/** `currentScope` entry for one ApmData / intellectualproperty burrito project. */
export function burritoCurrentScopeForProject(
  project: ProjectD,
  getProjectDefault: (key: string, project: ProjectD) => unknown,
  num2BookCode: (bookNum: number) => string | undefined
): BurritoScopes {
  const bookCode = projectDefaultToBurritoBookKey(
    (getProjectDefault(projDefBook, project) as string) ?? 'B01',
    num2BookCode
  );
  return bookCode ? { [bookCode]: [] } : {};
}

/** Union of per-project scopes for the ApmData and intellectualproperty burritos. */
export function burritoCurrentScopeForProjects(
  projects: ProjectD[],
  getProjectDefault: (key: string, project: ProjectD) => unknown,
  num2BookCode: (bookNum: number) => string | undefined
): BurritoScopes {
  return projects.reduce<BurritoScopes>(
    (scope, project) => ({
      ...scope,
      ...burritoCurrentScopeForProject(
        project,
        getProjectDefault,
        num2BookCode
      ),
    }),
    {}
  );
}
