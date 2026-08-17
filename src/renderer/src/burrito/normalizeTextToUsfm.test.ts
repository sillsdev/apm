jest.mock('usfm-grammar-web/tree-sitter-usfm.wasm?url', () => 'grammar.wasm', {
  virtual: true,
});
jest.mock('usfm-grammar-web/tree-sitter.wasm?url', () => 'parser.wasm', {
  virtual: true,
});

describe('normalizeTextToUsfm', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  async function loadWithParser() {
    // Match production: `new USFMParser(null, usj)` / `new USFMParser(null, null, usxDoc)`
    const USFMParser = class {
      static init = jest.fn().mockResolvedValue(undefined);
      usfm: string;
      constructor(_usfm: string | null, usj?: unknown, usx?: unknown) {
        if (usj != null) {
          this.usfm = '\\id GEN\n\\c 1\n\\v 1 from-usj';
        } else if (usx != null) {
          this.usfm = '\\id GEN\n\\c 1\n\\v 1 from-usx';
        } else if (typeof _usfm === 'string') {
          this.usfm = _usfm;
        } else {
          this.usfm = '';
        }
      }
    };

    jest.doMock('usfm-grammar-web/dist/bundle.mjs', () => ({ USFMParser }), {
      virtual: true,
    });

    const mod = await import('./normalizeTextToUsfm');
    return { normalizeTextToUsfm: mod.normalizeTextToUsfm, USFMParser };
  }

  it('returns input for usfm', async () => {
    const { normalizeTextToUsfm } = await loadWithParser();
    const input = '\\id GEN\r\n\\c 1\r\n\\v 1 Hello';
    await expect(normalizeTextToUsfm(input, 'usfm')).resolves.toBe(
      '\\id GEN\n\\c 1\n\\v 1 Hello'
    );
  });

  it('converts usj to usfm via USFMParser', async () => {
    const { normalizeTextToUsfm } = await loadWithParser();
    const usj = JSON.stringify({ type: 'USJ', version: '0.3.0', content: [] });
    const out = await normalizeTextToUsfm(usj, 'usj');
    expect(out).toContain('\\c 1');
    expect(out).toContain('from-usj');
  });

  it('converts usx to usfm via USFMParser', async () => {
    const { normalizeTextToUsfm } = await loadWithParser();
    const usx =
      '<usx><chapter number="1"/><para style="p"><verse number="1"/>x</para></usx>';
    const out = await normalizeTextToUsfm(usx, 'usx');
    expect(out).toContain('\\c 1');
    expect(out).toContain('from-usx');
  });
});
