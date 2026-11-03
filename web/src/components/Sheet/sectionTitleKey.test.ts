import type { ISheet } from '../../model';
import { sectionTitleKey } from './sectionTitleKey';

// The casts build partial rows: sectionTitleKey reads only sectionId and rowKey.
describe('sectionTitleKey', () => {
  it('uses the section id so the key follows the section', () => {
    const row = { sectionId: { type: 'section', id: 's1' } } as ISheet;
    expect(sectionTitleKey(row, 3)).toBe('title-s1');
    expect(sectionTitleKey(row, 7)).toBe('title-s1');
  });

  it('uses the rowKey of an unsaved section', () => {
    const row = { rowKey: 'k1' } as ISheet;
    expect(sectionTitleKey(row, 3)).toBe('title-key-k1');
    expect(sectionTitleKey(row, 7)).toBe('title-key-k1');
  });

  it('falls back to the sheet row when the row has no identity', () => {
    expect(sectionTitleKey({} as ISheet, 3)).toBe('title-row-3');
    expect(sectionTitleKey(undefined, 0)).toBe('title-row-0');
  });
});
