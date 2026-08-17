// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
// See: https://www.w3schools.com/TAGS/ref_av_dom.asp
import { cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MediaPlayer } from './MediaPlayer';
import { act } from 'react';
import { HiddenPlayerProps } from './HiddenPlayer';

enum MediaSt {
  'IDLE',
  'PENDING',
  'FETCHED',
  'ERROR',
}
interface IMediaState {
  status: MediaSt;
  error: null | string;
  url: string; // temporary url
  id: string; // media id
  remoteId: string;
  cancelled: boolean;
}

enum BlobStatus {
  'IDLE',
  'PENDING',
  'RESET',
  'FETCHED',
  'ERROR',
}

interface IBlobState extends IMediaState {
  blob: Blob;
  blobStat: BlobStatus;
}

const mediaClean = {
  status: MediaSt.IDLE,
  error: null,
  url: '',
  id: '',
  remoteId: '',
  cancelled: false,
};
const mockBlobClean = {
  ...mediaClean,
  blob: new Blob(),
  blobStat: BlobStatus.IDLE,
};
let mockMediaState: IMediaState = { ...mediaClean };
let mockBlobState: IBlobState = { ...mockBlobClean };
const mockFetchBlob = jest.fn();
const mockShowMessage = jest.fn();
let mockShouldUseWaveSurfer = false;

jest.mock('../utils/audioPlayback', () => ({
  shouldUseWaveSurferPlayback: jest.fn(() => mockShouldUseWaveSurfer),
}));

jest.mock('./HiddenPlayer', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const MockHiddenPlayer = (_props: HiddenPlayerProps) => {
    return <div id="hiddenplayer" />;
  };
  MockHiddenPlayer.displayName = 'MockHiddenPlayer';
  return MockHiddenPlayer;
});

jest.mock('../crud/useFetchMediaBlob', () => {
  const BlobStatus = {
    IDLE: 0,
    PENDING: 1,
    RESET: 2,
    FETCHED: 3,
    ERROR: 4,
  };
  return {
    useFetchMediaBlob: () => [mockBlobState, mockFetchBlob],
    BlobStatus,
  };
});

jest.mock('../crud', () => {
  const MediaSt = {
    IDLE: 0,
    PENDING: 1,
    FETCHED: 2,
    ERROR: 3,
  };
  return {
    useFetchMediaUrl: () => {
      return {
        mediaState: mockMediaState,
        fetchMediaUrl: ({ id }: { id: string }) => {
          if (id === '1') {
            mockMediaState = {
              ...mockMediaState,
              id: 'abcd-1',
              remoteId: '1',
              error: '',
              status: MediaSt.PENDING,
            };
            setTimeout(() => {
              mockMediaState = {
                ...mockMediaState,
                status: MediaSt.FETCHED,
                url: 'https://localhost/media/1.mp3',
              };
            }, 500);
          } else if (id === 'ogg-1') {
            mockMediaState = {
              ...mockMediaState,
              id: 'abcd-ogg',
              remoteId: 'ogg-1',
              error: '',
              status: MediaSt.FETCHED,
              url: 'https://localhost/media/1.ogg',
            };
          } else {
            mockMediaState = { ...mockMediaState, error: 'error' };
          }
        },
      };
    },
    MediaSt,
  };
});

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({
    showMessage: mockShowMessage,
  }),
}));

jest.mock('../selector', () => ({
  peerCheckSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    afterResource: 'Play from end of resource',
    back3Seconds: 'Skip back 3 seconds',
    resourceStart: 'Play from start of resource',
    mediaError: 'Media error',
    fileNotFound: 'File not found',
    close: 'Close',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    const mockValues: Record<string, unknown> = {
      errorReporter: jest.fn(),
      memory: {
        keyMap: { keyToId: jest.fn(), idToKey: jest.fn() },
        cache: {
          query: jest.fn(() => ({
            attributes: { contentType: 'audio/mpeg' },
          })),
        },
        update: jest.fn(),
      },
      user: 'test-user',
      organization: 'test-org',
      project: 'test-project',
      plan: 'test-plan',
      offline: false,
    };
    return [mockValues[key] || jest.fn(), jest.fn()];
  },
}));

jest.mock('../schema', () => ({
  memory: {
    cache: { query: jest.fn(() => []) },
    update: jest.fn(),
  },
  requestedSchema: 100,
}));

jest.mock('../utils', () => {
  const logError = jest.fn(() => {});
  return {
    logError,
    Severity: { error: 'error' },
  };
});

