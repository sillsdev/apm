import {
  applyFewerClauses,
  applyMoreClauses,
  boldDefaultSegParams,
} from './boldCarefulSpeechSegParams';

describe('boldCarefulSpeechSegParams', () => {
  it('boldDefaultSegParams matches BOLD spec UI scale', () => {
    expect(boldDefaultSegParams.silenceThreshold).toBe(0.002);
    expect(boldDefaultSegParams.timeThreshold).toBe(0.02);
    expect(boldDefaultSegParams.segLenThreshold).toBe(1.5);
  });

  describe('applyMoreClauses', () => {
    it('raises silence threshold when changeLength is false', () => {
      const next = applyMoreClauses(boldDefaultSegParams, false);
      expect(next.silenceThreshold).toBeCloseTo(0.003, 6);
      expect(next.segLenThreshold).toBe(boldDefaultSegParams.segLenThreshold);
      expect(next.timeThreshold).toBe(boldDefaultSegParams.timeThreshold);
    });

    it('shortens minimum segment length when changeLength is true', () => {
      const next = applyMoreClauses(boldDefaultSegParams, true);
      expect(next.segLenThreshold).toBe(1);
      expect(next.silenceThreshold).toBe(boldDefaultSegParams.silenceThreshold);
    });

    it('does not raise silence threshold above maximum', () => {
      const loud = { ...boldDefaultSegParams, silenceThreshold: 0.049 };
      const next = applyMoreClauses(loud, false);
      expect(next.silenceThreshold).toBe(0.05);
    });

    it('does not shorten segment length below minimum', () => {
      const tight = { ...boldDefaultSegParams, segLenThreshold: 0.08 };
      const next = applyMoreClauses(tight, true);
      expect(next.segLenThreshold).toBe(0.05);
    });
  });

  describe('applyFewerClauses', () => {
    it('lowers silence threshold when changeLength is false', () => {
      const base = { ...boldDefaultSegParams, silenceThreshold: 0.01 };
      const next = applyFewerClauses(base, false);
      expect(next.silenceThreshold).toBeCloseTo(0.009, 6);
      expect(next.segLenThreshold).toBe(boldDefaultSegParams.segLenThreshold);
    });

    it('lengthens minimum segment when changeLength is true', () => {
      const next = applyFewerClauses(boldDefaultSegParams, true);
      expect(next.segLenThreshold).toBe(2);
      expect(next.silenceThreshold).toBe(boldDefaultSegParams.silenceThreshold);
    });

    it('does not lower silence threshold below minimum', () => {
      const quiet = { ...boldDefaultSegParams, silenceThreshold: 0.001 };
      const next = applyFewerClauses(quiet, false);
      expect(next.silenceThreshold).toBe(0.001);
    });

    it('does not lengthen segment above maximum', () => {
      const long = { ...boldDefaultSegParams, segLenThreshold: 7.6 };
      const next = applyFewerClauses(long, true);
      expect(next.segLenThreshold).toBe(8);
    });
  });

  describe('rough reversibility (no stack)', () => {
    it('more then fewer on silence returns to prior silence', () => {
      const more = applyMoreClauses(boldDefaultSegParams, false);
      const back = applyFewerClauses(more, false);
      expect(back.silenceThreshold).toBe(boldDefaultSegParams.silenceThreshold);
    });

    it('fewer then more on length returns to prior length', () => {
      const fewer = applyFewerClauses(boldDefaultSegParams, true);
      const back = applyMoreClauses(fewer, true);
      expect(back.segLenThreshold).toBe(boldDefaultSegParams.segLenThreshold);
    });
  });
});
