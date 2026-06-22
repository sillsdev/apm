import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeTextToUsj,
  extractStructureFromUsj,
} from './usj-structure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string} name
 * @returns {string}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function pickShape(structure) {
  return {
    sections: structure.sections.map((section) => ({
      name: section.name,
      startChapter: section.startChapter,
      startVerse: section.startVerse,
      endChapter: section.endChapter,
      endVerse: section.endVerse,
    })),
    paragraphs: structure.paragraphs.map((paragraph) => ({
      sectionIndex: paragraph.sectionIndex,
      chapter: paragraph.chapter,
      startVerse: paragraph.startVerse,
      endVerse: paragraph.endVerse,
    })),
  };
}

test('normalization parity for usfm/usx/usj structure extraction', () => {
  const usfm = normalizeTextToUsj(fixture('step2-structure.usfm'), 'usfm');
  const usx = normalizeTextToUsj(fixture('step2-structure.usx'), 'usx');
  const usj = normalizeTextToUsj(fixture('step2-structure.usj'), 'usj');

  const usfmShape = pickShape(extractStructureFromUsj(usfm));
  const usxShape = pickShape(extractStructureFromUsj(usx));
  const usjShape = pickShape(extractStructureFromUsj(usj));

  assert.deepEqual(usfmShape, usjShape);
  assert.deepEqual(usxShape, usjShape);
});

test('section heading after \\c keeps ch4 audio in second section when ch4 has no verses yet', () => {
  const usfm = [
    '\\id RUT',
    '\\c 3',
    '\\s Ruth 3: Ruth Proposes Marriage',
    '\\p',
    '\\v 1-18 transcribe it',
    '\\c 4',
    '\\s Ruth 4: Joy',
    '\\p',
  ].join('\n');
  const usj = normalizeTextToUsj(usfm, 'usfm');
  const { sections, paragraphs } = extractStructureFromUsj(usj, null);
  assert.equal(sections.length, 2);
  assert.equal(sections[1].startChapter, 4);
  assert.equal(sections[1].endChapter, 4);
  const ch4Paras = paragraphs.filter((p) => p.chapter === 4);
  assert.equal(ch4Paras.length, 0);
});
