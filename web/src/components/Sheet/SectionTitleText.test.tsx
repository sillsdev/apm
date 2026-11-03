jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { SectionTitleText } from './SectionTitleText';

const mockUseSelector = useSelector as unknown as jest.Mock;

beforeEach(() => {
  mockUseSelector.mockReturnValue({ title: 'Title' });
});

const renderTitle = (onTitleCommit?: (next: string) => void) =>
  render(
    <SectionTitleText value="Teest" cell={{ value: 'Teest', onTitleCommit }} />
  );

describe('section title outside the title field', () => {
  it('spellchecks the title, saves each change, and trims on blur', () => {
    const onTitleCommit = jest.fn();
    renderTitle(onTitleCommit);
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title.tagName).toBe('TEXTAREA');
    expect(title).toHaveValue('Teest');
    expect(title).toHaveAttribute('spellcheck', 'true');

    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Test ' } });
    expect(title).toHaveValue('Test ');
    expect(onTitleCommit).toHaveBeenLastCalledWith('Test ');

    fireEvent.blur(title);
    expect(onTitleCommit).toHaveBeenLastCalledWith('Test');
    expect(onTitleCommit).toHaveBeenCalledTimes(2);
  });

  it('does not save again on blur when nothing needs trimming', () => {
    const onTitleCommit = jest.fn();
    renderTitle(onTitleCommit);
    const title = screen.getByRole('textbox');
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Test' } });
    fireEvent.blur(title);
    expect(onTitleCommit).toHaveBeenCalledTimes(1);
    expect(onTitleCommit).toHaveBeenCalledWith('Test');
  });

  it('does not save when the title is unchanged', () => {
    const onTitleCommit = jest.fn();
    renderTitle(onTitleCommit);
    const title = screen.getByRole('textbox');
    fireEvent.focus(title);
    fireEvent.blur(title);
    expect(onTitleCommit).not.toHaveBeenCalled();
  });

  it('does not rewrite a title that ends in a space when only focused', () => {
    const onTitleCommit = jest.fn();
    render(
      <SectionTitleText
        value="Teest "
        cell={{ value: 'Teest ', onTitleCommit }}
      />
    );
    const title = screen.getByRole('textbox');
    fireEvent.focus(title);
    fireEvent.blur(title);
    expect(onTitleCommit).not.toHaveBeenCalled();
  });

  it.each(['Enter', 'Tab', 'Escape'])(
    'hands focus back to the grid on %s',
    (key) => {
      render(
        <span className="data-grid-container" tabIndex={0}>
          <SectionTitleText
            value="Teest"
            cell={{ value: 'Teest', onTitleCommit: jest.fn() }}
          />
        </span>
      );
      const title = screen.getByRole('textbox');
      title.focus();
      fireEvent.keyDown(title, { key });
      expect(title.closest('.data-grid-container')).toHaveFocus();
    }
  );

  it('saves each change through the callback of the current render', () => {
    const saveFirst = jest.fn();
    const saveSecond = jest.fn();
    const { rerender } = renderTitle(saveFirst);
    const title = screen.getByRole('textbox');
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Tes' } });

    rerender(
      <SectionTitleText
        value="Teest"
        cell={{ value: 'Teest', onTitleCommit: saveSecond }}
      />
    );
    fireEvent.change(title, { target: { value: 'Test' } });
    expect(saveFirst).toHaveBeenCalledWith('Tes');
    expect(saveSecond).toHaveBeenCalledWith('Test');
  });

  it('keeps the draft while a save in progress re-renders the title', () => {
    const onTitleCommit = jest.fn();
    const { rerender } = renderTitle(onTitleCommit);
    const title = screen.getByRole('textbox');
    fireEvent.focus(title);
    fireEvent.change(title, { target: { value: 'Test' } });

    rerender(
      <SectionTitleText value="Tes" cell={{ value: 'Tes', onTitleCommit }} />
    );
    expect(title).toHaveValue('Test');

    fireEvent.blur(title);
    rerender(
      <SectionTitleText value="Test" cell={{ value: 'Test', onTitleCommit }} />
    );
    expect(title).toHaveValue('Test');
  });

  it('leaves Enter and Escape to the IME while composing', () => {
    const onTitleCommit = jest.fn();
    const onKeyDown = jest.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <SectionTitleText
          value="Teest"
          cell={{ value: 'Teest', onTitleCommit }}
        />
      </div>
    );
    const title = screen.getByRole('textbox');
    title.focus();
    fireEvent.change(title, { target: { value: 'Test' } });

    const enter = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    title.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    fireEvent.keyDown(title, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(title, { key: 'Enter', keyCode: 229 });

    expect(title).toHaveFocus();
    expect(title).toHaveValue('Test');
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(onTitleCommit).toHaveBeenCalledTimes(1);
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
          cell={{ value: 'Teest', onTitleCommit: jest.fn() }}
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
          cell={{ value: 'Teest', onTitleCommit: jest.fn() }}
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
