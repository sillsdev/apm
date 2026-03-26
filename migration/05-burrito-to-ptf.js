/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Scripture Burrito to APM PTF Transformer
 *
 * This script loads Scripture Burrito packages (`.zip` archives or folders
 * containing `metadata.json`) from `migration-data/burrito`, extracts their
 * audio content when flavor is scripture/audioTranslation, and produces PTF
 * files compatible with Audio Project Manager.
 *
 * Usage:
 *   node 05-burrito-to-ptf.js
 *   node 05-burrito-to-ptf.js --input <wrapperDir> --output <outDir> [--book RUT] [--options '{"include":{"transcription":true},"chapters":["1","2","__other__"]}'] [--json-result]
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { pathToFileURL } = require('node:url');
const AdmZip = require('adm-zip');
const { DateTime } = require('luxon');
const { getLangTag, getRtl } = require('mui-language-picker');

const SAMPLE_ARTIFACT_CATEGORIES = require('./APM_PTF_Sample/data/C_artifactcategorys.json');
const SAMPLE_ARTIFACT_TYPES = require('./APM_PTF_Sample/data/C_artifacttypes.json');
const SAMPLE_PASSAGE_TYPES = require('./APM_PTF_Sample/data/B_passagetypes.json');
const SAMPLE_ORG_WORKFLOW_STEPS = require('./APM_PTF_Sample/data/C_orgworkflowsteps.json');
const SAMPLE_WORKFLOW_STEPS = require('./APM_PTF_Sample/data/B_workflowsteps.json');

const SCRIPT_DIR = __dirname;
const DEFAULT_BURRITO_DIR = path.join(SCRIPT_DIR, 'migration-data', 'burrito');
const DEFAULT_OUTPUT_DIR = path.join(SCRIPT_DIR, 'migration-data', 'ptf-files');
const VERSE_CATALOG_PATH = path.join(__dirname, 'eng.vrs');

function parseCliArgs() {
  const args = process.argv.slice(2);
  const defaults = {
    input: DEFAULT_BURRITO_DIR,
    output: DEFAULT_OUTPUT_DIR,
    book: null,
    optionsJson: '{}',
    jsonResult: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      defaults.input = path.resolve(args[++i]);
    } else if (args[i] === '--output' && args[i + 1]) {
      defaults.output = path.resolve(args[++i]);
    } else if (args[i] === '--book' && args[i + 1]) {
      defaults.book = args[++i];
    } else if (args[i] === '--options' && args[i + 1]) {
      defaults.optionsJson = args[++i];
    } else if (args[i] === '--json-result') {
      defaults.jsonResult = true;
    }
  }
  return defaults;
}

/** Must match `BURRITO_CHAPTER_FILTER_OTHER` in parseBurritoMetadata.ts */
const CHAPTER_FILTER_OTHER = '__other__';

/**
 * Collects chapter numbers appearing before `:` in a reference string (e.g. "1:1-4", "1:14-2:20")
 * and whether any segment is non-numeric (maps to `CHAPTER_FILTER_OTHER`).
 */
function extractChapterKeysFromReferenceString(ref) {
  if (ref == null || ref === '') {
    return { numeric: [], hasOther: true };
  }
  const text = String(ref).trim();
  if (!text) {
    return { numeric: [], hasOther: true };
  }
  const numeric = new Set();
  let hasOther = false;
  const colonChapterRe = /(\d+):/g;
  let m;
  while ((m = colonChapterRe.exec(text)) !== null) {
    numeric.add(m[1]);
  }
  for (const segment of text.split(',')) {
    const p = segment.trim();
    if (!p) {
      continue;
    }
    if (!p.includes(':')) {
      if (/^\d+$/.test(p)) {
        numeric.add(p);
      } else if (p) {
        hasOther = true;
      }
      continue;
    }
    const before = p.slice(0, p.indexOf(':')).trim();
    if (!/^\d+$/.test(before)) {
      hasOther = true;
    }
  }
  if (numeric.size === 0 && !hasOther) {
    hasOther = true;
  }
  return { numeric: Array.from(numeric), hasOther };
}

function passageMatchesChapterFilter(referenceStr, selectedChapters) {
  if (!selectedChapters || selectedChapters.length === 0) {
    return true;
  }
  const selected = new Set(selectedChapters);
  const otherSelected = selected.has(CHAPTER_FILTER_OTHER);
  const { numeric, hasOther } =
    extractChapterKeysFromReferenceString(referenceStr);
  if (hasOther && otherSelected) {
    return true;
  }
  for (const n of numeric) {
    if (selected.has(n)) {
      return true;
    }
  }
  if (hasOther && !otherSelected) {
    return false;
  }
  return false;
}

