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

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8');
}

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
