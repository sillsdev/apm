import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { transformBurritoToPTF } = require('./05-burrito-to-ptf.js');

const BOOK = 'RUT';
const PROJECT_FOLDER = 'TestProject';
const USER_ID = 'user-export-1';
const ORG_ID = 'org-export-1';
const PLAN_ID = 'plan-export-1';

/**
 * @returns {Buffer}
 */
function tinyWavBytes() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 8;
  const dataSize = 8;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

/**
 * @param {number} count
 * @returns {unknown[]}
 */
function buildOrgWorkflowSteps(count) {
  return Array.from({ length: count }, (_, index) => {
    const seq = index + 1;
    return {
      type: 'orgworkflowsteps',
      id: `wf-export-${seq}`,
      attributes: {
        process: 'draft',
        name: `APMImportWF_${String(seq).padStart(2, '0')}`,
        sequencenum: seq,
        tool: '{"tool":"transcribe"}',
        permissions: '{}',
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        organization: { data: { type: 'organization', id: ORG_ID } },
      },
    };
  });
}

/**
 * @returns {{ sections: unknown[]; passages: unknown[] }}
 */
function buildPlanStructure() {
  const sectionEmptyA = 'section-empty-a';
  const sectionAudio = 'section-audio';
  const sectionEmptyB = 'section-empty-b';
  const passageAudio = 'passage-audio';
  const passageMovement = 'passage-movement';
  const passageChapter = 'passage-chapter';
  const passageNote = 'passage-note';

  const sections = [
    {
      type: 'sections',
      id: sectionEmptyA,
      attributes: {
        sequencenum: 1,
        name: 'Empty Publishing Row A',
        state: '',
        level: 3,
        published: false,
        'publish-to': '{}',
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        plan: { data: { type: 'plan', id: PLAN_ID } },
        passages: { data: [{ type: 'passage', id: passageMovement }] },
      },
    },
    {
      type: 'sections',
      id: sectionAudio,
      attributes: {
        sequencenum: 2,
        name: 'Audio Section',
        state: '',
        level: 3,
        published: false,
        'publish-to': '{}',
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        plan: { data: { type: 'plan', id: PLAN_ID } },
        passages: { data: [{ type: 'passage', id: passageAudio }] },
      },
    },
    {
      type: 'sections',
      id: sectionEmptyB,
      attributes: {
        sequencenum: 3,
        name: 'Empty Publishing Row B',
        state: '',
        level: 3,
        published: false,
        'publish-to': '{}',
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        plan: { data: { type: 'plan', id: PLAN_ID } },
        passages: { data: [] },
      },
    },
  ];

  const passages = [
    {
      type: 'passages',
      id: passageMovement,
      attributes: {
        sequencenum: 1,
        book: BOOK,
        reference: 'Movement 01',
        title: 'Movement 01',
        state: 'noMedia',
        'start-chapter': 0,
        'end-chapter': 0,
        'start-verse': 0,
        'end-verse': 0,
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        section: { data: { type: 'section', id: sectionEmptyA } },
        mediafiles: { data: [] },
      },
    },
    {
      type: 'passages',
      id: passageChapter,
      attributes: {
        sequencenum: 2,
        book: BOOK,
        reference: '1',
        title: '1',
        state: 'noMedia',
        'start-chapter': 1,
        'end-chapter': 1,
        'start-verse': 0,
        'end-verse': 0,
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        section: { data: { type: 'section', id: sectionEmptyA } },
        mediafiles: { data: [] },
      },
    },
    {
      type: 'passages',
      id: passageNote,
      attributes: {
        sequencenum: 3,
        book: BOOK,
        reference: 'Note 1',
        title: 'Note 1',
        state: 'noMedia',
        'start-chapter': 0,
        'end-chapter': 0,
        'start-verse': 0,
        'end-verse': 0,
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        section: { data: { type: 'section', id: sectionEmptyA } },
        mediafiles: { data: [] },
      },
    },
    {
      type: 'passages',
      id: passageAudio,
      attributes: {
        sequencenum: 4,
        book: BOOK,
        reference: '1:1-5',
        title: '1:1-5',
        state: 'noMedia',
        'start-chapter': 1,
        'end-chapter': 1,
        'start-verse': 1,
        'end-verse': 5,
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        lastModifiedByUser: { data: { type: 'user', id: USER_ID } },
        section: { data: { type: 'section', id: sectionAudio } },
        mediafiles: { data: [] },
      },
    },
  ];

  return { sections, passages };
}

