import {
  getMarkVersesAutosaveBlockers,
  getMarkVersesValidationIssues,
} from './markVersesValidation';

const strings = {
  badReferences: 'ERROR: bad refs',
  noSegments: 'ERROR: no segment: ({0})',
  missingReferences: 'Warning: missing ({0})',
  outsideReferences: 'ERROR: outside ({0})',
  noReferences: 'Warning: no refs on segments',
  btNotUpdated: 'WARNING: BT not updated',
};

describe('markVersesValidation', () => {
  it('allows autosave when segments lack references (work in progress)', () => {
    const blockers = getMarkVersesAutosaveBlockers({
      rows: [
        { limits: '0.0-5.0', ref: '' },
        { limits: '5.0-9.0', ref: '' },
      ],
      expandedRefs: [],
      passageRefs: ['1:1', '1:2', '1:3', '1:4'],
      hasBtRecordings: false,
      strings,
    });
    expect(blockers).toEqual([]);
  });

  it('blocks autosave on verses outside the passage', () => {
    const blockers = getMarkVersesAutosaveBlockers({
      rows: [{ limits: '0.0-5.0', ref: '9:9' }],
      expandedRefs: ['9:9'],
      passageRefs: ['1:1'],
      hasBtRecordings: false,
      strings,
    });
    expect(blockers.some((b) => b.includes('9:9'))).toBe(true);
  });

  it('includes soft warnings in full issues but not autosave blockers', () => {
    const issues = getMarkVersesValidationIssues({
      rows: [{ limits: '0.0-5.0', ref: '' }],
      expandedRefs: [],
      passageRefs: ['1:1', '1:2'],
      hasBtRecordings: true,
      strings,
    });
    expect(issues).toContain(strings.noReferences);
    expect(issues.some((i) => i.startsWith('Warning: missing'))).toBe(true);
    expect(issues).toContain(strings.btNotUpdated);

    const blockers = getMarkVersesAutosaveBlockers({
      rows: [{ limits: '0.0-5.0', ref: '' }],
      expandedRefs: [],
      passageRefs: ['1:1', '1:2'],
      hasBtRecordings: true,
      strings,
    });
    expect(blockers).toEqual([]);
  });
});

