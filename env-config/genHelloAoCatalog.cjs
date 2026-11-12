/**
 * Regenerate web/src/assets/reference_text_bibles.json, the Reference Text
 * catalog, from HelloAO; every entry has type `helloao` (see CONTEXT.md
 * "Reference Text" and docs/adr/0014).
 *
 *   node env-config/genHelloAoCatalog.cjs
 *
 * Reads HelloAO's translation list, then each translation's book list, and
 * keeps translations that have at least one canonical book. A translation
 * HelloAO gives no license gets an empty label; the picker says so rather
 * than guessing (its licenseUrl / website say what the terms are).
 * Translations whose book list cannot be fetched are skipped and reported.
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const OUTPUT = path.join(root, 'web/src/assets/reference_text_bibles.json');
const API = 'https://bible.helloao.org';
const CONCURRENCY = 8;
const RETRIES = 3;

// Canonical books (1–66) in canon order; a Project Book is always one of them.
const CANON = JSON.parse(
  fs.readFileSync(path.join(root, 'web/src/assets/code-num.json'), 'utf8')
)
  .filter(([, num]) => num >= 1 && num <= 66)
  .sort((a, b) => a[1] - b[1])
  .map(([usfm]) => usfm);

/** Short label for a HelloAO license, e.g. `CC BY-NC-ND` or `Public Domain`; '' when none is given. */
const licenseLabel = (l) => {
  if (!l) return '';
  if (l.publicDomain) return 'Public Domain';
  let label = 'CC BY';
  if (l.commercialUse === 'not-allowed') label += '-NC';
  if (l.derivatives === 'not-allowed') label += '-ND';
  else if (l.copyleft) label += '-SA';
  return label;
};

const fetchJson = async (url) => {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= RETRIES) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
};

/** Runs fn over items, at most `limit` at a time, keeping input order. */
const mapLimit = async (items, limit, fn) => {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
};

const main = async () => {
  const { translations } = await fetchJson(
    `${API}/api/available_translations.json`
  );
  const skipped = {};
  const skip = (why) => (skipped[why] = (skipped[why] ?? 0) + 1);
  const failed = [];
  let done = 0;

  const entries = await mapLimit(translations, CONCURRENCY, async (x) => {
    let books;
    try {
      books = (await fetchJson(`${API}${x.listOfBooksApiLink}`)).books;
    } catch (err) {
      failed.push(`${x.id}: ${err.message}`);
      return undefined;
    } finally {
      if (++done % 100 === 0) console.log(`${done}/${translations.length}`);
    }
    const ids = new Set(books.map((b) => b.id));
    const canon = CANON.filter((b) => ids.has(b));
    if (canon.length === 0) {
      skip('nocanon');
      return undefined;
    }
    return {
      id: x.id,
      type: 'helloao',
      name: x.name,
      englishName: x.englishName,
      shortName: x.shortName,
      language: x.language,
      languageName: x.languageName,
      languageEnglishName: x.languageEnglishName,
      textDirection: x.textDirection,
      license: licenseLabel(x.license),
      licenseUrl: x.licenseUrl,
      website: x.website,
      books: canon.join(' '),
    };
  });

  const bibles = entries.filter(Boolean);
  // Code-point order (not localeCompare) so regenerating keeps a stable diff.
  const cmp = (a, b) => {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  };
  bibles.sort(
    (a, b) =>
      cmp(a.languageEnglishName ?? '', b.languageEnglishName ?? '') ||
      cmp(a.id, b.id)
  );
  const generated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(
      { source: API, generated, count: bibles.length, bibles },
      null,
      2
    ) + '\n'
  );
  console.log(`${bibles.length} Bibles written to ${OUTPUT}`, skipped);
  if (failed.length > 0) {
    console.warn(`${failed.length} book lists could not be fetched:`);
    failed.forEach((f) => console.warn(`  ${f}`));
  }
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
