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
    // distinct keys so a test can answer the resource lookup and the section
    // lookup differently
    storeKey: (keyType?: string) => `compare-${keyType ?? 'res'}`,
    SecSlug: 'secId',
  }),
}));

import { render } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX (react-jsx) still expects React in scope for TS in this file
import React, { act } from 'react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { TeamCheckReference } from './TeamCheckReference';
import SelectMyResource from './Internalization/SelectMyResource';
import { LimitedMediaPlayer } from '../LimitedMediaPlayer';

const SelectMyResourceMock = SelectMyResource as unknown as jest.Mock;
const LimitedMediaPlayerMock = LimitedMediaPlayer as unknown as jest.Mock;

const storedRow = {
  id: 'res-1',
  mediafile: { id: 'res-1', attributes: { segments: '{}' } },
};

/**
 * The user previously chose 'res-1' for this passage of this section.
 * Seed real storage: jsdom's localStorage is a Proxy, so assigning over
 * `getItem` stores an item named "getItem" instead of replacing the method.
 */
function storedResourceInLocalStorage() {
  localStorage.setItem('compare-res', 'res-1');
  localStorage.setItem('compare-secId', 'section-1');
}

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
    LimitedMediaPlayerMock.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('leaves the resource selector usable when nothing is playing', () => {
    renderWithContext({ itemPlaying: false });

    expect(SelectMyResourceMock.mock.calls[0][0].disabled).toBeFalsy();
  });

  // TT-7005 (reopened): PR #606 blocked switching while a resource played,
  // which only hid the real defect (LimitedMediaPlayer reporting a spurious
  // "ended" as soon as the next resource's blob loaded). With that fixed, the
  // dropdown must stay usable mid-playback — picking another resource while
  // one plays is what the ticket asked for in the first place.
  it('TT-7005: keeps the resource selector usable while a resource is playing', () => {
    renderWithContext({ itemPlaying: true });

    expect(SelectMyResourceMock.mock.calls[0][0].disabled).toBeFalsy();
  });

  // TT-7005 (reopened): when a resource finished, handleEnded cleared playItem
  // and 500ms later the restore effect re-selected the same resource from
  // localStorage. That re-armed PassageDetailContext's 2-second auto-play
  // timer, so the finished resource restarted itself and the player tore down
  // and remounted on every cycle — the "blinking" QA reported.
  it('TT-7005: does not re-select the resource after it finishes playing', () => {
    jest.useFakeTimers();
    storedResourceInLocalStorage();
    const setPlayItem = jest.fn();
    const handleItemPlayEnd = jest.fn();

    renderWithContext({
      rowData: [storedRow],
      setPlayItem,
      handleItemPlayEnd,
    });
    // sanity: the stored choice was restored on mount
    expect(setPlayItem).toHaveBeenCalledWith('res-1');
    setPlayItem.mockClear(); // ignore the mount-time restore

    act(() => {
      LimitedMediaPlayerMock.mock.calls[0][0].onEnded();
    });
    expect(handleItemPlayEnd).toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(setPlayItem).not.toHaveBeenCalledWith('res-1');
  });
});
