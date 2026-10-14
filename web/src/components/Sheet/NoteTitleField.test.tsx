import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { NoteTitleField } from './NoteTitleField';
import { shouldOpenSheetContextMenu } from './sheetContextMenu';

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
      <NoteTitleField value="Teest" onChange={() => undefined} />
      {menuOpen ? <div role="menu">Sheet menu</div> : null}
    </div>
  );
}

describe('note title dictionary', () => {
  it('does not open the sheet menu on a misspelled note title', () => {
    render(<TitleCell />);
    const title = screen.getByRole('textbox', { name: 'Note title' });
    expect(title).toHaveAttribute('spellcheck', 'true');
    fireEvent.contextMenu(title);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
