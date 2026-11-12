/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
jest.mock('@xmldom/xmldom', () => ({
  XMLSerializer: class XMLSerializer {
    serializeToString() {
      return '<usx />';
    }
  },
}));

jest.mock('usfm-grammar-web/tree-sitter-usfm.wasm?url', () => 'grammar.wasm', {
  virtual: true,
});
jest.mock('usfm-grammar-web/tree-sitter.wasm?url', () => 'parser.wasm', {
  virtual: true,
});

describe('convertBurritoText', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function mockParser(modImpl: {
    init?: jest.Mock;
    errors?: unknown;
    toUSJ?: unknown;
    toUSX?: unknown;
  }) {
    const init = modImpl.init ?? jest.fn().mockResolvedValue(undefined);
    const USFMParser = class {
      static init = init;
      errors = modImpl.errors ?? null;
      constructor(_usfm: string) {}
      toUSJ() {
        return modImpl.toUSJ ?? { ok: true };
      }
      toUSX() {
        return (
          modImpl.toUSX ?? {
            nodeType: 1,
            nodeName: 'usx',
            childNodes: [],
            attributes: [],
          }
        );
      }
    };

    jest.doMock('usfm-grammar-web/dist/bundle.mjs', () => ({ USFMParser }), {
      virtual: true,
    });

    return { init };
  }

  it('converts to USJ (JSON pretty printed) after init', async () => {
    const { init } = mockParser({
      toUSJ: { book: 'GEN', chapters: [1] },
      errors: null,
    });

    const { convertBurritoText } = await import('./usfmTextConvert');
    const out = await convertBurritoText('\\id GEN', 'usj');

    expect(init).toHaveBeenCalledWith('grammar.wasm', 'parser.wasm');
    expect(out).toContain('"book": "GEN"');
    expect(out).toContain('\n  '); // pretty-print indentation
  });

  it('converts to USX (XML string) after init', async () => {
    const { init } = mockParser({
      toUSX: { nodeType: 1, nodeName: 'usx', childNodes: [], attributes: [] },
      errors: null,
    });

    const { convertBurritoText } = await import('./usfmTextConvert');
    const out = await convertBurritoText('\\id GEN', 'usx');

    expect(init).toHaveBeenCalledWith('grammar.wasm', 'parser.wasm');
    expect(typeof out).toBe('string');
    expect(out.toLowerCase()).toContain('usx');
  });

  it('throws when parser reports errors array', async () => {
    mockParser({
      errors: [{ message: 'bad usfm' }],
    });

    const { convertBurritoText } = await import('./usfmTextConvert');
    await expect(convertBurritoText('bad', 'usj')).rejects.toThrow(
      /USFM parse errors/
    );
  });

  it('caches init across calls within module (init called once)', async () => {
    const { init } = mockParser({
      errors: null,
      toUSJ: { ok: 1 },
    });

    const { convertBurritoText } = await import('./usfmTextConvert');
    await convertBurritoText('\\id GEN', 'usj');
    await convertBurritoText('\\id GEN', 'usj');

    expect(init).toHaveBeenCalledTimes(1);
  });

  it('allows retry after init failure (second call re-inits)', async () => {
    const init = jest
      .fn()
      .mockRejectedValueOnce(new Error('init failed'))
      .mockResolvedValueOnce(undefined);
    mockParser({ init, errors: null, toUSJ: { ok: true } });

    const { convertBurritoText } = await import('./usfmTextConvert');

    await expect(convertBurritoText('\\id GEN', 'usj')).rejects.toThrow(
      /init failed/
    );
    await expect(convertBurritoText('\\id GEN', 'usj')).resolves.toContain(
      '"ok": true'
    );
    expect(init).toHaveBeenCalledTimes(2);
  });
});
