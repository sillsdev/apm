import Memory from '@orbit/memory';
import { postPass } from './postPass';
import { PassageInfo } from './PassageInfo';
import { DOMParser } from '@xmldom/xmldom';
import { PassageD } from '../../model';
const domParser = new DOMParser();

let mockChapDom = domParser.parseFromString('<usx/>');
const mockMemory = { update: jest.fn() } as unknown as Memory;

describe('postPass', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChapDom = domParser.parseFromString('<usx></usx>');
  });

  it('should post one verse to the current empty chapter', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'MAT',
        reference: '1:1',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockMemory.update).not.toHaveBeenCalled();
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1" style="v"/>transcription</para></usx>`
    );
  });

  it('should post two verses to the current empty chapter', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'MAT',
        reference: '1:1-2',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockMemory.update).not.toHaveBeenCalled();
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1-2" style="v"/>transcription</para></usx>`
    );
  });

  it('should post three verses to the current empty chapter', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'MAT',
        reference: '1:1-3',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockMemory.update).not.toHaveBeenCalled();
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1-3" style="v"/>transcription</para></usx>`
    );
  });

  it('should put transcription in second chapter when more verses and no markup included', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'JON',
        reference: '1:17-2:10',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '2',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1-10" style="v"/>[1:17-2:10] transcription</para></usx>`
    );
  });

  it('should put no content in first chapter when more verses and no markup included', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'JON',
        reference: '1:17-2:10',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockChapDom.documentElement?.toString()).toBe(`<usx/>`);
  });

  it('should put transcription in first chapter when more verses and no markup included', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'LUK',
        reference: '4:38-5:1',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '4',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="38-44" style="v"/>[4:38-5:1] transcription</para></usx>`
    );
  });

  it('should put no content in second chapter when more verses and no markup included', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'LUK',
        reference: '4:38-5:1',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '5',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockChapDom.documentElement?.toString()).toBe(`<usx/>`);
  });

  it('should put transcription in second chapter when more verses and no markup included and startVerse already set to one', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'JON',
        reference: '1:17-2:10',
        startChapter: 2,
        startVerse: 1,
        endChapter: 2,
        endVerse: 10,
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '2',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: 'transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1-10" style="v"/>[1:17-2:10] transcription</para></usx>`
    );
  });

  it('should put first content in first chapter if marked up', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'JON',
        reference: '1:17-2:10',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription:
          '\\v 17 transcription \\c 2 \\v 1-10 rest of transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockMemory.update).not.toHaveBeenCalled();
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="17" style="v"/>transcription</para></usx>`
    );
  });

  it('should put rest of content in second chapter if marked up', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'JON',
        reference: '1:17-2:10',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '2',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription:
          '\\v 17 transcription \\c 2 \\v 1-10 rest of transcription',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };
    // Act
    postPass(params);
    // Assert
    expect(mockMemory.update).not.toHaveBeenCalled();
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1-10" style="v"/>rest of transcription</para></usx>`
    );
  });

  it('should re-sync a verse range without affecting surrounding verses', () => {
    // Arrange: existing DOM has verses 7-11 each in their own paragraph
    mockChapDom = domParser.parseFromString(
      '<usx>' +
        '<para style="p">\r\n<verse number="7" style="v"/>V7</para>' +
        '<para style="p">\r\n<verse number="8" style="v"/>V8<verse number="9" style="v"/>V9<verse number="10" style="v"/>V10</para>' +
        '<para style="p">\r\n<verse number="11" style="v"/>V11</para>' +
        '</usx>'
    );
    const passage = {
      attributes: {
        book: 'LUK',
        reference: '1:8-10',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: '\\v 8 new8 \\v 9 new9 \\v 10 new10',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };

    // Act
    postPass(params);

    // Assert: v7 and v11 paragraphs remain, v8-10 grouped in one new paragraph
    const result = mockChapDom.documentElement?.toString();
    expect(result).toContain(
      '<verse number="7" style="v"/>V7</para>'
    );
    expect(result).toContain(
      '<verse number="11" style="v"/>V11</para>'
    );
    expect(result).toContain(
      '<verse number="8" style="v"/>new8<verse number="9" style="v"/>new9<verse number="10" style="v"/>new10</para>'
    );
    // Order: v7 para, v8-10 para, v11 para
    const v7pos = result!.indexOf('number="7"');
    const v8pos = result!.indexOf('number="8"');
    const v11pos = result!.indexOf('number="11"');
    expect(v7pos).toBeLessThan(v8pos);
    expect(v8pos).toBeLessThan(v11pos);
  });

  it('should keep multiple marked verses in one paragraph', () => {
    // Arrange
    const passage = {
      attributes: {
        book: 'MAT',
        reference: '1:1-4',
      },
    } as PassageD;
    const params = {
      doc: mockChapDom,
      chap: '1',
      currentPI: {
        passage,
        mediaId: 'm1',
        transcription: '\\v 1 one \\v 2 two \\v 3 three \\v 4 four',
      } as PassageInfo,
      exportNumbers: false,
      sectionArr: [],
      memory: mockMemory,
    };

    // Act
    postPass(params);

    // Assert
    expect(mockChapDom.documentElement?.toString()).toBe(
      `<usx><para style="p">\r\n<verse number="1" style="v"/>one<verse number="2" style="v"/>two<verse number="3" style="v"/>three<verse number="4" style="v"/>four</para></usx>`
    );
  });
});