/**
 * @param {string} rootDir
 * @param {number} orgWorkflowStepCount
 * @returns {Promise<void>}
 */
async function writeApmDataBurrito(rootDir, orgWorkflowStepCount) {
  const apmRoot = path.join(rootDir, 'apmdata');
  const projectRoot = path.join(apmRoot, PROJECT_FOLDER);
  const dataDir = path.join(projectRoot, 'data');
  await fs.mkdir(dataDir, { recursive: true });

  const { sections, passages } = buildPlanStructure();
  const orgWorkflowSteps = buildOrgWorkflowSteps(orgWorkflowStepCount);
  const scope = { [BOOK]: [] };

  /**
   * @param {string} fileName
   * @param {unknown} data
   * @returns {Promise<void>}
   */
  const writeTable = async (fileName, data) => {
    await fs.writeFile(
      path.join(dataDir, fileName),
      JSON.stringify({ data }, null, 2)
    );
  };

  await writeTable('F_sections.json', sections);
  await writeTable('G_passages.json', passages);
  await writeTable('C_orgworkflowsteps.json', orgWorkflowSteps);
  await writeTable('E_plans.json', [
    {
      type: 'plans',
      id: PLAN_ID,
      attributes: {
        name: 'Ruth Audio',
        slug: 'ruth-audio',
        flat: false,
        sectionCount: sections.length,
        'date-created': '2025-01-01T00:00:00.000Z',
        'date-updated': '2025-01-01T00:00:00.000Z',
      },
      relationships: {
        project: { data: { type: 'project', id: 'project-export-1' } },
        sections: {
          data: sections.map((section) => ({
            type: 'section',
            id: section.id,
          })),
        },
      },
    },
  ]);

  const ingredients = {};
  for (const fileName of [
    'F_sections.json',
    'G_passages.json',
    'C_orgworkflowsteps.json',
    'E_plans.json',
  ]) {
    const rel = `${PROJECT_FOLDER}/data/${fileName}`;
    const abs = path.join(projectRoot, 'data', fileName);
    const size = fsSync.statSync(abs).size;
    ingredients[rel] = {
      checksum: { md5: '0'.repeat(32) },
      mimeType: 'application/json',
      size,
      scope,
    };
  }

  await fs.writeFile(
    path.join(apmRoot, 'metadata.json'),
    JSON.stringify(
      {
        format: 'burrito',
        meta: {
          version: '0.3',
          category: 'scripture',
          generator: {
            softwareName: 'apm',
            softwareVersion: '1',
            userName: 't',
          },
          defaultLocale: 'en',
          dateCreated: '2025-01-01T00:00:00.000Z',
        },
        identification: { name: { en: 'ApmData Fixture' } },
        languages: [{ tag: 'und', name: { en: 'Unknown' } }],
        type: {
          flavorType: {
            name: 'scripture',
            flavor: { name: 'x-apmdata' },
            currentScope: scope,
          },
        },
        ingredients,
      },
      null,
      2
    )
  );
}

/**
 * ApmData burrito whose table files are not valid JSON (conversion should fall back).
 * @param {string} rootDir
 * @returns {Promise<void>}
 */
// async function writeMalformedApmDataBurrito(rootDir) {
//   const apmRoot = path.join(rootDir, 'apmdata');
//   const projectRoot = path.join(apmRoot, PROJECT_FOLDER);
//   const dataDir = path.join(projectRoot, 'data');
//   await fs.mkdir(dataDir, { recursive: true });

//   const scope = { [BOOK]: [] };
//   const tableFiles = [
//     'F_sections.json',
//     'G_passages.json',
//     'C_orgworkflowsteps.json',
//     'E_plans.json',
//   ];

//   for (const fileName of tableFiles) {
//     await fs.writeFile(path.join(dataDir, fileName), '{not valid json');
//   }

