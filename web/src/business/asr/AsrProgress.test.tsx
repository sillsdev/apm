import React from 'react';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import { act, cleanup, render } from '@testing-library/react';
import type { MediaFileD } from '../../model';

// Orbit mutates records in place; only a useOrbitData subscription re-renders.
let orbitMedia: MediaFileD[] = [];
const mockOrbitListeners = new Set<(records: MediaFileD[]) => void>();
const notifyOrbit = () => {
  orbitMedia = [...orbitMedia];
  mockOrbitListeners.forEach((listener) => listener(orbitMedia));
};

jest.mock('../../hoc/useOrbitData', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useOrbitData: (model: string) => {
      const [records, setRecords] = React.useState(() =>
        model === 'mediafile' ? orbitMedia : []
      );
      React.useEffect(() => {
        if (model !== 'mediafile') return;
        mockOrbitListeners.add(setRecords);
        return () => {
          mockOrbitListeners.delete(setRecords);
        };
      }, [model]);
      return records;
    },
  };
});

jest.mock('../../crud/tryFindRecord', () => ({
  findRecord: (_memory: unknown, _table: string, id: string) =>
    orbitMedia.find((m) => m.id === id),
}));

jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext({ state: { accessToken: 't' } }) };
});

const mockAxiosPost = jest.fn<() => Promise<unknown>>();
// Methods aero lists for a language, best first.
let mockAsrMethods: string[] = [];
jest.mock('../../utils/axios', () => ({
  axiosGet: async (url: string) =>
    url.includes('asrlanguages') ? mockAsrMethods : undefined,
  axiosPost: () => mockAxiosPost(),
}));

jest.mock('../../hoc/SnackBar', () => ({
  AlertSeverity: { Error: 'error' },
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../crud/remoteId', () => ({
  remoteId: (_table: string, id: string) => id,
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [{ keyMap: {} }, jest.fn()],
}));

jest.mock('../../control', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  ActionRow: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../model', () => ({}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    aiTimeRemaining: 'About {0} remaining',
    aiTakingLonger: 'Taking longer than usual: {0} elapsed',
    aiWillContinue: '{0} will continue',
    recognizeSpeech: 'Recognize speech',
    close: 'Close',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../../selector', () => ({
  cardsSelector: jest.fn(),
  mainSelector: jest.fn(),
  wsAudioPlayerSelector: jest.fn(),
  sharedSelector: jest.fn(),
  transcriberSelector: jest.fn(),
}));

jest.mock('./AeroTaskErrorMessage', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../utils', () => ({
  infoMsg: jest.fn(),
  logError: jest.fn(),
  Severity: { error: 'error' },
}));

jest.mock('../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({ getAsrSettings: () => undefined }),
}));

jest.mock(
  '../../components/PassageDetail/Internalization/useProjectSegmentSave',
  () => ({ useProjectSegmentSave: () => jest.fn() })
);

import AsrProgress from './AsrProgress';
import { clearAsrLanguageValidityCache } from './asrLanguages';

const mediaWith = (duration: number) =>
  ({
    id: 'm1',
    type: 'mediafile',
    attributes: { duration, transcription: '', segments: '{}' },
  }) as unknown as MediaFileD;

// postTranscribe awaits the saved ASR settings before it starts the run, so
// let that settle before reading the estimate.
const renderAsr = async (phonetic = false) => {
  const result = render(
    <AsrProgress
      mediaId="m1"
      phonetic={phonetic}
      setTranscription={jest.fn()}
      onPullTasks={jest.fn()}
      onClose={jest.fn()}
    />
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return result;
};

describe('AsrProgress estimated time', () => {
  beforeEach(() => {
    mockOrbitListeners.clear();
    localStorage.clear();
    clearAsrLanguageValidityCache();
    mockAsrMethods = [];
    // The transcription request stays in flight for the whole test.
    mockAxiosPost.mockReset();
    mockAxiosPost.mockImplementation(() => new Promise(() => undefined));
  });

  afterEach(() => {
    cleanup();
  });

  it('updates the estimate when the media record gains a new duration', async () => {
    orbitMedia = [mediaWith(60)];
    await renderAsr();
    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'About 0:45 remaining'
    );

    act(() => {
      orbitMedia[0].attributes.duration = 120;
      notifyOrbit();
    });

    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'About 1:15 remaining'
    );
  });

  it('shows only elapsed time while transcribing a recording with no stored duration', async () => {
    orbitMedia = [mediaWith(0)];
    await renderAsr();
    expect(mockAxiosPost).toHaveBeenCalled();
    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      /^0:00$/
    );
  });

  it('estimates from earlier transcriptions with the same model', async () => {
    // total = 10 + 1 * duration
    const samples = [10, 20, 40, 80, 160].map((d) => ({
      durationSec: d,
      totalMs: (10 + d) * 1000,
      at: 0,
    }));
    // No method chosen: the run is timed under the method aero ranks first.
    mockAsrMethods = ['w2v-bert', 'mms'];
    localStorage.setItem(
      'aiTiming-transcription:w2v-bert',
      JSON.stringify(samples)
    );
    orbitMedia = [mediaWith(60)];
    await renderAsr();
    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'About 1:10 remaining'
    );
  });

  it('times phonetic runs apart from script runs', async () => {
    const samples = [10, 20, 40, 80, 160].map((d) => ({
      durationSec: d,
      totalMs: (10 + d) * 1000,
      at: 0,
    }));
    mockAsrMethods = ['w2v-bert'];
    localStorage.setItem(
      'aiTiming-transcription:phonetic',
      JSON.stringify(samples)
    );
    orbitMedia = [mediaWith(60)];
    await renderAsr(true);
    expect(document.getElementById('asr-time-estimate')).toHaveTextContent(
      'About 1:10 remaining'
    );
  });
});