function parseBurritoOptionsJson(raw) {
  try {
    const parsed = JSON.parse(raw || '{}');
    return {
      include: {
        audio:
          parsed.include?.audio !== undefined
            ? Boolean(parsed.include.audio)
            : true,
        transcription:
          parsed.include?.transcription !== undefined
            ? Boolean(parsed.include.transcription)
            : true,
      },
      chapters:
        parsed.chapters === undefined
          ? null
          : Array.isArray(parsed.chapters)
            ? parsed.chapters.map(String)
            : null,
      sister: {
        transcriptionFlavorName:
          parsed.sister?.transcriptionFlavorName ?? 'textTranslation',
      },
    };
  } catch {
    return {
      include: { audio: true, transcription: true },
      chapters: null,
      sister: { transcriptionFlavorName: 'textTranslation' },
    };
  }
}

async function findBurritoPackageByFlavorName(parentDir, flavorName) {
  const packages = await discoverBurritoPackages(parentDir);
  for (const pkg of packages) {
    const metadataEntry = findMetadataBurritoEntry(pkg.entries);
    if (!metadataEntry) {
      continue;
    }
    let metadata;
    try {
      metadata = JSON.parse(metadataEntry.getData().toString('utf-8'));
    } catch {
      continue;
    }
    const { flavorName: fn } = getBurritoFlavor(metadata);
    if (fn === flavorName) {
      return { pkg, metadata };
    }
  }
  return null;
}

// APM Schema Version
const SCHEMA_VERSION = 10;

/** Burrito types this script converts to PTF (see metadata.type.flavorType). */
const BURRITO_PTF_FLAVOR_TYPE = 'scripture';
const BURRITO_PTF_FLAVOR_NAME = 'audioTranslation';

function getBurritoFlavor(metadata) {
  const ft = metadata?.type?.flavorType;
  return {
    flavorTypeName: ft?.name ?? null,
    flavorName: ft?.flavor?.name ?? null,
  };
}

