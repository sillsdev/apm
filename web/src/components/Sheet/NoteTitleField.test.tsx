jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

const mockToggle = jest.fn();
jest.mock('./usePassagePlayback', () => ({
  usePassagePlayback: jest.fn(() => ({
    playing: false,
    loading: false,
    progress: 0,
    toggle: mockToggle,
    audio: null,
  })),
}));

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { NoteTitleField } from './NoteTitleField';
import { usePassagePlayback } from './usePassagePlayback';
import { shouldOpenSheetContextMenu } from './sheetContextMenu';

const mockPlayback = usePassagePlayback as jest.Mock;

const mockUseSelector = useSelector as unknown as jest.Mock;

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
    mockPlayback.mockReturnValue({
      playing: false,
      loading: false,
      progress: 0,
      toggle: mockToggle,
      audio: null,
    });
  });

  it('shows the note title as text and opens the sheet menu', () => {
    render(<TitleCell />);
    const title = screen.getByText('Teest');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.contextMenu(title);
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('keeps the note icon and title on one line', () => {
    render(<NoteTitleField value="Teest" />);
    const title = screen.getByText('Teest');
    const icon = screen.getByTestId('note-icon');
    expect(title).toContainElement(icon);
    expect(getComputedStyle(title).whiteSpace).toBe('nowrap');
  });

  it('plays a recorded title from a button before the note icon', () => {
    mockToggle.mockClear();
    const { container } = render(
      <NoteTitleField value="Teest" mediaId="title-media" />
    );
    const play = screen.getByRole('button', { name: 'Play / Pause' });
    const icon = screen.getByTestId('note-icon');
    expect(play.compareDocumentPosition(icon)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    fireEvent.click(play);
    expect(mockToggle).toHaveBeenCalled();
    expect(screen.getByText('Teest')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(container.querySelector('.MuiCircularProgress-root')).toBeNull();
  });

  it('shows a spinner while the title recording loads', () => {
    mockPlayback.mockReturnValue({
      playing: true,
      loading: true,
      progress: 0,
      toggle: mockToggle,
      audio: null,
    });
    const { container } = render(
      <NoteTitleField value="Teest" mediaId="title-media" />
    );
    expect(
      container.querySelector('.MuiCircularProgress-indeterminate')
    ).not.toBeNull();
  });

  it('hides the play button when the title has no recording', () => {
    render(<NoteTitleField value="Teest" />);
    expect(screen.queryByRole('button', { name: 'Play / Pause' })).toBeNull();
  });
});
