jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { NoteTitleField } from './NoteTitleField';
import { shouldOpenSheetContextMenu } from './sheetContextMenu';

const mockUseSelector = useSelector as unknown as jest.Mock;

function TitleCell({ readonly = false }: { readonly?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [value, setValue] = useState('Teest');
  return (
    <div
      onContextMenu={(event) => {
        if (!shouldOpenSheetContextMenu(event.target)) return;
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <NoteTitleField value={value} onChange={setValue} readonly={readonly} />
      {menuOpen ? <div role="menu">Sheet menu</div> : null}
    </div>
  );
}

describe('note title dictionary', () => {
  beforeEach(() => {
    mockUseSelector.mockReturnValue({ title: 'Title' });
  });

  it('does not open the sheet menu on a misspelled note title', () => {
    render(<TitleCell />);
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveAttribute('spellcheck', 'true');
    expect(title).not.toHaveAttribute('readonly');
    fireEvent.change(title, { target: { value: 'Changed' } });
    expect(title).toHaveValue('Changed');
    fireEvent.contextMenu(title);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not change a read-only note title', () => {
    render(<TitleCell readonly />);
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveAttribute('spellcheck', 'true');
    expect(title).toHaveAttribute('readonly');
    fireEvent.change(title, { target: { value: 'Changed' } });
    expect(title).toHaveValue('Teest');
    fireEvent.contextMenu(title);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
