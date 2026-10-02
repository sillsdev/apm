import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import { MediaFile } from '../../../model';

const mockUpdate = jest.fn().mockResolvedValue(undefined as unknown as never);
const mockMemory = {
  update: mockUpdate,
  schema: {
    models: {},
    generateId: () => 'id-123',
  },
};

jest.mock('../../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'memory') return [mockMemory, jest.fn()];
    if (key === 'user') return ['user-1', jest.fn()];
    return [undefined, jest.fn()];
  }),
}));

import { useProjectSegmentSave } from './useProjectSegmentSave';

describe('useProjectSegmentSave', () => {
  beforeEach(() => {
    mockUpdate.mockClear();
  });

  it('updates segments using attribute-scoped replaceAttribute instead of full updateRecord', async () => {
    const { result } = renderHook(() => useProjectSegmentSave());
    const projectSegmentSave = result.current;

    const media: MediaFile = {
      type: 'mediafile',
      id: 'media-1',
      attributes: {
        versionNumber: 1,
        transcription: 'Current transcription text',
        transcriptionstate: 'transcribing',
        segments: '{"regions":[{"start":0,"end":5}]}',
      },
    } as unknown as MediaFile;

    await projectSegmentSave({
      media,
      segments: '{"regions":[{"start":0,"end":10}]}',
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateFn = mockUpdate.mock.calls[0][0] as (t: any) => any[];

    // Execute the transform builder function with a mock transform builder
    const recordedOps: any[] = [];
    const mockTransformBuilder = {
      replaceAttribute: (record: any, attribute: string, value: any) => ({
        toOperation: () => {
          const op = { op: 'replaceAttribute', record, attribute, value };
          recordedOps.push(op);
          return op;
        },
      }),
      replaceRelatedRecord: (
        record: any,
        relationship: string,
        relatedRecord: any
      ) => ({
        toOperation: () => {
          const op = {
            op: 'replaceRelatedRecord',
            record,
            relationship,
            relatedRecord,
          };
          recordedOps.push(op);
          return op;
        },
      }),
      updateRecord: (record: any) => ({
        toOperation: () => {
          const op = { op: 'updateRecord', record };
          recordedOps.push(op);
          return op;
        },
      }),
    };

    updateFn(mockTransformBuilder);

    const updateRecordOps = recordedOps.filter(
      (op) => op.op === 'updateRecord'
    );
    const segmentReplaceOps = recordedOps.filter(
      (op) => op.op === 'replaceAttribute' && op.attribute === 'segments'
    );

    expect(updateRecordOps).toHaveLength(0);
    expect(segmentReplaceOps).toHaveLength(1);
    expect(segmentReplaceOps[0].record.id).toBe('media-1');
    expect(segmentReplaceOps[0].value).toBe(
      '{"regions":[{"start":0,"end":10}]}'
    );
  });
});
