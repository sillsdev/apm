import { XMLSerializer } from '@xmldom/xmldom';
import grammarWasmUrl from 'usfm-grammar-web/tree-sitter-usfm.wasm?url';
import parserWasmUrl from 'usfm-grammar-web/tree-sitter.wasm?url';

export type BurritoTextExportFormat = 'usj' | 'usx';

interface USFMParserInstance {
  errors: unknown;
  toUSJ(): unknown;
  toUSX(): object;
}

interface USFMParserCtor {
  new (usfm: string): USFMParserInstance;
  init(grammarPath?: string, parserPath?: string): Promise<void>;
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

async function ensureUSFMParserInitialized(
  USFMParser: USFMParserCtor
): Promise<void> {
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

export async function convertBurritoText(
  usfm: string,
  format: BurritoTextExportFormat
): Promise<string> {
  const USFMParser = await getUSFMParserCtor();
  await ensureUSFMParserInitialized(USFMParser);
  const parser = new USFMParser(usfm);
  const errs = parser.errors;
  if (errs != null && Array.isArray(errs) && errs.length > 0) {
    throw new Error(`USFM parse errors: ${JSON.stringify(errs)}`);
  }
  if (format === 'usj') {
    return JSON.stringify(parser.toUSJ(), null, 2);
  }
  return new XMLSerializer().serializeToString(
    parser.toUSX() as unknown as Parameters<
      XMLSerializer['serializeToString']
    >[0]
  );
}
