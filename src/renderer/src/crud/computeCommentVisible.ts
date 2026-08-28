/** Same string values as PermissionName — kept local to avoid importing the hook. */
const CIT = 'consultantInTraining';
const MENTOR = 'mentor';

export interface ComputeCommentVisibleArgs {
  /** When set (e.g. mentor approval toggle), merge into existing permissions. */
  approved?: boolean;
  /** Existing comment.attributes.visible JSON string (for approve path). */
  existingPermissions?: string;
  isCIT: boolean;
  isMentor: boolean;
  /** Remote or local user id stamped as `author` when CIT needs approval. */
  authorId: string;
}

/**
 * Compute comment `visible` JSON the same way as useSaveComment
 * (CIT/Mentor access + needs-approval / approve).
 */
export function computeCommentVisible(
  args: ComputeCommentVisibleArgs
): Record<string, unknown> {
  if (args.approved !== undefined) {
    const json = args.existingPermissions
      ? (JSON.parse(args.existingPermissions) as Record<string, unknown>)
      : {};
    return { ...json, approved: args.approved };
  }
  if (args.isCIT || args.isMentor) {
    let visible: Record<string, unknown> = {
      [CIT]: true,
      [MENTOR]: true,
    };
    if (args.isCIT) {
      visible = {
        ...visible,
        approved: false,
        author: args.authorId,
      };
    }
    return visible;
  }
  return {};
}

export function computeCommentVisibleString(
  args: ComputeCommentVisibleArgs
): string {
  return JSON.stringify(computeCommentVisible(args));
}
