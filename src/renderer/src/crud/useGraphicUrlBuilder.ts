import { useCallback, useMemo } from 'react';
import { parseRef } from './passage';
import { pad3 } from '../utils/pad3';
import { IState, PassageD } from '../model';
import CodeNum from '../assets/code-num.json';
import { type ScriptureRefChecked } from '../components/GraphicImageFilter';
import { useSelector } from 'react-redux';
import { chapterMatch, refMatch } from '../utils/refMatch';
import { API_CONFIG } from '../../api-variable';

const codeNumMap = new Map<string, number>(
  (CodeNum as [string, number][]).map(([code, num]) => [code, num])
);

export interface GraphicFilterState {
  /** Style (s) parameter */
  s?: string;
  /** Keyword (k) parameter */
  k?: string;
}

export interface GetUrlOptions {
  /** Page number (default 1) */
  page?: number;
  /** Page size (default 100) */
  limit?: number;
}

export interface GetKeywordUrlOptions extends GetUrlOptions {
  /** styles (s) parameter */
  s?: string;
}

export interface GetStyleUrlOptions extends GetUrlOptions {
  /** keywords (k) parameter */
  k?: string;
}

export interface GetSearchUrlOptions extends GetUrlOptions {
  /** Search query (q) */
  query: string;
  /** Style and keyword filters */
  filterState?: GraphicFilterState;
  /** Sort by newest (default true) */
  sortByNewest?: boolean;
}

export interface ScriptureRange {
  book_code: string;
  start_idx: number;
  end_idx: number;
}

/**
 * Builds start_idx / end_idx in BBCCCVVV format from book code and chapter/verse.
 * BB = pad2(book number from code-num), CCC = pad3(chapter), VVV = pad3(verse).
 */
function toScriptureIndex(
  bookCode: string,
  chapter: number,
  verse: number
): number {
  const bookNum = codeNumMap.get(bookCode) ?? 0;
  const bb = bookNum.toString();
  const ccc = pad3(chapter);
  const vvv = pad3(verse);
  return parseInt(bb + ccc + vvv, 10);
}

/**
 * Hook that builds the graphic search API URL for a section.
 * Uses sectionId to resolve section + passages, then sectionRef logic to get
 * book_code and start_idx/end_idx. Dispatches fetchBooks so book short name (b) is available.
 * Pass query, filterState, page, limit, sortByNewest to getSearchUrl() to build the URL.
 */
