import { buildSelectSectionRows } from './buildSelectSectionRows';
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
  const organizedBy = 'Section';

  it('omits passage rows when isFlat (TT-6936)', () => {
    const rows = buildSelectSectionRows({
      sections: [section('s1', 1)],
      passages: [passage('p1', 's1', 1), passage('p2', 's1', 2)],
      bookData: [],
      planId: 'plan-1',
      isFlat: true,
      organizedBy,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].recId).toBe('s1');
    expect(rows[0].parentId).toBe('');
    expect(rows[0].passages).toBe('2');
    expect(rows[0].kind).toBe('section');
  });

  it('includes passage children when not flat', () => {
    const rows = buildSelectSectionRows({
      sections: [section('s1', 1)],
      passages: [passage('p1', 's1', 1), passage('p2', 's1', 2)],
      bookData: [],
      planId: 'plan-1',
      isFlat: false,
      organizedBy,
    });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.recId)).toEqual(['s1', 'p1', 'p2']);
    expect(rows.map((r) => r.kind)).toEqual([
      'section',
      'passage',
      'passage',
    ]);
    expect(rows[1].parentId).toBe('s1');
    expect(rows[2].parentId).toBe('s1');
  });

  it('ignores BOOK passages without creating title rows', () => {
    const rows = buildSelectSectionRows({
      sections: [section('s1', 1)],
      passages: [
        passage('book', 's1', 0, 'BOOK'),
        passage('p1', 's1', 1),
      ],
      bookData: [],
      planId: 'plan-1',
      isFlat: false,
      organizedBy,
    });
    expect(rows.map((row) => row.recId)).toEqual(['s1', 'p1']);
    expect(rows.map((row) => row.kind)).toEqual(['section', 'passage']);
  });
});
