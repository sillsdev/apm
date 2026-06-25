/** Trimmed Genesis hierarchical paste — enough rows for shtNumChanges > 10. */
export const genesisPasteTrimmed: string[][] = [
  [
    'Set #',
    "Title in Translator's Notes",
    'Passage',
    'Book',
    'Breaks',
    'Description',
  ],
  ['', '', '', '', '', ''],
  ['1', 'God created the heavens and the earth', '', 'Gen', 'Section 1:1–2:3', ''],
  ['', '', '1', 'Gen', '1:1-5', ''],
  ['', '', '2', 'Gen', '1:6-8', ''],
  ['', '', '3', 'Gen', '1:9-13', ''],
  ['', '', '4', 'Gen', '1:14-19', ''],
  ['', '', '', '', '', ''],
  ['2', 'God formed the man', '', 'Gen', 'Section 2:4–25', ''],
  ['', '', '1', 'Gen', '2:4-7', ''],
  ['', '', '2', 'Gen', '2:8-14', ''],
  ['', '', '3', 'Gen', '2:15-17', ''],
  ['', '', '4', 'Gen', '2:18-25', ''],
  ['', '', '', '', '', ''],
  ['3', 'The man and woman disobeyed God', '', 'Gen', 'Section 3:1–24', ''],
  ['', '', '1', 'Gen', '3:1-7', ''],
  ['', '', '2', 'Gen', '3:8-13', ''],
  ['', '', '3', 'Gen', '3:14-19', ''],
  ['', '', '4', 'Gen', '3:20-24', ''],
];

export const findGenesisBook = (val: string) => (/GEN/i.test(val) ? 'GEN' : '');
