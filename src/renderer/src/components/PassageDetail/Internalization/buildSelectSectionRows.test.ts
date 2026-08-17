import {
  buildSelectSectionRows,
  selectSectionRowType,
} from './buildSelectSectionRows';
import { PassageD, SectionD } from '../../../model';

const section = (id: string, sequencenum: number, planId = 'plan-1'): SectionD =>
  ({
    type: 'section',
    id,
    attributes: { sequencenum, name: `Section ${sequencenum}` },
    relationships: { plan: { data: { type: 'plan', id: planId } } },
  }) as SectionD;

const passage = (
  id: string,
  sectionId: string,
  sequencenum: number,
  reference = '1:1'
): PassageD =>
  ({
    type: 'passage',
    id,
    attributes: { sequencenum, reference, book: 'GEN' },
    relationships: { section: { data: { type: 'section', id: sectionId } } },
  }) as PassageD;

describe('buildSelectSectionRows', () => {
  const sectionMap = new Map<number, string>();

  it('omits passage rows when isFlat (TT-6936)', () => {
    const rows = buildSelectSectionRows({
      sections: [section('s1', 1)],
      passages: [passage('p1', 's1', 1), passage('p2', 's1', 2)],
      bookData: [],
      planId: 'plan-1',
      isFlat: true,
      sectionMap,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].recId).toBe('s1');
    expect(rows[0].parentId).toBe('');
    expect(rows[0].passages).toBe('2');
  });

  it('includes passage children when not flat', () => {
    const rows = buildSelectSectionRows({
      sections: [section('s1', 1)],
      passages: [passage('p1', 's1', 1), passage('p2', 's1', 2)],
      bookData: [],
      planId: 'plan-1',
      isFlat: false,
      sectionMap,
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.recId)).toEqual(['s1', 'p1', 'p2']);
    expect(rows[1].parentId).toBe('s1');
    expect(rows[2].parentId).toBe('s1');
  });
});

describe('selectSectionRowType', () => {
  it('returns section for flat section rows', () => {
    expect(
      selectSectionRowType({ parentId: '', passages: '1' }, true)
    ).toBe('section');
  });

  it('returns section for hierarchical multi-passage section rows', () => {
    expect(
      selectSectionRowType({ parentId: '', passages: '3' }, false)
    ).toBe('section');
  });

  it('returns passage for child rows', () => {
    expect(
      selectSectionRowType({ parentId: 's1', passages: '' }, false)
    ).toBe('passage');
  });
});
