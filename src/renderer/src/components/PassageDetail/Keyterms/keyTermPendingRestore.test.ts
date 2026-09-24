import { describe, expect, it } from '@jest/globals';
import { keyTermPendingRestore } from './keyTermPendingRestore';

describe('keyTermPendingRestore (TT-7721)', () => {
  it('returns orgkeytermtarget restore meta for Term Verify audio', () => {
    expect(
      keyTermPendingRestore({
        term: 'grace',
        termIndex: 2,
        target: 'favor',
        organizationId: 'org-1',
      })
    ).toEqual({
      kind: 'orgkeytermtarget',
      term: 'grace',
      termIndex: 2,
      target: 'favor',
      organizationId: 'org-1',
    });
  });

  it('returns undefined without an organization', () => {
    expect(
      keyTermPendingRestore({
        term: 'grace',
        termIndex: 0,
        target: 'favor',
        organizationId: '',
      })
    ).toBeUndefined();
  });

  it('returns undefined without a term', () => {
    expect(
      keyTermPendingRestore({
        term: '',
        termIndex: 0,
        target: 'favor',
        organizationId: 'org-1',
      })
    ).toBeUndefined();
  });
});
