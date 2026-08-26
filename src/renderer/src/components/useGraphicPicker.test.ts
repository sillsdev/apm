jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));
jest.mock('../crud/useGraphicCreate', () => ({ useGraphicCreate: jest.fn() }));
jest.mock('../crud/useGraphicUpdate', () => ({ useGraphicUpdate: jest.fn() }));
jest.mock('../utils/useCompression', () => ({
  ApmDim: 40,
  Rights: 'rights',
}));

import { act, renderHook } from '@testing-library/react';
import { GraphicD } from '../model';
import { saveGraphicRecord, useGraphicPicker } from './useGraphicPicker';

const png = {
  name: 'x-1024.png',
  content: 'data',
  type: 'image/png',
  dimension: 1024,
};

describe('saveGraphicRecord', () => {
  it('writes rights and images onto an existing graphic', async () => {
    const graphicUpdate = jest.fn(async (rec: GraphicD) => rec);
    const graphicCreate = jest.fn();
    const showMessage = jest.fn();
    const rec = await saveGraphicRecord({
      images: [png],
      rights: 'SIL',
      graphicRec: {
        id: 'g1',
        type: 'graphic',
        attributes: { info: '{}' },
      } as GraphicD,
      resourceType: 'category',
      resourceId: 7,
      graphicCreate,
      graphicUpdate,
      showMessage,
      saving: 'saving',
      uploadSuccess: 'ok',
    });
    expect(graphicCreate).not.toHaveBeenCalled();
    expect(showMessage).toHaveBeenCalledWith('ok');
    expect(JSON.parse(rec?.attributes.info ?? '{}')).toMatchObject({
      rights: 'SIL',
      '1024': png,
    });
  });

  it('does not write when rights and images are unchanged', async () => {
    const graphicUpdate = jest.fn();
    const rec = await saveGraphicRecord({
      images: [],
      rights: 'SIL',
      graphicRec: {
        id: 'g1',
        type: 'graphic',
        attributes: { info: JSON.stringify({ rights: 'SIL' }) },
      } as GraphicD,
      resourceType: 'section',
      resourceId: 1,
      graphicCreate: jest.fn(),
      graphicUpdate,
      showMessage: jest.fn(),
      saving: 'saving',
      uploadSuccess: 'ok',
    });
    expect(rec).toBeUndefined();
    expect(graphicUpdate).not.toHaveBeenCalled();
  });
});

describe('useGraphicPicker', () => {
  it('closes when the closing save rejects', async () => {
    const save = jest.fn().mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useGraphicPicker(save));
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    await act(async () => {
      result.current.onOpen(false);
      await save.mock.results[0].value.catch(() => undefined);
    });
    expect(result.current.isOpen).toBe(false);
  });
});
