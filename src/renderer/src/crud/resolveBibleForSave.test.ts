import { BibleD } from '../model';
import { resolveBibleForSave } from './resolveBibleForSave';

const bible = (id: string, bibleId: string): BibleD =>
  ({
    id,
    type: 'bible',
    attributes: { bibleId },
  }) as BibleD;

const current = bible('b-current', 'ENGABC');
const matching = bible('b-match', 'ENGXYZ');

describe('resolveBibleForSave', () => {
  it('returns undefined when bibleId is empty', () => {
    expect(
      resolveBibleForSave('', matching, current, 'team-1', 'team-1')
    ).toBeUndefined();
  });

  it('uses an existing bible when the bibleId already exists', () => {
    expect(
      resolveBibleForSave('ENGXYZ', matching, current, 'other-team', 'team-1')
    ).toBe(matching);
  });

  it('skips persist when this team does not own the bible and bibleId is unchanged', () => {
    expect(
      resolveBibleForSave('ENGABC', current, current, 'other-team', 'team-1')
    ).toBeUndefined();
  });

  it('updates the current bible when this team owns it and bibleId is unchanged', () => {
    expect(
      resolveBibleForSave('ENGABC', current, current, 'team-1', 'team-1')
    ).toBe(current);
  });

  it('updates the current bible when this team owns it', () => {
    expect(
      resolveBibleForSave('ENGNEW1', undefined, current, 'team-1', 'team-1')
    ).toBe(current);
  });

  it('creates a new bible when this team does not own the current one', () => {
    const result = resolveBibleForSave(
      'ENGNEW1',
      undefined,
      current,
      'other-team',
      'team-1'
    );
    expect(result?.id).toBeUndefined();
    expect(result?.type).toBe('bible');
  });

  it('creates a new bible when the team has none yet', () => {
    const result = resolveBibleForSave(
      'ENGNEW1',
      undefined,
      undefined,
      undefined,
      'team-1'
    );
    expect(result?.id).toBeUndefined();
    expect(result?.type).toBe('bible');
  });
});
