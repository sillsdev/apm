/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Scripture Burrito Audio Metadata Generator
 *
 * This script creates a Scripture Burrito compliant `metadata.json`
 * in each language subfolder under `migration-data/audio`.
 *
 * Usage: node 04-generate-audio-burrito.js
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { DateTime } = require('luxon');
const { getLangTag } = require('mui-language-picker');

const MIGRATION_PACKAGE = require('./package.json');

const AUDIO_ROOT = path.join(__dirname, 'migration-data', 'audio');
const AUDIO_METADATA_FILE = path.join(__dirname, 'migration-data', 'audio-metadata.json');
const LANGUAGES_FILE = path.join(__dirname, 'migration-data', 'languages.json');
const CODE3_2_FILE = path.join(__dirname, 'CODE3-2.txt');
const OUTPUT_FILENAME = 'metadata.json';

const MIME_AUDIO_MPEG = 'audio/mpeg';
const DEFAULT_SCOPE = {};

async function readJson(filePath) {
  const data = await fsp.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

async function loadCodeMap() {
  const raw = await fsp.readFile(CODE3_2_FILE, 'utf-8');
  return raw
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('\t'))
    .reduce((acc, [code3, bcp47]) => {
      if (code3 && bcp47) {
        acc.set(code3, bcp47);
      }
      return acc;
    }, new Map());
}

function getLanguageRecord(languageName, languages) {
  return languages.find((lang) => lang.name === languageName);
}

function getBcp47ForLanguage(languageRecord, codeMap) {
  if (!languageRecord?.url) {
    return 'und';
  }
  const code = languageRecord.url.split('/').pop();
  if (!code) {
    return 'und';
  }
  return codeMap.get(code) ?? code;
}

function buildIdentification(languageName) {
  const abbrev = languageName
    .split(/\s+/)
    .map((word) => word.charAt(0))
    .join('')
    .substring(0, 8)
    .toUpperCase();

  return {
    name: {
      en: `${languageName} OneStory Audio`,
    },
    description: {
      en: `OneStory Bible stories in ${languageName}`,
    },
    abbreviation: {
      en: abbrev || languageName.substring(0, 8).toUpperCase(),
    },
    primary: {
      apm: {
        [crypto.randomBytes(8).toString('hex')]: {
          revision: '1',
          timestamp: DateTime.utc().toISO(),
        },
      },
    },
  };
}

function buildMeta(nowIso, languageName) {
  return {
    version: '1.0.0',
    category: 'source',
    generator: {
      softwareName: 'APM Migration Toolkit',
      softwareVersion: MIGRATION_PACKAGE.version ?? '1.0.0',
      userName: 'Migration Script',
    },
    defaultLocale: 'en',
    dateCreated: nowIso,
    comments: [
      `Generated from OneStory migration data for ${languageName}`,
      `Executed on ${nowIso}`,
    ],
  };
}

function buildLanguagesSection(bcp47, languageName) {
  const langTag = getLangTag(bcp47);
  const displayName = langTag?.name ?? languageName;
  const localizedName = langTag?.autonym ?? displayName;

  return [
    {
      tag: bcp47,
      name: {
        en: displayName,
        [bcp47]: localizedName,
      },
    },
  ];
}

function buildTypeSection(audioCount) {
  return {
    flavorType: {
      name: 'scripture',
      flavor: {
        name: 'audioTranslation',
        performance: audioCount > 1 ? ['multipleVoice'] : ['singleVoice'],
        formats: {
          format1: {
            compression: 'mp3',
          },
        },
      },
      currentScope: DEFAULT_SCOPE,
    },
  };
}

function buildAgenciesSection() {
  return [
    {
      id: 'apm::onestory',
      roles: ['content', 'publication', 'management'],
      url: 'https://www.onestory.org',
      name: {
        en: 'OneStory Partnership',
      },
      abbr: {
        en: 'OneStory',
      },
    },
    {
      id: 'apm::apm',
      roles: ['rightsHolder'],
      url: 'https://www.audioprojectmanager.org',
      name: {
        en: 'Audio Project Manager',
      },
      abbr: {
        en: 'APM',
      },
    },
  ];
}

