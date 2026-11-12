import { resolveSegmentSpeaker } from './resolveSegmentSpeaker';

describe('resolveSegmentSpeaker', () => {
  const key = 'test-careful-speaker';

  beforeEach(() => {
    localStorage.clear();
  });

  it('prefers performedBy from the segment mediafile', () => {
    localStorage.setItem(key, 'FromStorage');
    expect(resolveSegmentSpeaker('FromMedia', key)).toBe('FromMedia');
  });

  it('falls back to localStorage when performedBy is missing', () => {
    localStorage.setItem(key, 'FromStorage');
    expect(resolveSegmentSpeaker(undefined, key)).toBe('FromStorage');
    expect(resolveSegmentSpeaker(null, key)).toBe('FromStorage');
    expect(resolveSegmentSpeaker('', key)).toBe('FromStorage');
  });

  it('returns empty string when neither source has a speaker', () => {
    expect(resolveSegmentSpeaker(undefined, key)).toBe('');
  });
});
