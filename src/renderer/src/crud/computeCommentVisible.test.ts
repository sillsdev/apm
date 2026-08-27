import { describe, expect, it } from '@jest/globals';
import {
  computeCommentVisible,
  computeCommentVisibleString,
  type ComputeCommentVisibleArgs,
} from './computeCommentVisible';

describe('computeCommentVisible', () => {
  const base: ComputeCommentVisibleArgs = {
    isCIT: false,
    isMentor: false,
    authorId: 'user-1',
  };

  it('returns empty object for users without CIT/Mentor', () => {
    expect(computeCommentVisible(base)).toEqual({});
    expect(computeCommentVisibleString(base)).toBe('{}');
  });

  it('grants CIT and Mentor access and needs approval for CIT', () => {
    expect(
      computeCommentVisible({ ...base, isCIT: true, isMentor: false })
    ).toEqual({
      consultantInTraining: true,
      mentor: true,
      approved: false,
      author: 'user-1',
    });
  });

  it('grants CIT and Mentor access without approval gate for Mentor-only', () => {
    expect(
      computeCommentVisible({ ...base, isCIT: false, isMentor: true })
    ).toEqual({
      consultantInTraining: true,
      mentor: true,
    });
  });

  it('merges approved flag into existing permissions', () => {
    expect(
      computeCommentVisible({
        ...base,
        approved: true,
        existingPermissions: JSON.stringify({
          consultantInTraining: true,
          approved: false,
          author: 'author-9',
        }),
      })
    ).toEqual({
      consultantInTraining: true,
      approved: true,
      author: 'author-9',
    });
  });
});
