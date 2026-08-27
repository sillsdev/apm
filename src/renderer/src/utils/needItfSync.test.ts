import {
  clearNeedItfSync,
  markNeedItfSync,
  needItfSync,
  shouldRunItfSync,
} from './needItfSync';
import { LocalKey } from './localUserKey';

describe('needItfSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is off until an online-linked user goes offline', () => {
    expect(needItfSync()).toBe(false);
    markNeedItfSync();
    expect(needItfSync()).toBe(true);
    expect(localStorage.getItem(LocalKey.needItfSync)).toBe('true');
  });

  it('does not export ITF on a normal online Electron start', () => {
    expect(
      shouldRunItfSync({
        isElectron: true,
        offline: false,
        needItf: needItfSync(),
      })
    ).toBe(false);
  });

  it('exports ITF only after an offline session when back online on Electron', () => {
    markNeedItfSync();
    expect(
      shouldRunItfSync({ isElectron: true, offline: false, needItf: true })
    ).toBe(true);
    expect(
      shouldRunItfSync({ isElectron: true, offline: true, needItf: true })
    ).toBe(false);
    expect(
      shouldRunItfSync({ isElectron: false, offline: false, needItf: true })
    ).toBe(false);
  });

  it('clears the flag after a successful export attempt', () => {
    markNeedItfSync();
    clearNeedItfSync();
    expect(needItfSync()).toBe(false);
  });
});
