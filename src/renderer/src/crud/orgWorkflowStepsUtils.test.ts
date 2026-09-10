import { WorkflowStepD } from '../model';
import {
  filterWorkflowStepTemplates,
  readWorkflowStepTemplates,
} from './orgWorkflowStepsUtils';

const draftOffline = (id: string, sequencenum: number): WorkflowStepD =>
  ({
    id,
    type: 'workflowstep',
    attributes: {
      process: 'draft',
      name: id,
      sequencenum,
      tool: '{"tool":"discuss"}',
      permissions: '{}',
    },
  }) as WorkflowStepD;

describe('readWorkflowStepTemplates', () => {
  it('reads draft templates from memory cache for offlineOnly (not a stale empty snapshot)', () => {
    const cached = [
      draftOffline('ws-internalize', 1),
      draftOffline('ws-record', 2),
      draftOffline('ws-done', 3),
    ];
    // Simulates CreateOrgWorkflowSteps running while useOrbitData still held [].
    const staleHookSnapshot: WorkflowStepD[] = [];
    const memory = {
      cache: {
        query: (queryFn: (q: { findRecords: (t: string) => unknown }) => unknown) =>
          queryFn({
            findRecords: (type: string) =>
              type === 'workflowstep' ? cached : [],
          }),
      },
    };

    expect(filterWorkflowStepTemplates(staleHookSnapshot, 'draft', true)).toEqual(
      []
    );
    const fromCache = readWorkflowStepTemplates(memory, 'draft', true);
    expect(fromCache.map((s) => s.id)).toEqual([
      'ws-internalize',
      'ws-record',
      'ws-done',
    ]);
  });

  it('excludes remoteId templates when offlineOnly', () => {
    const mixed = [
      { ...draftOffline('offline-1', 1) },
      {
        ...draftOffline('online-1', 2),
        keys: { remoteId: 'r1' },
      } as WorkflowStepD,
    ];
    expect(
      filterWorkflowStepTemplates(mixed, 'draft', true).map((s) => s.id)
    ).toEqual(['offline-1']);
  });
});
