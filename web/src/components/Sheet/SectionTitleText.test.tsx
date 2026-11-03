import { fireEvent, render, screen } from '@testing-library/react';
import { SectionTitleText } from './SectionTitleText';

const renderTitle = (onSpellReplace?: (next: string) => void) =>
  render(
    <SectionTitleText value="Teest" cell={{ value: 'Teest', onSpellReplace }} />
  );

describe('section title outside the title field', () => {
  it('spellchecks the title and saves a correction on blur', () => {
    const onSpellReplace = jest.fn();
    renderTitle(onSpellReplace);
    const title = screen.getByRole('textbox');
    expect(title.tagName).toBe('TEXTAREA');
    expect(title).toHaveValue('Teest');
    expect(title).toHaveAttribute('spellcheck', 'true');

    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Test ' } });
    expect(title).toHaveValue('Test ');
    expect(onSpellReplace).not.toHaveBeenCalled();

    fireEvent.blur(title);
    expect(onSpellReplace).toHaveBeenCalledWith('Test');
  });

  it('does not save when the title is unchanged', () => {
    const onSpellReplace = jest.fn();
    renderTitle(onSpellReplace);
    const title = screen.getByRole('textbox');
    fireEvent.focus(title);
    fireEvent.blur(title);
    expect(onSpellReplace).not.toHaveBeenCalled();
  });

  it('drops the edit when Escape is pressed', () => {
    const onSpellReplace = jest.fn();
    renderTitle(onSpellReplace);
    const title = screen.getByRole('textbox');
    title.focus();
    fireEvent.change(title, { target: { value: 'Test' } });
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(onSpellReplace).not.toHaveBeenCalled();
    expect(title).toHaveValue('Teest');
  });

  it('is read-only when the cell cannot be edited', () => {
    renderTitle();
    const title = screen.getByRole('textbox');
    expect(title).toHaveAttribute('readonly');
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Test' } });
    expect(title).toHaveValue('Teest');
  });

  it('keeps sheet editing from taking keys meant for the title', () => {
    const onKeyDown = jest.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <SectionTitleText
          value="Teest"
          cell={{ value: 'Teest', onSpellReplace: jest.fn() }}
        />
      </div>
    );
    const title = screen.getByRole('textbox');
    fireEvent.keyDown(title, { key: 'a' });
    expect(onKeyDown).not.toHaveBeenCalled();

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    title.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(onKeyDown).not.toHaveBeenCalled();

    fireEvent.keyDown(title, { key: 'Tab' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('keeps clipboard events away from the sheet', () => {
    const onCopy = jest.fn();
    const onPaste = jest.fn();
    render(
      <div onCopy={onCopy} onPaste={onPaste}>
        <SectionTitleText
          value="Teest"
          cell={{ value: 'Teest', onSpellReplace: jest.fn() }}
        />
      </div>
    );
    const title = screen.getByRole('textbox');
    fireEvent.copy(title);
    fireEvent.paste(title);
    expect(onCopy).not.toHaveBeenCalled();
    expect(onPaste).not.toHaveBeenCalled();
  });
});
