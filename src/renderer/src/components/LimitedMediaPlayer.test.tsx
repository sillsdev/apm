// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
// See: https://www.w3schools.com/TAGS/ref_av_dom.asp
import { cleanup, render, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LimitedMediaPlayer } from './LimitedMediaPlayer';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { HiddenPlayerProps } from './HiddenPlayer';

enum MediaSt {
  IDLE,
  PENDING,
  FETCHED,
  ERROR,
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
  IDLE,
  PENDING,
  RESET, // 403 when getting blob
  FETCHED,
  ERROR,
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
let mockBlobState: IBlobState = { ...mockBlobClean };

const blobFetched = {
  ...mockBlobClean,
  blobStat: BlobStatus.FETCHED,
  url: 'https://localhost/media/1.mp3',
  id: 'apcd-1',
  remoteId: '1',
};

const mockFetchBlob = jest.fn();

let mockOnProgress = jest.fn();
let mockOnDuration = jest.fn();
let mockPosition = 0;
let mockSetPlaying = jest.fn();

jest.mock('./HiddenPlayer', () => {
  const MockHiddenPlayer = (props: HiddenPlayerProps) => {
    mockOnProgress = props.onProgress as any;
    mockOnDuration = props.onDuration as any;
    mockPosition = props.position as any;
    mockSetPlaying = props.setPlaying as any;
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
    useFetchMediaBlob: () => {
      return [mockBlobState, mockFetchBlob];
    },
    BlobStatus,
  };
});

jest.mock('../selector', () => ({
  peerCheckSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    afterResource: 'Play from end of resource',
    back3Seconds: 'Skip back 3 seconds',
    resourceStart: 'Play from start of resource',
    mediaError: 'Media error',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../utils', () => {
  const logError = jest.fn(() => {});
  return {
    logError,
  };
});

describe('<LimitedMediaPlayer />', () => {
  beforeEach(cleanup);
  afterEach(() => {
    mockBlobState = { ...mockBlobClean };
  });

  it('should render without crashing when limits are defined', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
      limits: { start: 0, end: 100 },
    };
    const { container } = render(<LimitedMediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('should render without crashing when limits are zeros', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
      limits: { start: 0, end: 0 },
    };
    const { container } = render(<LimitedMediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('should render without crashing when onTogglePlay, limits, and controls are defined', () => {
    const props = {
      srcMediaId: '1',
      requestPlay: true,
      onEnded: () => {},
      onTogglePlay: () => {},
      controls: true,
      limits: { start: 0, end: 100 },
    };
    const { container } = render(<LimitedMediaPlayer {...props} />);
    expect(container.firstChild).toBe(null);
  });

  it('should set currentTime if limits set', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
      limits: { start: 10, end: 100 },
      onLoaded: jest.fn(),
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(props.onLoaded).toHaveBeenCalled();
    expect(mockPosition).toBe(10);
  });

  it('should set currentTime if limits are zeros', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
      limits: { start: 0, end: 0 },
      onLoaded: jest.fn(),
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(props.onLoaded).toHaveBeenCalled();
    expect(mockPosition).toBe(0);
  });

  it('should call onEnded if timeUpdate is more than limits.end', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      limits: { start: 10, end: 100 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(200);
      mockSetPlaying(true);
      mockOnProgress(101);
    });
    expect(props.onEnded).toHaveBeenCalled();
  });

  it('should set length when limist.end set', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 10, end: 100 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    await screen.findAllByText('1:30');
  });

