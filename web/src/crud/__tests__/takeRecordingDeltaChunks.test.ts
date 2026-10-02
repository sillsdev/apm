import { takeRecordingDeltaChunks } from '../WavRecorder';

describe('takeRecordingDeltaChunks', () => {
  it('returns empty delta when no new chunks', () => {
    const c1 = new Float32Array([1, 2]);
    const chunks = [c1];
    expect(takeRecordingDeltaChunks(chunks, 1)).toEqual({
      delta: [],
      nextIndex: 1,
    });
  });

  it('returns only new chunks since last index', () => {
    const c1 = new Float32Array([1]);
    const c2 = new Float32Array([2, 3]);
    const c3 = new Float32Array([4]);
    const chunks = [c1, c2, c3];
    expect(takeRecordingDeltaChunks(chunks, 0)).toEqual({
      delta: [c1, c2, c3],
      nextIndex: 3,
    });
    expect(takeRecordingDeltaChunks(chunks, 2)).toEqual({
      delta: [c3],
      nextIndex: 3,
    });
  });
});
