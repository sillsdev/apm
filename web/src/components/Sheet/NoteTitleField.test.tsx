jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(() => ['', jest.fn()]),
}));

const mockToggle = jest.fn();
jest.mock('./usePassagePlayback', () => ({
  usePassagePlayback: jest.fn(),
}));

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import { NoteTitleField } from './NoteTitleField';
import { usePassagePlayback } from './usePassagePlayback';
import { shouldOpenSheetContextMenu } from './sheetContextMenu';

const mockPlayback = usePassagePlayback as jest.Mock;

const mockUseSelector = useSelector as unknown as jest.Mock;
const mockUseGlobal = useGlobal as unknown as jest.Mock;

function playback(state: { playing?: boolean; loading?: boolean } = {}) {
  return {
    playing: false,
    loading: false,
    progress: 0,
    toggle: mockToggle,
    audio: null,
    ...state,
  };
}

function TitleCell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      onContextMenu={(event) => {
        if (!shouldOpenSheetContextMenu(event.target)) return;
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <NoteTitleField value="Teest" />
      {menuOpen ? <div role="menu">Sheet menu</div> : null}
    </div>
  );
}

describe('note title', () => {
  beforeEach(() => {
    mockUseSelector.mockReturnValue({
      title: 'Title',
      playPause: 'Play / Pause',
    });
    mockPlayback.mockReturnValue(playback());
    mockUseGlobal.mockReturnValue(['', jest.fn()]);
  });

  it('shows the note title as text and opens the sheet menu', () => {
    render(<TitleCell />);
    const title = screen.getByText('Teest');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.contextMenu(title);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('keeps the note icon with the title text', () => {
    render(<NoteTitleField value="Teest" />);
    const title = screen.getByText('Teest');
    const icon = screen.getByTestId('note-icon');
    expect(title).toContainElement(icon);
  });

  it('plays a recorded title from a button before the note icon', () => {
    mockToggle.mockClear();
    render(<NoteTitleField value="Teest" mediaId="title-media" />);
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    const icon = screen.getByTestId('note-icon');
    expect(play.compareDocumentPosition(icon)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    fireEvent.click(play);
    expect(mockToggle).toHaveBeenCalled();
    expect(screen.getByText('Teest')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows a spinner while the title recording loads', () => {
    mockPlayback.mockReturnValue(playback({ playing: true, loading: true }));
    render(<NoteTitleField value="Teest" mediaId="title-media" />);
    const spinner = screen
      .getAllByRole('progressbar')
      .find((bar) => !bar.hasAttribute('aria-valuenow'));
    expect(spinner).toBeDefined();
  });

  it('does not play a title while a recording is in progress', () => {
    mockToggle.mockClear();
    render(<NoteTitleField value="Teest" mediaId="title-media" disabled />);
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    expect(play).toBeDisabled();
    fireEvent.click(play);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('stops title playback when a recording starts', () => {
    mockToggle.mockClear();
    mockPlayback.mockReturnValue(playback({ playing: true }));
    render(<NoteTitleField value="Teest" mediaId="title-media" disabled />);
    expect(mockToggle).toHaveBeenCalled();
  });

  it('does not play a title while other sheet audio is playing', () => {
    mockToggle.mockClear();
    mockUseGlobal.mockReturnValue(['other-media', jest.fn()]);
    render(<NoteTitleField value="Teest" mediaId="title-media" />);
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    expect(play).toBeDisabled();
    fireEvent.click(play);
    expect(mockToggle).not.toHaveBeenCalled();
  });

  it('hides the play button when the title has no recording', () => {
    render(<NoteTitleField value="Teest" />);
    expect(screen.queryByRole('button', { name: 'Play / Pause' })).toBeNull();
  });

  it('keeps Enter and Space on the play button from reaching the sheet', () => {
    const onKeyDown = jest.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <NoteTitleField value="Teest" mediaId="title-media" />
      </div>
    );
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    fireEvent.keyDown(play, { key: 'Enter' });
    fireEvent.keyDown(play, { key: ' ' });
    fireEvent.keyDown(play, { key: 'ArrowDown' });
    fireEvent.keyDown(play, { key: 'a' });
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it('keeps a click on the note play button from reaching the sheet', () => {
    const onMouseDown = jest.fn();
    const onClick = jest.fn();
    render(
      <div onMouseDown={onMouseDown} onClick={onClick}>
        <NoteTitleField value="Teest" mediaId="title-media" />
      </div>
    );
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    fireEvent.mouseDown(play);
    fireEvent.click(play);
    expect(onMouseDown).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
