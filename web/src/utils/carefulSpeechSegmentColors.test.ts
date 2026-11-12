import {
  CAREFUL_SPEECH_COMPLETED_RGBA,
  CAREFUL_SPEECH_CURRENT_RGBA,
  CAREFUL_SPEECH_PENDING_RGBA,
  createCarefulSpeechApplyRegionColor,
} from './carefulSpeechSegmentColors';

interface StatusRef {
  current: {
    currentIndex: number;
    isCompleted: (index: number) => boolean;
  } | null;
}

describe('carefulSpeechSegmentColors', () => {
  it('createCarefulSpeechApplyRegionColor maps roles to region colors', () => {
    const statusRef: StatusRef = {
      current: {
        currentIndex: 1,
        isCompleted: (i: number) => i === 0,
      },
    };
    const apply = createCarefulSpeechApplyRegionColor(statusRef);
    expect(apply('current', 1, 3)).toBe(CAREFUL_SPEECH_CURRENT_RGBA);
    expect(apply('new', 0, 3)).toBe(CAREFUL_SPEECH_PENDING_RGBA);
    expect(apply('base', 0, 3)).toBe(CAREFUL_SPEECH_COMPLETED_RGBA);
    expect(apply('base', 1, 3)).toBe(CAREFUL_SPEECH_PENDING_RGBA);

    statusRef.current = null;
    expect(apply('base', 0, 3)).toBe(CAREFUL_SPEECH_PENDING_RGBA);
  });
});
