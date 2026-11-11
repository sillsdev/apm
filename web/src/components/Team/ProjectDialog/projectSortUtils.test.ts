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

  it('returns an empty list when there are no projects', () => {
    expect(sortProjects([], new Map())).toEqual([]);
  });

  // A project with no book is compared by its name against the book codes.
  it('inserts a project with no book by its name', () => {
    const map: SortMap = new Map([
      ['1', 0],
      ['2', 1],
    ]);
    const acts = item('4', 'Acts');
    expect(sortProjects([genesis, luke, acts], map)).toEqual([
      'Genesis',
      'Acts',
      'Luke',
    ]);
  });

  it('puts a project with no book or name last', () => {
    const map: SortMap = new Map([
      ['1', 0],
      ['2', 1],
    ]);
    const unnamed: ProjectSortItem<string> = {
      ...item('4', ''),
      item: 'Unnamed',
      name: undefined,
    };
    expect(sortProjects([unnamed, genesis, luke], map)).toEqual([
      'Genesis',
      'Luke',
      'Unnamed',
    ]);
  });

  it('inserts a plan with no project record by its book', () => {
    const map: SortMap = new Map([
      ['1', 0],
      ['2', 1],
    ]);
    const noRecord: ProjectSortItem<string> = {
      item: 'Exodus',
      book: 'A02',
      name: 'Exodus',
    };
    expect(sortProjects([luke, noRecord, genesis], map)).toEqual([
      'Genesis',
      'Exodus',
      'Luke',
    ]);
  });

  it('orders projects with the same saved position by book', () => {
    const map: SortMap = new Map([
      ['1', 0],
      ['2', 0],
    ]);
    expect(sortProjects([luke, genesis], map)).toEqual(['Genesis', 'Luke']);
  });

  it('orders projects with the same saved position and book by name', () => {
    const ruth = item('5', 'Ruth', 'A02');
    const map: SortMap = new Map([
      ['5', 0],
      ['3', 0],
    ]);
    expect(sortProjects([ruth, exodus], map)).toEqual(['Exodus', 'Ruth']);
  });

  it('orders projects with the same book by name', () => {
    const ruth = item('5', 'Ruth', 'A02');
    expect(sortProjects([ruth, genesis, exodus], new Map())).toEqual([
      'Genesis',
      'Exodus',
      'Ruth',
    ]);
  });
});
