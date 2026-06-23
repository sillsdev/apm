/** Scripture hierarchical spreadsheet rows (Luke sample from Help menu). */
export const hierarchicalLukePasteHeader = [
  'Set #',
  "Title in Translator's Notes",
  'Passage',
  'Book',
  'Breaks',
  'Description',
] as const;

export const hierarchicalLukePasteRows: string[][] = [
  [...hierarchicalLukePasteHeader],
  ['', '', '', '', '', ''],
  [
    '1',
    'Luke wrote this book about Jesus for Theophilus',
    '',
    'Luk',
    'Section 1:1–4',
    '',
  ],
  ['', '', '1', 'Luk', '1:1-4', ''],
  ['', '', '', '', '', ''],
  [
    '2',
    'An angel said that John the Baptizer would be born',
    '',
    'Luk',
    'Section 1:5–25',
    '',
  ],
  ['', '', '1', 'Luk', '1:5-7', ''],
  ['', '', '2', 'Luk', '1:8-10', ''],
  ['', '', '3', 'Luk', '1:11-17', ''],
  ['', '', '4', 'Luk', '1:18-20', ''],
  ['', '', '5', 'Luk', '1:21-25', ''],
  ['', '', '', '', '', '', ''],
  [
    '3',
    'An angel told Mary that Jesus would be born',
    '',
    'Luk',
    'Section 1:26–38',
    '',
  ],
  ['', '', '1', 'Luk', '1:26-28', ''],
  ['', '', '2', 'Luk', '1:29-34', ''],
  ['', '', '3', 'Luk', '1:35-38', ''],
  ['', '', '', '', '', ''],
  ['4', 'Mary visited Elizabeth', '', 'Luk', 'Section 1:39–45', ''],
  ['', '', '1', 'Luk', '1:39-45', ''],
  ['', '', '', '', '', ''],
  ['5', 'Mary praised God', '', 'Luk', 'Section 1:46–56', ''],
  ['', '', '1', 'Luk', '1:46-56', ''],
  ['', '', '', '', '', ''],
  [
    '6',
    'John the Baptizer was born and received his name',
    '',
    'Luk',
    'Section 1:57–66',
    '',
  ],
  ['', '', '1', 'Luk', '1:57-58', ''],
  ['', '', '2', 'Luk', '1:59-64', ''],
  ['', '', '3', 'Luk', '1:65-66', ''],
  ['', '', '', '', '', ''],
  [
    '7',
    'Zechariah prophesied and praised God',
    '',
    'Luk',
    'Section 1:67–80',
    '',
  ],
  ['', '', '1', 'Luk', '1:67-80', ''],
];

export const sheetPasteColNames = [
  'sectionSeq',
  'title',
  'passageSeq',
  'book',
  'reference',
  'comment',
];

/** Duplicate Luke sections until row count exceeds minRows (for batch-boundary tests). */
export function expandHierarchicalPaste(
  minRows: number,
  base: string[][] = hierarchicalLukePasteRows
): string[][] {
  if (base.length >= minRows) return base.map((r) => [...r]);
  const header = base.slice(0, 2);
  const body = base.slice(2);
  const expanded = [...header];
  let seq = 1;
  let copy = 0;
  while (expanded.length < minRows) {
    copy += 1;
    for (const row of body) {
      if (expanded.length >= minRows) break;
      if (row[0] && /^\d+$/.test(row[0])) {
        expanded.push([String(seq), ...row.slice(1)]);
        seq += 1;
      } else {
        expanded.push([...row]);
      }
    }
    if (copy > 50) break;
  }
  return expanded;
}