/** Burrito ingredients often omit mimeType; treat these extensions as audio. */
const BURRITO_AUDIO_FILE_EXTENSIONS = new Set([
  '.mp3',
  '.wav',
  '.ogg',
  '.opus',
  '.m4a',
  '.aac',
  '.webm',
  '.flac',
]);

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
      r = ((d + r) % 16) | 0;
      d = Math.floor(d / 16);
    } else {
      r = ((d2 + r) % 16) | 0;
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

function buildUniqueName(baseName, usedNames) {
  const base = String(baseName ?? '').trim();
  const safeBase = base || 'Untitled';
  let candidate = safeBase;
  let idx = 2;
  while (usedNames.has(candidate)) {
    candidate = `${safeBase} (${idx++})`;
  }
  usedNames.add(candidate);
  return candidate;
}

function buildUniqueSlug(baseSlug, usedSlugs) {
  const base = String(baseSlug ?? '').trim();
  const safeBase = base || 'untitled';
  let candidate = safeBase;
  let idx = 2;
  while (usedSlugs.has(candidate)) {
    candidate = `${safeBase}-${idx++}`;
  }
  usedSlugs.add(candidate);
  return candidate;
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
  const scopeEntries = Object.entries(scope).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const [bookCode, chapters] = scopeEntries[0] ?? [null, []];
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

function groupAudioEntriesByBook(audioEntries) {
  const map = new Map();
  for (const entry of audioEntries) {
    const raw = entry.reference?.bookCode;
    const code =
      raw && String(raw).trim() ? String(raw).toUpperCase() : 'UNKNOWN';
    if (!map.has(code)) {
      map.set(code, []);
    }
    map.get(code).push(entry);
  }
  return map;
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

function loadVirtualEntriesFromZip(zipPath) {
  const burritoZip = new AdmZip(zipPath);
  return burritoZip.getEntries().map((e) => ({
    entryName: e.entryName,
    isDirectory: e.isDirectory,
    getData: () => e.getData(),
  }));
}

async function loadVirtualEntriesFromDir(rootDir) {
  const results = [];
  async function walk(currentAbsDir, relativePosix) {
    const names = await fs.readdir(currentAbsDir, { withFileTypes: true });
    for (const dirent of names) {
      const rel = relativePosix
        ? `${relativePosix}/${dirent.name}`
        : dirent.name;
      const abs = path.join(currentAbsDir, dirent.name);
      if (dirent.isDirectory()) {
        await walk(abs, rel);
      } else if (dirent.isFile()) {
        results.push({
          entryName: rel.split(path.sep).join('/'),
          isDirectory: false,
          getData: () => fsSync.readFileSync(abs),
        });
      }
    }
  }
  await walk(rootDir, '');
  return results;
}

async function discoverBurritoPackages(burritoDir) {
  const dirEntries = await fs.readdir(burritoDir, { withFileTypes: true });
  const packages = [];
  for (const entry of dirEntries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
      try {
        const zipPath = path.join(burritoDir, entry.name);
        packages.push({
          label: entry.name,
          entries: loadVirtualEntriesFromZip(zipPath),
        });
      } catch (err) {
        console.warn(
          `  Skipping ${entry.name}: unable to open zip (${err.message})`
        );
      }
    } else if (entry.isDirectory()) {
      const rootDir = path.join(burritoDir, entry.name);
      try {
        await fs.access(path.join(rootDir, 'metadata.json'));
        packages.push({
          label: `${entry.name}/`,
          entries: await loadVirtualEntriesFromDir(rootDir),
        });
      } catch {
        /* not a burrito root */
      }
    }
  }
  return packages;
}

function findMetadataBurritoEntry(entries) {
  if (!Array.isArray(entries)) {
    return undefined;
  }
  const rootMeta = entries.find(
    (e) => !e.isDirectory && normalizePathKey(e.entryName) === 'metadata.json'
  );
  if (rootMeta) {
    return rootMeta;
  }
  return entries.find(
    (e) =>
      !e.isDirectory &&
      normalizePathKey(e.entryName).toLowerCase().endsWith('metadata.json')
  );
}

function packageStemForFilename(label) {
  const trimmed = label.replace(/[/\\]+$/, '');
  if (!trimmed) {
    return 'burrito';
  }
  if (trimmed.toLowerCase().endsWith('.zip')) {
    return path.basename(trimmed, path.extname(trimmed));
  }
  return path.basename(trimmed) || trimmed;
}

function findBurritoEntry(entries, ingredientKey) {
  if (!ingredientKey || !Array.isArray(entries)) {
    return undefined;
  }
  const normalizedKey = normalizePathKey(ingredientKey);
  const direct = entries.find(
    (e) => !e.isDirectory && normalizePathKey(e.entryName) === normalizedKey
  );
  if (direct) {
    return direct;
  }
  return entries.find(
    (e) =>
      !e.isDirectory && normalizePathKey(e.entryName).endsWith(normalizedKey)
  );
}

function isBurritoAudioIngredient(ingredientPath, ingredient) {
  if (!ingredientPath || !ingredient) {
    return false;
  }
  if ((ingredient.role ?? '').toLowerCase() === 'timing') {
    return false;
  }
  const ext = path.extname(ingredientPath).toLowerCase();
  const mt = (ingredient.mimeType ?? '').trim().toLowerCase();
  if (mt.startsWith('audio/')) {
    return true;
  }
  if (!BURRITO_AUDIO_FILE_EXTENSIONS.has(ext)) {
    return false;
  }
  if (mt === 'text/usfm' || mt.startsWith('text/usfm')) {
    return false;
  }
  return true;
}

function inferAudioContentType(ingredientPath, declaredMime) {
  const trimmed = (declaredMime ?? '').trim();
  if (trimmed.toLowerCase().startsWith('audio/')) {
    return trimmed;
  }
  const ext = path.extname(ingredientPath).toLowerCase();
  const byExt = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/opus',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.webm': 'audio/webm',
    '.flac': 'audio/flac',
  };
  return byExt[ext] ?? 'audio/mpeg';
}

/** Unique name under PTF media/ (avoids collisions when basename repeats across folders). */
function burritoIngredientMediaFilename(ingredientKey) {
  const normalized = normalizePathKey(ingredientKey);
  const ext = path.extname(normalized).toLowerCase();
  const withoutExt = ext ? normalized.slice(0, -ext.length) : normalized;
  const flatStem = sanitizeFilename(
    withoutExt.replace(/\//g, '_'),
    path.basename(normalized, ext)
  );
  return ext ? `${flatStem}${ext}` : flatStem;
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
    const contentEntry = findBurritoEntry(entries, entryName);
    if (!contentEntry) {
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
          contentEntry,
        });
      }
    });
  });

  return map;
}

function detectTextFormat(ingredientPath, ingredient) {
  const mime = String(ingredient?.mimeType ?? '')
    .trim()
    .toLowerCase();
  const ext = path.extname(String(ingredientPath ?? '')).toLowerCase();
  if (mime === 'text/usfm' || mime.startsWith('text/usfm') || ext === '.usfm') {
    return 'usfm';
  }
  if (
    mime === 'application/usx+xml' ||
    mime === 'application/xml' ||
    ext === '.usx' ||
    ext === '.xml'
  ) {
    return 'usx';
  }
  if (
    mime === 'application/usj+json' ||
    mime === 'application/json' ||
    ext === '.usj' ||
    ext === '.json'
  ) {
    return 'usj';
  }
  return null;
}

