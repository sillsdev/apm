// Lists TranscriberAdmin-en-1.2.xliff trans-unit ids whose key is not referenced in src/.
//
// Usage (from repo root): node localization/findUnusedStrings.cjs [outDir]
//   Writes <outDir>/none.txt  - key never appears as a word anywhere in src (likely unused)
//          <outDir>/weak.txt  - key appears, but never as `.key` or a quoted 'key' (verify by hand)
//   Also prints groups (layouts) that no selector reads.
//
// Caveats - this is a text search, so review results before deleting:
//   - Keys built at runtime are reported as unused, e.g. workflowSteps (step names from the
//     database), permission `p + 'Tip'`, wsAudioPlayer `${func}Failed`, burrito toCamel(BurritoType),
//     shared role names via localizeRole, and resource `help` keys.
//   - Layouts handed to third-party components are skipped (see EXTERNAL_LAYOUTS).
const fs = require('fs'), cp = require('child_process');

// Layouts whose strings are consumed inside a library, not by our code.
const EXTERNAL_LAYOUTS = ['languagePicker']; // mui-language-picker ILanguagePickerStrings

const out = process.argv[2] ?? '.';
const x = fs.readFileSync('localization/TranscriberAdmin-en-1.2.xliff', 'utf8');
const ids = [...x.matchAll(/<trans-unit id="([^"]+)"/g)].map((m) => m[1]);
const files = cp
  .execSync('git ls-files src', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.includes('store/localization/'));
const src = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const none = [], weak = [];
const groups = {};
for (const id of ids) {
  const i = id.indexOf('.');
  const g = id.slice(0, i), k = id.slice(i + 1);
  (groups[g] ??= []).push(k);
  if (EXTERNAL_LAYOUTS.includes(g)) continue;
  const e = esc(k);
  if (!new RegExp('(?<![\\w$])' + e + '(?![\\w$])').test(src)) none.push(id);
  else if (!new RegExp('\\.' + e + '(?![\\w$])|[\'"`]' + e + '[\'"`]').test(src)) weak.push(id);
}
const noLayout = Object.keys(groups).filter(
  (g) => !new RegExp('layout:\\s*[\'"]' + esc(g) + '[\'"]').test(src)
);
fs.writeFileSync(out + '/none.txt', none.join('\n'));
fs.writeFileSync(out + '/weak.txt', weak.join('\n'));
console.log('total', ids.length, 'groups', Object.keys(groups).length, 'none', none.length, 'weak', weak.length);
console.log('layouts w/o selector:', noLayout.map((g) => `${g}(${groups[g].length})`).join(', '));
