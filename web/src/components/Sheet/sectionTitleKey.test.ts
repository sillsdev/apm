import type { ISheet } from '../../model';
import { sectionTitleKey } from './sectionTitleKey';

// The casts build partial rows: sectionTitleKey reads only sectionId.
describe('sectionTitleKey', () => {
  it('uses the section id so the key follows the section', () => {
    const row = { sectionId: { type: 'section', id: 's1' } } as ISheet;
    expect(sectionTitleKey(row, 3)).toBe('title-s1');
    expect(sectionTitleKey(row, 7)).toBe('title-s1');
  });

  it('falls back to the sheet row for an unsaved section', () => {
    expect(sectionTitleKey({} as ISheet, 3)).toBe('title-row-3');
    expect(sectionTitleKey(undefined, 0)).toBe('title-row-0');
  });
});
