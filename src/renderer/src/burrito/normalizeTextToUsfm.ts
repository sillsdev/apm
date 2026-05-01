import { DOMParser } from '@xmldom/xmldom';
import grammarWasmUrl from 'usfm-grammar-web/tree-sitter-usfm.wasm?url';
import parserWasmUrl from 'usfm-grammar-web/tree-sitter.wasm?url';

export type BurritoTextInputFormat = 'usfm' | 'usj' | 'usx';

interface USFMParserCtor {
  init(grammarPath?: string, parserPath?: string): Promise<void>;
  // The published d.ts only declares `constructor(usfm: string)`, but we also
  // support `{ from_usj }` / `{ from_usx }` in runtime builds. Use `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (usfm: string | null, usj?: any, usx?: Document | null): any;
}

let parserCtorPromise: Promise<USFMParserCtor> | null = null;
let parserInitPromise: Promise<void> | null = null;

async function getUSFMParserCtor(): Promise<USFMParserCtor> {
  if (parserCtorPromise == null) {
    parserCtorPromise = (async () => {
      const mod = (await import('usfm-grammar-web/dist/bundle.mjs')) as {
        USFMParser: USFMParserCtor;
      };
      return mod.USFMParser;
    })();
  }
  return await parserCtorPromise;
}

async function ensureUSFMParserInitialized(USFMParser: USFMParserCtor) {
  if (parserInitPromise == null) {
    parserInitPromise = USFMParser.init(grammarWasmUrl, parserWasmUrl).catch(
      (err: unknown) => {
        // Allow subsequent calls to retry if initialization fails.
        parserInitPromise = null;
        throw err;
      }
    );
  }
  await parserInitPromise;
}

function normalizeNewlines(s: string): string {
  return String(s ?? '').replace(/\r\n?/g, '\n');
}

export async function normalizeTextToUsfm(
  input: string,
  format: BurritoTextInputFormat
): Promise<string> {
  const raw = normalizeNewlines(input);
  if (format === 'usfm') {
    return raw;
  }

  const USFMParser = await getUSFMParserCtor();
  await ensureUSFMParserInitialized(USFMParser);

  if (format === 'usj') {
    const usj = JSON.parse(raw);
    const parser = new USFMParser(null, usj);
    const usfm = String(parser?.usfm ?? '');
    return normalizeNewlines(usfm);
  }

  const usxDoc = new DOMParser().parseFromString(raw, 'application/xml');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new USFMParser(null, null, usxDoc);
  const usfm = String(parser?.usfm ?? '');
  return normalizeNewlines(usfm);
}
