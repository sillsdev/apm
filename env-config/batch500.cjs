const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '..', 'localization', 'missing.txt');
const outputPath = path.join(__dirname, '..', 'localization', 'missing500.txt');

const MAX_CHARS = 500;

const content = fs.readFileSync(inputPath, 'utf8');
const lines = content.split(/\r?\n/);

const outputParts = [];
let batch = [];
let batchLength = 0;

for (const line of lines) {
  // If adding this line would push the batch over the limit, flush the batch first.
  if (batch.length > 0 && batchLength + line.length > MAX_CHARS) {
    outputParts.push(batch.join('\n'));
    batch = [];
    batchLength = 0;
  }

  batch.push(line);
  batchLength += line.length + 2;
}

// Flush any remaining lines.
if (batch.length > 0) {
  outputParts.push(batch.join('\n'));
}

// Separate each batch with a blank line.
fs.writeFileSync(outputPath, outputParts.join('\n\n') + '\n', 'utf8');

console.log(`Wrote ${outputParts.length} batch(es) to ${outputPath}`);