function buildTextEntryMap(entries, ingredients) {
  const map = new Map();
  if (!Array.isArray(entries) || !ingredients) {
    return map;
  }
  Object.entries(ingredients).forEach(([entryName, ingredient]) => {
    const format = detectTextFormat(entryName, ingredient);
    if (!format) {
      return;
    }
    const scope = ingredient.scope ?? {};
    const contentEntry = findBurritoEntry(entries, entryName);
    if (!contentEntry) {
      return;
    }
    Object.keys(scope).forEach((bookCode) => {
      if (!bookCode) {
        return;
      }
      const normalizedBook = bookCode.toUpperCase();
      if (!map.has(normalizedBook)) {
        map.set(normalizedBook, []);
      }
      map.get(normalizedBook).push({ entryName, contentEntry, format });
    });
  });
  return map;
}

function createTextEntryResolver(textEntryMap) {
  const cache = new Map();
  return function getTextEntry(bookCode) {
    if (!bookCode) {
      return null;
    }
    const normalizedBook = String(bookCode).toUpperCase();
    const records = textEntryMap.get(normalizedBook);
    if (!records || records.length === 0) {
      return null;
    }
    const preferredOrder = ['usj', 'usx', 'usfm'];
    const selected =
      preferredOrder
        .map((format) => records.find((record) => record.format === format))
        .find(Boolean) ?? records[0];
    if (!selected) {
      return null;
    }
    if (!cache.has(selected.entryName)) {
      cache.set(
        selected.entryName,
        selected.contentEntry
          .getData()
          .toString('utf-8')
          .replace(/\r\n?/g, '\n')
      );
    }
    return {
      format: selected.format,
      text: cache.get(selected.entryName),
    };
  };
}

function toVerseIndex(chapter, verse) {
  const safeChapter = Number.isFinite(chapter) ? chapter : 0;
  const safeVerse = Number.isFinite(verse) ? verse : 0;
  return safeChapter * 1000 + safeVerse;
}

function parseAudioReferenceToSpan(referenceText, bookCode) {
  const text = String(referenceText ?? '').trim();
  if (!text) {
    return null;
  }

  const cleaned = text.replace(/^[A-Za-z]{3}\s+/, '');
  const crossChapter = cleaned.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
  if (crossChapter) {
    return {
      startChapter: parseInt(crossChapter[1], 10),
      startVerse: parseInt(crossChapter[2], 10),
      endChapter: parseInt(crossChapter[3], 10),
      endVerse: parseInt(crossChapter[4], 10),
    };
  }
  const sameChapterRange = cleaned.match(/^(\d+):(\d+)-(\d+)$/);
  if (sameChapterRange) {
    const chapter = parseInt(sameChapterRange[1], 10);
    return {
      startChapter: chapter,
      startVerse: parseInt(sameChapterRange[2], 10),
      endChapter: chapter,
      endVerse: parseInt(sameChapterRange[3], 10),
    };
  }
  const singleVerse = cleaned.match(/^(\d+):(\d+)$/);
  if (singleVerse) {
    const chapter = parseInt(singleVerse[1], 10);
    const verse = parseInt(singleVerse[2], 10);
    return {
      startChapter: chapter,
      startVerse: verse,
      endChapter: chapter,
      endVerse: verse,
    };
  }
  const chapterOnly = cleaned.match(/^(\d+)$/);
  if (chapterOnly) {
    const chapter = parseInt(chapterOnly[1], 10);
    const maxVerse =
      chapterVerseMap?.[String(bookCode ?? '').toUpperCase()]?.[chapter];
    return {
      startChapter: chapter,
      startVerse: 1,
      endChapter: chapter,
      endVerse: Number.isFinite(maxVerse) ? maxVerse : 999,
    };
  }
  return null;
}

