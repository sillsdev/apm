#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- plain Node script */
/**
 * Localization pipeline: Crowdin sync + AI fill-in of missing translations.
 *
 * Replaces the manual steps (CrowdInRefresh.exe, MissingTargetWithId.xsl,
 * spreadsheet + regex, MissingTargetUpdate.xsl, pretty-print). Priority for each
 * target string is unchanged:
 *   1. Crowdin translation (state "translated" or "final")
 *   2. new AI translation (only for strings that need one)
 *   3. existing target in TranscriberAdmin-<lang>.xlf
 *
 * Usage (from repo root):
 *   node localization/l10n.mjs upload                 push TranscriberAdmin-en-1.2.xliff to Crowdin
 *   node localization/l10n.mjs download               build + download translations, write SILTranscriberTranslations.zip
 *   node localization/l10n.mjs refresh <crowdin.zip>  normalize a manually downloaded zip (replaces CrowdInRefresh.exe)
 *   node localization/l10n.mjs translate [langs...]   fill missing targets in TranscriberAdmin-<lang>.xlf
 *   node localization/l10n.mjs merge <lang> [file]    merge a filled-in l10n-work/missing-<lang>.json
 *   node localization/l10n.mjs all [langs...]         upload + download + translate
 *
 * Options:
 *   --translator=api|session   api: call Claude; session: write l10n-work/missing-<lang>.json
 *                              for a Claude Code session to fill in, then run `merge`.
 *                              Default: api when ANTHROPIC_API_KEY/ANTHROPIC_AUTH_TOKEN is set.
 *   --out=<dir>                write the .xlf files to <dir> instead of localization/ (dry run)
 *   --exclude=zh-TW,...        Crowdin locales to drop when collapsing to 2-letter codes (default zh-TW)
 *   --model=<id>               Claude model (default claude-opus-5-5)
 *
 * Environment:
 *   CROWDIN_TOKEN       Crowdin personal access token (upload/download)
 *   CROWDIN_PROJECT     project identifier or numeric id (default sil-transcriber)
 *   CROWDIN_API         API base (default https://api.crowdin.com/api/v2)
 *   ANTHROPIC_API_KEY   Claude API key (translator=api)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { DOMParser } from '@xmldom/xmldom';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORK = path.join(HERE, 'l10n-work');
const SOURCE_FILE = 'TranscriberAdmin-en-1.2.xliff';
const SOURCE_PATH = path.join(HERE, SOURCE_FILE);
const TRANSLATIONS_ZIP = path.join(HERE, 'SILTranscriberTranslations.zip');
const DEFAULT_LANGS = ['es', 'fr', 'id', 'pt', 'ru', 'zh'];
const NS12 = 'urn:oasis:names:tc:xliff:document:1.2';
const NS20 = 'urn:oasis:names:tc:xliff:document:2.0';

// Crowdin locale each two-letter code comes from, for the translator prompt.
const LANG_NAMES = {
  es: 'Spanish (Spain)',
  fr: 'French',
  id: 'Indonesian',
  pt: 'Portuguese (Brazil)',
  ru: 'Russian',
  zh: 'Chinese (Simplified, zh-CN)',
};

// ---------- args ----------
const argv = process.argv.slice(2);
const opts = {};
const positional = [];
for (const a of argv) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) opts[m[1]] = m[2] ?? true;
  else positional.push(a);
}
const command = positional.shift();
const outDir = opts.out ? path.resolve(opts.out) : HERE;
const excluded = String(opts.exclude ?? 'zh-TW')
  .split(',')
  .filter(Boolean);
const model = opts.model ?? 'claude-opus-5-5';

// ---------- xml helpers ----------
// Collapse whitespace runs to one space but keep a leading/trailing space:
// strings like "Error: " are concatenated with other text at runtime.
// Only XML whitespace (as XSLT normalize-space) — French uses U+00A0 before ':'.
const norm = (s) => (s ?? '').replace(/[ \t\r\n]+/g, ' ');
const trimXml = (s) => s.replace(/^ | $/g, '');
const same = (a, b) => trimXml(a) === trimXml(b);
const blank = (s) => !s || s === ' ';
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');

function parseXml(text, name) {
  const errors = [];
  const doc = new DOMParser({
    onError: (level, msg) => {
      if (level !== 'warning') errors.push(msg);
    },
  }).parseFromString(text.replace(/^\uFEFF/, ''), 'text/xml');
  if (errors.length) throw new Error(`${name}: ${errors.join('; ')}`);
  return doc;
}

const firstChild = (el, ns, tag) => el.getElementsByTagNameNS(ns, tag)[0];

/** XLIFF 1.2 → Map(id → {source, target, state}) in document order. */
function read12(text, name) {
  const doc = parseXml(text, name);
  const units = new Map();
  for (const tu of Array.from(doc.getElementsByTagNameNS(NS12, 'trans-unit'))) {
    const t = firstChild(tu, NS12, 'target');
    units.set(tu.getAttribute('id'), {
      source: norm(firstChild(tu, NS12, 'source')?.textContent),
      target: norm(t?.textContent),
      state: t?.getAttribute('state') ?? '',
    });
  }
  return units;
}

