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
 * uploads (TT-7363). Section and passage resources recreate a sectionresource;
 * general (project) resources only carry topic/category so Home Retry can
 * apply them and resume the configure wizard.
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

  if (resourceType === ResourceTypeEnum.projectResource) {
    return {
      kind: 'projectresource' as const,
      ...(description ? { topic: description } : {}),
      ...(artifactCategoryId ? { artifactCategoryId } : {}),
    };
  }

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
