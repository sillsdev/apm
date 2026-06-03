const mockVProjectStrings = {
  spellCheck: 'Spell Check',
  language: 'Language',
  font: 'Font',
};

const mockPickerStrings = {};

const mockState = {
  vProject: mockVProjectStrings,
  languagePicker: mockPickerStrings,
};

jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({
  vProjectSelector: (state: typeof mockState) => state.vProject,
  pickerSelector: (state: typeof mockState) => state.languagePicker,
}));

jest.mock('../utils/fontFamilyName', () => ({
  fontFamilyName: (font: string) => font,
}));

jest.mock('mui-language-picker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    LanguagePicker: ({ setFont }: { setFont: (font: string) => void }) =>
      React.createElement(
        'button',
        { type: 'button', onClick: () => setFont('OtherFont') },
        'change-font'
      ),
  };
});

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX needs React in scope for TS
import React from 'react';
import { useSelector } from 'react-redux';
import { ILanguage, Language } from './Language';

const mockUseSelector = useSelector as unknown as jest.Mock;

const baseProps: ILanguage = {
  bcp47: 'en',
  languageName: 'English',
  font: 'CharisSIL',
  rtl: false,
  spellCheck: false,
};

describe('Language', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSelector.mockImplementation(
      (sel: (state: typeof mockState) => unknown) => sel(mockState)
    );
  });

  test('shows parent spellCheck on checkbox after prop update', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <Language
        {...baseProps}
        spellCheck={false}
        onChange={onChange}
        hideFont
      />
    );

    rerender(
      <Language {...baseProps} spellCheck={true} onChange={onChange} hideFont />
    );

    expect(screen.getByRole('checkbox', { name: 'Spell Check' })).toBeChecked();
  });

  test('onChange reflects parent spellCheck after prop update and font edit', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <Language
        {...baseProps}
        spellCheck={false}
        onChange={onChange}
        hideFont
      />
    );
    onChange.mockClear();

    rerender(
      <Language {...baseProps} spellCheck={true} onChange={onChange} hideFont />
    );
    fireEvent.click(screen.getByText('change-font'));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ILanguage;
    expect(lastCall.spellCheck).toBe(true);
    expect(lastCall.font).toBe('OtherFont');
  });

  test('onChange sends toggled spellCheck from checkbox', () => {
    const onChange = jest.fn();
    render(
      <Language
        {...baseProps}
        spellCheck={false}
        onChange={onChange}
        hideFont
      />
    );
    onChange.mockClear();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Spell Check' }));

    const lastCall = onChange.mock.calls.at(-1)?.[0] as ILanguage;
    expect(lastCall.spellCheck).toBe(true);
  });

  test('hides spell check when hideSpelling is set', () => {
    render(
      <Language
        {...baseProps}
        spellCheck={false}
        onChange={jest.fn()}
        hideFont
        hideSpelling
      />
    );

    expect(
      screen.queryByRole('checkbox', { name: 'Spell Check' })
    ).not.toBeInTheDocument();
  });
});
