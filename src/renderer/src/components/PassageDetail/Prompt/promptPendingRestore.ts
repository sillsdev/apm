import type { PendingUploadRestore } from '../../../store/upload/pendingMediaUploads';

export interface PromptPendingRestoreArgs {
  sectionId: string;
  orgWorkflowStepId: string;
}

/**
 * Restore metadata for Prompt-step recordings so Home → Retry recreates the
 * sectionresource that findPromptRow needs (TT-7724).
 *
 * Matches PassageDetailPromptAdmin.afterUploadCb: sequence 0, null description,
 * section-scoped (no passageId).
 */
export const promptPendingRestore = ({
  sectionId,
  orgWorkflowStepId,
}: PromptPendingRestoreArgs): PendingUploadRestore | undefined =>
  sectionId && orgWorkflowStepId
    ? {
        kind: 'sectionresource',
        sectionId,
        description: null,
        sequenceNum: 0,
        orgWorkflowStepId,
      }
    : undefined;