export function useGraphicUrlBuilder(
  bookCode: string,
  reference: string,
  scriptureRefChecked: ScriptureRefChecked,
  refOverride: boolean,
  setQBook: (book: string | undefined) => void,
  setQRef: (ref: string | undefined) => void
) {
  // if users sets a book or reference in the query...
  const lang = useSelector((state: IState) => state.strings.lang);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const bookNameMap = useMemo(() => {
    const dataMap = new Map<string, string>();
    allBookData.forEach((book) => {
      dataMap.set(book.short.toLocaleUpperCase(), book.code);
      dataMap.set(book.long.toLocaleUpperCase(), book.code);
      dataMap.set(book.abbr.toLocaleUpperCase(), book.code);
      dataMap.set(book.code, book.code);
    });
    return dataMap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBookData, lang]);

  const psgRefParts = useMemo(() => {
    const psg = {
      attributes: { book: bookCode, reference: reference },
    } as PassageD;
    parseRef(psg);
    return {
      startChapter: psg.attributes.startChapter,
      startVerse: psg.attributes.startVerse,
      endChapter: psg.attributes.endChapter,
      endVerse: psg.attributes.endVerse,
    };
  }, [bookCode, reference]);

  const scriptureRange = useMemo((): ScriptureRange | undefined => {
    const startChapter =
      scriptureRefChecked.chapter || refOverride
        ? (psgRefParts?.startChapter ?? 1)
        : 1;
    const startVerse =
      scriptureRefChecked.verse || refOverride
        ? (psgRefParts?.startVerse ?? 1)
        : 1;
    const endChapter =
      scriptureRefChecked.chapter || refOverride
        ? (psgRefParts?.endChapter ?? startChapter)
        : 999;
    const endVerse =
      scriptureRefChecked.verse || refOverride
        ? (psgRefParts?.endVerse ?? startVerse)
        : 999;
    const start_idx = toScriptureIndex(bookCode, startChapter, startVerse);
    const end_idx = toScriptureIndex(bookCode, endChapter, endVerse);
    return { book_code: bookCode, start_idx, end_idx };
  }, [psgRefParts, scriptureRefChecked, bookCode, refOverride]);

  const buildGraphicUrl = useCallback(
    (
      endpoint: string,
      baseOptions: { page?: number; limit?: number },
      addParams: (append: (key: string, value: string) => void) => void
    ): string | undefined => {
      if (!scriptureRange) return undefined;
      const pairs: [string, string][] = [];
      const append = (key: string, value: string) => pairs.push([key, value]);

      append('page', String(baseOptions.page ?? 1));
      append('limit', String(baseOptions.limit ?? 100));
      addParams(append);
      if (scriptureRefChecked.book || refOverride) {
        append(
          'scripture',
          JSON.stringify({
            book_code: scriptureRange.book_code,
            start_idx: scriptureRange.start_idx,
            end_idx: scriptureRange.end_idx,
          })
        );
      }
      const queryString = pairs
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      return `${API_CONFIG.graphicApiBase}/${endpoint}?${queryString}`;
    },
    [scriptureRange, scriptureRefChecked, refOverride]
  );

  const refFromQuery = (
    query: string,
    setQBook?: (book: string | undefined) => void,
    setQRef?: (ref: string | undefined) => void
  ) => {
    let pquery = query.trim();
    const mBook = /^([1-5])\s([^\s]+)/.exec(pquery);
    if (mBook) {
      pquery = `${mBook[1]}_${mBook[2]}${pquery.slice(mBook[0].length)}`;
    }
    // check for book and reference in the query
    const words = pquery.split(' ');
    const book = words[0].replace('_', ' ');
    if (book && bookNameMap.has(book.toLocaleUpperCase())) {
      const newCode = bookNameMap.get(book.toLocaleUpperCase()) as string;
      if (newCode && (!refOverride || newCode !== bookCode)) {
        setQBook?.(newCode);
      }
      const ref = words[1];
      const m = chapterMatch(ref);
      if (ref && m) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_, start, end] = m;
        let chapterRef = `${start}:1-`;
        if (end) chapterRef += `${end}:`;
        chapterRef += '999';
        setQRef?.(chapterRef);
        query = query.replace(`${mBook?.[0] ?? words[0]} ${ref}`, '');
      } else if (ref && refMatch(ref)) {
        setQRef?.(ref);
        query = query.replace(`${mBook?.[0] ?? words[0]} ${ref}`, '');
      } else {
        setQRef?.('1:1-999:999');
        query = query.replace(mBook?.[0] ?? words[0], '');
      }
    } else {
      setQBook?.(undefined);
      setQRef?.(undefined);
    }
    return query.trim();
  };

  const getSearchUrl = useCallback(
    (options: GetSearchUrlOptions): string | undefined => {
      const {
        filterState = {},
        page = 1,
        limit = 100,
        sortByNewest = true,
      } = options;
      const query = refFromQuery(options.query, setQBook, setQRef);
      return buildGraphicUrl('search', { page, limit }, (append) => {
        append('q', query);
        append('sortByNewest', String(sortByNewest));
        if (filterState.k != null && filterState.k !== '') {
          append('k', filterState.k);
        }
        if (filterState.s != null && filterState.s !== '') {
          append('s', filterState.s);
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buildGraphicUrl, bookNameMap]
  );

  const getKeywordUrl = useCallback(
    (options: GetKeywordUrlOptions): string | undefined => {
      const { s, page = 1, limit = 100 } = options;
      return buildGraphicUrl('keywords', { page, limit }, (append) => {
        if (s != null && s !== '') {
          append('s', s);
        }
      });
    },
    [buildGraphicUrl]
  );

  const getStyleUrl = useCallback(
    (options: GetStyleUrlOptions): string | undefined => {
      const { k, page = 1, limit = 100 } = options;
      return buildGraphicUrl('styles', { page, limit }, (append) => {
        if (k != null && k !== '') {
          append('k', k);
        }
      });
    },
    [buildGraphicUrl]
  );

  return {
    /** Scripture range for the API */
    scriptureRange,
    /** Build the search URL from query, filterState, page, limit, sortByNewest */
    getSearchUrl,
    /** Build the keyword URL from styles, page, limit */
    getKeywordUrl,
    /** Build the style URL from keywords, page, limit */
    getStyleUrl,
    /** Get Reference from Query */
    refFromQuery,
  };
}

export default useGraphicUrlBuilder;
