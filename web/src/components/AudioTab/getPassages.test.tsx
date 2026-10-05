import { PassageD, SectionD } from '../../model';
import { passageRow } from './getPassages';
import { sequenceSortKey } from '../../utils/sort';

const defPassage = {
  id: '1',
  attributes: {
    reference: '1:1',
    sequencenum: 1,
    book: 'Gen',
  },
} as PassageD;
const defSection = {
  id: '1',
  attributes: {
    sequencenum: 1,
    name: 'Creation',
  },
} as SectionD;
const defData = {
  media: [],
  allBookData: [],
};

const newRef = (ref: string) =>
  ({
    ...defPassage,
    attributes: { ...defPassage.attributes, reference: ref },
  }) as PassageD;

describe('src/components/AudioTab/getPassages.test.tsx', () => {
  it('should return parsed reference for Gen 1:1', () => {
    const result = passageRow(defPassage, defSection, defData);

    // console.log(Array.from(result.sectionDesc).map((c) => c.codePointAt(0)));
    expect(result).toEqual({
      passageId: '1',
      sectionId: '1',
      sectionDesc: '  1\xa0\xa0Creation',
      reference: 'Gen 1:1',
      attached: 'N',
      sort: '00001000.00001000',
      book: 'Gen',
      chap: 1,
      beg: 1,
      endChap: -1,
      end: -1,
      pasNum: 1,
      secNum: 1,
    });
  });

  it('should return parsed reference for Gen 1:1a', () => {
    const passage = newRef('1:1a');
    const result = passageRow(passage, defSection, defData);

    expect(result.chap).toBe(1);
    expect(result.beg).toBe(1);
    expect(result.sort).toBe('00001000.00001000');
  });

  it('should return parsed reference for Gen 1:1-3', () => {
    const passage = newRef('1:1-3');
    const result = passageRow(passage, defSection, defData);

    expect(result).toEqual({
      passageId: '1',
      sectionId: '1',
      sectionDesc: '  1\xa0\xa0Creation',
      reference: 'Gen 1:1-3',
      attached: 'N',
      sort: '00001000.00001000',
      book: 'Gen',
      chap: 1,
      beg: 1,
      endChap: -1,
      end: 3,
      pasNum: 1,
      secNum: 1,
    });
  });

  it('should return parsed reference for Gen 1:26-2:3', () => {
    const passage = newRef('1:26-2:3');
    const result = passageRow(passage, defSection, defData);

    expect(result).toEqual({
      passageId: '1',
      sectionId: '1',
      sectionDesc: '  1\xa0\xa0Creation',
      reference: 'Gen 1:26-2:3',
      attached: 'N',
      sort: '00001000.00001000',
      book: 'Gen',
      chap: 1,
      beg: 26,
      endChap: 2,
      end: 3,
      pasNum: 1,
      secNum: 1,
    });
  });
});

describe('sequenceSortKey', () => {
  it('keeps numeric order as a string sort (10 after 2, not before)', () => {
    const keys = [
      sequenceSortKey(1, 1),
      sequenceSortKey(1, 10),
      sequenceSortKey(1, 2),
      sequenceSortKey(10, 1),
      sequenceSortKey(2, 1),
    ];
    expect([...keys].sort()).toEqual([
      sequenceSortKey(1, 1),
      sequenceSortKey(1, 2),
      sequenceSortKey(1, 10),
      sequenceSortKey(2, 1),
      sequenceSortKey(10, 1),
    ]);
  });

  it('orders by section first, then passage', () => {
    expect(sequenceSortKey(1, 99) < sequenceSortKey(2, 1)).toBe(true);
  });

  it('handles fractional (inserted) sequence numbers', () => {
    expect(sequenceSortKey(1, 1) < sequenceSortKey(1, 1.5)).toBe(true);
    expect(sequenceSortKey(1, 1.5) < sequenceSortKey(1, 2)).toBe(true);
  });
});
