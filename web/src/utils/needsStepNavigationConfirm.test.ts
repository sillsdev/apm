import { needsStepNavigationConfirm } from './needsStepNavigationConfirm';

describe('needsStepNavigationConfirm', () => {
  const complete = new Set(['done-a', 'done-b']);

  it('returns false when source and target are the same', () => {
    expect(
      needsStepNavigationConfirm('step-1', 'step-1', (id) => complete.has(id))
    ).toBe(false);
  });

  it('returns false when source or target step id is empty', () => {
    expect(
      needsStepNavigationConfirm('', 'step-2', (id) => complete.has(id))
    ).toBe(false);
    expect(
      needsStepNavigationConfirm('step-1', '', (id) => complete.has(id))
    ).toBe(false);
  });

  it('returns false when leaving a completed step', () => {
    expect(
      needsStepNavigationConfirm('done-a', 'step-2', (id) => complete.has(id))
    ).toBe(false);
  });

  it('returns false when navigating to a completed step', () => {
    expect(
      needsStepNavigationConfirm('step-1', 'done-b', (id) => complete.has(id))
    ).toBe(false);
  });

  it('returns true when leaving an incomplete step for another incomplete step', () => {
    expect(
      needsStepNavigationConfirm('step-1', 'step-2', (id) => complete.has(id))
    ).toBe(true);
  });
});