  it('should set length to duration', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 0, end: 0 },
    };

    const { container, rerender } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(200);
    });
    rerender(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(screen.getByText('3:20')).toBeTruthy();
  });

  it('should set length to limits even if duration set', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 10, end: 100 },
    };

    const { container, rerender } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(200);
    });
    rerender(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(screen.getByText('1:30')).toBeTruthy();
  });

  it('should call onEnded if timeUpdate is at end', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      limits: { start: 0, end: 0 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(200);
      mockSetPlaying(true);
      mockOnProgress(200);
    });
    expect(props.onEnded).toHaveBeenCalled();
  });

  it('should not call onEnded if timeUpdate is less than limits.end', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      limits: { start: 10, end: 100 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(200);
      mockSetPlaying(true);
      mockOnProgress(95);
    });
    expect(props.onEnded).not.toHaveBeenCalled();
  });

  it('should not call onEnded if timeUpdate is less than duration', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      limits: { start: 0, end: 0 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(200);
      mockSetPlaying(true);
      mockOnProgress(95);
    });
    expect(props.onEnded).not.toHaveBeenCalled();
  });

  it('should include extra controls if limits set', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
      controls: true,
      limits: { start: 10, end: 100 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(screen.getByTestId('segment-start')).toBeInTheDocument();
    expect(screen.getByTestId('skip-back')).toBeInTheDocument();
  });

  it('should include extra controls if limits set to zero', async () => {
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: () => {},
      controls: true,
      limits: { start: 0, end: 0 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    expect(screen.getByTestId('segment-start')).toBeInTheDocument();
    expect(screen.getByTestId('skip-back')).toBeInTheDocument();
  });

  // We removed the segement-start button in the current LimitedMediaPlayer component.
  it.skip('should set currentTime to start if segment-start clicked', async () => {
    const user = userEvent.setup();
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 10, end: 100 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    const startEl = screen.getByTestId('segment-start');
    await screen.findByText('1:30');
    act(() => {
      mockSetPlaying(true);
      mockOnProgress(50);
    });
    await screen.findByText('0:40');
    expect(startEl).toBeInTheDocument();
    user.click(startEl);
    await waitFor(() => expect(mockPosition).toBe(10));
  });

  // Team City doesn't always have a media player so this test is skipped
  it.skip('should set currentTime back 3 if skip-back clicked', async () => {
    const user = userEvent.setup();
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 10, end: 100 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    await screen.findByText('1:30');
    act(() => {
      mockSetPlaying(true);
      mockOnProgress(50);
    });
    await screen.findByText('0:40');
    const backEl = screen.getByTestId('skip-back');
    expect(backEl).toBeInTheDocument();
    user.click(backEl);
    await waitFor(() => expect(mockPosition).toBe(47));
  });

  // Team City doesn't always have a media player so this test is skipped
  it.skip('should set currentTime back 3 if skip-back clicked and limits are zeros', async () => {
    const user = userEvent.setup();
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 0, end: 0 },
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockSetPlaying(true);
      mockOnProgress(50);
    });
    await screen.findByText('0:50');
    await user.click(screen.getByTestId('skip-back'));
    await waitFor(() => expect(mockPosition).toBe(47));
  });

  // TT-7005: the Compare step keeps one LimitedMediaPlayer instance alive across
  // resource changes, so its timing refs survive. After a resource plays to the
  // end, WSAudioPlayer emits onProgress(0) for the next blob before its duration
  // is known; a stale valueTracker made that look like "at the end", firing
  // onEnded on load, so the newly selected resource never played and the player
  // unmounted/remounted in a loop.
  // TT-7005 (PR #619 review): resetPlay() also runs from ended(), so clearing
  // the media-scoped timing there left a replay of the same loaded resource
  // with no end boundary at all. The player does not reload for a replay, so
  // it never emits onDuration again — onEnded was never called and the
  // caller's itemPlaying stayed stuck on.
  it('TT-7005: reports ended again when the same resource is replayed', async () => {
    mockBlobState = { ...blobFetched };

    const onEnded = jest.fn();
    const props = {
      srcMediaId: 'apcd-1',
      requestPlay: true,
      onEnded,
      limits: {},
    };

    const { container } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));

    act(() => {
      mockOnDuration(10);
      mockSetPlaying(true);
      mockOnProgress(5);
      mockOnProgress(10); // end of the resource
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
    onEnded.mockClear();

    // the user presses play again: same blob, so no second onDuration report
    act(() => {
      mockSetPlaying(true);
      mockOnProgress(5);
      mockOnProgress(10);
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('TT-7005: does not report ended when the next resource loads', async () => {
    mockBlobState = { ...blobFetched };

    const onEnded = jest.fn();
    const props = {
      srcMediaId: 'apcd-1',
      requestPlay: true,
      onEnded,
      limits: {},
    };

    const { container, rerender } = render(<LimitedMediaPlayer {...props} />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));

    act(() => {
      mockOnDuration(10);
      mockSetPlaying(true);
      mockOnProgress(5); // valueTracker.current -> 5
      mockOnProgress(10); // end of the first resource
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
    onEnded.mockClear();

    // the user picks a different resource: a fresh WSAudioPlayer reports
    // duration 0 / progress 0 on mount, before the file is decoded
    mockBlobState = { ...blobFetched, id: 'apcd-2' };
    rerender(<LimitedMediaPlayer {...props} srcMediaId="apcd-2" />);
    await waitFor(() => expect(container.firstChild).not.toBe(null));
    act(() => {
      mockOnDuration(0);
      mockOnProgress(0);
    });

    expect(onEnded).not.toHaveBeenCalled();

    // ...and the new resource still reports ended at its own end
    act(() => {
      mockOnDuration(8);
      mockSetPlaying(true);
      mockOnProgress(8);
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('should show negative time when if currentTime is less than start', async () => {
    const user = userEvent.setup();
    mockBlobState = { ...blobFetched };

    const props = {
      srcMediaId: '1',
      requestPlay: false,
      onEnded: jest.fn(),
      controls: true,
      limits: { start: 10, end: 100 },
    };

    render(<LimitedMediaPlayer {...props} />);
    expect(await screen.findByTestId('skip-back')).toBeInTheDocument();
    user.click(screen.getByTestId('skip-back'));
    await screen.findByText('-0:03');
  });
});
