/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';

const migrationDir = path.resolve(__dirname, '../../../../migration');

type SectionShape = {
  name: string;
  startChapter: number | null;
  startVerse: number | null;
  endChapter: number | null;
  endVerse: number | null;
};

type ParagraphShape = {
  sectionIndex: number;
  chapter: number;
  startVerse: number;
  endVerse: number;
};

type ExtractedStructure = {
  sections: SectionShape[];
  paragraphs: ParagraphShape[];
};

type UsjStructureModule = {
  normalizeTextToUsj: (input: unknown, inputFormat: string) => unknown;
  extractStructureFromUsj: (
    usjDoc: unknown,
    scopeFilter: unknown
  ) => ExtractedStructure;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest runs as CJS; migration impl is CommonJS
const { normalizeTextToUsj, extractStructureFromUsj } =
  require('../../../../migration/usj-structure-impl.cjs') as UsjStructureModule;

function fixture(name: string): string {
  return fs.readFileSync(path.join(migrationDir, 'fixtures', name), 'utf-8');
}

function pickShape(structure: ExtractedStructure) {
  return {
    sections: structure.sections.map((section: SectionShape) => ({
      name: section.name,
      startChapter: section.startChapter,
      startVerse: section.startVerse,
      endChapter: section.endChapter,
      endVerse: section.endVerse,
    })),
    paragraphs: structure.paragraphs.map((paragraph: ParagraphShape) => ({
      sectionIndex: paragraph.sectionIndex,
      chapter: paragraph.chapter,
      startVerse: paragraph.startVerse,
      endVerse: paragraph.endVerse,
    })),
  };
}

describe('usj-structure (migration)', () => {
  it('normalization parity for usfm/usx/usj structure extraction', () => {
    const usfm = normalizeTextToUsj(fixture('step2-structure.usfm'), 'usfm');
    const usx = normalizeTextToUsj(fixture('step2-structure.usx'), 'usx');
    const usj = normalizeTextToUsj(fixture('step2-structure.usj'), 'usj');

    const usfmShape = pickShape(extractStructureFromUsj(usfm, null));
    const usxShape = pickShape(extractStructureFromUsj(usx, null));
    const usjShape = pickShape(extractStructureFromUsj(usj, null));

    expect(usfmShape).toEqual(usjShape);
    expect(usxShape).toEqual(usjShape);
  });
});
