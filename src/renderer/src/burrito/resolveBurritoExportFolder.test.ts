import { AltBkSeq, BookSeq } from '../model/section';
import type { PassageD, SectionD } from '../model';
import {
  chnumChapterFromRef,
  resolveBurritoExportFolder,
  resolveChnumExportFolder,
} from './resolveBurritoExportFolder';

const bookPath = '/burrito/PHP';

function section(id: string, sequencenum: number): SectionD {
  return {
    id,
    type: 'section',
    attributes: { sequencenum },
    relationships: { plan: { data: { id: 'plan-1' } } },
  } as unknown as SectionD;
}

function passage(
  id: string,
  sectionId: string,
  reference: string,
  sequencenum: number,
  startChapter?: number
): PassageD {
  return {
    id,
    type: 'passage',
    attributes: {
      reference,
      sequencenum,
      startChapter: startChapter ?? 0,
      startVerse: 1,
      endChapter: startChapter ?? 0,
      endVerse: 1,
    },
    relationships: { section: { data: { id: sectionId } } },
  } as unknown as PassageD;
}

describe('chnumChapterFromRef', () => {
  it('parses pipe and space CHNUM reference formats', () => {
    expect(chnumChapterFromRef('CHNUM|3')).toBe(3);
    expect(chnumChapterFromRef('CHNUM 4')).toBe(4);
  });
});

describe('resolveBurritoExportFolder — book rows', () => {
  it('uses distinct scope refs for Book and Alt Book rows', () => {
    const book = section('book', BookSeq);
    const alt = section('alt', AltBkSeq);
    const passages: PassageD[] = [];
    const input = {
      bookPath,
      sections: [book, alt],
      passages,
      computeSectionRef: () => '',
      computeMovementRef: () => '',
    };
    expect(resolveBurritoExportFolder({ ...input, section: book }).scopeRef).toBe(
      'BOOK'
    );
    expect(resolveBurritoExportFolder({ ...input, section: alt }).scopeRef).toBe(
      'ALTBK'
    );
  });
});

describe('resolveChnumExportFolder', () => {
  it('places CHNUM space-format rows in the matching chapter folder', () => {
    const p = passage('p1', 's1', 'CHNUM 2', 0.02);
    const folder = resolveChnumExportFolder(p, bookPath);
    expect(folder.folderPath).toBe(`${bookPath}/002`);
    expect(folder.chapter).toBe('2');
  });
});

describe('resolveBurritoExportFolder — CHNUM space format', () => {
  it('derives chapter folder from CHNUM N when section has no scripture ref prefix', () => {
    const ch2 = section('ch2', 2);
    const passages = [
      passage('n1', 'ch2', 'NOTE', 0.01),
      passage('cn', 'ch2', 'CHNUM 2', 0.02),
      passage('n2', 'ch2', 'NOTE', 0.03),
      passage('scr', 'ch2', '2:1-30', 1, 2),
    ];
    const folder = resolveBurritoExportFolder({
      section: ch2,
      bookPath,
      sections: [ch2],
      passages,
      computeSectionRef: () => '2:1-30',
      computeMovementRef: () => '',
    });
    expect(folder.folderPath).toBe(`${bookPath}/002`);
  });
});
