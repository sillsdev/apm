import { asrShowsLanguagePicker } from './asrShowsLanguagePicker';

describe('asrShowsLanguagePicker', () => {
  it('is false for a vernacular that does not need a sister', () => {
    expect(asrShowsLanguagePicker('en', false)).toBe(false);
    expect(asrShowsLanguagePicker('en', undefined)).toBe(false);
  });

  it('is true when a sister language is required', () => {
    expect(asrShowsLanguagePicker('xyz', true)).toBe(true);
  });

  it('is true when there is no primary language', () => {
    expect(asrShowsLanguagePicker(undefined, false)).toBe(true);
    expect(asrShowsLanguagePicker('und', false)).toBe(true);
    expect(asrShowsLanguagePicker('', false)).toBe(true);
  });
});
