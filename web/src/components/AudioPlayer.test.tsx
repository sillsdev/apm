import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

type Handler = (...args: any[]) => void;

// Wavesurfer needs a real audio stack.
let mockListeners: Record<string, Handler[]> = {};
const mockWs = {
  on: jest.fn((evt: string, cb: Handler) => {
    (mockListeners[evt] ||= []).push(cb);
    return () => {};
  }),
  once: jest.fn(),
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  setTime: jest.fn(),
  setOptions: jest.fn(),
  load: jest.fn(),
  empty: jest.fn(),
  zoom: jest.fn(),
  destroy: jest.fn(),
  registerPlugin: jest.fn(),
  isPlaying: jest.fn(() => false),
  getDuration: jest.fn(() => 10),
  getCurrentTime: jest.fn(() => 0),
  getMediaElement: jest.fn(() => ({ load: jest.fn() })),
  getWrapper: jest.fn(() => ({
    getBoundingClientRect: () => ({ width: 100 }),
  })),
  options: { minPxPerSec: 0 },
};
const mockRegions = {
  on: jest.fn(),
  getRegions: jest.fn(() => []),
  addRegion: jest.fn(),
  enableDragSelection: jest.fn(() => () => {}),
};
const mockSpliceAudio = jest.fn();
const mockInsertSilenceAudio = jest.fn();
const mockStartRecording = jest.fn();
// Stable reference: the player's mic effect depends on this function.
const mockGetMic = jest.fn(() => Promise.resolve({ stream: {} }));

jest.mock('wavesurfer.js', () => ({
  __esModule: true,
  default: { create: () => mockWs },
}));
jest.mock('wavesurfer.js/dist/plugins/regions', () => ({
  __esModule: true,
  default: { create: () => mockRegions },
}));
jest.mock('wavesurfer.js/dist/plugins/zoom', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));
jest.mock('wavesurfer.js/dist/plugins/minimap', () => ({
  __esModule: true,
  default: { create: jest.fn() },
}));
jest.mock('../crud/waveformRenderer', () => ({
  createWaveformRenderer: jest.fn(),
  disableProgressSplit: jest.fn(),
}));
jest.mock('../utils/audioUtils', () => ({
  spliceAudio: (...args: unknown[]) => mockSpliceAudio(...args),
  insertSilenceAudio: (...args: unknown[]) => mockInsertSilenceAudio(...args),
  clampSelectionToHighlights: jest.fn(),
}));
jest.mock('../utils/useRecorder', () => ({
  useRecorder: () => ({
    startRecording: mockStartRecording,
    stopRecording: jest.fn(),
  }),
}));
jest.mock('../crud/useUserMedia', () => ({
  useUserMedia: () => mockGetMic,
}));
jest.mock('../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => ({
    recording: false,
    setRecording: jest.fn(),
    isBoldWorkflow: false,
  }),
}));
jest.mock('../utils/useAudioConversion', () => ({
  useAudioConversion: () => ({
    progress: undefined,
    suppressNoise: jest.fn(),
    convertVoice: jest.fn(),
    cancel: jest.fn(),
  }),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({ reduceNoiseAi: 'Reduce', convertVoiceAi: 'Convert' }),
  shallowEqual: jest.fn(),
}));
jest.mock('../selector', () => ({ wsAudioPlayerSelector: jest.fn() }));
jest.mock('./MicrophoneDialog', () => ({ MicrophoneDialog: () => null }));
jest.mock('./ConvertVoiceDialog', () => ({ ConvertVoiceDialog: () => null }));
jest.mock('./AiProcessing', () => ({ AiProcessing: () => null }));
jest.mock('../control/NoChickenIcon', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../control/VoiceConversionLogo', () => ({
  __esModule: true,
  default: () => null,
}));

// imported after the mocks so the player picks them up
import {
  AudioPlayer,
  type AudioPlayerHandle,
  type AudioPlayerProps,
} from './AudioPlayer';

const AUDIO = new Blob(['audio']);
const DURATION = 10;

const emit = (evt: string, ...args: unknown[]) =>
  act(() => (mockListeners[evt] ?? []).forEach((cb) => cb(...args)));

const renderPlayer = (props: AudioPlayerProps = {}) => {
  const ref = createRef<AudioPlayerHandle>();
  render(<AudioPlayer ref={ref} {...props} />);
  return ref;
};

/** Renders the player and decodes its audio, as when a clip finishes loading. */
const renderLoaded = (props: AudioPlayerProps = {}) => {
  const ref = renderPlayer({ audioSource: AUDIO, ...props });
  emit('decode', DURATION);
  return ref;
};

const button = (name: string) => screen.getByRole('button', { name });