// Sub-verse references (TDD).
//
// `refMatch` already accepts sub-verse syntax (e.g. 1:2a, 3:4b-c), but the
// markup validation compares expanded refs against passageRefs by exact string
// equality. A passage only lists whole verses (1:2, 3:4), so any sub-verse part
// is currently treated as "outside the passage" and the parent verse reported
// "missing".
//
// Coverage rule: assume every verse has at least two sub-verse parts, so a
// verse is only fully covered once BOTH parts a and b are present. A verse with
// only some of its parts is still reported missing (a soft warning, not an
// autosave blocker).
//
// The "no blocker" / "verse completeness" tests describe the behavior we WANT
// and fail today. The "still rejects" tests lock in the rule that repeated or
// overlapping parts must remain invalid.
describe('markVersesValidation - sub-verse references', () => {
  describe('does not treat in-passage sub-verse parts as outside (no blocker)', () => {
    it('does not block a single sub-verse ref (1:2a)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [
          { limits: '0.0-1.0', ref: '1:1' },
          { limits: '1.0-2.0', ref: '1:2a' },
          { limits: '2.0-3.0', ref: '1:3' },
          { limits: '3.0-4.0', ref: '1:4' },
        ],
        expandedRefs: ['1:1', '1:2a', '1:3', '1:4'],
        passageRefs: ['1:1', '1:2', '1:3', '1:4'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers).toEqual([]);
    });

    it('does not block a sub-verse letter range (3:4b-c)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [{ limits: '0.0-1.0', ref: '3:4b-c' }],
        expandedRefs: ['3:4b-c'],
        passageRefs: ['3:4'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers).toEqual([]);
    });

    it('does not block distinct parts of the same verse (1:2a and 1:2b)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [
          { limits: '0.0-1.0', ref: '1:2a' },
          { limits: '1.0-2.0', ref: '1:2b' },
        ],
        expandedRefs: ['1:2a', '1:2b'],
        passageRefs: ['1:2'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers).toEqual([]);
    });

    // A gap in parts (missing b) makes the verse incomplete, but that is a soft
    // "missing" warning — it must not block autosave.
    it('does not block a verse with a gap in its parts (1:2a and 1:2c)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [
          { limits: '0.0-1.0', ref: '1:2a' },
          { limits: '1.0-2.0', ref: '1:2c' },
        ],
        expandedRefs: ['1:2a', '1:2c'],
        passageRefs: ['1:2'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers).toEqual([]);
    });
  });

  describe('verse completeness requires consecutive parts from a', () => {
    const rowsFor = (refs: string[]) =>
      refs.map((ref, i) => ({ limits: `${i}.0-${i + 1}.0`, ref }));

    const missingIssues = (expandedRefs: string[]) =>
      getMarkVersesValidationIssues({
        rows: rowsFor(expandedRefs),
        expandedRefs,
        passageRefs: ['1:1', '1:2', '1:3', '1:4'],
        hasBtRecordings: false,
        strings,
      });

    const reportsMissingVerse2 = (issues: string[]) =>
      issues.some((i) => i.startsWith('Warning: missing') && i.includes('1:2'));
    const reportsOutside = (issues: string[]) =>
      issues.some((i) => i.startsWith('ERROR: outside'));

    it('treats a verse as covered when both a and b are present (1:2a, 1:2b)', () => {
      const issues = missingIssues(['1:1', '1:2a', '1:2b', '1:3', '1:4']);
      expect(reportsMissingVerse2(issues)).toBe(false);
      expect(reportsOutside(issues)).toBe(false);
    });

    it('treats a verse as covered for a contiguous run past b (1:2a, 1:2b, 1:2c)', () => {
      const issues = missingIssues([
        '1:1',
        '1:2a',
        '1:2b',
        '1:2c',
        '1:3',
        '1:4',
      ]);
      expect(reportsMissingVerse2(issues)).toBe(false);
      expect(reportsOutside(issues)).toBe(false);
    });

    it('reports the verse missing when only part a is present (1:2a)', () => {
      const issues = missingIssues(['1:1', '1:2a', '1:3', '1:4']);
      // Part a alone is not enough — part b is missing, so verse 1:2 is missing.
      expect(reportsMissingVerse2(issues)).toBe(true);
      // ...but the part itself belongs to the passage, so it is not "outside".
      expect(reportsOutside(issues)).toBe(false);
    });

    it('reports the verse missing when only part b is present (1:2b)', () => {
      const issues = missingIssues(['1:1', '1:2b', '1:3', '1:4']);
      expect(reportsMissingVerse2(issues)).toBe(true);
      expect(reportsOutside(issues)).toBe(false);
    });

    it('reports the verse missing when parts skip b (1:2a, 1:2c)', () => {
      const issues = missingIssues(['1:1', '1:2a', '1:2c', '1:3', '1:4']);
      expect(reportsMissingVerse2(issues)).toBe(true);
      expect(reportsOutside(issues)).toBe(false);
    });

    it('reports the verse missing on a gap in the run (1:2a, 1:2b, 1:2d skips c)', () => {
      const issues = missingIssues([
        '1:1',
        '1:2a',
        '1:2b',
        '1:2d',
        '1:3',
        '1:4',
      ]);
      // Parts must be consecutive from a: d present but c absent => still missing.
      expect(reportsMissingVerse2(issues)).toBe(true);
      expect(reportsOutside(issues)).toBe(false);
    });
  });

  describe('still rejects repeated or overlapping parts', () => {
    it('blocks the same sub-verse part used twice (1:2a, 1:2a)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [
          { limits: '0.0-1.0', ref: '1:2a' },
          { limits: '1.0-2.0', ref: '1:2a' },
        ],
        expandedRefs: ['1:2a', '1:2a'],
        passageRefs: ['1:2'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers.length).toBeGreaterThan(0);
    });

    it('blocks an overlapping sub-verse range and part (1:2a-c overlaps 1:2b)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [
          { limits: '0.0-1.0', ref: '1:2a-c' },
          { limits: '1.0-2.0', ref: '1:2b' },
        ],
        expandedRefs: ['1:2a-c', '1:2b'],
        passageRefs: ['1:2'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers.length).toBeGreaterThan(0);
    });

    it('blocks a sub-verse part whose verse is outside the passage (9:9a)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [{ limits: '0.0-1.0', ref: '9:9a' }],
        expandedRefs: ['9:9a'],
        passageRefs: ['1:1'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers.length).toBeGreaterThan(0);
    });

    it('still blocks a repeated whole verse (1:1 used twice)', () => {
      const blockers = getMarkVersesAutosaveBlockers({
        rows: [
          { limits: '0.0-1.0', ref: '1:1' },
          { limits: '1.0-2.0', ref: '1:1' },
        ],
        expandedRefs: ['1:1', '1:1'],
        passageRefs: ['1:1', '1:2'],
        hasBtRecordings: false,
        strings,
      });
      expect(blockers.length).toBeGreaterThan(0);
    });
  });

  // The passage's own range can involve a subpart boundary, e.g. "1:1-4a"
  // expands to whole verses 1-3 plus only part a of verse 4, and "1:2b-5"
  // starts part-way through verse 2. The expected (passage) refs then contain a
  // subpart entry, and coverage must respect that boundary:
  //  - marking exactly the expected parts is clean;
  //  - an interior whole verse may still be split into a+b;
  //  - marking past the boundary (whole verse 1:4, or 1:4a-b, when only 1:4a is
  //    expected) is an overshoot and stays flagged as outside.
  describe('expected range involving subparts (e.g. 1:1-4a)', () => {
    const endSubpartPassage = ['1:1', '1:2', '1:3', '1:4a'];
    const startSubpartPassage = ['1:2b', '1:3', '1:4', '1:5'];

    const rowsFor = (refs: string[]) =>
      refs.map((ref, i) => ({ limits: `${i}.0-${i + 1}.0`, ref }));

    const blockersFor = (expandedRefs: string[], passageRefs: string[]) =>
      getMarkVersesAutosaveBlockers({
        rows: rowsFor(expandedRefs),
        expandedRefs,
        passageRefs,
        hasBtRecordings: false,
        strings,
      });

    const issuesFor = (expandedRefs: string[], passageRefs: string[]) =>
      getMarkVersesValidationIssues({
        rows: rowsFor(expandedRefs),
        expandedRefs,
        passageRefs,
        hasBtRecordings: false,
        strings,
      });

    const hasMissing = (issues: string[]) =>
      issues.some((i) => i.startsWith('Warning: missing'));
    const hasOutside = (issues: string[]) =>
      issues.some((i) => i.startsWith('ERROR: outside'));

    it('accepts exact coverage of a passage ending mid-verse (…, 1:4a)', () => {
      const refs = ['1:1', '1:2', '1:3', '1:4a'];
      expect(blockersFor(refs, endSubpartPassage)).toEqual([]);
      const issues = issuesFor(refs, endSubpartPassage);
      expect(hasMissing(issues)).toBe(false);
      expect(hasOutside(issues)).toBe(false);
    });

    it('accepts an interior verse split into a+b when the passage ends mid-verse', () => {
      const refs = ['1:1', '1:2a', '1:2b', '1:3', '1:4a'];
      expect(blockersFor(refs, endSubpartPassage)).toEqual([]);
      const issues = issuesFor(refs, endSubpartPassage);
      expect(hasMissing(issues)).toBe(false);
      expect(hasOutside(issues)).toBe(false);
    });

    it('reports the final partial verse missing when its expected part is absent (1:4a)', () => {
      const issues = issuesFor(['1:1', '1:2', '1:3'], endSubpartPassage);
      expect(
        issues.some(
          (i) => i.startsWith('Warning: missing') && i.includes('1:4a')
        )
      ).toBe(true);
    });

    it('flags marking the whole verse as overshoot past the expected end (1:4 vs 1:4a)', () => {
      const refs = ['1:1', '1:2', '1:3', '1:4'];
      expect(blockersFor(refs, endSubpartPassage).length).toBeGreaterThan(0);
    });

    it('flags a part extending past the expected end as overshoot (1:4a-b vs 1:4a)', () => {
      const refs = ['1:1', '1:2', '1:3', '1:4a-b'];
      expect(blockersFor(refs, endSubpartPassage).length).toBeGreaterThan(0);
    });

    it('accepts exact coverage of a passage starting mid-verse (1:2b, …)', () => {
      const refs = ['1:2b', '1:3', '1:4', '1:5'];
      expect(blockersFor(refs, startSubpartPassage)).toEqual([]);
      const issues = issuesFor(refs, startSubpartPassage);
      expect(hasMissing(issues)).toBe(false);
      expect(hasOutside(issues)).toBe(false);
    });

    it('accepts an interior verse split into a+b when the passage starts mid-verse', () => {
      const refs = ['1:2b', '1:3a', '1:3b', '1:4', '1:5'];
      expect(blockersFor(refs, startSubpartPassage)).toEqual([]);
      const issues = issuesFor(refs, startSubpartPassage);
      expect(hasMissing(issues)).toBe(false);
      expect(hasOutside(issues)).toBe(false);
    });

    it('flags marking the whole verse as overshoot before the expected start (1:2 vs 1:2b)', () => {
      const refs = ['1:2', '1:3', '1:4', '1:5'];
      expect(blockersFor(refs, startSubpartPassage).length).toBeGreaterThan(0);
    });
  });
});
