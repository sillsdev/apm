/**
 * The discussion panel opens as a right-hand drawer over the step (instead of
 * an inline column that narrowed the step). The drawer carries its own player
 * because the backdrop covers the step's player.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import DiscussionDrawer from './DiscussionDrawer';

let latestPlayerProps: Record<string, unknown> = {};

jest.mock('../../context/PassageDetailContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: R.createContext({ state: {}, setState: jest.fn() }),
  };
});

jest.mock('../../context/UnsavedContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: R.createContext({ state: {}, setState: jest.fn() }),
  };
});

jest.mock('./DiscussionList', () => ({
  __esModule: true,
  NewDiscussionToolId: 'newDiscussion',
  actionButtonProps: {},
  default: (props: {
    closeButton: React.ReactNode;
    player: React.ReactNode;
  }) => (
    <div data-testid="discussion-list">
      {props.closeButton}
      {props.player}
    </div>
  ),
}));

jest.mock('../AlertDialog', () => ({
  __esModule: true,
  default: (props: {
    no: string;
    yes: string;
    noResponse: () => void;
    yesResponse: () => void;
  }) => (
    <div data-testid="confirm-close">
      <button onClick={props.noResponse}>{props.no}</button>
      <button onClick={props.yesResponse}>{props.yes}</button>
    </div>
  ),
}));

jest.mock('../PassageDetail/PassageDetailPlayer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    latestPlayerProps = props;
    return <div data-testid="mini-player" />;
  },
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: (table: string) =>
    table === 'discussion' ? [{ id: 'd1' }] : [],
}));
jest.mock('../../crud/useDiscussionCount', () => ({
  useDiscussionCount: () => () => 2,
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    open: 'Open discussions',
    close: 'Close',
    stayOpen: 'Stay Open',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../selector', () => ({
  discussionListSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

const setDiscussOpen = jest.fn();
const setPlaying = jest.fn();

const startClear = jest.fn();
const unsent = { d1: {} };

const panel = (discussOpen: boolean, toolsChanged: object) => (
  <UnsavedContext.Provider
    value={
      { state: { toolsChanged, startClear }, setState: jest.fn() } as never
    }
  >
    <PassageDetailContext.Provider
      value={
        {
          state: {
            mediafileId: 'm1',
            discussOpen,
            passage: { id: 'p1' },
            currentstep: 's1',
            setDiscussOpen,
            setPlaying,
          },
          setState: jest.fn(),
        } as never
      }
    >
      <DiscussionDrawer />
    </PassageDetailContext.Provider>
  </UnsavedContext.Provider>
);

const renderPanel = (discussOpen: boolean, toolsChanged: object = {}) =>
  render(panel(discussOpen, toolsChanged));

describe('DiscussionDrawer', () => {
  beforeEach(() => {
    startClear.mockClear();
    latestPlayerProps = {};
    setDiscussOpen.mockClear();
    setPlaying.mockClear();
  });

  it('pauses the step player when opening the drawer', () => {
    renderPanel(false);
    fireEvent.click(screen.getByLabelText('Open discussions'));
    expect(setPlaying).toHaveBeenCalledWith(false);
    expect(setDiscussOpen).toHaveBeenCalledWith(true);
  });

  it('gives the drawer player its own play state and no hotkeys', () => {
    renderPanel(true);
    expect(screen.getByTestId('mini-player')).toBeInTheDocument();
    expect(latestPlayerProps.playing).toBe(false);
    expect(typeof latestPlayerProps.setPlayingOverride).toBe('function');
    expect(latestPlayerProps.hotkeys).toBe(false);
  });

  const pressEscape = () =>
    fireEvent.keyDown(screen.getByTestId('discussion-list'), {
      key: 'Escape',
    });

  it('closes on Escape or the close button when nothing is unsent', () => {
    renderPanel(true);
    pressEscape();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(setDiscussOpen).toHaveBeenCalledTimes(2);
    expect(setDiscussOpen).toHaveBeenCalledWith(false);
  });

  it('asks before closing with unsent edits; Stay Open keeps them', () => {
    renderPanel(true, unsent);
    pressEscape();
    fireEvent.click(screen.getByText('Stay Open'));
    expect(screen.queryByTestId('confirm-close')).not.toBeInTheDocument();
    expect(startClear).not.toHaveBeenCalled();
    expect(setDiscussOpen).not.toHaveBeenCalled();
  });

  it('discards unsent edits and closes once they are cleared', () => {
    const { rerender } = renderPanel(true, unsent);
    fireEvent.click(screen.getByLabelText('Close'));
    fireEvent.click(
      within(screen.getByTestId('confirm-close')).getByText('Close')
    );
    expect(startClear).toHaveBeenCalledWith('d1');
    expect(setDiscussOpen).not.toHaveBeenCalled();
    rerender(panel(true, {}));
    expect(setDiscussOpen).toHaveBeenCalledWith(false);
  });

  describe('drawer width', () => {
    const paperStyle = () =>
      getComputedStyle(
        document.querySelector('.MuiDrawer-paper') as HTMLElement
      );

    it('is a fixed-width panel capped to the viewport by CSS', () => {
      renderPanel(true);
      expect(paperStyle().width).toBe('450px');
      expect(paperStyle().maxWidth).toBe('95vw');
    });

    it('lets the mini player fill the panel instead of passing a width', () => {
      renderPanel(true);
      expect(latestPlayerProps.width).toBeUndefined();
    });
  });
});
