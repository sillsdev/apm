import { jest, describe, it, beforeEach, expect } from '@jest/globals';

jest.mock('../useGraphicPicker', () => ({
  saveGraphicRecord: jest.fn(),
}));

import { act, renderHook } from '@testing-library/react';
import type { GraphicD } from '../../model';
import { saveGraphicRecord } from '../useGraphicPicker';
import { useCategoryGraphicEdit } from './useCategoryGraphicEdit';

const mockSaveGraphicRecord =
  saveGraphicRecord as unknown as jest.MockedFunction<typeof saveGraphicRecord>;

const png = {
  name: 'x-40.png',
  content: 'data:image/png;base64,abc',
  type: 'image/png',
  dimension: 40,
};

const deps = {
  graphicRec: undefined,
  resourceType: 'category',
  resourceId: 7,
  graphicCreate: jest.fn() as unknown as ReturnType<
    typeof import('../../crud/useGraphicCreate').useGraphicCreate
  >,
  graphicUpdate: jest.fn() as unknown as ReturnType<
    typeof import('../../crud/useGraphicUpdate').useGraphicUpdate
  >,
  showMessage: jest.fn((msg: string) => {
    void msg;
  }),
  saving: 'saving',
  uploadSuccess: 'ok',
};

describe('useCategoryGraphicEdit (TT-7627 cancel vs graphic persist)', () => {
  beforeEach(() => {
    mockSaveGraphicRecord.mockReset();
    mockSaveGraphicRecord.mockResolvedValue({
      id: 'g-new',
      type: 'graphic',
      attributes: { info: '{}' },
    } as GraphicD);
  });

  /**
   * Copilot r3970692716: finishing the picker must not write Orbit until
   * Apply; Cancel must discard the staged graphic with no persist.
   */
  it('does not persist a staged graphic when discarded (cancel)', async () => {
    const { result } = renderHook(() => useCategoryGraphicEdit(deps));

    act(() => {
      result.current.stage([png], 'SIL');
    });
    expect(mockSaveGraphicRecord).not.toHaveBeenCalled();

    act(() => {
      result.current.discard();
    });
    await act(async () => {
      await result.current.flush();
    });

    expect(mockSaveGraphicRecord).not.toHaveBeenCalled();
  });

  it('persists a staged graphic only on flush (apply)', async () => {
    const { result } = renderHook(() => useCategoryGraphicEdit(deps));

    act(() => {
      result.current.stage([png], 'SIL');
    });
    expect(mockSaveGraphicRecord).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flush();
    });

    expect(mockSaveGraphicRecord).toHaveBeenCalledTimes(1);
    expect(mockSaveGraphicRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        images: [png],
        rights: 'SIL',
        resourceType: 'category',
        resourceId: 7,
      })
    );
  });
});
