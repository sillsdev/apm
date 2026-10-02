declare module 'usfm-grammar-web/dist/bundle.mjs' {
  export class USFMParser {
    static init(grammarPath?: string, parserPath?: string): Promise<void>;
    constructor(usfm: string);
    errors: unknown;
    toUSJ(): unknown;
    toUSX(): object;
  }
}
