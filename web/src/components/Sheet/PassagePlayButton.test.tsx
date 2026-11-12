jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

jest.mock('./usePassagePlayback', () => ({
  usePassagePlayback: jest.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { PassagePlayButton } from './PassagePlayButton';
import { usePassagePlayback } from './usePassagePlayback';

const mockPlayback = usePassagePlayback as jest.Mock;
const mockUseSelector = useSelector as unknown as jest.Mock;

describe('PassagePlayButton', () => {
  beforeEach(() => {
    mockUseSelector.mockReturnValue({ playPause: 'Play / Pause' });
    mockPlayback.mockReturnValue({
      playing: false,
      loading: false,
      progress: 0,
      toggle: jest.fn(),
      audio: null,
    });
  });

  it('lets a click on a card play button reach the card', () => {
    const onMouseDown = jest.fn();
    const onClick = jest.fn();
    render(
      <div onMouseDown={onMouseDown} onClick={onClick}>
        <PassagePlayButton mediaId="card-media" />
      </div>
    );
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    fireEvent.mouseDown(play);
    fireEvent.click(play);
    expect(onMouseDown).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
  });
});
