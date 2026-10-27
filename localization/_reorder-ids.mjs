import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
// Windows file URL: /C:/...
const root = dir.replace(/^\/([A-Za-z]:)/, '$1');

const files = fs
  .readdirSync(root)
  .filter((name) => name.endsWith('.xlf') || name.endsWith('.xliff'));

const moves = [
  ['mediaTab.toobig', 'mediaTab.fileTooBig'],
  ['mediaUpload.toobig', 'mediaUpload.fileTooBig'],
];

const elementRe = /[ \t]*<(trans-unit|unit) id="([^"]+)"[\s\S]*?<\/\1>/g;

function moveIntoOrder(text, fromId, toId) {
  elementRe.lastIndex = 0;
  const matches = [...text.matchAll(elementRe)];
  const current = matches.find((m) => m[2] === fromId || m[2] === toId);
  if (!current) return { text, changed: false };

  const block = current[0].replace(`id="${current[2]}"`, `id="${toId}"`);
  let start = current.index;
  let end = start + current[0].length;
  if (start > 0 && text[start - 1] === '\n') start -= 1;
  text = text.slice(0, start) + text.slice(end);

  elementRe.lastIndex = 0;
  const rest = [...text.matchAll(elementRe)];
  const group = toId.slice(0, toId.indexOf('.') + 1);
  const key = toId.toLowerCase();
  const next = rest.find(
    (m) => m[2].startsWith(group) && m[2].toLowerCase() > key
  );
  if (!next) {
    throw new Error(`No later ${group} id for ${toId}`);
  }
  const at = next.index;
  const glue = text[at - 1] === '\n' ? '\n' : '';
  text = text.slice(0, at) + block + glue + text.slice(at);
  return { text, changed: true };
}

for (const name of files) {
  const full = path.join(root, name);
  let text = fs.readFileSync(full, 'utf8');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  let changed = false;
  for (const [fromId, toId] of moves) {
    const result = moveIntoOrder(text, fromId, toId);
    text = result.text;
    changed = changed || result.changed;
  }
  if (!changed) {
    console.log(`skip ${name}`);
    continue;
  }
  if (!text.endsWith(newline)) text += newline;
  fs.writeFileSync(full, text.replace(/\r\n/g, '\n'), 'utf8');
  console.log(`updated ${name}`);
}
