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
  useSelector: () => ({
    resource: 'Resource',
    resourcehelper: 'Select a resource',
  }),
  shallowEqual: (a: unknown, b: unknown) => a === b,
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

import { fireEvent, render, screen } from '@testing-library/react';
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

describe('SelectMyResource', () => {
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
});
