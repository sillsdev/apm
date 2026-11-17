import { describe, expect, it } from '@jest/globals';
import { buildResourcePendingRestore } from './buildResourcePendingRestore';
import { ResourceTypeEnum } from './ResourceTypeEnum';

describe('buildResourcePendingRestore (TT-7363)', () => {
  it('returns no restore for general resources, which are never queued for retry', () => {
    expect(
      buildResourcePendingRestore({
        resourceType: ResourceTypeEnum.projectResource,
        sectionId: 'sec-1',
        passageId: 'pas-1',
        description: 'General take',
        sequenceNum: 1,
        orgWorkflowStepId: 'ows-1',
        artifactCategoryId: 'cat-1',
      })
    ).toBeUndefined();
  });

  it('still builds sectionresource restore for section resources', () => {
    expect(
      buildResourcePendingRestore({
        resourceType: ResourceTypeEnum.sectionResource,
        sectionId: 'sec-1',
        passageId: 'pas-1',
        description: 'Section take',
        sequenceNum: 2,
        orgWorkflowStepId: 'ows-1',
      })
    ).toEqual({
      kind: 'sectionresource',
      sectionId: 'sec-1',
      description: 'Section take',
      sequenceNum: 2,
      orgWorkflowStepId: 'ows-1',
      topic: 'Section take',
    });
  });
});
