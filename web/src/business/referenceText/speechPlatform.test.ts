import { speechPlatform } from './speechPlatform';

describe('speechPlatform', () => {
  it('reads userAgentData and navigator.platform values', () => {
    expect(speechPlatform('Windows', '')).toBe('windows');
    expect(speechPlatform('Win32', '')).toBe('windows');
    expect(speechPlatform('macOS', '')).toBe('mac');
    expect(speechPlatform('MacIntel', '')).toBe('mac');
    expect(speechPlatform('Linux', '')).toBe('linux');
    expect(speechPlatform('Linux x86_64', '')).toBe('linux');
  });

  it('treats Android and ChromeOS as other, though they report Linux', () => {
    expect(speechPlatform('Android', '')).toBe('other');
    expect(
      speechPlatform('Linux armv8l', 'Mozilla/5.0 (Linux; Android 14)')
    ).toBe('other');
    expect(speechPlatform('Chrome OS', '')).toBe('other');
    expect(
      speechPlatform('Linux x86_64', 'Mozilla/5.0 (X11; CrOS x86_64)')
    ).toBe('other');
  });

  it('is other when unknown', () => {
    expect(speechPlatform('', '')).toBe('other');
    expect(speechPlatform('iPhone', '')).toBe('other');
  });
});
