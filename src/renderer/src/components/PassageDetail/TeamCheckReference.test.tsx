// Context object must be created inside the factory so it exists when the mock
// initializes (ESM hoists imports; do not rely on a pre-mock const binding).
jest.mock('../../context/PassageDetailContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: R.createContext({
      state: {},
      setState: jest.fn(),
    }),
  };
});

jest.mock('./Internalization/SelectMyResource', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="select-resource" />),
}));

jest.mock('../LimitedMediaPlayer', () => ({
  LimitedMediaPlayer: jest.fn(() => <div data-testid="limited-media-player" />),
}));

jest.mock('../../utils', () => ({
  NamedRegions: { ProjectResource: 'ProjectResource' },
  getSegments: jest.fn(() => '[]'),
}));

jest.mock('../../utils/storedCompareKey', () => ({
  storedCompareKey: () => ({
    removeStoredKeys: jest.fn(),
    saveKey: jest.fn(),
    storeKey: () => 'compare-store-key',
    SecSlug: 'SecSlug',
  }),
}));

import { render } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX (react-jsx) still expects React in scope for TS in this file
import React from 'react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { TeamCheckReference } from './TeamCheckReference';
import SelectMyResource from './Internalization/SelectMyResource';

const SelectMyResourceMock = SelectMyResource as unknown as jest.Mock;

function buildState(overrides: Record<string, unknown> = {}) {
  return {
    rowData: [],
    playItem: '',
    setPlayItem: jest.fn(),
    setMediaSelected: jest.fn(),
    itemPlaying: false,
    handleItemPlayEnd: jest.fn(),
    handleItemTogglePlay: jest.fn(),
    section: { id: 'section-1' },
    passage: { id: 'passage-1' },
    currentstep: 'compare-step',
    ...overrides,
  };
}

function renderWithContext(stateOverrides?: Record<string, unknown>) {
  const state = buildState(stateOverrides);
  return render(
    <PassageDetailContext.Provider
      value={{ state: state as never, setState: jest.fn() }}
    >
      <TeamCheckReference />
    </PassageDetailContext.Provider>
  );
}

describe('TeamCheckReference', () => {
  beforeEach(() => {
    SelectMyResourceMock.mockClear();
    global.localStorage.getItem = jest.fn(() => null);
  });

  it('leaves the resource selector enabled when nothing is playing', () => {
    renderWithContext({ itemPlaying: false });

    expect(SelectMyResourceMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ disabled: false })
    );
  });

  // TT-7005: while a Compare-step resource was playing, picking a different
  // resource from the dropdown silently failed to play it. The fix disallows
  // switching the selection while a resource is playing, so the dropdown must
  // be disabled whenever itemPlaying is true.
  it('TT-7005: disables the resource selector while a resource is playing', () => {
    renderWithContext({ itemPlaying: true });

    expect(SelectMyResourceMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({ disabled: true })
    );
  });
});