function buildCopyrightSection(nowIso) {
  const year = DateTime.fromISO(nowIso).toUTC().year;
  return {
    shortStatements: [
      {
        statement: `<p>&copy; ${year}, OneStory Partnership. All rights reserved.</p>`,
        mimetype: 'text/html',
        lang: 'en',
      },
    ],
  };
}

async function calculateMd5(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('error', (err) => reject(err));
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function buildIngredients(languageDir, audioEntries) {
  const ingredients = {};
  for (const audio of audioEntries) {
    const filename = path.basename(audio.filepath);
    const absolutePath = path.join(languageDir, filename);

    try {
      const stat = await fsp.stat(absolutePath);
      if (!stat.isFile()) {
        console.warn(`Skipping non-file entry: ${absolutePath}`);
        continue;
      }

      const md5 = await calculateMd5(absolutePath);
      const key = `audio/${filename}`;

      ingredients[key] = {
        checksum: {
          md5,
        },
        mimeType: MIME_AUDIO_MPEG,
        size: stat.size,
        role: ['sourceAudio'],
      };
    } catch (err) {
      console.error(
        `Unable to process audio file ${absolutePath}: ${err.message}`
      );
    }
  }

  return ingredients;
}

async function generateScriptureBurritoMetadata() {
  console.log('Generating Scripture Burrito metadata files...');

  const [languages, audioMetadata, codeMap] = await Promise.all([
    readJson(LANGUAGES_FILE),
    readJson(AUDIO_METADATA_FILE),
    loadCodeMap(),
  ]);

  const metadataByLanguage = audioMetadata.reduce((acc, entry) => {
    if (!acc.has(entry.language)) {
      acc.set(entry.language, []);
    }
    acc.get(entry.language).push(entry);
    return acc;
  }, new Map());

  const dirEntries = await fsp.readdir(AUDIO_ROOT, { withFileTypes: true });
  let processedCount = 0;

  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) {
      continue;
    }

    const languageName = dirEntry.name;
    const languageDir = path.join(AUDIO_ROOT, languageName);
    const audioEntries = [...(metadataByLanguage.get(languageName) ?? [])].sort(
      (a, b) => a.filepath.localeCompare(b.filepath)
    );

    if (audioEntries.length === 0) {
      console.warn(`Skipping ${languageName} (no audio metadata entries found)`);
      continue;
    }

    console.log(`Processing ${languageName} (${audioEntries.length} files)...`);
    const languageRecord = getLanguageRecord(languageName, languages);
    const bcp47 = getBcp47ForLanguage(languageRecord, codeMap);
    const nowIso = DateTime.utc().toISO();

    const metadata = {
      format: 'scripture burrito',
      meta: buildMeta(nowIso, languageName),
      idAuthorities: {
        apm: {
          id: 'https://www.audioprojectmanager.org',
          name: {
            en: 'Audio Project Manager',
          },
        },
      },
      identification: buildIdentification(languageName),
      languages: buildLanguagesSection(bcp47, languageName),
      type: buildTypeSection(audioEntries.length),
      confidential: false,
      agencies: buildAgenciesSection(),
      targetAreas: [],
      localizedNames: {},
      ingredients: await buildIngredients(languageDir, audioEntries),
      copyright: buildCopyrightSection(nowIso),
    };

    const outputPath = path.join(languageDir, OUTPUT_FILENAME);
    await fsp.writeFile(outputPath, JSON.stringify(metadata, null, 2));
    console.log(`  Created ${OUTPUT_FILENAME} in ${languageName}/`);
    processedCount++;
  }

  console.log(`\nCompleted metadata generation for ${processedCount} languages.`);
}

generateScriptureBurritoMetadata().catch((err) => {
  console.error('Failed to generate Scripture Burrito metadata:', err);
  process.exitCode = 1;
});

