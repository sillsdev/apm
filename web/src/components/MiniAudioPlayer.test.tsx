import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MiniAudioPlayer, MiniAudioPlayerHandle } from './MiniAudioPlayer';
import type { MiniAudio, UseMiniAudioProps } from '../utils/useMiniAudio';
import { MiniAudioPlayerStatus } from '../utils/miniAudioPlayerStatus';

// Playback itself is useMiniAudio's job (see useMiniAudio.test.ts); these tests
// cover what the player shows and wires up.
let mockPlayer: MiniAudio;
let mockPlayerProps: UseMiniAudioProps | undefined;
jest.mock('../utils/useMiniAudio', () => ({
  useMiniAudio: (props: UseMiniAudioProps) => {
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

const player = (overrides: Partial<MiniAudio> = {}): MiniAudio => ({
  status: MiniAudioPlayerStatus.Idle,
  position: 0,
  length: 0,
  play: jest.fn(),
  pause: jest.fn(),
  toggle: jest.fn(),
  seek: jest.fn(),
  ...overrides,
});

describe('<MiniAudioPlayer />', () => {
  beforeEach(() => {
    mockPlayer = player();
    mockPlayerProps = undefined;
  });

  it('passes the media, clip and onFinish to the hook', () => {
    const onFinish = jest.fn();
    render(
      <MiniAudioPlayer
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
    render(<MiniAudioPlayer srcMediaId="m1" />);

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).toBeDisabled();
  });

  it('the play button toggles playback', () => {
    render(<MiniAudioPlayer srcMediaId="m1" />);
    fireEvent.click(screen.getByTestId('play-pause'));
    expect(mockPlayer.toggle).toHaveBeenCalled();
  });

  it('shows a spinner in place of the play icon while loading', () => {
    mockPlayer = player({ status: MiniAudioPlayerStatus.Loading });
    render(<MiniAudioPlayer srcMediaId="m1" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows pause while playing, and the clip position and length', () => {
    mockPlayer = player({
      status: MiniAudioPlayerStatus.Playing,
      position: 65,
      length: 125,
    });
    render(<MiniAudioPlayer srcMediaId="m1" />);

    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('slider')).not.toBeDisabled();
    expect(screen.getByRole('slider')).toHaveValue('65');
    expect(document.querySelectorAll('time')).toHaveLength(2);
  });

  it('moving the slider seeks within the clip', () => {
    mockPlayer = player({ position: 10, length: 30 });
    render(<MiniAudioPlayer srcMediaId="m1" />);

    fireEvent.change(screen.getByRole('slider'), { target: { value: 12 } });

    expect(mockPlayer.seek).toHaveBeenLastCalledWith(12);
  });

  // TODO cleanup after we switch PassageDetailArtifacts to the new design
  it('reports playing changes', () => {
    const onPlayingChange = jest.fn();
    const { rerender } = render(
      <MiniAudioPlayer srcMediaId="m1" onPlayingChange={onPlayingChange} />
    );
    mockPlayer = player({ status: MiniAudioPlayerStatus.Playing });
    rerender(
      <MiniAudioPlayer srcMediaId="m1" onPlayingChange={onPlayingChange} />
    );
    expect(onPlayingChange).toHaveBeenLastCalledWith(true);
  });

  // TODO cleanup after we switch PassageDetailArtifacts to the new design
  it('exposes play, pause and toggle through its ref', () => {
    const ref = createRef<MiniAudioPlayerHandle>();
    render(<MiniAudioPlayer ref={ref} srcMediaId="m1" />);

    act(() => ref.current?.toggle());
    act(() => ref.current?.pause());
    act(() => ref.current?.play());

    expect(mockPlayer.toggle).toHaveBeenCalled();
    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(mockPlayer.play).toHaveBeenCalled();
  });
});
