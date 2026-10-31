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

// TT-7819: the Reference Text parts Compare reuses from Internalize
const mockPassages: Record<string, unknown> = {};
// Each rank's Reference Text is a stand-in whose id is the rank
jest.mock('../../business/referenceText/useReferenceTextPassage', () => ({
  useProjectReferenceTexts: () => [{ id: 'primary' }, { id: 'secondary' }],
  useReferenceTextPassage: (_p: unknown, referenceText: { id: string }) =>
    mockPassages[referenceText.id] ?? { status: 'none' },
}));
jest.mock('../../business/referenceText/speakReferenceText', () => ({
  speakReferenceText: jest.fn(),
}));
jest.mock('./Internalization/usePassageRef', () => ({
  usePassageRef: () => ({ passageRef: () => 'John 3:16' }),
}));
jest.mock('../StepEditor', () => ({
  LightTooltip: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../hoc/BigDialog', () => ({
  __esModule: true,
  default: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
jest.mock('../../selector', () => ({
  vProjectSelector: () => ({
    primaryReferenceText: 'Primary Reference Text',
    secondaryReferenceText: 'Secondary Reference Text',
    licenseNotStated: 'License not stated',
  }),
  passageDetailArtifactsSelector: () => ({
    referenceTextLoading: 'Loading passage…',
    referenceTextNoVoice: 'No voice for {0} on this device.',
    referenceTextSpeakFailed: 'The passage could not be spoken.',
  }),
  sharedSelector: () => ({ close: 'Close' }),
  mediaActionsSelector: () => ({ play: 'Play', stop: 'Stop', view: 'View' }),
}));
jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ strings: { lang: 'en' } }),
}));

import { fireEvent, render, screen } from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX (react-jsx) still expects React in scope for TS in this file
import React, { act } from 'react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { TeamCheckReference } from './TeamCheckReference';
import SelectMyResource from './Internalization/SelectMyResource';
import { LimitedMediaPlayer } from '../LimitedMediaPlayer';
import { speakReferenceText } from '../../business/referenceText/speakReferenceText';

const mockSpeak = speakReferenceText as jest.Mock;
const bsb = {
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books: 'JHN',
};
const PRIMARY_ID = 'referenceText:primary';

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
    // Speaking a Reference Text stops other passage playback
    setPlaying: jest.fn(),
    setItemPlaying: jest.fn(),
    setCommentPlaying: jest.fn(),
    handleOldVernacularPlayEnd: jest.fn(),
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
    delete mockPassages.primary;
    delete mockPassages.secondary;
    mockSpeak.mockReset().mockReturnValue({
      done: new Promise(() => undefined),
      stop: jest.fn(),
    });
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

  // TT-7819: Compare offers the project's Reference Texts as resources. One
  // is spoken, not played as media, so it must not become the playItem.
  it('TT-7819: speaks the Primary Reference Text picked as the resource', () => {
    mockPassages.primary = {
      status: 'ready',
      referenceText: bsb,
      text: 'For God so loved',
    };
    const setPlayItem = jest.fn();
    renderWithContext({ setPlayItem });

    act(() => {
      SelectMyResourceMock.mock.calls.at(-1)[0].onChange(PRIMARY_ID);
    });

    expect(setPlayItem).not.toHaveBeenCalledWith(PRIMARY_ID);
    expect(screen.queryByTestId('limited-media-player')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(mockSpeak).toHaveBeenCalledWith(
      bsb,
      'For God so loved',
      expect.any(Function)
    );
  });

  it('TT-7819: restores a Reference Text chosen earlier for the passage', () => {
    mockPassages.primary = {
      status: 'ready',
      referenceText: bsb,
      text: 'For God so loved',
    };
    localStorage.setItem('compare-res', PRIMARY_ID);
    localStorage.setItem('compare-secId', 'section-1');
    const setPlayItem = jest.fn();

    renderWithContext({ setPlayItem });

    expect(setPlayItem).not.toHaveBeenCalledWith(PRIMARY_ID);
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });

  it('TT-7819: plays media again after switching back from a Reference Text', () => {
    mockPassages.primary = {
      status: 'ready',
      referenceText: bsb,
      text: 'For God so loved',
    };
    const setPlayItem = jest.fn();
    renderWithContext({ rowData: [storedRow], setPlayItem });
    const { onChange } = SelectMyResourceMock.mock.calls.at(-1)[0];

    act(() => onChange(PRIMARY_ID));
    act(() => onChange('res-1'));

    expect(setPlayItem).toHaveBeenLastCalledWith('res-1');
    expect(screen.getByTestId('limited-media-player')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull();
  });
});
