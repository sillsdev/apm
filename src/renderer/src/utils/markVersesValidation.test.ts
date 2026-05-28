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
