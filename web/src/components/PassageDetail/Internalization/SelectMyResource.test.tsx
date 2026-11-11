// Context object must be created inside the factory so it exists when the mock
// initializes (ESM hoists imports; do not rely on a pre-mock const binding).
jest.mock('../../../context/PassageDetailContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: R.createContext({
      state: {},
      setState: jest.fn(),
    }),
  };
});

jest.mock('react-redux', () => ({
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ strings: { lang: 'en' } }),
  shallowEqual: (a: unknown, b: unknown) => a === b,
}));

jest.mock('../../../selector', () => ({
  teamCheckRefSelector: () => ({
    resource: 'Resource',
    resourcehelper: 'Select a resource',
  }),
  vProjectSelector: () => ({
    primaryReferenceText: 'Primary Reference Text',
    secondaryReferenceText: 'Secondary Reference Text',
  }),
}));

const mockPassages: Record<string, unknown> = {};
// Each rank's Reference Text is a stand-in whose id is the rank
jest.mock('../../../business/referenceText/useReferenceTextPassage', () => ({
  useProjectReferenceTexts: () => [{ id: 'primary' }, { id: 'secondary' }],
  useReferenceTextPassage: (_p: unknown, referenceText: { id: string }) =>
    mockPassages[referenceText.id] ?? { status: 'none' },
}));

jest.mock('../../../crud', () => ({
  related: jest.fn(() => 'section-1'),
  useArtifactCategory: () => ({
    scriptureTypeCategory: () => true,
  }),
}));

jest.mock('../../../utils', () => ({
  useMobile: () => ({
    isMobile: false,
    isMobileView: false,
    isMobileWidth: false,
  }),
}));

import { fireEvent, render, screen, within } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX (react-jsx) still expects React in scope for TS in this file
import React from 'react';
import { PassageDetailContext } from '../../../context/PassageDetailContext';
import { SelectMyResource } from './SelectMyResource';

const rowData = [
  {
    id: 'res-1',
    isResource: true,
    isText: false,
    artifactCategory: 'resource',
    resource: {},
    passageId: '',
    artifactName: 'Emotional-408.mp3',
  },
  {
    id: 'res-2',
    isResource: true,
    isText: false,
    artifactCategory: 'resource',
    resource: {},
    passageId: '',
    artifactName: 'i_love_you_mummy-29.mp3',
  },
];

function renderSelect(props: { disabled?: boolean; onChange?: jest.Mock }) {
  const state = {
    rowData,
    section: { id: 'section-1' },
    passage: { id: 'passage-1' },
  };
  return render(
    <PassageDetailContext.Provider
      value={{ state: state as never, setState: jest.fn() }}
    >
      <SelectMyResource onChange={props.onChange} disabled={props.disabled} />
    </PassageDetailContext.Provider>
  );
}

const bible = (over: Record<string, string> = {}) => ({
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books: 'JHN',
  ...over,
});

describe('SelectMyResource', () => {
  beforeEach(() => {
    delete mockPassages.primary;
    delete mockPassages.secondary;
  });

  it('lets the user pick a resource when nothing is playing', async () => {
    const onChange = jest.fn();
    renderSelect({ disabled: false, onChange });

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(
      await screen.findByRole('option', { name: 'i_love_you_mummy-29.mp3' })
    );

    expect(onChange).toHaveBeenCalledWith('res-2');
  });

  // TT-7005: switching the Compare-step resource mid-playback left the newly
  // selected resource silently not playing. The fix is to block the switch
  // outright while a resource is playing, rather than support switching
  // resources mid-play.
  it('TT-7005: blocks switching resources while one is playing', () => {
    const onChange = jest.fn();
    renderSelect({ disabled: true, onChange });

    const combobox = screen.getByRole('combobox');
    expect(combobox).toHaveAttribute('aria-disabled', 'true');

    fireEvent.mouseDown(combobox);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  // TT-7819: the project's Reference Texts are offered on Compare after the
  // audio resources, Primary then Secondary.
  it('TT-7819: offers the Reference Texts after the audio resources', async () => {
    mockPassages.primary = {
      status: 'ready',
      referenceText: bible(),
      text: 'For God so loved',
    };
    mockPassages.secondary = {
      status: 'loading',
      referenceText: bible({
        id: 'arb_vdv',
        name: 'Van Dyke',
        englishName: 'Van Dyke',
        language: 'arb',
      }),
    };
    const onChange = jest.fn();
    renderSelect({ onChange });

    fireEvent.mouseDown(screen.getByRole('combobox'));
    const options = within(await screen.findByRole('listbox')).getAllByRole(
      'option'
    );

    expect(options.map((o) => o.textContent)).toEqual([
      'Emotional-408.mp3',
      'i_love_you_mummy-29.mp3',
      'Primary Reference Text — Berean Standard Bible',
      'Secondary Reference Text — Van Dyke',
    ]);
    fireEvent.click(options[2]);
    expect(onChange).toHaveBeenCalledWith('referenceText:primary');
  });

  it('TT-7819: offers no Reference Text the project lacks', async () => {
    renderSelect({});

    fireEvent.mouseDown(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');

    expect(within(listbox).getAllByRole('option')).toHaveLength(2);
  });
});
