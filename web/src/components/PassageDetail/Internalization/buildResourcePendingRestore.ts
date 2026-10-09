import type { PendingUploadRestore } from '../../../store/upload/pendingMediaUploads';
import { ResourceTypeEnum } from './ResourceTypeEnum';

export interface BuildResourcePendingRestoreArgs {
  resourceType: ResourceTypeEnum;
  sectionId: string;
  passageId: string;
  description: string | null;
  sequenceNum: number;
  orgWorkflowStepId?: string;
  artifactCategoryId?: string;
}

/**
 * Serializable restore metadata for resource Uploader / MediaRecord pending
 * uploads (TT-7363). Section and passage resources recreate a sectionresource.
 * General (project) resources are to be configured in one go through the add-resource wizard
 * and are not staged as pending uploads.
 */
export function buildResourcePendingRestore(
  args: BuildResourcePendingRestoreArgs
): PendingUploadRestore | undefined {
  const {
    resourceType,
    sectionId,
    passageId,
    description,
    sequenceNum,
    orgWorkflowStepId,
    artifactCategoryId,
  } = args;

  if (!orgWorkflowStepId) return undefined;

  return {
    kind: 'sectionresource' as const,
    sectionId,
    description: description || null,
    sequenceNum,
    orgWorkflowStepId,
    ...(resourceType === ResourceTypeEnum.passageResource ? { passageId } : {}),
    ...(artifactCategoryId ? { artifactCategoryId } : {}),
    ...(description ? { topic: description } : {}),
  };
}
