import { PassageD } from '../../model';
import { withUpdatedReference } from './withUpdatedReference';
import { memory } from '../../schema';
import { getSerializer } from '../../serializers/getSerializer';

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
  it('clears stale chapter/verse attributes and recomputes them immediately (TT-7704 follow-up, PR #675 review)', () => {
    const passage = passageWith({
      reference: '1:1-4',
      startChapter: 1,
      endChapter: 1,
      startVerse: 1,
      endVerse: 4,
    });

    const updated = withUpdatedReference(passage, '3:1-4');

    expect(updated?.attributes.reference).toBe('3:1-4');
    expect(updated?.attributes.startChapter).toBe(3);
    expect(updated?.attributes.endChapter).toBe(3);
    expect(updated?.attributes.startVerse).toBe(1);
    expect(updated?.attributes.endVerse).toBe(4);
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

  // PR #675 review (r4087346106): "It would be better to parseRef immediately
  // instead of setting these to undefined". Reason: JSONAPIResourceSerializer
  // (used to sync `memory` to the online db) skips any attribute whose value
  // is `undefined` when building the outgoing PATCH — see
  // @orbit/jsonapi's serializeAttribute, `if (value === undefined) return;`.
  // So clearing startChapter/etc to undefined never overwrites the stale
  // number already stored online; the next full refetch brings the stale
  // chapter straight back (parseRef's own guard then skips recomputing it
  // because it looks like a real, already-parsed value). Calling parseRef
  // immediately produces a real number that DOES get sent to the online db.
  it('recomputes chapter/verse immediately so the online db actually receives the new values', () => {
    const passage = passageWith({
      book: 'MAT',
      reference: '1:1-4',
      startChapter: 1,
      endChapter: 1,
      startVerse: 1,
      endVerse: 4,
    });

    const updated = withUpdatedReference(passage, '3:1-4');

    const resource = getSerializer(memory).serialize(updated as PassageD);

    expect(resource.attributes?.['start-chapter']).toBe(3);
    expect(resource.attributes?.['end-chapter']).toBe(3);
    expect(resource.attributes?.['start-verse']).toBe(1);
    expect(resource.attributes?.['end-verse']).toBe(4);
  });
});
