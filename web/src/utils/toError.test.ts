import { errorMessage, toError } from './toError';

describe('toError', () => {
  it('keeps a real Error', () => {
    const err = new Error('boom');
    expect(toError(err)).toBe(err);
  });

  it('wraps anything else', () => {
    expect(toError('bad').message).toBe('bad');
    expect(toError(42).message).toBe('42');
  });
});

describe('errorMessage', () => {
  it('reads the message of an Error', () => {
    expect(errorMessage(new Error('Timed Out'))).toBe('Timed Out');
  });

  it('stringifies non-Error rejections', () => {
    expect(errorMessage('Save failed')).toBe('Save failed');
    expect(errorMessage({ toString: () => 'obj' })).toBe('obj');
  });

  it('returns empty for null, undefined and empty values', () => {
    expect(errorMessage(undefined)).toBe('');
    expect(errorMessage(null)).toBe('');
    expect(errorMessage('')).toBe('');
    expect(errorMessage(new Error(''))).toBe('');
  });
});
