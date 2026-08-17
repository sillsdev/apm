import { passagesForSection } from './passagesForSection';
import { PassageD } from '../model';

const createMockMemory = (passages: PassageD[]) =>
  ({
    cache: {
      query: () => passages,
    },
  }) as any;

describe('passagesForSection', () => {
  it('returns empty when memory or section id missing', () => {
    expect(passagesForSection(undefined, 's1')).toEqual([]);
    expect(passagesForSection(createMockMemory([]), undefined)).toEqual([]);
  });

  it('filters passages by section relationship (TT-7023 offline)', () => {
    const passages = [
      {
        id: 'p1',
        relationships: { section: { data: { type: 'section', id: 's1' } } },
      },
      {
        id: 'p2',
        relationships: { section: { data: { type: 'section', id: 's2' } } },
      },
      {
        id: 'p3',
        relationships: { section: { data: { type: 'section', id: 's1' } } },
      },
    ] as PassageD[];
    const result = passagesForSection(createMockMemory(passages), 's1');
    expect(result.map((p) => p.id)).toEqual(['p1', 'p3']);
  });
});