describe('AudioPlayer', () => {
  beforeAll(() => {
    // jsdom does not implement object URLs.
    URL.createObjectURL = jest.fn(() => 'blob:audio');
    URL.revokeObjectURL = jest.fn();
  });

  beforeEach(() => {
    mockListeners = {};
  });

  describe('loading', () => {
    it('keeps play disabled until the audio decodes', () => {
      const onReady = jest.fn();
      renderPlayer({ audioSource: AUDIO, onReady });
      expect(button('passage play')).toBeDisabled();

      emit('decode', DURATION);

      expect(button('passage play')).toBeEnabled();
      expect(screen.getByText('0:00 / 0:10')).toBeInTheDocument();
      expect(onReady).toHaveBeenCalledWith(DURATION);
    });

    it('prefixes aria-labels with the label prop', () => {
      renderPlayer({ label: 'source' });
      expect(button('source play')).toBeInTheDocument();
    });
  });

  describe('playback', () => {
    it('toggles between play and pause', async () => {
      renderLoaded();

      await userEvent.click(button('passage play'));
      expect(mockWs.play).toHaveBeenCalledTimes(1);

      emit('play');
      await userEvent.click(button('passage pause'));
      expect(mockWs.pause).toHaveBeenCalledTimes(1);

      emit('pause');
      expect(button('passage play')).toBeInTheDocument();
    });

    it('shows and reports the current time', () => {
      const onTimeUpdate = jest.fn();
      renderLoaded({ onTimeUpdate });

      emit('timeupdate', 3);

      expect(screen.getByText('0:03 / 0:10')).toBeInTheDocument();
      expect(onTimeUpdate).toHaveBeenCalledWith(3);
    });

    it('stops at the end of a sticky selection and seeks back', () => {
      mockWs.isPlaying.mockReturnValueOnce(true);
      renderLoaded({ stickySelection: { start: 2, end: 4 } });
      emit('play');

      emit('timeupdate', 4);

      expect(mockWs.pause).toHaveBeenCalledTimes(1);
      expect(mockWs.setTime).toHaveBeenLastCalledWith(2);
    });

    it('calls onFinish at the end of the clip', () => {
      const onFinish = jest.fn();
      renderLoaded({ onFinish });

      emit('finish');

      expect(onFinish).toHaveBeenCalledTimes(1);
    });
  });

  describe('recording', () => {
    it('shows record instead of play when no audio is loaded', () => {
      renderPlayer({ showRecordButton: true });
      expect(button('passage start recording')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'passage play' })
      ).not.toBeInTheDocument();
    });

    it('shows play instead of record once audio is loaded', () => {
      renderLoaded({ showRecordButton: true });
      expect(button('passage play')).toBeInTheDocument();
    });

    it('starts the recorder when record is clicked', async () => {
      renderPlayer({ showRecordButton: true });
      await userEvent.click(button('passage start recording'));
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });
  });

  describe('selection', () => {
    it('shows the selected range and clears it on waveform click', () => {
      const onSelectionChange = jest.fn();
      const ref = renderLoaded({ onSelectionChange });

      act(() => ref.current!.updateSelection({ start: 2, end: 4 }));
      expect(screen.getByText('0:02 - 0:04')).toBeInTheDocument();
      expect(onSelectionChange).toHaveBeenLastCalledWith(
        { start: 2, end: 4 },
        'user'
      );

      emit('click', 0.5);
      expect(screen.getByText('0:00 / 0:10')).toBeInTheDocument();
      expect(onSelectionChange).toHaveBeenLastCalledWith(null, 'user');
    });

    it('keeps a sticky selection on waveform click', () => {
      renderLoaded({ stickySelection: { start: 2, end: 4 } });

      emit('click', 0.5);

      expect(screen.getByText('0:02 - 0:04')).toBeInTheDocument();
    });
  });

  describe('onWaveformClick', () => {
    it('passes the nearest marker within the grace distance', () => {
      const onWaveformClick = jest.fn();
      // 100px wide over 10s, so 2px away from the marker at 5s.
      renderLoaded({ markers: [5], onWaveformClick });

      emit('click', 0.52);

      expect(onWaveformClick).toHaveBeenCalledWith(5.2, 5);
    });

    it('passes no marker when the click is outside the grace distance', () => {
      const onWaveformClick = jest.fn();
      renderLoaded({ markers: [5], onWaveformClick });

      emit('click', 0.8);

      expect(onWaveformClick).toHaveBeenCalledWith(8, undefined);
    });
  });

  describe('editing', () => {
    it('hides undo until there is something to undo', () => {
      renderLoaded();
      expect(
        screen.queryByRole('button', { name: 'passage undo' })
      ).not.toBeInTheDocument();
    });

    it('disables cut until there is a selection', () => {
      renderLoaded({ showCut: true });
      expect(button('passage cut')).toBeDisabled();
    });

    it('cuts the selection, and undo restores the audio', async () => {
      const spliced = new Blob(['spliced']);
      mockSpliceAudio.mockResolvedValueOnce(spliced);
      const onAudioChange = jest.fn();
      const ref = renderLoaded({ showCut: true, onAudioChange });
      act(() => ref.current!.updateSelection({ start: 2, end: 4 }));

      await userEvent.click(button('passage cut'));

      expect(mockSpliceAudio).toHaveBeenCalledWith(AUDIO, 2, 4);
      expect(onAudioChange).toHaveBeenLastCalledWith(spliced);

      await userEvent.click(button('passage undo'));

      expect(onAudioChange).toHaveBeenLastCalledWith(AUDIO, undefined);
      expect(screen.getByText('0:02 - 0:04')).toBeInTheDocument();
    });

    it('inserts silence at the current time', async () => {
      const withSilence = new Blob(['silence']);
      mockInsertSilenceAudio.mockResolvedValueOnce(withSilence);
      const onAudioChange = jest.fn();
      renderLoaded({ showSilence: true, onAudioChange });
      emit('timeupdate', 3);

      await userEvent.click(button('passage insert silence'));

      expect(mockInsertSilenceAudio).toHaveBeenCalledWith(AUDIO, 3, 0.5);
      expect(onAudioChange).toHaveBeenLastCalledWith(withSilence);
    });

    it('clears the audio from the menu', async () => {
      const onAudioChange = jest.fn();
      renderLoaded({ showTrash: true, onAudioChange });

      await userEvent.click(button('passage audio menu'));
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'passage reset audio' })
      );

      expect(onAudioChange).toHaveBeenLastCalledWith(null);
      expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument();
      expect(button('passage play')).toBeDisabled();
    });
  });
});
