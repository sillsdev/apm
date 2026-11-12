import { useEffect, useState } from 'react';
import { logError, Severity } from '../../utils/logErrorService';
import { CatalogBible, parseCatalog } from './referenceText';

export type CatalogState =
  | { status: 'loading' }
  | { status: 'ready'; bibles: CatalogBible[] }
  | { status: 'error' };

let cached: CatalogBible[] | undefined;

/** The bundled HelloAO catalog, loaded on first use to keep it out of the main bundle. */
export const useBibleCatalog = () => {
  const [state, setState] = useState<CatalogState>(
    cached ? { status: 'ready', bibles: cached } : { status: 'loading' }
  );

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    const load = async () => {
      try {
        const json = await import('../../assets/reference_text_bibles.json');
        cached = parseCatalog(json.default ?? json);
        if (!cancelled) setState({ status: 'ready', bibles: cached });
      } catch (err) {
        logError(Severity.error, undefined, err as Error);
        if (!cancelled) setState({ status: 'error' });
      }
    };
    void load(); // load reports its own errors
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
