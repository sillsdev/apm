/**
 * Pure decision for the web Upload Pending leave gate (ADR 0017 / step 05).
 * UI prompts and discard live at the call site; this only answers whether the
 * gate must run before leaving `leavingProjectId`.
 */

/** True when leaving a project that still has Upload Pending for a different destination (or logout). */
export const needsUploadPendingLeaveGate = (args: {
  leavingProjectId: string | undefined;
  /** Empty / undefined when logging out or clearing project without opening another. */
  enteringProjectId?: string;
  pendingCount: number;
}): boolean => {
  const { leavingProjectId, enteringProjectId, pendingCount } = args;
  if (!leavingProjectId || pendingCount <= 0) return false;
  if (enteringProjectId && enteringProjectId === leavingProjectId) return false;
  return true;
};
