import { finalizeRecordingOnDeviceLoss } from './finalizeRecordingOnDeviceLoss';

function mockRecorder(
  overrides: Partial<{
    stop: () => Promise<Blob>;
    cleanup: () => void;
  }> = {}
) {
  return {
    stop: jest
      .fn()
      .mockResolvedValue(new Blob(['audio'], { type: 'audio/wav' })),
    cleanup: jest.fn(),
    ...overrides,
  };
}

describe('finalizeRecordingOnDeviceLoss', () => {
  it('returns the flushed blob and cleans up after an active take', async () => {
    const blob = new Blob(['take'], { type: 'audio/wav' });
    const recorder = mockRecorder({
      stop: jest.fn().mockResolvedValue(blob),
    });

    await expect(finalizeRecordingOnDeviceLoss(recorder, true)).resolves.toBe(
      blob
    );
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(recorder.cleanup).toHaveBeenCalledTimes(1);
  });

  it('still cleans up when stop fails', async () => {
    const recorder = mockRecorder({
      stop: jest.fn().mockRejectedValue(new Error('worklet gone')),
    });

    await expect(
      finalizeRecordingOnDeviceLoss(recorder, true)
    ).resolves.toBeUndefined();
    expect(recorder.cleanup).toHaveBeenCalledTimes(1);
  });

  it('ignores an empty stop blob', async () => {
    const recorder = mockRecorder({
      stop: jest.fn().mockResolvedValue(new Blob([])),
    });

    await expect(
      finalizeRecordingOnDeviceLoss(recorder, true)
    ).resolves.toBeUndefined();
    expect(recorder.cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not stop when capture was not recording', async () => {
    const recorder = mockRecorder();

    await expect(
      finalizeRecordingOnDeviceLoss(recorder, false)
    ).resolves.toBeUndefined();
    expect(recorder.stop).not.toHaveBeenCalled();
    expect(recorder.cleanup).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a recorder', async () => {
    await expect(
      finalizeRecordingOnDeviceLoss(undefined, true)
    ).resolves.toBeUndefined();
  });
});