function findBestSectionIndexForSpan(sections, span) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return 0;
  }
  if (!span) {
    return 0;
  }
  const midpoint = Math.floor(
    (toVerseIndex(span.startChapter, span.startVerse) +
      toVerseIndex(span.endChapter, span.endVerse)) /
      2
  );
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  sections.forEach((section, index) => {
    const start = toVerseIndex(section.startChapter, section.startVerse);
    const end = toVerseIndex(section.endChapter, section.endVerse);
    if (midpoint >= start && midpoint <= end) {
      bestIndex = index;
      bestDistance = 0;
      return;
    }
    const distance = midpoint < start ? start - midpoint : midpoint - end;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

/**
 * Chapters for which burrito audio ingredients declare scope and/or a parseable
 * reference. Used to avoid duplicating passages: those chapters get structure
 * from audio entries; other chapters can fall back to text-derived paragraph spans.
 */
function collectChaptersCoveredByAudio(entriesForBook, bookGroupCode) {
  const chapters = new Set();
  if (!Array.isArray(entriesForBook)) {
    return chapters;
  }
  for (const entry of entriesForBook) {
    const refStr = entry.reference?.reference;
    const bookCode =
      entry.reference?.bookCode &&
      String(entry.reference.bookCode).trim() !== ''
        ? entry.reference.bookCode
        : bookGroupCode !== 'UNKNOWN'
          ? bookGroupCode
          : '';
    const span = parseAudioReferenceToSpan(refStr, bookCode);
    if (span && Number.isFinite(span.startChapter)) {
      const endC = span.endChapter ?? span.startChapter;
      const lo = Math.min(span.startChapter, endC);
      const hi = Math.max(span.startChapter, endC);
      for (let c = lo; c <= hi; c++) {
        chapters.add(c);
      }
    }
    const scopeChapters = entry.reference?.chapters;
    if (Array.isArray(scopeChapters)) {
      for (const ch of scopeChapters) {
        const n = parseInt(String(ch), 10);
        if (Number.isFinite(n) && n > 0) {
          chapters.add(n);
        }
      }
    }
  }
  return chapters;
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
        record.contentEntry.getData().toString('utf-8').replace(/\r\n?/g, '\n')
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

    const entry = findBurritoEntry(allEntries, key);

    if (!entry) {
      console.warn(
        `  Timing file ${key} referenced in metadata was not found in package`
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
  const originalBase = path.basename(normalizedKey || '');
  const storedBase = filename ? path.basename(filename) : originalBase;

  const candidates = [
    normalizedKey,
    filename,
    originalBase,
    storedBase,
    `media/${originalBase}`,
    `media/${storedBase}`,
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
async function transformBurritoToPTF(cli) {
  const INPUT_DIR = cli.input;
  const OUTPUT_DIR = cli.output;
  const BOOK_FILTER = cli.book ? String(cli.book).trim().toUpperCase() : null;
  const burritoOptions = parseBurritoOptionsJson(cli.optionsJson);
  const jsonResult = cli.jsonResult;

  const { normalizeTextToUsj, extractStructureFromUsj } = await import(
    pathToFileURL(path.join(__dirname, 'usj-structure.mjs')).href
  );

  console.log('Starting Scripture Burrito to PTF transformation...');
  if (INPUT_DIR !== DEFAULT_BURRITO_DIR) {
    console.log(`  Input: ${INPUT_DIR}`);
    console.log(`  Output: ${OUTPUT_DIR}`);
    if (BOOK_FILTER) {
      console.log(`  Book filter: ${BOOK_FILTER}`);
    }
  }

  chapterVerseMap = await loadChapterVerseMap();
  const now = DateTime.utc().toISO();

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const packages = await discoverBurritoPackages(INPUT_DIR);

  if (packages.length === 0) {
    console.warn(
      'No Scripture Burrito packages found (.zip archives or folders with metadata.json).'
    );
    if (jsonResult) {
      console.log(
        'JSON_RESULT:' + JSON.stringify({ ok: false, error: 'no_packages' })
      );
    }
    return;
  }

  let ptfCount = 0;
  let lastPtfPath = null;
  const usedTeamNames = new Set();
  const usedOrganizationSlugs = new Set();

  for (const pkg of packages) {
    const packageLabel = pkg.label;
    const entries = pkg.entries;
    console.log(`\nProcessing ${packageLabel}...`);

    const metadataEntry = findMetadataBurritoEntry(entries);

    if (!metadataEntry) {
      console.warn(`  Skipping ${packageLabel} (metadata.json not found)`);
      continue;
    }

    let metadata;
    try {
      metadata = JSON.parse(metadataEntry.getData().toString('utf-8'));
    } catch (err) {
      console.error(
        `  Failed to parse metadata.json in ${packageLabel}: ${err.message}`
      );
      continue;
    }

    const { flavorTypeName, flavorName } = getBurritoFlavor(metadata);
    if (
      flavorTypeName !== BURRITO_PTF_FLAVOR_TYPE ||
      flavorName !== BURRITO_PTF_FLAVOR_NAME
    ) {
      console.warn(
        `  Skipping ${packageLabel}: expected flavorType "${BURRITO_PTF_FLAVOR_TYPE}" / flavor "${BURRITO_PTF_FLAVOR_NAME}", got "${flavorTypeName ?? '?'}" / "${flavorName ?? '?'}"`
      );
      continue;
    }

    let usfmEntryMap = new Map();
    let textEntryMap = new Map();
    const sisterFlavor =
      burritoOptions.sister.transcriptionFlavorName ?? 'textTranslation';
    const sister = await findBurritoPackageByFlavorName(
      INPUT_DIR,
      sisterFlavor
    );
    if (sister) {
      usfmEntryMap = buildUsfmEntryMap(
        sister.pkg.entries,
        sister.metadata.ingredients ?? {}
      );
      textEntryMap = buildTextEntryMap(
        sister.pkg.entries,
        sister.metadata.ingredients ?? {}
      );
      console.log(
        `  Using text ingredients from sister burrito (${sisterFlavor}): ${sister.pkg.label}`
      );
    } else {
      usfmEntryMap = buildUsfmEntryMap(entries, metadata.ingredients ?? {});
      textEntryMap = buildTextEntryMap(entries, metadata.ingredients ?? {});
      console.warn(
        `  Sister burrito flavor "${sisterFlavor}" not found; falling back to audio package text ingredients (if any)`
      );
    }
    const getUsfmText = createUsfmTextResolver(usfmEntryMap);
    const getTextEntry = createTextEntryResolver(textEntryMap);

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

    const identificationName = getLocalizedString(
      metadata.identification?.name,
      defaultLocale
    );
    const projectName = identificationName ?? `${langName} Audio`;
    const projectDescription =
      getLocalizedString(metadata.identification?.description, defaultLocale) ??
      `Audio content generated from Scripture Burrito ${packageLabel}`;
    const planName = `${projectName} Audio`;
    const abbreviation = sanitizeFilename(
      getLocalizedString(metadata.identification?.abbreviation, defaultLocale),
      projectName
    );

    const audioIngredients = Object.entries(metadata.ingredients ?? {}).filter(
      ([ingredientPath, ingredient]) =>
        isBurritoAudioIngredient(ingredientPath, ingredient)
    );

    if (audioIngredients.length === 0) {
      console.warn(`  Skipping ${packageLabel} (no audio ingredients found)`);
      continue;
    }

    const localizedNames = metadata.localizedNames ?? {};
    const timingSegments = buildTimingSegmentMap(
      entries,
      metadata.ingredients ?? {}
    );
    const audioEntries = [];

    for (const [key, ingredient] of audioIngredients) {
      const includeAudio = burritoOptions.include.audio !== false;
      const contentEntry = includeAudio ? findBurritoEntry(entries, key) : null;
      if (includeAudio && !contentEntry) {
        console.warn(
          `  Audio file ${key} referenced in metadata was not found in package`
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
        contentEntry,
        filename: burritoIngredientMediaFilename(key),
        reference,
      });
    }

    if (audioEntries.length === 0) {
      console.warn(
        `  Skipping ${packageLabel} (no usable audio entries found)`
      );
      continue;
    }

    orderAudioEntries(audioEntries);

    const bookGroups = groupAudioEntriesByBook(audioEntries);
    let sortedBookGroups = Array.from(bookGroups.entries()).sort(([a], [b]) => {
      if (a === 'UNKNOWN') return 1;
      if (b === 'UNKNOWN') return -1;
      return a.localeCompare(b);
    });
    if (BOOK_FILTER) {
      sortedBookGroups = sortedBookGroups.filter(
        ([code]) =>
          code === BOOK_FILTER ||
          (code === 'UNKNOWN' && BOOK_FILTER === 'UNKNOWN')
      );
      if (sortedBookGroups.length === 0) {
        console.warn(
          `  Skipping ${packageLabel}: no audio for book "${BOOK_FILTER}"`
        );
        continue;
      }
    }
    const isMultiBook = sortedBookGroups.length > 1;

    const exportTimestamp = toUtcIso(metadata.meta?.dateCreated, now);

    if (isMultiBook) {
      console.log(
        `  Splitting into ${sortedBookGroups.length} PTF file(s) by Bible book (ingredient scope)`
      );
    }
    const emitBookPtf = async (bookGroupCode, bookAudioEntries) => {
      orderAudioEntries(bookAudioEntries);

      const chapterFilter = burritoOptions.chapters;
      let entriesForBook = bookAudioEntries;
      if (chapterFilter === null || chapterFilter === undefined) {
        entriesForBook = bookAudioEntries;
      } else if (chapterFilter.length === 0) {
        entriesForBook = [];
      } else {
        entriesForBook = bookAudioEntries.filter((entry) =>
          passageMatchesChapterFilter(entry.reference?.reference, chapterFilter)
        );
      }
      if (entriesForBook.length === 0) {
        console.warn(
          `  Skipping ${bookGroupCode} in ${packageLabel}: no passages match chapter filter`
        );
        return;
      }

      const bookDisplayName =
        bookGroupCode === 'UNKNOWN'
          ? undefined
          : buildBookName(bookGroupCode, localizedNames, defaultLocale);
      const bookSuffix = isMultiBook
        ? bookGroupCode === 'UNKNOWN'
          ? ' — Unscoped'
          : ` — ${bookDisplayName ?? bookGroupCode}`
        : '';
      const bookProjectName =
        bookGroupCode && bookGroupCode !== 'UNKNOWN'
          ? (bookDisplayName ?? bookGroupCode)
          : null;
      const scopedProjectName = bookProjectName
        ? bookProjectName
        : `${projectName}${bookSuffix}`;
      const scopedPlanName = bookProjectName
        ? `${bookProjectName} Audio`
        : `${planName}${bookSuffix}`;
      const textEntry =
        bookGroupCode && bookGroupCode !== 'UNKNOWN'
          ? getTextEntry(bookGroupCode)
          : null;
      let extractedStructure = null;
      if (textEntry) {
        try {
          const usjDoc = normalizeTextToUsj(textEntry.text, textEntry.format);
          extractedStructure = extractStructureFromUsj(usjDoc, chapterFilter);
        } catch (err) {
          console.warn(
            `  Failed to parse ${textEntry.format.toUpperCase()} structure for ${bookGroupCode}: ${err?.message ?? err}`
          );
        }
      }
      const normalizedSections =
        extractedStructure?.sections && extractedStructure.sections.length > 0
          ? extractedStructure.sections
          : [
              {
                sequencenum: 1,
                name: 'Audio Content',
                level: 3,
                startChapter: 1,
                startVerse: 1,
                endChapter: 1,
                endVerse: 1,
              },
            ];
      const paragraphSpans = Array.isArray(extractedStructure?.paragraphs)
        ? extractedStructure.paragraphs
        : [];
      const chaptersCoveredByAudio = collectChaptersCoveredByAudio(
        entriesForBook,
        bookGroupCode
      );
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

      const baseTeamName = identificationName ?? projectName;
      const scopedTeamName = buildUniqueName(
        isMultiBook && bookProjectName
          ? `${baseTeamName} ${bookProjectName}`
          : baseTeamName,
        usedTeamNames
      );
      const organizationSlug = buildUniqueSlug(
        sanitizeFilename(scopedTeamName, 'burrito'),
        usedOrganizationSlugs
      );
      const organization = createJsonApiRecord(
        'organizations',
        {
          name: scopedTeamName,
          slug: organizationSlug,
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
              toolConfig.settings.artifactTypeId = getTypeByName(
                attributes.name
              );
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
              toolConfig.settings.artifactTypeId = getTypeByName(
                attributes.name
              );
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
          name: scopedProjectName,
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
          name: scopedPlanName,
          slug: sanitizeFilename(scopedPlanName, 'audio-plan'),
          flat: false,
          sectionCount: normalizedSections.length,
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
      project.relationships.plans.data.push(
        relationshipIdentifier('plan', plan)
      );
      planTypes.forEach((planType) => {
        if (planType.attributes.name === 'Other') {
          planType.relationships.plans.data.push(
            relationshipIdentifier('plan', plan)
          );
        }
      });

      const sections = normalizedSections.map((sectionInfo, index) => {
        const section = createJsonApiRecord(
          'sections',
          {
            sequencenum: index + 1,
            name: sectionInfo.name || `Section ${index + 1}`,
            state: '',
            level: sectionInfo.level ?? 3,
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
        return section;
      });

      const passages = [];
      const mediafiles = [];
      const passageBySection = new Map();
      sections.forEach((section, index) => {
        passageBySection.set(index, []);
      });
      let passageSeq = 1;

      function createPassageFromSpan(sectionIndex, span, fallbackTitle) {
        const section = sections[sectionIndex] ?? sections[0];
        const chapter = span?.chapter ?? span?.startChapter ?? 0;
        const startVerse = span?.startVerse ?? 0;
        const endChapter = span?.endChapter ?? chapter;
        const endVerse = span?.endVerse ?? startVerse;
        const referenceLabel =
          chapter > 0 && startVerse > 0
            ? `${chapter}:${startVerse}${endVerse > startVerse ? `-${endVerse}` : ''}`
            : fallbackTitle || `Passage ${passageSeq}`;
        const passage = createJsonApiRecord(
          'passages',
          {
            sequencenum: passageSeq++,
            book: bookGroupCode === 'UNKNOWN' ? '' : bookGroupCode,
            reference: referenceLabel,
            title: fallbackTitle || referenceLabel,
            state: 'noMedia',
            dateCreated: createdAt,
            dateUpdated: createdAt,
            'start-chapter': chapter || 0,
            'end-chapter': endChapter || 0,
            'start-verse': startVerse || 0,
            'end-verse': endVerse || 0,
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
        passageBySection.get(sectionIndex)?.push(passage);
        return passage;
      }

      if (
        textEntry &&
        paragraphSpans.length > 0 &&
        chaptersCoveredByAudio.size > 0
      ) {
        paragraphSpans.forEach((paragraph) => {
          const ch = Number(paragraph.chapter);
          if (!Number.isFinite(ch) || ch <= 0) {
            return;
          }
          if (chaptersCoveredByAudio.has(ch)) {
            return;
          }
          const sectionIndex = Number.isFinite(paragraph.sectionIndex)
            ? paragraph.sectionIndex
            : 0;
          createPassageFromSpan(
            Math.max(0, Math.min(sectionIndex, sections.length - 1)),
            paragraph,
            ''
          );
        });
      }

      const includeAudio = burritoOptions.include.audio !== false;

      entriesForBook.forEach((audioEntry, index) => {
        const audioFilename = audioEntry.filename;
        const downloadTimestamp = toUtcIso(exportTimestamp, createdAt);
        const referenceTitle =
          audioEntry.reference.title || `Audio ${index + 1}`;
        const referenceLabel =
          audioEntry.reference.reference || `Audio ${index + 1}`;
        const span = parseAudioReferenceToSpan(
          referenceLabel,
          audioEntry.reference.bookCode
        );
        const targetSectionIndex = findBestSectionIndexForSpan(
          normalizedSections,
          span
        );
        const candidatePassages =
          passageBySection.get(targetSectionIndex) ?? [];
        let passage = candidatePassages.find((candidate) => {
          if (!span) {
            return false;
          }
          return (
            candidate.attributes['start-chapter'] === span.startChapter &&
            candidate.attributes['start-verse'] === span.startVerse &&
            candidate.attributes['end-chapter'] === span.endChapter &&
            candidate.attributes['end-verse'] === span.endVerse
          );
        });
        if (!passage) {
          passage = createPassageFromSpan(
            targetSectionIndex,
            span,
            referenceTitle
          );
        }
        passage.attributes.reference = referenceLabel;
        passage.attributes.title = referenceTitle;
        passage.attributes.book = audioEntry.reference.bookCode ?? '';

        const transcription = resolveTranscriptionFromScope(
          audioEntry.ingredient.scope,
          getUsfmText
        );

        if (includeAudio) {
          const audioBuffer = audioEntry.contentEntry?.getData?.();
          if (!audioBuffer) {
            console.warn(
              `  Audio entry missing content data for ${audioEntry.key}; skipping mediafile`
            );
            return;
          }

          const mediafile = createJsonApiRecord(
            'mediafiles',
            {
              versionNumber: 1,
              audioUrl: audioFilename,
              'eaf-url': '',
              'audio-url': `media/${audioFilename}`,
              s3file: '',
              duration: null,
              'content-type': inferAudioContentType(
                audioEntry.key,
                audioEntry.ingredient.mimeType
              ),
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
              'resource-passage-id': null,
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
        }
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
        F_sections: { data: sections },
        G_passages: { data: passages },
        H_mediafiles: { data: mediafiles },
      };

      for (const [filename, content] of Object.entries(dataFiles)) {
        ptfZip.addFile(
          `data/${filename}.json`,
          Buffer.from(JSON.stringify(content, null, 2))
        );
      }

      const packageStem = packageStemForFilename(packageLabel);
      const ptfBaseName = isMultiBook
        ? sanitizeFilename(
            `${abbreviation || langName}_${
              bookGroupCode === 'UNKNOWN' ? 'unscoped' : bookGroupCode
            }_burrito`,
            packageStem
          )
        : sanitizeFilename(`${abbreviation || langName}-burrito`, packageStem);
      const ptfFilename = `${ptfBaseName}.ptf`;
      const ptfPath = path.join(OUTPUT_DIR, ptfFilename);

      await fs.writeFile(ptfPath, ptfZip.toBuffer());
      console.log(`  Created: ${ptfFilename}`);
      ptfCount++;
      lastPtfPath = ptfPath;
    };

    for (const [bookGroupCode, bookAudioEntries] of sortedBookGroups) {
      await emitBookPtf(bookGroupCode, bookAudioEntries);
    }
  }

  console.log('\n=== TRANSFORMATION COMPLETE ===');
  console.log(`Created ${ptfCount} PTF file(s) in ${OUTPUT_DIR}/`);
  if (!jsonResult) {
    console.log('\nNext step: Import the PTF files into Audio Project Manager');
    console.log('  1. Open Audio Project Manager');
    console.log('  2. Go to File > Import Project');
    console.log('  3. Select a .ptf file from the output directory');
    console.log('  4. Repeat for each PTF you want to import');
  }
  if (jsonResult) {
    console.log(
      'JSON_RESULT:' +
        JSON.stringify({
          ok: ptfCount > 0,
          ptfPath: lastPtfPath ?? null,
          ptfCount,
        })
    );
  }
}

const cliArgs = parseCliArgs();
transformBurritoToPTF(cliArgs).catch((err) => {
  console.error('Failed to transform Scripture Burrito to PTF:', err);
  if (cliArgs.jsonResult) {
    console.log(
      'JSON_RESULT:' +
        JSON.stringify({ ok: false, error: err?.message ?? String(err) })
    );
  }
  process.exitCode = 1;
});
