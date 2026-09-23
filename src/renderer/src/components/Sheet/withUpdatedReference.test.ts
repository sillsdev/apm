import { PassageD } from '../../model';
import { withUpdatedReference } from './withUpdatedReference';

const passageWith = (attrs: Partial<PassageD['attributes']> = {}): PassageD =>
  ({
    type: 'passage',
    id: 'p1',
    attributes: {
      sequencenum: 1,
      book: 'LUK',
      reference: '1:1-4',
      state: '',
      hold: false,
      title: '',
      lastComment: '',
      stepComplete: '',
      dateCreated: '',
      dateUpdated: '',
      lastModifiedBy: 0,
      ...attrs,
    },
  }) as PassageD;

describe('withUpdatedReference', () => {
  it('clears cached chapter/verse attributes when the reference changes (TT-7704 follow-up)', () => {
    const passage = passageWith({
      reference: '1:1-4',
      startChapter: 1,
      endChapter: 1,
      startVerse: 1,
      endVerse: 4,
    });

    const updated = withUpdatedReference(passage, '3:1-4');

    expect(updated?.attributes.reference).toBe('3:1-4');
    expect(updated?.attributes.startChapter).toBeUndefined();
    expect(updated?.attributes.endChapter).toBeUndefined();
    expect(updated?.attributes.startVerse).toBeUndefined();
    expect(updated?.attributes.endVerse).toBeUndefined();
  });

  it('is a no-op when the reference is unchanged', () => {
    const passage = passageWith({
      reference: '1:1-4',
      startChapter: 1,
      endChapter: 1,
      startVerse: 1,
      endVerse: 4,
    });

    const updated = withUpdatedReference(passage, '1:1-4');

    expect(updated).toBe(passage);
  });

  it('is a no-op when there is no passage yet', () => {
    expect(withUpdatedReference(undefined, '1:1-4')).toBeUndefined();
  });
});