/** XLIFF 2.0 → {trgLang, units: Map(id → {source, target})}. */
function read20(text, name) {
  const doc = parseXml(text, name);
  const units = new Map();
  for (const u of Array.from(doc.getElementsByTagNameNS(NS20, 'unit'))) {
    units.set(u.getAttribute('id'), {
      source: norm(firstChild(u, NS20, 'source')?.textContent),
      target: norm(firstChild(u, NS20, 'target')?.textContent),
    });
  }
  const file = firstChild(doc, NS20, 'file');
  return {
    trgLang: doc.documentElement.getAttribute('trgLang'),
    original: file?.getAttribute('original') || 'TranscriberAdmin-en.xliff',
    units,
  };
}

function write20(file, { trgLang, original }, rows) {
  const out = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<xliff xmlns="${NS20}" srcLang="en" trgLang="${escAttr(trgLang)}" version="1.0">`,
    `   <file id="TranscriberAdmin" original="${escAttr(original)}">`,
  ];
  for (const { id, source, target } of rows) {
    out.push(
      `      <unit id="${escAttr(id)}">`,
      '         <segment>',
      `            <source>${esc(source)}</source>`,
      `            <target>${esc(target)}</target>`,
      '         </segment>',
      '      </unit>'
    );
  }
  out.push('   </file>', '</xliff>', '');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, out.join('\n'), 'utf8');
}

const isCrowdTranslated = (u) =>
  !!u && !blank(u.target) && (u.state === 'translated' || u.state === 'final');

// ---------- per-language model ----------
function loadLang(lang) {
  const en = read12(fs.readFileSync(SOURCE_PATH, 'utf8'), SOURCE_FILE);

  if (!fs.existsSync(TRANSLATIONS_ZIP))
    throw new Error(
      `${TRANSLATIONS_ZIP} not found — run "download" or "refresh" first`
    );
  const entry = new AdmZip(TRANSLATIONS_ZIP).getEntry(`${lang}/${SOURCE_FILE}`);
  const crowd = entry
    ? read12(entry.getData().toString('utf8'), `${lang}/${SOURCE_FILE}`)
    : new Map();
  if (!entry)
    console.warn(
      `  ! no ${lang}/ folder in Crowdin zip; using local translations only`
    );

  const xlfPath = path.join(HERE, `TranscriberAdmin-${lang}.xlf`);
  const existing = fs.existsSync(xlfPath)
    ? read20(fs.readFileSync(xlfPath, 'utf8'), path.basename(xlfPath))
    : {
        trgLang: lang,
        original: 'TranscriberAdmin-en.xliff',
        units: new Map(),
      };

  // A string needs a new translation when Crowdin has none and the local
  // target is empty or was made for different English text.
  const missing = [];
  for (const [id, { source }] of en) {
    if (isCrowdTranslated(crowd.get(id))) continue;
    const have = existing.units.get(id);
    if (have && !blank(have.target) && same(have.source, source)) continue;
    if (blank(source)) continue;
    missing.push({ id, source });
  }
  return { lang, en, crowd, existing, missing };
}

function merge(model_, translations) {
  const { lang, en, crowd, existing } = model_;
  const counts = { crowdin: 0, new: 0, kept: 0, empty: 0 };
  const rows = [];
  for (const [id, { source }] of en) {
    const c = crowd.get(id);
    const prior = existing.units.get(id)?.target;
    let target = '';
    let from = 'empty';
    if (isCrowdTranslated(c)) {
      target = c.target;
      from = 'crowdin';
    } else if (translations.has(id)) {
      target = norm(translations.get(id));
      from = 'new';
    } else if (!blank(prior)) {
      target = prior;
      from = 'kept';
    }
    counts[from]++;
    rows.push({ id, source, target });
  }
  const file = path.join(outDir, `TranscriberAdmin-${lang}.xlf`);
  write20(file, { ...existing, trgLang: existing.trgLang || lang }, rows);
  const summary = Object.entries(counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  console.log(
    `  ${lang}: wrote ${path.relative(process.cwd(), file)} — ${summary}`
  );
}

// ---------- Claude translation ----------
const placeholders = (s) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');

/** Existing translations from the same sections, so terminology stays consistent. */
function referencePairs(m, limit = 400) {
  const sections = new Set(m.missing.map((x) => x.id.split('.')[0]));
  const pairs = [];
  const add = (id, source, target) => {
    if (source && target && pairs.length < limit)
      pairs.push({ id, source, target });
  };
  for (const [id, { source }] of m.en) {
    if (!sections.has(id.split('.')[0])) continue;
    const c = m.crowd.get(id);
    const e = m.existing.units.get(id);
    if (isCrowdTranslated(c)) add(id, source, c.target);
    else if (!blank(e?.target) && same(e.source, source))
      add(id, source, e.target);
  }
  // Pad with general UI vocabulary (shared/main) if there is room.
  for (const [id, { source }] of m.en) {
    if (pairs.length >= limit) break;
    if (
      !/^(shared|main|cards|planTabs)\./.test(id) ||
      sections.has(id.split('.')[0])
    )
      continue;
    const e = m.existing.units.get(id);
    if (!blank(e?.target) && same(e.source, source)) add(id, source, e.target);
  }
  return pairs;
}

const SYSTEM = `You translate user-interface strings for Audio Project Manager (SIL Transcriber), an app used by Bible translation teams to record, transcribe, and review oral translations of Scripture passages.

Rules:
- Translate the English "source" of every item into the target language. Return every id exactly once.
- Keep placeholders such as {0}, {1}, {2} exactly as written; reorder them only if the grammar requires it.
- Keep any HTML tags, URLs, keyboard shortcuts (e.g. Ctrl+S), file extensions, and product names (Audio Project Manager, Paratext, Crowdin, Bible Brain, Burrito) unchanged.
- Match the terminology and tone of the reference translations. Use the conventional software UI register for the language (for example, infinitive or imperative button labels as the reference translations do).
- Keep the length close to the English; these appear in buttons, menus, and dialogs.
- Return only the translated text in "target": no quotes, notes, or alternatives.`;

async function translateWithClaude(m) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic();
  const languageName =
    LANG_NAMES[m.lang] ??
    new Intl.DisplayNames(['en'], { type: 'language' }).of(m.lang);
  const refs = referencePairs(m);
  const refBlock =
    `Target language: ${languageName} (${m.lang})\n\nReference translations already in use:\n` +
    refs.map((r) => `${r.id}\t${r.source}\t${r.target}`).join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['translations'],
    properties: {
      translations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'target'],
          properties: { id: { type: 'string' }, target: { type: 'string' } },
        },
      },
    },
  };

  const result = new Map();
  const BATCH = 60;
  for (let i = 0; i < m.missing.length; i += BATCH) {
    const batch = m.missing.slice(i, i + BATCH);
    process.stdout.write(
      `  ${m.lang}: translating ${i + 1}-${i + batch.length} of ${m.missing.length}… `
    );
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 32000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM }],
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema },
      },
      messages: [
        {
          role: 'user',
          content: [
            // Stable per language → cached across batches.
            {
              type: 'text',
              text: refBlock,
              cache_control: { type: 'ephemeral' },
            },
            {
              type: 'text',
              text:
                'Translate these items:\n' +
                JSON.stringify(
                  batch.map(({ id, source }) => ({ id, source })),
                  null,
                  1
                ),
            },
          ],
        },
      ],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal')
      throw new Error(`refused: ${msg.stop_details?.explanation ?? ''}`);
    if (msg.stop_reason === 'max_tokens')
      throw new Error('response truncated (max_tokens)');
    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const { translations } = JSON.parse(text);
    let ok = 0;
    for (const { id, target } of translations) {
      const src = batch.find((b) => b.id === id);
      if (!src || blank(norm(target))) continue;
      if (placeholders(src.source) !== placeholders(target)) {
        console.warn(
          `\n    ! ${id}: placeholder mismatch, skipped (${target})`
        );
        continue;
      }
      result.set(id, target);
      ok++;
    }
    console.log(`${ok}/${batch.length}`);
  }
  return result;
}

// ---------- session (Claude Code) hand-off ----------
const missingFile = (lang) => path.join(WORK, `missing-${lang}.json`);

function writeMissing(m) {
  fs.mkdirSync(WORK, { recursive: true });
  const refs = referencePairs(m, 200);
  const data = {
    lang: m.lang,
    languageName: LANG_NAMES[m.lang] ?? m.lang,
    instructions:
      SYSTEM +
      '\nFill in "target" for each item in "items"; leave "references" unchanged.',
    references: refs,
    items: m.missing.map(({ id, source }) => ({ id, source, target: '' })),
  };
  fs.writeFileSync(
    missingFile(m.lang),
    JSON.stringify(data, null, 2) + '\n',
    'utf8'
  );
  console.log(
    `  ${m.lang}: ${m.missing.length} strings need translation → ${path.relative(process.cwd(), missingFile(m.lang))}`
  );
}

function readFilled(lang, file = missingFile(lang)) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const map = new Map();
  for (const { id, source, target } of data.items) {
    if (blank(norm(target ?? ''))) continue;
    if (placeholders(source) !== placeholders(target)) {
      console.warn(`  ! ${id}: placeholder mismatch, skipped`);
      continue;
    }
    map.set(id, target);
  }
  return map;
}

// ---------- Crowdin ----------
const CROWDIN_API = process.env.CROWDIN_API ?? 'https://api.crowdin.com/api/v2';

async function crowdin(method, url, body, headers = {}) {
  const token = process.env.CROWDIN_TOKEN;
  if (!token) throw new Error('CROWDIN_TOKEN is not set');
  const isJson = body !== undefined && !(body instanceof Uint8Array);
  const res = await fetch(url.startsWith('http') ? url : CROWDIN_API + url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(isJson ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isJson ? JSON.stringify(body) : body,
  });
  if (!res.ok)
    throw new Error(
      `Crowdin ${method} ${url}: ${res.status} ${await res.text()}`
    );
  return res.status === 204 ? null : res.json();
}

async function crowdinProjectId() {
  const p = process.env.CROWDIN_PROJECT ?? 'sil-transcriber';
  if (/^\d+$/.test(p)) return p;
  const { data } = await crowdin('GET', '/projects?limit=500');
  const hit = data.find((d) => d.data.identifier === p);
  if (!hit) throw new Error(`Crowdin project "${p}" not found for this token`);
  return hit.data.id;
}

async function upload() {
  const projectId = await crowdinProjectId();
  const { data: files } = await crowdin(
    'GET',
    `/projects/${projectId}/files?limit=500`
  );
  const file = files.find((f) => f.data.name === SOURCE_FILE);
  if (!file)
    throw new Error(`${SOURCE_FILE} not found in Crowdin project ${projectId}`);
  const storage = await crowdin(
    'POST',
    '/storages',
    new Uint8Array(fs.readFileSync(SOURCE_PATH)),
    {
      'Crowdin-API-FileName': SOURCE_FILE,
      'Content-Type': 'application/octet-stream',
    }
  );
  await crowdin('PUT', `/projects/${projectId}/files/${file.data.id}`, {
    storageId: storage.data.id,
    updateOption: 'keep_translations_and_approvals',
  });
  console.log(`Uploaded ${SOURCE_FILE} to Crowdin (file ${file.data.id}).`);
}

async function download() {
  const projectId = await crowdinProjectId();
  let build = (
    await crowdin('POST', `/projects/${projectId}/translations/builds`, {})
  ).data;
  process.stdout.write('Building Crowdin translations');
  while (build.status !== 'finished') {
    if (build.status === 'failed' || build.status === 'canceled')
      throw new Error(`build ${build.status}`);
    await new Promise((r) => setTimeout(r, 3000));
    build = (
      await crowdin(
        'GET',
        `/projects/${projectId}/translations/builds/${build.id}`
      )
    ).data;
    process.stdout.write('.');
  }
  console.log(' done');
  const { data } = await crowdin(
    'GET',
    `/projects/${projectId}/translations/builds/${build.id}/download`
  );
  const res = await fetch(data.url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  fs.mkdirSync(WORK, { recursive: true });
  const raw = path.join(WORK, 'crowdin-translations.zip');
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  refresh(raw);
}

/** Collapse Crowdin locale folders (es-ES → es) like CrowdInRefresh.exe, dropping excluded locales. */
function refresh(zipPath) {
  const src = new AdmZip(zipPath);
  const out = new AdmZip();
  const renamed = new Map();
  for (const e of src.getEntries()) {
    if (e.isDirectory) continue;
    const [dir, ...rest] = e.entryName.split('/');
    if (!rest.length) continue;
    if (excluded.includes(dir)) continue;
    const code = dir.split('-')[0];
    if (renamed.has(code) && renamed.get(code) !== dir)
      throw new Error(
        `Both ${renamed.get(code)} and ${dir} map to "${code}". Add one to --exclude.`
      );
    renamed.set(code, dir);
    out.addFile([code, ...rest].join('/'), e.getData());
  }
  out.writeZip(TRANSLATIONS_ZIP);
  console.log(
    `Wrote ${path.relative(process.cwd(), TRANSLATIONS_ZIP)} (${[...renamed.keys()].sort().join(' ')})` +
      (excluded.length ? `; excluded ${excluded.join(', ')}` : '')
  );
}

// ---------- translate ----------
async function translate(langs) {
  const mode =
    opts.translator ??
    (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
      ? 'api'
      : 'session');
  console.log(`Translator: ${mode}`);
  for (const lang of langs) {
    const m = loadLang(lang);
    if (!m.missing.length) {
      console.log(`  ${lang}: nothing missing`);
      merge(m, new Map());
      continue;
    }
    if (mode === 'api') merge(m, await translateWithClaude(m));
    else {
      writeMissing(m);
      merge(m, new Map()); // still pick up new Crowdin translations / new units
    }
  }
  if (mode === 'session')
    console.log(
      `\nAsk Claude Code to fill in the "target" fields of l10n-work/missing-*.json, then run:\n` +
        `  node localization/l10n.mjs merge ${langs.join(' ')}`
    );
  console.log(
    '\nNext: cd .\\localization\\bin\\Debug ; &.\\.\\updateLocalization.exe'
  );
}

// ---------- main ----------
const langsArg = () => (positional.length ? positional : DEFAULT_LANGS);
try {
  switch (command) {
    case 'upload':
      await upload();
      break;
    case 'download':
      await download();
      break;
    case 'refresh':
      if (!positional[0]) throw new Error('usage: refresh <crowdin.zip>');
      refresh(path.resolve(positional[0]));
      break;
    case 'translate':
      await translate(langsArg());
      break;
    case 'merge': {
      const [lang, file] = positional;
      if (lang && file?.endsWith('.json'))
        merge(loadLang(lang), readFilled(lang, path.resolve(file)));
      else for (const l of langsArg()) merge(loadLang(l), readFilled(l));
      break;
    }
    case 'all':
      await upload();
      await download();
      await translate(langsArg());
      break;
    default:
      console.log(
        /\/\*\*([\s\S]*?)\*\//.exec(
          fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
        )[1]
      );
      process.exitCode = command ? 1 : 0;
  }
} catch (err) {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
}
