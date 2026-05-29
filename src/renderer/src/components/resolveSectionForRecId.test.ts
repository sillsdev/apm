import { PassageD, SectionD } from '../model';
import {
  resolveSectionForRecId,
  resolveSelectedSections,
} from './resolveSectionForRecId';

const section1 = {
  id: 'sec-1',
  type: 'section',
  attributes: { sequencenum: 1 },
} as SectionD;

const passage1 = {
  id: 'pas-1',
  type: 'passage',
  attributes: { sequencenum: 1 },
  relationships: {
    section: { data: { type: 'section', id: 'sec-1' } },
  },
} as PassageD;

const data = [
  { recId: 'sec-1', parentId: '' },
  { recId: 'pas-1', parentId: 'sec-1' },
];

describe('resolveSectionForRecId', () => {
  it('resolves a section row by recId', () => {
    expect(
      resolveSectionForRecId('sec-1', data, [section1], [passage1])
    ).toBe(section1);
  });

  it('resolves a passage row to its parent section', () => {
    expect(
      resolveSectionForRecId('pas-1', data, [section1], [passage1])
    ).toBe(section1);
  });

  it('returns undefined for unknown recId', () => {
    expect(
      resolveSectionForRecId('missing', data, [section1], [passage1])
    ).toBeUndefined();
  });
});

describe('resolveSelectedSections', () => {
  it('deduplicates sections when multiple passage rows share a parent', () => {
    const selected = resolveSelectedSections(
      ['pas-1', 'sec-1'],
      data,
      [section1],
      [passage1]
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBe(section1);
  });
});
