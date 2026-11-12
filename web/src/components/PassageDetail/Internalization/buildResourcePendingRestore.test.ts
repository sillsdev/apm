import { describe, expect, it } from '@jest/globals';
import { buildResourcePendingRestore } from './buildResourcePendingRestore';
import { ResourceTypeEnum } from './ResourceTypeEnum';

describe('buildResourcePendingRestore (TT-7363 general resource)', () => {
  it('returns projectresource restore meta instead of undefined for general resources', () => {
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
    ).toEqual({
      kind: 'projectresource',
      topic: 'General take',
      artifactCategoryId: 'cat-1',
    });
  });

  it('omits empty topic and category on projectresource restore', () => {
    expect(
      buildResourcePendingRestore({
        resourceType: ResourceTypeEnum.projectResource,
        sectionId: 'sec-1',
        passageId: 'pas-1',
        description: null,
        sequenceNum: 1,
      })
    ).toEqual({ kind: 'projectresource' });
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
