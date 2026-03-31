/* eslint-disable @typescript-eslint/no-require-imports */
describe('burritoConversion', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function makeIpc() {
    return {
      temp: jest.fn().mockResolvedValue('/tmp'),
      createFolder: jest.fn().mockResolvedValue(undefined),
      burritoToPtf: jest
        .fn()
        .mockResolvedValue({ ok: true, ptfPath: '/tmp/out.ptf' }),
    };
  }

  function loadWithApi(api: any) {
    (window as unknown as { api?: any }).api = api;

    jest.doMock('./useBookN', () => ({
      getBookCode: jest.fn((bookId: string) => (bookId === 'GEN' ? 1 : 99)),
    }));
    jest.doMock('./pad2', () => ({
      pad2: jest.fn((n: number) => String(n).padStart(2, '0')),
    }));

    return require('./burritoConversion') as typeof import('./burritoConversion');
  }

  it('convertBookToPTF passes include options based on burritos (legacy undefined => include all)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(12345);
    const ipc = makeIpc();
    const { convertBookToPTF } = loadWithApi(ipc);

    await convertBookToPTF('/wrapper', 'GEN', '01GEN', {
      id: 'GEN',
      label: 'Genesis',
      chapters: ['1'],
      // `burritos` missing means include everything
    } as any);

    expect(ipc.temp).toHaveBeenCalled();
    expect(ipc.createFolder).toHaveBeenCalledWith('/tmp/ptf-out-01GEN-12345');
    expect(ipc.burritoToPtf).toHaveBeenCalledWith(
      expect.objectContaining({
        wrapperDirPath: '/wrapper',
        bookId: 'GEN',
        outputDir: '/tmp/ptf-out-01GEN-12345',
        options: expect.objectContaining({
          include: { audio: true, transcription: true },
          chapters: ['1'],
          sister: { transcriptionFlavorName: 'textTranslation' },
        }),
      })
    );
  });

  it('convertBookToPTF sets include false when burritos is empty array (explicit deselect)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1);
    const ipc = makeIpc();
    const { convertBookToPTF } = loadWithApi(ipc);

    await convertBookToPTF('/wrapper', 'GEN', '01GEN', {
      id: 'GEN',
      label: 'Genesis',
      chapters: [],
      burritos: [],
    } as any);

    expect(ipc.burritoToPtf.mock.calls[0][0].options.include).toEqual({
      audio: false,
      transcription: false,
    });
  });

  it('convertWrapperToPTFs reports progress per book and returns ptf paths', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(2);
    const ipc = makeIpc();
    const { convertWrapperToPTFs } = loadWithApi(ipc);

    const onProgress = jest.fn();
    const paths = await convertWrapperToPTFs(
      {
        label: 'Wrapper',
        books: [
          {
            id: 'GEN',
            label: 'Genesis',
            chapters: ['1'],
            burritos: ['audioTranslation'],
          },
          {
            id: 'EXO',
            label: 'Exodus',
            chapters: ['1'],
            burritos: ['textTranslation'],
          },
        ],
      } as any,
      '/wrapper',
      onProgress
    );

    expect(onProgress).toHaveBeenCalledWith({
      kind: 'book',
      bookLabel: 'Genesis',
      index: 1,
      total: 2,
    });
    expect(onProgress).toHaveBeenCalledWith({
      kind: 'book',
      bookLabel: 'Exodus',
      index: 2,
      total: 2,
    });

    expect(paths).toEqual(['/tmp/out.ptf', '/tmp/out.ptf']);
  });

  it('convertBookToPTF throws with a useful message when IPC returns ok=false', async () => {
    const ipc = makeIpc();
    ipc.burritoToPtf.mockResolvedValueOnce({ ok: false, error: 'nope' });
    const { convertBookToPTF } = loadWithApi(ipc);

    await expect(
      convertBookToPTF('/wrapper', 'GEN', '01GEN', {
        id: 'GEN',
        label: 'Genesis',
        chapters: [],
        burritos: ['audioTranslation'],
      } as any)
    ).rejects.toThrow('nope');
  });
});
