import type { ISheet } from '../../model';
import { sectionTitleKey } from './sectionTitleKey';

// The casts build partial rows: sectionTitleKey reads only sectionId and rowKey.
describe('sectionTitleKey', () => {
  it('uses the section id of a loaded row so the key follows the section', () => {
    const row = { sectionId: { type: 'section', id: 's1' } } as ISheet;
    expect(sectionTitleKey(row, 3)).toBe('title-s1');
    expect(sectionTitleKey(row, 7)).toBe('title-s1');
  });

  it('keeps the rowKey of a new row through its first save', () => {
    const added = { rowKey: 'k1' } as ISheet;
    const saved = {
      rowKey: 'k1',
      sectionId: { type: 'section', id: 's1' },
    } as ISheet;
    expect(sectionTitleKey(added, 3)).toBe('title-key-k1');
    expect(sectionTitleKey(saved, 7)).toBe('title-key-k1');
  });

  it('falls back to the sheet row when the row has no identity', () => {
    expect(sectionTitleKey({} as ISheet, 3)).toBe('title-row-3');
    expect(sectionTitleKey(undefined, 0)).toBe('title-row-0');
  });
});