//   const ingredients = {};
//   for (const fileName of tableFiles) {
//     const rel = `${PROJECT_FOLDER}/data/${fileName}`;
//     const abs = path.join(projectRoot, 'data', fileName);
//     const size = fsSync.statSync(abs).size;
//     ingredients[rel] = {
//       checksum: { md5: '0'.repeat(32) },
//       mimeType: 'application/json',
//       size,
//       scope,
//     };
//   }

//   await fs.writeFile(
//     path.join(apmRoot, 'metadata.json'),
//     JSON.stringify(
//       {
//         format: 'burrito',
//         meta: {
//           version: '0.3',
//           category: 'scripture',
//           generator: {
//             softwareName: 'apm',
//             softwareVersion: '1',
//             userName: 't',
//           },
//           defaultLocale: 'en',
//           dateCreated: '2025-01-01T00:00:00.000Z',
//         },
//         identification: { name: { en: 'Malformed ApmData Fixture' } },
//         languages: [{ tag: 'und', name: { en: 'Unknown' } }],
//         type: {
//           flavorType: {
//             name: 'scripture',
//             flavor: { name: 'x-apmdata' },
//             currentScope: scope,
//           },
//         },
//         ingredients,
//       },
//       null,
//       2
//     )
//   );
// }

/**
 * @param {string} rootDir
 * @returns {Promise<void>}
 */
async function writeAudioBurrito(rootDir) {
  const audioRoot = path.join(rootDir, 'audio');
  const ingredientsDir = path.join(audioRoot, 'ingredients');
  await fs.mkdir(ingredientsDir, { recursive: true });
  const audioName = 'rut-1-5.wav';
  const audioPath = path.join(ingredientsDir, audioName);
  await fs.writeFile(audioPath, tinyWavBytes());

  const ingredients = {
    [`ingredients/${audioName}`]: {
      checksum: { md5: '0'.repeat(32) },
      mimeType: 'audio/wav',
      size: tinyWavBytes().length,
      scope: { [BOOK]: ['1:1-5'] },
    },
  };

  await fs.writeFile(
    path.join(audioRoot, 'metadata.json'),
    JSON.stringify(
      {
        format: 'burrito',
        meta: {
          version: '0.3',
          category: 'scripture',
          generator: {
            softwareName: 'apm',
            softwareVersion: '1',
            userName: 't',
          },
          defaultLocale: 'en',
          dateCreated: '2025-01-01T00:00:00.000Z',
        },
        identification: {
          name: { en: 'Audio Fixture' },
          abbreviation: { en: 'RUT' },
        },
        languages: [{ tag: 'und', name: { en: 'Unknown' } }],
        localizedNames: {
          'book-rut': { long: { en: 'Ruth' }, short: { en: 'Rut' } },
        },
        type: {
          flavorType: {
            name: 'scripture',
            flavor: { name: 'audioTranslation' },
            currentScope: { [BOOK]: [] },
          },
        },
        ingredients,
      },
      null,
      2
    )
  );
}

/**
 * @param {string} ptfPath
 * @param {string} tableFile
 * @returns {unknown}
 */
function readPtfTable(ptfPath, tableFile) {
  const zip = new AdmZip(ptfPath);
  const entry = zip.getEntry(`data/${tableFile}`);
  assert.ok(entry, `missing data/${tableFile} in ${ptfPath}`);
  return JSON.parse(entry.getData().toString('utf-8'));
}

/**
 * @param {number} orgWorkflowStepCount
 * @param {(ptfPath: string) => void | Promise<void>} run
 * @returns {Promise<void>}
 */
