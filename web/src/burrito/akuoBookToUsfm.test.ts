import type { PassageD, PlanD, ProjectD, SectionD } from '../model';
import {
  akuoBookToUsfm,
  collectBurritoBooks,
  projectDefaultToBurritoBookKey,
} from './akuoBookToUsfm';

describe('akuoBookToUsfm', () => {
  const num2 = (bookNum: number) =>
    (({ 1: 'GEN', 4: 'NUM', 40: 'MAT', 43: 'JHN' }) as Record<number, string>)[
      bookNum
    ];

  it('maps A-prefixed slots to 1-based book numbers', () => {
    expect(akuoBookToUsfm('A01', num2)).toBe('GEN');
    expect(akuoBookToUsfm('A04', num2)).toBe('NUM');
  });

  it('maps B-prefixed slots to book numbers offset by 39', () => {
    expect(akuoBookToUsfm('B01', num2)).toBe('MAT');
    expect(akuoBookToUsfm('B04', num2)).toBe('JHN');
  });

  it('trims whitespace on the Akuo token', () => {
    expect(akuoBookToUsfm('  A01  ', num2)).toBe('GEN');
  });

  it('returns undefined for non-matching strings', () => {
    expect(akuoBookToUsfm('C01', num2)).toBeUndefined();
    expect(akuoBookToUsfm('A1', num2)).toBeUndefined();
    expect(akuoBookToUsfm('', num2)).toBeUndefined();
  });
});

describe('projectDefaultToBurritoBookKey', () => {
  const num2 = (bookNum: number) =>
    (({ 1: 'GEN', 4: 'NUM', 40: 'MAT', 43: 'JHN' }) as Record<number, string>)[
      bookNum
    ];

  it('maps Akuo slots like akuoBookToUsfm', () => {
    expect(projectDefaultToBurritoBookKey('A01', num2)).toBe('GEN');
    expect(projectDefaultToBurritoBookKey('B01', num2)).toBe('MAT');
  });

  it('returns 3-digit general designations unchanged', () => {
    expect(projectDefaultToBurritoBookKey('010', num2)).toBe('010');
    expect(projectDefaultToBurritoBookKey('000', num2)).toBe('000');
  });

  it('keeps project-sort general keys instead of mapping them to scripture', () => {
    expect(projectDefaultToBurritoBookKey('A0104', num2)).toBe('A0104');
    expect(projectDefaultToBurritoBookKey('B0108', num2)).toBe('B0108');
    expect(projectDefaultToBurritoBookKey('E0104', num2)).toBe('E0104');
  });

  it('returns undefined for unrecognized non-Akuo strings', () => {
    expect(
      projectDefaultToBurritoBookKey('not-a-book-code', num2)
    ).toBeUndefined();
    expect(projectDefaultToBurritoBookKey('12', num2)).toBeUndefined();
  });
});

describe('collectBurritoBooks', () => {
  const num2 = (bookNum: number) =>
    (({ 1: 'GEN', 40: 'MAT' }) as Record<number, string>)[bookNum];

  const project = (id: string): ProjectD =>
    ({ id, type: 'project', attributes: { name: id } }) as ProjectD;

  const planFor = (id: string, projectId: string): PlanD =>
    ({
      id,
      type: 'plan',
      relationships: { project: { data: { type: 'project', id: projectId } } },
    }) as PlanD;

  const sectionFor = (id: string, planId: string): SectionD =>
    ({
      id,
      type: 'section',
      relationships: { plan: { data: { type: 'plan', id: planId } } },
    }) as SectionD;

  const passageFor = (id: string, sectionId: string, book?: string): PassageD =>
    ({
      id,
      type: 'passage',
      attributes: { book },
      relationships: { section: { data: { type: 'section', id: sectionId } } },
    }) as PassageD;

  const collect = (
    defaults: Record<string, unknown>,
    args: {
      projects: ProjectD[];
      plans: PlanD[];
      sections: SectionD[];
      passages: PassageD[];
    }
  ) =>
    collectBurritoBooks({
      ...args,
      getProjectDefault: (_key, proj) => defaults[proj.id],
      num2BookCode: num2,
    });

  it('collects passage book codes', () => {
    expect(
      collect(
        {},
        {
          projects: [project('proj-1')],
          plans: [planFor('plan-1', 'proj-1')],
          sections: [sectionFor('sec-1', 'plan-1')],
          passages: [passageFor('pas-1', 'sec-1', 'GEN')],
        }
      )
    ).toEqual(['GEN']);
  });

  it('uses a project-sort general key when passages have no book', () => {
    expect(
      collect(
        { 'proj-g': 'A0104' },
        {
          projects: [project('proj-g')],
          plans: [planFor('plan-g', 'proj-g')],
          sections: [sectionFor('sec-g', 'plan-g')],
          passages: [passageFor('pas-g', 'sec-g')],
        }
      )
    ).toEqual(['A0104']);
  });

  it('uses the project book default when passages have no book', () => {
    expect(
      collect(
        { 'proj-g': '010' },
        {
          projects: [project('proj-g')],
          plans: [planFor('plan-g', 'proj-g')],
          sections: [sectionFor('sec-g', 'plan-g')],
          passages: [passageFor('pas-g', 'sec-g')],
        }
      )
    ).toEqual(['010']);
  });

  it('keeps the passage book when a project default is also set', () => {
    expect(
      collect(
        { 'proj-1': '010' },
        {
          projects: [project('proj-1')],
          plans: [planFor('plan-1', 'proj-1')],
          sections: [sectionFor('sec-1', 'plan-1')],
          passages: [passageFor('pas-1', 'sec-1', 'GEN')],
        }
      )
    ).toEqual(['GEN']);
  });

  it('warns and keeps each passage book when one project has several', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      collect(
        {},
        {
          projects: [project('proj-1')],
          plans: [planFor('plan-1', 'proj-1')],
          sections: [
            sectionFor('sec-1', 'plan-1'),
            sectionFor('sec-2', 'plan-1'),
          ],
          passages: [
            passageFor('pas-1', 'sec-1', 'GEN'),
            passageFor('pas-2', 'sec-2', 'MAT'),
          ],
        }
      )
    ).toEqual(['GEN', 'MAT']);
    expect(warn).toHaveBeenCalledWith('multiple books in one project');
    warn.mockRestore();
  });
});
