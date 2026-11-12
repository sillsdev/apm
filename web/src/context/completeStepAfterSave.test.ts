import {
  completeStepAfterSave,
  trySetStepComplete,
} from './completeStepAfterSave';

const setup = (
  overrides: Partial<Parameters<typeof completeStepAfterSave>[0]> = {}
) => {
  const calls: string[] = [];
  const options = {
    stepId: 'step-1',
    complete: true,
    waitForSaves: jest.fn(async () => {
      calls.push('wait');
    }),
    setStepComplete: jest.fn(async () => {
      calls.push('set');
    }),
    showMessage: jest.fn(),
    onDone: jest.fn(() => {
      calls.push('done');
    }),
    ...overrides,
  };
  return { options, calls };
};

describe('completeStepAfterSave', () => {
  it('waits for saves, marks the step, then runs onDone', async () => {
    const { options, calls } = setup();
    await completeStepAfterSave(options);
    expect(calls).toEqual(['wait', 'set', 'done']);
    expect(options.setStepComplete).toHaveBeenCalledWith('step-1', true);
    expect(options.showMessage).not.toHaveBeenCalled();
  });

  it('works without onDone', async () => {
    const { options } = setup({ onDone: undefined, complete: false });
    await expect(completeStepAfterSave(options)).resolves.toBeUndefined();
    expect(options.setStepComplete).toHaveBeenCalledWith('step-1', false);
  });

  it('shows a failed save and does not mark the step or move on', async () => {
    const { options } = setup({
      waitForSaves: jest.fn(async () => {
        throw new Error('Saving is taking too long.');
      }),
    });
    await completeStepAfterSave(options);
    expect(options.showMessage).toHaveBeenCalledWith(
      'Saving is taking too long.'
    );
    expect(options.setStepComplete).not.toHaveBeenCalled();
    expect(options.onDone).not.toHaveBeenCalled();
  });

  it('shows nothing when the save failure has no message', async () => {
    const { options } = setup({
      waitForSaves: jest.fn(async () => {
        throw new Error('');
      }),
    });
    await completeStepAfterSave(options);
    expect(options.showMessage).not.toHaveBeenCalled();
    expect(options.setStepComplete).not.toHaveBeenCalled();
  });

  it('stays put without a second message when the step write fails', async () => {
    const { options } = setup({
      setStepComplete: jest.fn(async () => {
        throw new Error('IndexedDB closed');
      }),
    });
    await expect(completeStepAfterSave(options)).resolves.toBeUndefined();
    expect(options.showMessage).not.toHaveBeenCalled();
    expect(options.onDone).not.toHaveBeenCalled();
  });

  it('lets an onDone error surface', async () => {
    const { options } = setup({
      onDone: jest.fn(() => {
        throw new Error('navigation bug');
      }),
    });
    await expect(completeStepAfterSave(options)).rejects.toThrow(
      'navigation bug'
    );
  });
});

describe('trySetStepComplete', () => {
  it('resolves true when the write lands', async () => {
    const set = jest.fn(async () => undefined);
    await expect(trySetStepComplete(set, 's1', false)).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith('s1', false);
  });

  it('resolves false instead of rejecting when the write fails', async () => {
    const set = jest.fn(async () => {
      throw new Error('IndexedDB closed');
    });
    await expect(trySetStepComplete(set, 's1', true)).resolves.toBe(false);
  });
});
