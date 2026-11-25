import { fireEvent, render, screen } from '@testing-library/react';
import { MinimalAudioPlayer } from './MinimalAudioPlayer';
import type { LazyAudio, UseLazyAudioProps } from '../utils/useLazyAudio';
import { LazyAudioStatus } from '../utils/lazyAudioStatus';

// Playback itself is useLazyAudio's job (see useLazyAudio.test.ts); these tests
// cover what the player shows and wires up.
let mockPlayer: LazyAudio;
let mockPlayerProps: UseLazyAudioProps | undefined;
jest.mock('../utils/useLazyAudio', () => ({
  useLazyAudio: (props: UseLazyAudioProps) => {
    mockPlayerProps = props;
    return mockPlayer;
  },
}));

jest.mock('../selector', () => ({
  mediaActionsSelector: jest.fn(),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({ play: 'Play', pause: 'Pause' }),
  shallowEqual: jest.fn(),
}));

const player = (overrides: Partial<LazyAudio> = {}): LazyAudio => ({
  status: LazyAudioStatus.Idle,
  position: 0,
  length: 0,
  play: jest.fn(),
  pause: jest.fn(),
  toggle: jest.fn(),
  seek: jest.fn(),
  ...overrides,
});

describe('<MinimalAudioPlayer />', () => {
  beforeEach(() => {
    mockPlayer = player();
    mockPlayerProps = undefined;
  });

  it('passes the media, clip and onFinish to the hook', () => {
    const onFinish = jest.fn();
    render(
      <MinimalAudioPlayer
        srcMediaId="m1"
        clip={{ start: 2, end: 9 }}
        onFinish={onFinish}
      />
    );
    expect(mockPlayerProps).toEqual({
      mediaId: 'm1',
      clip: { start: 2, end: 9 },
      onFinish,
    });
  });

  it('shows a play button and a disabled slider before anything loads', () => {
    render(<MinimalAudioPlayer srcMediaId="m1" />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('the play button toggles playback', () => {
    render(<MinimalAudioPlayer srcMediaId="m1" />);
    fireEvent.click(screen.getByTestId('play-pause'));
    expect(mockPlayer.toggle).toHaveBeenCalled();
  });

  it('shows a spinner in place of the play icon while loading', () => {
    mockPlayer = player({ status: LazyAudioStatus.Loading });
    render(<MinimalAudioPlayer srcMediaId="m1" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows pause while playing, and the clip position and length', () => {
    mockPlayer = player({
      status: LazyAudioStatus.Playing,
      position: 65,
      length: 125,
    });
    render(<MinimalAudioPlayer srcMediaId="m1" />);

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).not.toBeDisabled();
    expect(screen.getByRole('slider')).toHaveValue('65');
    expect(document.querySelectorAll('time')).toHaveLength(2);
  });

  it('moving the slider seeks within the clip', () => {
    mockPlayer = player({ position: 10, length: 30 });
    render(<MinimalAudioPlayer srcMediaId="m1" />);

    fireEvent.change(screen.getByRole('slider'), { target: { value: 12 } });

    expect(mockPlayer.seek).toHaveBeenLastCalledWith(12);
  });
});
