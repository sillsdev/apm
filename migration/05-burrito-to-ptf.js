/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Scripture Burrito to APM PTF Transformer
 *
 * This script loads Scripture Burrito zip packages from the
 * `migration-data/burrito` directory, extracts their audio content,
 * and produces PTF files compatible with Audio Project Manager.
 *
 * Usage: node 05-burrito-to-ptf.js
 */

const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const { DateTime } = require('luxon');
const { getLangTag, getRtl } = require('mui-language-picker');

const SAMPLE_ARTIFACT_CATEGORIES = require('./APM_PTF_Sample/data/C_artifactcategorys.json');
const SAMPLE_ARTIFACT_TYPES = require('./APM_PTF_Sample/data/C_artifacttypes.json');
const SAMPLE_PASSAGE_TYPES = require('./APM_PTF_Sample/data/B_passagetypes.json');
const SAMPLE_ORG_WORKFLOW_STEPS = require('./APM_PTF_Sample/data/C_orgworkflowsteps.json');
const SAMPLE_WORKFLOW_STEPS = require('./APM_PTF_Sample/data/B_workflowsteps.json');

const BURRITO_DIR = './migration-data/burrito';
const OUTPUT_DIR = './migration-data/ptf-files';
const VERSE_CATALOG_PATH = path.join(__dirname, 'eng.vrs');

// APM Schema Version
const SCHEMA_VERSION = 10;

let chapterVerseMap = {};

async function loadChapterVerseMap() {
  try {
    const raw = await fs.readFile(VERSE_CATALOG_PATH, 'utf-8');
    return raw.split(/\r?\n/).reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }
      const [bookCode, ...chapterEntries] = trimmed.split(/\s+/);
      if (!bookCode || chapterEntries.length === 0) {
        return acc;
      }
      const normalizedBook = bookCode.toUpperCase();
      acc[normalizedBook] = acc[normalizedBook] ?? {};
      chapterEntries.forEach((entry) => {
        const [chapterStr, verseStr] = entry.split(':');
        const chapterNum = parseInt(chapterStr, 10);
        const verseNum = parseInt(verseStr, 10);
        if (
          Number.isFinite(chapterNum) &&
          chapterNum > 0 &&
          Number.isFinite(verseNum) &&
          verseNum > 0
        ) {
          acc[normalizedBook][chapterNum] = verseNum;
        }
      });
      return acc;
    }, {});
  } catch (err) {
    console.warn(
      `Unable to load eng.vrs verse data: ${err?.message ?? err ?? 'Unknown error'}`
    );
    return {};
  }
}

function formatChapterReference(bookCode, chapterValue) {
  if (!chapterValue && chapterValue !== 0) {
    return '';
  }
  const text = chapterValue.toString().trim();
  if (!text || !bookCode || text.includes(':')) {
    return text;
  }
  if (!/^\d+$/.test(text)) {
    return text;
  }

  const chapterNum = parseInt(text, 10);
  const normalizedBook = bookCode.toUpperCase();
  const endingVerse = chapterVerseMap?.[normalizedBook]?.[chapterNum];

  if (!Number.isFinite(endingVerse)) {
    return text;
  }

  return `${chapterNum}:1-${endingVerse}`;
}

// UUID and ID helpers ---------------------------------------------------------
function generateUUID() {
  let d = new Date().getTime();
  let d2 = (performance && performance.now && performance.now() * 1000) || 0;
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const uuid = generateUUID();
let idCounter = 1;
function generateId() {
  return `${uuid}-${idCounter++}`;
}

function createJsonApiRecord(type, attributes, relationships = {}) {
  return {
    type,
    id: generateId(),
    attributes,
    relationships:
      Object.keys(relationships).length > 0 ? relationships : undefined,
  };
}

function relationshipIdentifier(type, value) {
  if (value && typeof value === 'object' && value.id) {
    const relationshipType =
      value.type && !Array.isArray(value.type) ? value.type : type;
    return {
      type: type ?? relationshipType,
      id: value.id,
    };
  }

  return {
    type,
    id: value ?? null,
  };
}

function createRelationship(type, value = null) {
  if (Array.isArray(value)) {
    return {
      data: value
        .filter((item) => item !== null && item !== undefined)
        .map((item) => relationshipIdentifier(type, item)),
    };
  }

  if (value === undefined || value === null) {
    return { data: null };
  }

  if (value && typeof value === 'object' && value.data) {
    return value;
  }

  return {
    data: relationshipIdentifier(type, value),
  };
}

function toUtcIso(value, fallback) {
  if (!value) {
    return fallback;
  }

  let candidate = DateTime.fromISO(value, { setZone: true });
  if (!candidate.isValid) {
    candidate = DateTime.fromJSDate(new Date(value));
  }

  return candidate.isValid ? candidate.toUTC().toISO() : fallback;
}

// Helpers ---------------------------------------------------------------------
function getLocalizedString(obj, preferredLocale) {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }
  if (preferredLocale && obj[preferredLocale]) {
    return obj[preferredLocale];
  }
  if (obj.en) {
    return obj.en;
  }
  const locales = Object.keys(obj);
  if (locales.length > 0) {
    return obj[locales[0]];
  }
  return undefined;
}

