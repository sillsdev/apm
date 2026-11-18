import { needsUploadPendingLeaveGate } from './uploadPendingLeaveGate';

describe('needsUploadPendingLeaveGate', () => {
  it('gates when leaving a project that has Upload Pending for another project', () => {
    expect(
      needsUploadPendingLeaveGate({
        leavingProjectId: 'A',
        enteringProjectId: 'B',
        pendingCount: 2,
      })
    ).toBe(true);
  });

  it('gates on logout when the current project has Upload Pending', () => {
    expect(
      needsUploadPendingLeaveGate({
        leavingProjectId: 'A',
        pendingCount: 1,
      })
    ).toBe(true);
  });

  it('does not gate when re-opening the same project', () => {
    expect(
      needsUploadPendingLeaveGate({
        leavingProjectId: 'A',
        enteringProjectId: 'A',
        pendingCount: 3,
      })
    ).toBe(false);
  });

  it('does not gate when there is no Upload Pending', () => {
    expect(
      needsUploadPendingLeaveGate({
        leavingProjectId: 'A',
        enteringProjectId: 'B',
        pendingCount: 0,
      })
    ).toBe(false);
  });

  it('does not gate when there is no project being left', () => {
    expect(
      needsUploadPendingLeaveGate({
        leavingProjectId: undefined,
        enteringProjectId: 'B',
        pendingCount: 2,
      })
    ).toBe(false);
  });
});
