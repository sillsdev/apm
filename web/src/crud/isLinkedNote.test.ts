import type { SharedResourceD } from '../model/sharedResource';
import { isLinkedNote } from './isLinkedNote';

const passage = (id: string) => ({ id });

const sharedResource = (sourcePassageId?: string): SharedResourceD =>
  ({
    id: 'sr1',
    type: 'sharedresource',
    relationships: sourcePassageId
      ? { passage: { data: { type: 'passage', id: sourcePassageId } } }
      : {},
  }) as SharedResourceD;

describe('isLinkedNote', () => {
  it('is false when there is no shared resource', () => {
    expect(isLinkedNote(passage('p1'), undefined)).toBe(false);
    expect(isLinkedNote(passage('p1'), null)).toBe(false);
  });

  it('is false when shared resource is empty (Passage Detail default)', () => {
    expect(isLinkedNote(passage('p1'), {} as SharedResourceD)).toBe(false);
  });

  it('is false when this passage owns the shared resource', () => {
    expect(isLinkedNote(passage('p1'), sharedResource('p1'))).toBe(false);
  });

  it('is true when shared resource is owned by a different passage', () => {
    expect(isLinkedNote(passage('p1'), sharedResource('source-p'))).toBe(true);
  });

  it('is false when the current passage has no id', () => {
    expect(isLinkedNote({}, sharedResource('source-p'))).toBe(false);
    expect(isLinkedNote(undefined, sharedResource('source-p'))).toBe(false);
  });
});
