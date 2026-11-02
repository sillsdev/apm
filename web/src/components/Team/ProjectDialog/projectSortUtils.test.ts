import { expect, describe, it } from '@jest/globals';
import { ProjectD } from '../../../model';
import { ProjectSortItem, SortMap, sortProjects } from './projectSortUtils';

const item = (
  id: string,
  name: string,
  book?: string
): ProjectSortItem<string> => ({
  item: name,
  project: {
    id,
    type: 'project',
    keys: { remoteId: id },
  } as unknown as ProjectD,
  book,
  name,
});

const genesis = item('1', 'Genesis', 'A01');
const exodus = item('3', 'Exodus', 'A02');
const luke = item('2', 'Luke', 'B03');

describe('sortProjects', () => {
  it('sorts by book when the team has no saved order', () => {
    expect(sortProjects([genesis, luke, exodus], new Map())).toEqual([
      'Genesis',
      'Exodus',
      'Luke',
    ]);
  });

  it('keeps the saved manual order', () => {
    const map: SortMap = new Map([
      ['2', 0],
      ['1', 1],
    ]);
    expect(sortProjects([genesis, luke], map)).toEqual(['Luke', 'Genesis']);
  });

  // TT-7820: Exodus was added after the team saved Genesis, Luke.
  it('inserts a project missing from the saved order by its book', () => {
    const map: SortMap = new Map([
      ['1', 0],
      ['2', 1],
    ]);
    expect(sortProjects([genesis, luke, exodus], map)).toEqual([
      'Genesis',
      'Exodus',
      'Luke',
    ]);
  });

  it('inserts a project before the first saved project with a later book', () => {
    const map: SortMap = new Map([
      ['2', 0],
      ['1', 1],
    ]);
    expect(sortProjects([genesis, luke, exodus], map)).toEqual([
      'Exodus',
      'Luke',
      'Genesis',
    ]);
  });
});