function sanitizeFilename(value, fallback) {
  const base = (value ?? fallback ?? 'output')
    .toString()
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '');
  return base.length > 0 ? base : 'output';
}

function buildBookName(bookCode, localizedNames, preferredLocale) {
  if (!bookCode) {
    return undefined;
  }
  const key = `book-${bookCode.toLowerCase()}`;
  const record = localizedNames?.[key];
  if (!record) {
    return undefined;
  }
  return (
    getLocalizedString(record.short, preferredLocale) ??
    getLocalizedString(record.long, preferredLocale)
  );
}

function buildAudioReference(ingredient, localizedNames, preferredLocale) {
  const scope = ingredient?.scope ?? {};
  const [bookCode, chapters] = Object.entries(scope)[0] ?? [null, []];
  const chapterList = Array.isArray(chapters) ? chapters : [];
  const bookName = buildBookName(bookCode, localizedNames, preferredLocale);
  const formattedChapters = chapterList
    .map((chapter) => formatChapterReference(bookCode, chapter))
    .filter((chapter) => typeof chapter === 'string' && chapter.trim());
  const chapterDisplay =
    formattedChapters.length > 0
      ? formattedChapters.join(', ')
      : chapterList.join(', ');
  const referenceParts = [];
  const titleParts = [];

  // if (bookCode) {
  //   referenceParts.push(bookCode);
  // }
  if (chapterDisplay) {
    referenceParts.push(chapterDisplay);
  }

  if (bookName) {
    titleParts.push(bookName);
  } else if (bookCode) {
    titleParts.push(bookCode);
  }
  if (chapterDisplay) {
    titleParts.push(chapterDisplay);
  }

  return {
    bookCode,
    chapters: chapterList,
    reference: referenceParts.join(' ').trim() || ingredient?._reference || '',
    title: titleParts.join(' ').trim() || ingredient?._title || '',
  };
}

function orderAudioEntries(entries) {
  return entries.sort((a, b) => {
    if (a.reference.bookCode !== b.reference.bookCode) {
      return (a.reference.bookCode ?? '').localeCompare(
        b.reference.bookCode ?? ''
      );
    }
    const aChapter = a.reference.chapters[0] ?? '';
    const bChapter = b.reference.chapters[0] ?? '';
    if (aChapter !== bChapter) {
      return aChapter.localeCompare(bChapter, undefined, {
        numeric: true,
      });
    }
    return a.filename.localeCompare(b.filename);
  });
}

function normalizePathKey(value) {
  if (!value) {
    return '';
  }
  return value
    .toString()
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '');
}

