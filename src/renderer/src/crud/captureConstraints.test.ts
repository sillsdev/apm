import { buildCaptureConstraints } from './captureConstraints';

describe('buildCaptureConstraints', () => {
  it('requires the selected microphone instead of treating it as optional', () => {
    const constraints = buildCaptureConstraints(
      'computer-mic-id',
      false,
      false
    );
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.deviceId).toEqual({ exact: 'computer-mic-id' });
  });

  it('omits deviceId when none is selected', () => {
    const constraints = buildCaptureConstraints(undefined, false, false);
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.deviceId).toBeUndefined();
  });

  it('omits deviceId when the stored id is empty', () => {
    const constraints = buildCaptureConstraints('', false, false);
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.deviceId).toBeUndefined();
  });
});
