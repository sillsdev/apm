import { PassageD, SharedResourceD } from '../model';
import { lookupSharedResource } from './useSharedResRead';

const sr = (id: string, passageId: string): SharedResourceD =>
  ({
    id,
    type: 'sharedresource',
    relationships: {
      passage: { data: { type: 'passage', id: passageId } },
    },
  }) as SharedResourceD;

const passage = (id: string, linkedId?: string): PassageD =>
  ({
    id,
    type: 'passage',
    relationships: linkedId
      ? { sharedResource: { data: { type: 'sharedresource', id: linkedId } } }
      : {},
  }) as PassageD;

describe('lookupSharedResource', () => {
  const resources = [sr('sr-a', 'p1'), sr('sr-b', 'p1'), sr('sr-c', 'p2')];
  const find = lookupSharedResource(resources);

  it('returns the first resource owned by the passage', () => {
    expect(find(passage('p1'))?.id).toBe('sr-a');
    expect(find(passage('p2'))?.id).toBe('sr-c');
  });

  it('returns the linked resource instead of one owned by this passage', () => {
    expect(find(passage('p1', 'sr-c'))?.id).toBe('sr-c');
  });

  it('does not fall back to an owned resource when the link is missing', () => {
    expect(find(passage('p1', 'missing'))).toBeUndefined();
  });
});