async function withFixture(orgWorkflowStepCount, run) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'burrito-ptf-'));
  const outputDir = path.join(rootDir, 'out');
  await fs.mkdir(outputDir, { recursive: true });
  try {
    await writeAudioBurrito(rootDir);
    await writeApmDataBurrito(rootDir, orgWorkflowStepCount);
    await transformBurritoToPTF({
      input: rootDir,
      output: outputDir,
      book: BOOK,
      optionsJson: '{}',
      jsonResult: true,
    });
    const files = await fs.readdir(outputDir);
    const ptfFile = files.find((f) => f.endsWith('.ptf'));
    assert.ok(ptfFile, 'expected a .ptf file');
    const ptfPath = path.join(outputDir, ptfFile);
    await run(ptfPath);
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

test('burrito import uses org workflow steps from ApmData instead of the migration sample', async () => {
  const exportedStepCount = 12;
  await withFixture(exportedStepCount, (ptfPath) => {
    const table = readPtfTable(ptfPath, 'C_orgworkflowsteps.json');
    assert.equal(
      table.data.length,
      exportedStepCount,
      'org workflow step count should match ApmData export'
    );
    const names = table.data.map((step) => step.attributes?.name);
    assert.ok(
      names.includes('APMImportWF_01'),
      'expected exported workflow step names in PTF'
    );
    assert.ok(
      !names.includes('MarkVerses'),
      'should not use hardcoded sample org workflow steps when ApmData is present'
    );
  });
});

test('burrito import preserves empty sections from ApmData', async () => {
  await withFixture(12, (ptfPath) => {
    const table = readPtfTable(ptfPath, 'F_sections.json');
    assert.equal(table.data.length, 3, 'all exported sections should import');
    const names = table.data.map((section) => section.attributes?.name);
    assert.ok(names.includes('Empty Publishing Row A'));
    assert.ok(names.includes('Empty Publishing Row B'));
    assert.ok(names.includes('Audio Section'));
  });
});

test('burrito import preserves publishing rows from ApmData', async () => {
  await withFixture(12, (ptfPath) => {
    const table = readPtfTable(ptfPath, 'G_passages.json');
    const references = table.data.map(
      (passage) => passage.attributes?.reference
    );
    assert.ok(references.includes('Movement 01'), 'movement publishing row');
    assert.ok(references.includes('1'), 'chapter number publishing row');
    assert.ok(references.includes('Note 1'), 'note publishing row');
    assert.ok(references.includes('1:1-5'), 'audio passage row');
  });
});

const LUK_BOOK = 'LUK';

/**
 * USFM modeled on TT-7306 Luke 1:1-14 source-project transcription layout.
 * @returns {string}
 */
function lukeChapter1Usfm() {
  return [
    '\\id LUK',
    '\\c 1',
    '\\p',
    '\\v 1 To Theophilus: Many have tried to give a history of the things that happened among us.',
    '\\v 2 They have written the same things that we learned from others the people who saw those things from the beginning and served God by telling people his message.',
    '\\v 3 I myself studied everything carefully from the beginning, your Excellency. I thought I should write it out for you. So I put it in order in a book.',
    '\\v 4 I write these things so that you can know that what you have been taught is true.',
    '\\v 5',
    '\\v 6',
    '\\v 7',
    '\\v 8',
    '\\v 9',
    '\\v 10',
    '\\v 11',
    '\\v 12',
    '\\v 13',
    '\\v 14',
  ].join('\n');
}

/**
 * @param {string} rootDir
 */
async function writeLukeTextBurrito(rootDir) {
  const textRoot = path.join(rootDir, 'text');
  await fs.mkdir(textRoot, { recursive: true });
  const usfmName = 'LUKv1.usfm';
  const usfmContent = lukeChapter1Usfm();
  await fs.writeFile(path.join(textRoot, usfmName), usfmContent);

  const ingredients = {
    [usfmName]: {
      checksum: { md5: '0'.repeat(32) },
      mimeType: 'text/usfm',
      size: Buffer.byteLength(usfmContent, 'utf-8'),
      scope: { [LUK_BOOK]: ['1'] },
    },
  };

  await fs.writeFile(
    path.join(textRoot, 'metadata.json'),
    JSON.stringify(
      {
        format: 'burrito',
        meta: {
          version: '0.3',
          category: 'scripture',
          generator: {
            softwareName: 'apm',
            softwareVersion: '1',
            userName: 't',
          },
          defaultLocale: 'en',
          dateCreated: '2025-01-01T00:00:00.000Z',
        },
        identification: {
          name: { en: 'Luke Text' },
          abbreviation: { en: 'LUK' },
        },
        languages: [{ tag: 'und', name: { en: 'Unknown' } }],
        type: {
          flavorType: {
            name: 'scripture',
            flavor: { name: 'textTranslation' },
            currentScope: { [LUK_BOOK]: ['1'] },
          },
        },
        ingredients,
      },
      null,
      2
    )
  );
}

/**
 * @param {string} rootDir
 */
async function writeLukeAudioBurrito(rootDir) {
  const audioRoot = path.join(rootDir, 'audio');
  const ingredientsDir = path.join(audioRoot, 'ingredients');
  await fs.mkdir(ingredientsDir, { recursive: true });
  const audioName = 'luk-1-14.wav';
  const audioPath = path.join(ingredientsDir, audioName);
  await fs.writeFile(audioPath, tinyWavBytes());

  const ingredients = {
    [`ingredients/${audioName}`]: {
      checksum: { md5: '0'.repeat(32) },
      mimeType: 'audio/wav',
      size: tinyWavBytes().length,
      scope: { [LUK_BOOK]: ['1:1-14'] },
    },
  };

  await fs.writeFile(
    path.join(audioRoot, 'metadata.json'),
    JSON.stringify(
      {
        format: 'burrito',
        meta: {
          version: '0.3',
          category: 'scripture',
          generator: {
            softwareName: 'apm',
            softwareVersion: '1',
            userName: 't',
          },
          defaultLocale: 'en',
          dateCreated: '2025-01-01T00:00:00.000Z',
        },
        identification: {
          name: { en: 'Luke Audio' },
          abbreviation: { en: 'LUK' },
        },
        languages: [{ tag: 'und', name: { en: 'Unknown' } }],
        localizedNames: {
          'book-luk': { long: { en: 'Luke' }, short: { en: 'Luk' } },
        },
        type: {
          flavorType: {
            name: 'scripture',
            flavor: { name: 'audioTranslation' },
            currentScope: { [LUK_BOOK]: [] },
          },
        },
        ingredients,
      },
      null,
      2
    )
  );
}

/**
 * @param {(ptfPath: string) => void | Promise<void>} run
 */
async function withTranscriptionFixture(run) {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'burrito-ptf-'));
  const outputDir = path.join(rootDir, 'out');
  await fs.mkdir(outputDir, { recursive: true });
  try {
    await writeLukeAudioBurrito(rootDir);
    await writeLukeTextBurrito(rootDir);
    await transformBurritoToPTF({
      input: rootDir,
      output: outputDir,
      book: LUK_BOOK,
      optionsJson: JSON.stringify({
        include: { audio: true, transcription: true },
      }),
      jsonResult: true,
    });
    const files = await fs.readdir(outputDir);
    const ptfFile = files.find((f) => f.endsWith('.ptf'));
    assert.ok(ptfFile, 'expected a .ptf file');
    const table = readPtfTable(
      path.join(outputDir, ptfFile),
      'C_orgworkflowsteps.json'
    );
    const names = table.data.map((step) => step.attributes?.name);
    assert.ok(
      names.includes('MarkVerses'),
      'malformed ApmData should fall back to migration sample workflow steps'
    );
    assert.ok(ptfFile, 'expected a .ptf file');
    await run(path.join(outputDir, ptfFile));
  } finally {
    await fs.rm(rootDir, { recursive: true, force: true });
  }
}

test('TT-7306: burrito import preserves verse tags and line breaks in transcription', async () => {
  await withTranscriptionFixture((ptfPath) => {
    const table = readPtfTable(ptfPath, 'H_mediafiles.json');
    assert.ok(table.data.length >= 1, 'expected at least one mediafile');
    const transcription = table.data[0].attributes?.transcription ?? '';

    assert.match(
      transcription,
      /\\v\s+1\s+To Theophilus/,
      'verse markers should remain \\v tags, not plain numbers'
    );
    assert.match(
      transcription,
      /\\v\s+2\s+They have written/,
      'each verse should keep its \\v marker'
    );
    assert.ok(
      transcription.includes('\n'),
      'transcription should preserve line breaks between verses'
    );
    assert.doesNotMatch(
      transcription,
      /^1 To Theophilus/m,
      'should not strip \\v markers to bare verse numbers'
    );
  });
});
