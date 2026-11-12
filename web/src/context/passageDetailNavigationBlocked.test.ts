import { isPassageNavigationBlocked } from './passageDetailNavigationBlocked';

describe('isPassageNavigationBlocked', () => {
  it('blocks when vernacular recording is active', () => {
    expect(isPassageNavigationBlocked(true, false)).toBe(true);
  });

  it('blocks when comment recording is active', () => {
    expect(isPassageNavigationBlocked(false, true)).toBe(true);
  });

  it('allows navigation when no recording is active', () => {
    expect(isPassageNavigationBlocked(false, false)).toBe(false);
  });
});
