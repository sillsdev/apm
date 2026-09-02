import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { axiosGet } from '../../utils/axios';
import { findRecord } from '../../crud/tryFindRecord';
import AsrProgress from './AsrProgress';
import { MediaFileD, PassageD } from '../../model';

jest.mock('../../utils/axios', () => ({
  axiosGet: jest.fn(),
  axiosPost: jest.fn(),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(() => [{ keyMap: {} }, jest.fn()]),
}));

jest.mock('../../context/TokenProvider', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: ReactActual.createContext({
      state: { accessToken: 'test-token' },
    }),
  };
});

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
  AlertSeverity: { Error: 'error' },
}));

jest.mock('../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({
    getAsrSettings: () => ({
      asrIso: 'eng',
      selectRoman: false,
      method: 'mms',
    }),
  }),
}));

jest.mock(
  '../../components/PassageDetail/Internalization/useProjectSegmentSave',
  () => ({
    useProjectSegmentSave: () => jest.fn().mockResolvedValue(undefined),
  })
);

jest.mock('../../crud/tryFindRecord', () => ({
  findRecord: jest.fn(),
}));

jest.mock('../../crud/remoteId', () => ({
  remoteId: (_table: string, id: string) => id,
}));

jest.mock('../../control', () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  ActionRow: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../utils', () => ({
  infoMsg: (_e: unknown, msg: string) => new Error(msg),
  logError: jest.fn(),
  Severity: { error: 'error' },
}));

jest.mock('../../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { error: 'error' },
  infoMsg: (_e: unknown, msg: string) => new Error(msg),
}));

jest.mock('./AeroTaskErrorMessage', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../selector', () => ({
  transcriberSelector: { name: 'transcriberSelector' },
  sharedSelector: { name: 'sharedSelector' },
  cardsSelector: { name: 'cardsSelector' },
  mainSelector: { name: 'mainSelector' },
}));

jest.mock('react-redux', () => ({
  useSelector: (selector: { name?: string }) => {
    if (selector.name === 'transcriberSelector') {
      return {
        asrProgress:
          'Transcribing {0} (verse {1}) of {2} (ending at verse {3})',
        aiWillContinue: 'AI will continue {0}',
        aiAsrFailed: 'ASR failed',
        noAsrTranscription: 'No transcription',
        transcriptionExists: 'Transcription exists',
      };
    }
    if (selector.name === 'sharedSelector') {
      return { close: 'Close' };
    }
    if (selector.name === 'cardsSelector') {
      return { recognizeSpeech: 'Auto Transcribe' };
    }
    if (selector.name === 'mainSelector') {
      return { details: 'Details' };
    }
    return {};
  },
  shallowEqual: (a: unknown, b: unknown) => a === b,
}));

const mockAxiosGet = axiosGet as jest.Mock;
const mockFindRecord = findRecord as jest.Mock;

function makeTrTaskSegments(
  tasks: Array<{ taskId: string; verse: string }>
): string {
  const regionInfo = JSON.stringify({
    regions: tasks.map((t, i) => ({
      label: `${t.taskId}|${t.verse}`,
      start: i,
      end: i + 1,
    })),
  });
  return JSON.stringify([{ name: 'TRTask', regionInfo }]);
}

const passage = {
  id: 'pass-1',
  type: 'passage',
  attributes: {
    startChapter: 1,
    startVerse: 10,
    endChapter: 1,
    endVerse: 12,
    reference: 'MAT 1:10-12',
  },
} as PassageD;

function renderAsrProgress(
  overrides: Partial<React.ComponentProps<typeof AsrProgress>> = {}
) {
  const setTranscription = jest.fn();
  const onClose = jest.fn();
  const onPullTasks = jest.fn();

  const mediafile = {
    id: 'media-1',
    type: 'mediafile',
    attributes: {
      transcription: '\\v 10 \\v 11 \\v 12 ',
      segments: makeTrTaskSegments([
        { taskId: 'task1', verse: '10' },
        { taskId: 'task2', verse: '11' },
      ]),
    },
  } as MediaFileD;

  mockFindRecord.mockReturnValue(mediafile);

  render(
    <AsrProgress
      mediaId="media-1"
      phonetic={false}
      force={false}
      contentVerses={[]}
      passage={passage}
      setTranscription={setTranscription}
      onPullTasks={onPullTasks}
      onClose={onClose}
      {...overrides}
    />
  );

  return { setTranscription, onClose, onPullTasks, mediafile };
}

describe('AsrProgress multi-verse polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAxiosGet.mockReset();
    mockFindRecord.mockReset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('inserts verse 1 then verse 2 as polls complete', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ transcription: 'Hello ten' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ transcription: 'Hello eleven' });

    const { setTranscription } = renderAsrProgress();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAxiosGet).toHaveBeenCalledWith('aero/transcription/task1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    expect(setTranscription).toHaveBeenCalledWith(' \\v 10 Hello ten');
    expect(mockAxiosGet).toHaveBeenCalledWith('aero/transcription/task2');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    expect(setTranscription).toHaveBeenCalledWith(' \\v 11 Hello eleven');
  });

  it('resumes at the next incomplete verse and skips contentVerses', async () => {
    mockAxiosGet
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ transcription: 'Hello eleven' });

    const { setTranscription } = renderAsrProgress({
      contentVerses: ['10'],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockAxiosGet).toHaveBeenCalledWith('aero/transcription/task2');
    expect(mockAxiosGet).not.toHaveBeenCalledWith('aero/transcription/task1');

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    expect(setTranscription).not.toHaveBeenCalledWith(
      expect.stringContaining('Hello ten')
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });

    expect(setTranscription).toHaveBeenCalledWith(' \\v 11 Hello eleven');
  });

  it('shows passage-aware progress text while polling', async () => {
    mockAxiosGet.mockResolvedValue({});

    renderAsrProgress();

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByText('Transcribing 1 (verse 10) of 3 (ending at verse 12)')
    ).toBeInTheDocument();
  });
});