describe('<MediaPlayer />', () => {
  beforeEach(() => {
    cleanup();
    mockShouldUseWaveSurfer = false;
    mockFetchBlob.mockClear();
    mockShowMessage.mockClear();
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        value: jest.fn(),
      });
    }
  });
  afterEach(() => {
    mockMediaState = { ...mediaClean };
    mockBlobState = { ...mockBlobClean };
  });

  it('should render without crashing', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
    };
    const { container } = render(<MediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('should render without crashing when requestPlay is true', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
    };
    const { container } = render(<MediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('should render without crashing when onTogglePlay is defined', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
      onTogglePlay: () => {},
    };
    const { container } = render(<MediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('should render without crashing when controls is defined', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
      controls: true,
    };
    const { container } = render(<MediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('returns an error if srcMediaId is not 1', async () => {
    const props = {
      srcMediaId: '2',
      requestPlay: false,
      onEnded: () => {},
    };
    render(<MediaPlayer {...props} />);
    await waitFor(() => expect(mockMediaState.error).toBe('error'));
  });

  it('fetchMediaUrl sets url when srcMediaId is 1', async () => {
    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
    };
    render(<MediaPlayer {...props} />);
    await waitFor(() => expect(mockMediaState.id).toBe('abcd-1'));
    await waitFor(() => expect(mockMediaState.remoteId).toBe('1'));
    await waitFor(() => expect(mockMediaState.error).toBe(''));
    await waitFor(() => expect(mockMediaState.status).toBe(MediaSt.PENDING));
    await waitFor(() => expect(mockMediaState.status).toBe(MediaSt.FETCHED));
    await waitFor(() =>
      expect(mockMediaState.url).toBe('https://localhost/media/1.mp3')
    );
  });

  it('should render with an audio player with src', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
    };
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(container.querySelector('audio')).toBeInTheDocument();
    expect(container.querySelector('audio')).toHaveAttribute(
      'src',
      'https://localhost/media/1.mp3'
    );
    expect(mockFetchBlob).not.toHaveBeenCalled();
  });

  it('should contain controls when controls parameter set', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
      controls: true,
    };
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(container.querySelector('audio')).toHaveAttribute('controls');
  });

  it('should not call onTogglePlay without requestPlay', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
      onTogglePlay: jest.fn(),
    };
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(container.querySelector('audio')).toBeInTheDocument();
    expect(props.onTogglePlay).not.toHaveBeenCalled();
  });

  it('should play with requestPlay true', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
    };

    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => new Promise(() => {}));
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(playStub).toHaveBeenCalled();
    playStub.mockRestore();
  });

  it('should call OnTogglePlay with pause event and requestPlay true', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
      onTogglePlay: jest.fn(),
    };

    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => new Promise(() => {}));
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    container.querySelector('audio')?.dispatchEvent(new Event('pause'));
    expect(props.onTogglePlay).toHaveBeenCalled();
    expect(playStub).toHaveBeenCalled();
    playStub.mockRestore();
  });

  it('should call onEnded with ended event and requestPlay true', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
    };

    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      container.querySelector('audio')?.dispatchEvent(new Event('ended'));
    });
    expect(props.onEnded).toHaveBeenCalled();
  });

  it('uses WaveSurfer proactively for unsupported formats', async () => {
    mockShouldUseWaveSurfer = true;
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.ogg',
      id: 'abcd-ogg',
      remoteId: 'ogg-1',
      cancelled: false,
    };
    mockBlobState = {
      ...mockBlobClean,
      blobStat: BlobStatus.FETCHED,
      url: 'blob:mock',
      id: 'abcd-ogg',
      remoteId: 'ogg-1',
      blob: new Blob(['audio'], { type: 'audio/ogg' }),
    };

    const props = {
      srcMediaId: 'ogg-1',
      requestPlay: true,
      onEnded: () => {},
    };
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() => expect(mockFetchBlob).toHaveBeenCalledWith('ogg-1'));
    await waitFor(() =>
      expect(container.querySelector('#hiddenplayer')).toBeInTheDocument()
    );
    expect(container.querySelector('audio')).not.toBeInTheDocument();
  });

  it('falls back to WaveSurfer when native audio errors', async () => {
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.mp3',
      id: 'apcd-1',
      remoteId: '1',
      cancelled: false,
    };

    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: jest.fn(),
    };
    const playStub = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    const { container } = render(<MediaPlayer {...props} />);
    await waitFor(() =>
      expect(container.querySelector('audio')).toBeInTheDocument()
    );

    act(() => {
      container.querySelector('audio')?.dispatchEvent(new Event('error'));
    });

    await waitFor(() => expect(mockFetchBlob).toHaveBeenCalledWith('1'));
    expect(mockShowMessage).not.toHaveBeenCalledWith('Media error');
    playStub.mockRestore();
  });

  it('shows mediaError when WaveSurfer blob fetch fails', async () => {
    mockShouldUseWaveSurfer = true;
    mockMediaState = {
      status: MediaSt.FETCHED,
      error: null,
      url: 'https://localhost/media/1.ogg',
      id: 'abcd-ogg',
      remoteId: 'ogg-1',
      cancelled: false,
    };
    mockBlobState = {
      ...mockBlobClean,
      blobStat: BlobStatus.ERROR,
      error: 'fetch failed abcd-ogg',
      id: 'abcd-ogg',
      remoteId: 'ogg-1',
    };

    const onEnded = jest.fn();
    render(
      <MediaPlayer srcMediaId="ogg-1" requestPlay={true} onEnded={onEnded} />
    );

    await waitFor(() =>
      expect(mockShowMessage).toHaveBeenCalledWith('Media error')
    );
    expect(onEnded).toHaveBeenCalled();
  });
});
