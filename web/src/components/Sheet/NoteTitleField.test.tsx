jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

const mockToggle = jest.fn();
jest.mock('./usePassagePlayback', () => ({
  usePassagePlayback: jest.fn(() => ({
    playing: false,
    toggle: mockToggle,
    audio: null,
  })),
}));

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { NoteTitleField } from './NoteTitleField';
import { shouldOpenSheetContextMenu } from './sheetContextMenu';

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

describe('note title dictionary', () => {
  beforeEach(() => {
    mockUseSelector.mockReturnValue({
      title: 'Title',
      playPause: 'Play / Pause',
    });
  });

  it('shows a spell-checked note title that is not an editable field', () => {
    const { container } = render(<TitleCell />);
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('Teest');
    expect(title).toHaveAttribute('spellcheck', 'true');
    // Spellcheck needs an editable element. The title itself is not one.
    expect(title).not.toHaveAttribute('readonly');
    expect(title).toHaveAttribute('aria-readonly', 'true');
    expect(
      container.querySelector('.MuiOutlinedInput-notchedOutline')
    ).toBeNull();
    fireEvent.change(title, { target: { value: 'Changed' } });
    expect(title).toHaveValue('Teest');
    fireEvent.contextMenu(title);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the note icon and title on one line', () => {
    const style = document.createElement('style');
    // Same rule react-datasheet applies to an input that is a direct child of a cell.
    style.textContent =
      '.cell > input { display: block; width: calc(100% - 6px); height: 11px; }';
    document.head.appendChild(style);
    const { container } = render(
      <div className="cell" style={{ width: 280 }}>
        <NoteTitleField value="Teest" />
      </div>
    );
    const title = screen.getByRole('textbox', { name: 'Title' });
    const icon = container.querySelector('[data-testid="note-icon"]');
    expect(icon).not.toBeNull();
    expect(title.parentElement).toBe(icon?.parentElement);
    expect(
      getComputedStyle(title.parentElement as HTMLElement).whiteSpace
    ).toBe('nowrap');
    expect(getComputedStyle(title).width).not.toContain('%');
    style.remove();
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
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Teest');
  });

  it('hides the play button when the title has no recording', () => {
    render(<NoteTitleField value="Teest" />);
    expect(screen.queryByRole('button', { name: 'Play / Pause' })).toBeNull();
  });
});