function toSeconds(timestamp) {
  if (timestamp === null || timestamp === undefined) {
    return null;
  }
  if (typeof timestamp === 'number') {
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const value = timestamp.toString().trim();
  if (!value) {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }
  const parts = value.split(':');
  if (parts.length < 2) {
    return null;
  }
  const secondsPart = parts.pop();
  const minutesPart = parts.pop();
  const hoursPart = parts.pop() ?? '0';
  const seconds = parseFloat(secondsPart ?? '0');
  const minutes = parseInt(minutesPart ?? '0', 10);
  const hours = parseInt(hoursPart ?? '0', 10);
  if ([seconds, minutes, hours].some((part) => Number.isNaN(part))) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

function parseTimecodeRange(value) {
  if (!value && value !== 0) {
    return null;
  }
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined || candidate === null) {
    return null;
  }

  if (typeof candidate === 'string') {
    const [startRaw, endRaw] = candidate.split(/\s*-->\s*/);
    if (!startRaw || !endRaw) {
      return null;
    }
    const start = toSeconds(startRaw);
    const end = toSeconds(endRaw);
    if (start === null || end === null || end <= start) {
      return null;
    }
    return { start, end };
  }

  if (typeof candidate === 'object') {
    const startValue =
      candidate.start ?? candidate.begin ?? candidate.from ?? candidate[0];
    const endValue =
      candidate.end ??
      candidate.stop ??
      candidate.finish ??
      candidate.to ??
      candidate[1];
    const start = toSeconds(startValue);
    const end = toSeconds(endValue);
    if (start === null || end === null || end <= start) {
      return null;
    }
    return { start, end };
  }

  return null;
}

function extractReferenceText(record, preferredKeys, skipKey) {
  const candidates =
    preferredKeys.length > 0 ? preferredKeys : Object.keys(record);
  for (const key of candidates) {
    if (!key || key === skipKey) {
      continue;
    }
    const value = record[key];
    if (value === undefined || value === null) {
      continue;
    }
    const candidate = Array.isArray(value)
      ? value.find((item) => typeof item === 'string' && item.trim())
      : value;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
}

function buildRegionLabel(referenceText, fallbackIndex) {
  if (referenceText) {
    const tokens = referenceText.trim().split(/\s+/);
    const candidate = tokens[tokens.length - 1];
    if (candidate) {
      return candidate;
    }
  }
  return fallbackIndex.toString();
}

function buildNamedSegmentsPayload(regions) {
  const normalizedRegions = regions
    .filter(
      (region) =>
        region &&
        Number.isFinite(region.start) &&
        Number.isFinite(region.end) &&
        region.end > region.start
    )
    .map((region) => ({
      start: Number(region.start.toFixed(5)),
      end: Number(region.end.toFixed(5)),
      label: region.label ?? '',
    }));

  if (normalizedRegions.length === 0) {
    return null;
  }

  const regionInfo = JSON.stringify({ regions: normalizedRegions });
  return JSON.stringify([
    { name: 'Verse', regionInfo },
    { name: 'Transcription', regionInfo },
    { name: 'BT', regionInfo },
    { name: 'TRTask', regionInfo: '' },
  ]);
}

function buildUsfmEntryMap(entries, ingredients) {
  const map = new Map();
  if (!Array.isArray(entries) || !ingredients) {
    return map;
  }

  Object.entries(ingredients).forEach(([entryName, ingredient]) => {
    if (!ingredient || ingredient.mimeType !== 'text/usfm') {
      return;
    }
    const scope = ingredient.scope ?? {};
    const zipEntry = entries.find((entry) =>
      normalizePathKey(entry.entryName).endsWith(normalizePathKey(entryName))
    );
    if (!zipEntry) {
      return;
    }
    Object.keys(scope).forEach((bookCode) => {
      if (!bookCode) {
        return;
      }
      const normalizedBook = bookCode.toUpperCase();
      if (!map.has(normalizedBook)) {
        map.set(normalizedBook, {
          entryName,
          zipEntry,
        });
      }
    });
  });

  return map;
}

function createUsfmTextResolver(usfmEntryMap) {
  const cache = new Map();
  return function getUsfmText(bookCode) {
    if (!bookCode) {
      return null;
    }
    const normalizedBook = bookCode.toUpperCase();
    const record = usfmEntryMap.get(normalizedBook);
    if (!record) {
      return null;
    }
    if (!cache.has(record.entryName)) {
      cache.set(
        record.entryName,
        record.zipEntry.getData().toString('utf-8').replace(/\r\n?/g, '\n')
      );
    }
    return cache.get(record.entryName);
  };
}

function resolveTranscriptionFromScope(scope, getUsfmText) {
  if (!scope || typeof scope !== 'object' || !getUsfmText) {
    return '';
  }

  const segments = [];
  for (const [bookCode, ranges] of Object.entries(scope)) {
    const usfmText = getUsfmText(bookCode);
    if (!usfmText) {
      continue;
    }
    const normalizedRanges =
      Array.isArray(ranges) && ranges.length > 0 ? ranges : [null];
    normalizedRanges.forEach((rangeToken) => {
      const parsedToken = parseScopeToken(rangeToken);
      if (!parsedToken) {
        return;
      }

      if (parsedToken.chapterRange) {
        for (
          let chapter = parsedToken.chapterRange.start;
          chapter <= parsedToken.chapterRange.end;
          chapter++
        ) {
          const chapterContent = extractChapterText(usfmText, chapter);
          const cleaned = cleanTranscriptionText(chapterContent);
          if (cleaned) {
            segments.push(cleaned);
          }
        }
        return;
      }

      const chapterContent = extractChapterText(usfmText, parsedToken.chapter);
      if (!chapterContent) {
        return;
      }

      if (!parsedToken.startVerse) {
        const cleaned = cleanTranscriptionText(chapterContent);
        if (cleaned) {
          segments.push(cleaned);
        }
        return;
      }

      const verseContent = extractVerseRange(
        chapterContent,
        parsedToken.startVerse,
        parsedToken.endVerse
      );
      const cleaned = cleanTranscriptionText(verseContent);
      if (cleaned) {
        segments.push(cleaned);
      }
    });
  }

  return segments.join('\n\n').replace(/\s+\n/g, '\n').trim();
}

function parseScopeToken(token) {
  if (token === null || token === undefined) {
    return null;
  }

  if (typeof token === 'object') {
    const chapter = parseInt(token.chapter ?? token.c ?? '', 10);
    if (!Number.isFinite(chapter)) {
      return null;
    }
    const startVerse = parseInt(token.startVerse ?? token.v ?? '', 10);
    const endVerse = parseInt(token.endVerse ?? token.end ?? '', 10);
    const normalizedStartVerse = Number.isFinite(startVerse)
      ? startVerse
      : null;
    const normalizedEndVerse = Number.isFinite(endVerse)
      ? endVerse
      : normalizedStartVerse;
    return {
      chapter,
      startVerse: normalizedStartVerse,
      endVerse: normalizedEndVerse,
    };
  }

  const text = token.toString().trim();
  if (!text) {
    return null;
  }

  const [chapterPart, versePart] = text.split(':');
  if (!chapterPart) {
    return null;
  }

  if (!versePart && chapterPart.includes('-')) {
    const [startChapterStr, endChapterStr] = chapterPart.split('-');
    const startChapter = parseInt(startChapterStr, 10);
    const endChapter = parseInt(endChapterStr, 10);
    if (Number.isFinite(startChapter)) {
      return {
        chapterRange: {
          start: startChapter,
          end: Number.isFinite(endChapter) ? endChapter : startChapter,
        },
      };
    }
    return null;
  }

  const chapter = parseInt(chapterPart, 10);
  if (!Number.isFinite(chapter)) {
    return null;
  }

  if (!versePart) {
    return {
      chapter,
      startVerse: null,
      endVerse: null,
    };
  }

  const [startVersePart, endVersePart] = versePart.split('-');
  const startVerse = parseInt(startVersePart, 10);
  const endVerse = parseInt(endVersePart, 10);

  if (!Number.isFinite(startVerse)) {
    return {
      chapter,
      startVerse: null,
      endVerse: null,
    };
  }

  return {
    chapter,
    startVerse,
    endVerse: Number.isFinite(endVerse) ? endVerse : startVerse,
  };
}

function extractChapterText(usfmText, chapterNumber) {
  if (!usfmText || !Number.isFinite(chapterNumber)) {
    return '';
  }

  const text = usfmText;
  const chapterPattern = new RegExp(
    `(?:^|\\n)\\\\c\\s+${chapterNumber}\\b`,
    'g'
  );
  const match = chapterPattern.exec(text);
  if (!match) {
    return '';
  }

  const startIndex = match.index + match[0].length;
  const nextChapterPattern = /\n\\c\s+\d+\b/g;
  nextChapterPattern.lastIndex = startIndex;
  const nextMatch = nextChapterPattern.exec(text);
  const endIndex = nextMatch ? nextMatch.index : text.length;

  return text.slice(startIndex, endIndex).trim();
}

function extractVerseRange(chapterContent, startVerse, endVerse) {
  if (!chapterContent || !Number.isFinite(startVerse)) {
    return '';
  }

  const limit = Number.isFinite(endVerse) ? endVerse : startVerse;
  const versePattern =
    /\\v\s+([\d]+[a-z]?)[^\S\r\n]?([\s\S]*?)(?=\\v\s+[\d]+[a-z]?|$)/gi;
  let result = '';
  let match;
  while ((match = versePattern.exec(chapterContent)) !== null) {
    const verseNumber = parseInt(match[1], 10);
    if (!Number.isFinite(verseNumber)) {
      continue;
    }
    if (verseNumber < startVerse) {
      continue;
    }
    if (verseNumber > limit) {
      break;
    }
    result += match[0];
  }

  return result.trim() || chapterContent.trim();
}

function cleanTranscriptionText(input) {
  if (!input) {
    return '';
  }

  let text = input
    .replace(/\\f\s+.*?\\f\*/gis, ' ')
    .replace(/\\x\s+.*?\\x\*/gis, ' ')
    .replace(/\\[a-z0-9]+\*/gi, ' ')
    .replace(/\\c\s+\d+[^\n]*\n?/gi, ' ')
    .replace(/\\v\s+(\d+)/gi, '$1 ')
    .replace(/\\[a-z0-9]+\s*/gi, ' ');

  return text.replace(/\s+/g, ' ').trim();
}

function extractSegmentsFromAlignment(alignmentJson) {
  const result = {};
  if (!alignmentJson || typeof alignmentJson !== 'object') {
    return result;
  }

  const records = Array.isArray(alignmentJson.records)
    ? alignmentJson.records
    : [];
  if (records.length === 0) {
    return result;
  }

  const documents = alignmentJson.documents ?? {};
  const documentEntries = Object.entries(documents).filter(
    ([, doc]) => doc && typeof (doc.docid ?? doc.docId) === 'string'
  );
  if (documentEntries.length === 0) {
    return result;
  }

  const referenceKeys = Object.entries(documents)
    .filter(([, doc]) => !doc || (doc.docid ?? doc.docId) === undefined)
    .map(([key]) => key);

  for (const [docKey, docInfo] of documentEntries) {
    const docId = docInfo.docid ?? docInfo.docId;
    if (!docId) {
      continue;
    }

    const regions = [];
    records.forEach((record, index) => {
      if (!record || typeof record !== 'object') {
        return;
      }
      const timeRange = parseTimecodeRange(record[docKey]);
      if (!timeRange) {
        return;
      }
      const referenceText = extractReferenceText(record, referenceKeys, docKey);
      regions.push({
        start: timeRange.start,
        end: timeRange.end,
        label: buildRegionLabel(referenceText, index),
      });
    });

    const segmentsPayload = buildNamedSegmentsPayload(regions);
    if (segmentsPayload) {
      result[docId] = segmentsPayload;
    }
  }

  return result;
}

function addSegmentVariants(target, docId, payload) {
  if (!docId || !payload) {
    return;
  }
  const normalized = normalizePathKey(docId);
  const baseName = path.basename(normalized);
  const variants = new Set([
    normalized,
    docId,
    baseName,
    `media/${baseName}`,
    baseName ? `./${baseName}` : '',
  ]);

  variants.forEach((variant) => {
    const key = normalizePathKey(variant);
    if (key && !target[key]) {
      target[key] = payload;
    }
  });
}

function buildTimingSegmentMap(zipEntries, ingredients) {
  const timingSegments = {};
  const allEntries = zipEntries ?? [];

  for (const [key, ingredient] of Object.entries(ingredients ?? {})) {
    if ((ingredient?.role ?? '').toLowerCase() !== 'timing') {
      continue;
    }

    const entry =
      allEntries.find((zipEntry) => zipEntry.entryName === key) ||
      allEntries.find((zipEntry) => zipEntry.entryName.endsWith(key));

    if (!entry) {
      console.warn(
        `  Timing file ${key} referenced in metadata was not found in zip`
      );
      continue;
    }

    let alignmentJson;
    try {
      alignmentJson = JSON.parse(entry.getData().toString('utf-8'));
    } catch (err) {
      console.warn(
        `  Failed to parse alignment file ${key}: ${err.message ?? err}`
      );
      continue;
    }

    const segmentsByDoc = extractSegmentsFromAlignment(alignmentJson);
    Object.entries(segmentsByDoc).forEach(([docId, payload]) => {
      addSegmentVariants(timingSegments, docId, payload);
    });
  }

  return timingSegments;
}

function resolveSegmentsForAudio(timingSegments, audioEntry) {
  if (!timingSegments || !audioEntry) {
    return '{}';
  }

  const filename = audioEntry.filename ?? '';
  const normalizedKey = normalizePathKey(audioEntry.key);
  const baseName = path.basename(filename || normalizedKey || '');

  const candidates = [
    normalizedKey,
    filename,
    baseName,
    `media/${baseName}`,
    normalizePathKey(`media/${filename}`),
  ]
    .filter(Boolean)
    .map((candidate) => normalizePathKey(candidate));

  for (const candidate of candidates) {
    if (candidate && timingSegments[candidate]) {
      return timingSegments[candidate];
    }
  }

  return '{}';
}

// Main transformation ---------------------------------------------------------
async function transformBurritoToPTF() {
  console.log('Starting Scripture Burrito to PTF transformation...');

  chapterVerseMap = await loadChapterVerseMap();
  const now = DateTime.utc().toISO();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const dirEntries = await fs.readdir(BURRITO_DIR, { withFileTypes: true });

  const zipFiles = dirEntries
    .filter(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip')
    )
    .map((entry) => entry.name);

  if (zipFiles.length === 0) {
    console.warn('No Scripture Burrito zip archives found.');
    return;
  }

  let ptfCount = 0;

  for (const zipFile of zipFiles) {
    const zipPath = path.join(BURRITO_DIR, zipFile);
    console.log(`\nProcessing ${zipFile}...`);

    let burritoZip;
    try {
      burritoZip = new AdmZip(zipPath);
    } catch (err) {
      console.error(`  Unable to open ${zipFile}: ${err.message}`);
      continue;
    }

    const entries = burritoZip.getEntries();
    const metadataEntry = entries.find(
      (entry) =>
        !entry.isDirectory &&
        entry.entryName.toLowerCase().endsWith('metadata.json')
    );

    if (!metadataEntry) {
      console.warn(`  Skipping ${zipFile} (metadata.json not found)`);
      continue;
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataEntry.getData().toString('utf-8'));
    } catch (err) {
      console.error(
        `  Failed to parse metadata.json in ${zipFile}: ${err.message}`
      );
      continue;
    }

    const usfmEntryMap = buildUsfmEntryMap(entries, metadata.ingredients ?? {});
    const getUsfmText = createUsfmTextResolver(usfmEntryMap);

    const languageInfo = metadata.languages?.[0] ?? {};
    const defaultLocale = metadata.meta?.defaultLocale ?? 'en';
    const languageTag = languageInfo.tag ?? 'und';
    const langName =
      getLocalizedString(languageInfo.name, defaultLocale) ??
      languageTag ??
      'Unknown Language';
    const langTag = getLangTag(languageTag);
    const fontFamily = langTag?.defaultFont ?? 'charissil';
    const rtl = getRtl(languageTag);

    const projectName =
      getLocalizedString(metadata.identification?.name, defaultLocale) ??
      `${langName} Audio`;
    const projectDescription =
      getLocalizedString(metadata.identification?.description, defaultLocale) ??
      `Audio content generated from Scripture Burrito ${zipFile}`;
    const planName = `${projectName} Audio`;
    const abbreviation = sanitizeFilename(
      getLocalizedString(metadata.identification?.abbreviation, defaultLocale),
      projectName
    );

    const audioIngredients = Object.entries(metadata.ingredients ?? {}).filter(
      ([, ingredient]) => ingredient?.mimeType?.startsWith('audio/')
    );

    if (audioIngredients.length === 0) {
      console.warn(`  Skipping ${zipFile} (no audio ingredients found)`);
      continue;
    }

    const localizedNames = metadata.localizedNames ?? {};
    const timingSegments = buildTimingSegmentMap(
      entries,
      metadata.ingredients ?? {}
    );
    const audioEntries = [];

    for (const [key, ingredient] of audioIngredients) {
      const zipEntry = entries.find((entry) => entry.entryName.endsWith(key));
      if (!zipEntry) {
        console.warn(
          `  Audio file ${key} referenced in metadata was not found in zip`
        );
        continue;
      }

      const reference = buildAudioReference(
        ingredient,
        localizedNames,
        defaultLocale
      );

      audioEntries.push({
        key,
        ingredient,
        zipEntry,
        filename: path.basename(key),
        reference,
      });
    }

    if (audioEntries.length === 0) {
      console.warn(`  Skipping ${zipFile} (no usable audio entries found)`);
      continue;
    }

    orderAudioEntries(audioEntries);

    const exportTimestamp = toUtcIso(metadata.meta?.dateCreated, now);

    const ptfZip = new AdmZip();
    const createdAt = DateTime.utc().toISO();

    ptfZip.addFile('SILTranscriber', Buffer.from(createdAt));
    ptfZip.addFile('Version', Buffer.from(SCHEMA_VERSION.toString()));
    ptfZip.addFile('Offline', Buffer.alloc(0));

    const user = createJsonApiRecord(
      'users',
      {
        name: 'Scripture Burrito Import',
        'given-name': 'Scripture Burrito',
        'family-name': 'Import',
        email: '',
        phone: '',
        locale: 'en',
        timezone: 'UTC',
        'is-locked': false,
        uilanguagebcp47: '',
        'digest-preference': 0,
        'news-preference': false,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        lastModifiedByUser: createRelationship('user', null),
        organizationMemberships: createRelationship(
          'organizationmembership',
          []
        ),
        groupMemberships: createRelationship('groupmembership', []),
      }
    );

    const integrations = [
      'paratext',
      'paratextbacktranslation',
      'paratextwholebacktranslation',
    ].map((name) =>
      createJsonApiRecord('integrations', {
        name,
      })
    );

    const organization = createJsonApiRecord(
      'organizations',
      {
        name: 'Scripture Burrito Imports',
        slug: sanitizeFilename(projectName, 'burrito'),
        'default-params': `{"langProps":{"bcp47":"${languageTag}","languageName":"${langName}","font":"${fontFamily}","rtl":"${rtl}","spellCheck":false}}`,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        lastModifiedByUser: createRelationship('user', user),
        owner: createRelationship('user', user),
        groups: createRelationship('group', []),
      }
    );

    const passageTypes = SAMPLE_PASSAGE_TYPES.data.map((passageType) =>
      createJsonApiRecord('passagetypes', { ...passageType.attributes })
    );

    const planTypes = ['Scripture', 'Other'].map((name) =>
      createJsonApiRecord(
        'plantypes',
        {
          name,
          dateCreated: createdAt,
          dateUpdated: createdAt,
        },
        {
          plans: createRelationship('plan', []),
        }
      )
    );
    const scripturePlanTYpe = planTypes.find(
      (planType) => planType.attributes.name === 'Scripture'
    );

    const projectTypes = ['Generic', 'Scripture'].map((name) =>
      createJsonApiRecord(
        'projecttypes',
        {
          name,
          dateCreated: createdAt,
          dateUpdated: createdAt,
        },
        { projects: createRelationship('project', []) }
      )
    );
    const scriptureProjectType = projectTypes.find(
      (projectType) => projectType.attributes.name === 'Scripture'
    );

    const roles = ['Admin', 'Member'].map((roleName) =>
      createJsonApiRecord('roles', {
        'role-name': roleName,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      })
    );
    const adminRole =
      roles.find(
        (roleResource) => roleResource.attributes['role-name'] === 'Admin'
      ) ?? roles[0];

    const artifactCategories = SAMPLE_ARTIFACT_CATEGORIES.data.map(
      (artifactCategory) =>
        createJsonApiRecord('artifactcategories', {
          ...artifactCategory.attributes,
        })
    );

    const activityStates = [
      'NoWork',
      'Transcribe',
      'Review',
      'Approval',
      'Done',
    ].map((state, idx) =>
      createJsonApiRecord('activitystates', {
        state,
        sequencenum: idx + 1,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      })
    );

    const artifactTypes = SAMPLE_ARTIFACT_TYPES.data.map((artifactType) =>
      createJsonApiRecord('artifacttypes', {
        ...artifactType.attributes,
      })
    );

    const findArtifactTypeByTypename = (typename) => {
      let targetArtifactType = artifactTypes.find(
        (type) => type.attributes.typename === typename
      );

      if (!targetArtifactType) {
        targetArtifactType = createJsonApiRecord('artifacttypes', {
          typename,
        });
        artifactTypes.push(targetArtifactType);
      }

      return targetArtifactType.id;
    };

    const backtranslationArtifactType =
      findArtifactTypeByTypename('backtranslation');
    const wholebacktranslationArtifactType = findArtifactTypeByTypename(
      'wholebacktranslation'
    );
    const retellArtifactType = findArtifactTypeByTypename('retell');
    const getTypeByName = (name) => {
      switch (name) {
        case 'PBTTranscribe':
        case 'PBTParatextSync':
          return backtranslationArtifactType;
        case 'WBTTranscribe':
        case 'WBTParatextSync':
          return wholebacktranslationArtifactType;
        case 'RetellTranscribe':
          return retellArtifactType;
      }
      return null;
    };

    const workflowSteps = SAMPLE_WORKFLOW_STEPS.data.map((step) => {
      const attributes = { ...step.attributes };
      if (attributes.tool) {
        try {
          const toolConfig = JSON.parse(attributes.tool);
          if (
            toolConfig?.settings &&
            Object.prototype.hasOwnProperty.call(
              toolConfig.settings,
              'artifactTypeId'
            )
          ) {
            toolConfig.settings.artifactTypeId = getTypeByName(attributes.name);
          }
          attributes.tool = JSON.stringify(toolConfig);
        } catch (err) {
          console.warn(
            `  Unable to parse workflow tool config: ${err.message}`
          );
        }
      }

      return createJsonApiRecord('workflowsteps', attributes);
    });

    const group = createJsonApiRecord(
      'groups',
      {
        name: `All users of >${user.attributes.name} Personal<`,
        abbreviation: 'all-users',
        allUsers: true,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        lastModifiedByUser: createRelationship('user', user),
        owner: createRelationship('organization', organization),
        groupMemberships: createRelationship('groupmembership', []),
        projects: createRelationship('project', []),
      }
    );
    organization.relationships.groups.data.push(
      relationshipIdentifier('group', group)
    );

    const organizationMembership = createJsonApiRecord(
      'organizationmemberships',
      {
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        user: createRelationship('user', user),
        organization: createRelationship('organization', organization),
        role: createRelationship('role', adminRole),
      }
    );
    user.relationships.organizationMemberships.data.push(
      relationshipIdentifier('organizationmembership', organizationMembership)
    );

    const orgWorkflowSteps = SAMPLE_ORG_WORKFLOW_STEPS.data.map((step) => {
      const attributes = {
        ...step.attributes,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      };
      if (attributes.tool) {
        try {
          const toolConfig = JSON.parse(attributes.tool);
          if (toolConfig?.settings?.artifactTypeId) {
            toolConfig.settings.artifactTypeId = getTypeByName(attributes.name);
          }
          attributes.tool = JSON.stringify(toolConfig);
        } catch (err) {
          console.warn(
            `  Unable to parse org workflow tool config: ${err.message}`
          );
        }
      }

      return createJsonApiRecord('orgworkflowsteps', attributes, {
        lastModifiedByUser: createRelationship('user', user),
        organization: createRelationship('organization', organization),
      });
    });

    const groupMembership = createJsonApiRecord(
      'groupmemberships',
      {
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        user: createRelationship('user', user),
        group: createRelationship('group', group),
      }
    );
    group.relationships.groupMemberships.data.push(
      relationshipIdentifier('groupmembership', groupMembership)
    );
    user.relationships.groupMemberships.data.push(
      relationshipIdentifier('groupmembership', groupMembership)
    );

    const project = createJsonApiRecord(
      'projects',
      {
        name: projectName,
        description: projectDescription,
        language: languageTag,
        languageName: langName,
        isPublic: false,
        rtl,
        spellCheck: false,
        defaultFont: fontFamily,
        defaultFontSize: 'large',
        defaultParams: `{"book":"","story":true,"sectionMap":[]}`,
        allowClaim: false,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        projecttype: createRelationship('projecttype', scriptureProjectType),
        owner: createRelationship('user', user),
        organization: createRelationship('organization', organization),
        group: createRelationship('group', group),
        plans: createRelationship('plan', []),
      }
    );
    group.relationships.projects.data.push(
      relationshipIdentifier('project', project)
    );
    scriptureProjectType.relationships.projects.data.push(
      relationshipIdentifier('project', project)
    );

    const plan = createJsonApiRecord(
      'plans',
      {
        name: planName,
        slug: sanitizeFilename(planName, 'audio-plan'),
        flat: false,
        sectionCount: 1,
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        project: createRelationship('project', project),
        plantype: createRelationship('plantype', scripturePlanTYpe),
        owner: createRelationship('user', user),
        sections: createRelationship('section', []),
        mediafiles: createRelationship('mediafile', []),
      }
    );
    project.relationships.plans.data.push(relationshipIdentifier('plan', plan));
    planTypes.forEach((planType) => {
      if (planType.attributes.name === 'Other') {
        planType.relationships.plans.data.push(
          relationshipIdentifier('plan', plan)
        );
      }
    });

    const section = createJsonApiRecord(
      'sections',
      {
        sequencenum: 1,
        name: 'Audio Content',
        state: '',
        level: 3,
        published: false,
        publishTo: '{}',
        dateCreated: createdAt,
        dateUpdated: createdAt,
      },
      {
        plan: createRelationship('plan', plan),
        passages: createRelationship('passage', []),
      }
    );
    plan.relationships.sections.data.push(
      relationshipIdentifier('section', section)
    );

    const passages = [];
    const mediafiles = [];

    audioEntries.forEach((audioEntry, index) => {
      const audioBuffer = audioEntry.zipEntry.getData();
      const audioFilename = audioEntry.filename;
      const downloadTimestamp = toUtcIso(exportTimestamp, createdAt);
      const referenceTitle = audioEntry.reference.title || `Audio ${index + 1}`;
      const referenceLabel =
        audioEntry.reference.reference || `Audio ${index + 1}`;

      const passage = createJsonApiRecord(
        'passages',
        {
          sequencenum: index + 1,
          book: audioEntry.reference.bookCode ?? '',
          reference: referenceLabel,
          title: referenceTitle,
          state: 'noMedia',
          dateCreated: createdAt,
          dateUpdated: createdAt,
          'start-chapter': 0,
          'end-chapter': 0,
          'start-verse': 0,
          'end-verse': 0,
        },
        {
          lastModifiedByUser: createRelationship('user', user),
          section: createRelationship('section', section),
          mediafiles: createRelationship('mediafile', []),
        }
      );

      passages.push(passage);
      section.relationships.passages.data.push(
        relationshipIdentifier('passage', passage)
      );

      const transcription = resolveTranscriptionFromScope(
        audioEntry.ingredient.scope,
        getUsfmText
      );

      const mediafile = createJsonApiRecord(
        'mediafiles',
        {
          versionNumber: 1,
          audioUrl: audioFilename,
          'eaf-url': '',
          'audio-url': `media/${audioFilename}`,
          s3file: '',
          duration: null,
          'content-type': audioEntry.ingredient.mimeType ?? 'audio/mpeg',
          'audio-quality': '',
          'text-quality': '',
          transcription: transcription ?? '',
          originalFile: audioFilename,
          filesize: audioEntry.ingredient.size ?? audioBuffer.length,
          position: 0,
          segments: resolveSegmentsForAudio(timingSegments, audioEntry),
          languagebcp47: languageTag,
          link: false,
          'ready-to-share': false,
          'publish-to': '{}',
          'performed-by': '',
          'source-segments': '{}',
          'source-media-offline-id': '',
          transcriptionstate: '',
          topic: referenceTitle,
          'last-modified-by': -1,
          'resource-passage-id': -1,
          'offline-id': '',
          dateCreated: downloadTimestamp,
          dateUpdated: downloadTimestamp,
        },
        {
          lastModifiedByUser: createRelationship('user', user),
          plan: createRelationship('plan', plan),
          passage: createRelationship('passage', passage),
          recordedbyUser: createRelationship('user', user),
        }
      );

      mediafiles.push(mediafile);
      passage.relationships.mediafiles.data.push(
        relationshipIdentifier('mediafile', mediafile)
      );
      plan.relationships.mediafiles.data.push(
        relationshipIdentifier('mediafile', mediafile)
      );

      ptfZip.addFile(`media/${audioFilename}`, audioBuffer);
    });

    const dataFiles = {
      A_users: { data: [user] },
      B_integrations: { data: integrations },
      B_organizations: { data: [organization] },
      B_passagetypes: { data: passageTypes },
      B_plantypes: { data: planTypes },
      B_projecttypes: { data: projectTypes },
      B_activitystates: { data: activityStates },
      B_roles: { data: roles },
      B_workflowsteps: { data: workflowSteps },
      C_artifactcategorys: { data: artifactCategories },
      C_artifacttypes: { data: artifactTypes },
      C_groups: { data: [group] },
      C_organizationmemberships: { data: [organizationMembership] },
      C_orgworkflowsteps: { data: orgWorkflowSteps },
      D_groupmemberships: { data: [groupMembership] },
      D_projects: { data: [project] },
      E_plans: { data: [plan] },
      F_sections: { data: [section] },
      G_passages: { data: passages },
      H_mediafiles: { data: mediafiles },
    };

    for (const [filename, content] of Object.entries(dataFiles)) {
      ptfZip.addFile(
        `data/${filename}.json`,
        Buffer.from(JSON.stringify(content, null, 2))
      );
    }

    const ptfBaseName = sanitizeFilename(
      `${abbreviation || langName}-burrito`,
      path.basename(zipFile, path.extname(zipFile))
    );
    const ptfFilename = `${ptfBaseName}.ptf`;
    const ptfPath = path.join(OUTPUT_DIR, ptfFilename);

    await fs.writeFile(ptfPath, ptfZip.toBuffer());
    console.log(`  Created: ${ptfFilename}`);
    ptfCount++;
  }

  console.log('\n=== TRANSFORMATION COMPLETE ===');
  console.log(`Created ${ptfCount} PTF file(s) in ${OUTPUT_DIR}/`);
  console.log('\nNext step: Import the PTF files into Audio Project Manager');
  console.log('  1. Open Audio Project Manager');
  console.log('  2. Go to File > Import Project');
  console.log('  3. Select a .ptf file from the output directory');
  console.log('  4. Repeat for each PTF you want to import');
}

transformBurritoToPTF().catch((err) => {
  console.error('Failed to transform Scripture Burrito to PTF:', err);
  process.exitCode = 1;
});
