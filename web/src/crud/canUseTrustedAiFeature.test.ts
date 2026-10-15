import { canUseTrustedAiFeature } from './canUseTrustedAiFeature';

describe('canUseTrustedAiFeature', () => {
  it('offers the control when the team feature is on, the user is online, and they may create shared content', () => {
    expect(canUseTrustedAiFeature(true, false, true)).toBe(true);
  });

  it('hides the control when the team feature is off', () => {
    expect(canUseTrustedAiFeature(false, false, true)).toBe(false);
    expect(canUseTrustedAiFeature(undefined, false, true)).toBe(false);
  });

  it('hides the control while offline', () => {
    expect(canUseTrustedAiFeature(true, true, true)).toBe(false);
  });

  it('hides the control when the user may not create shared content', () => {
    expect(canUseTrustedAiFeature(true, false, false)).toBe(false);
    expect(canUseTrustedAiFeature(true, false, undefined)).toBe(false);
  });
});
