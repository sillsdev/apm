/**
 * The discussion panel opens as a right-hand drawer over the step (instead of
 * an inline column that narrowed the step). The drawer carries its own player
 * because the backdrop covers the step's player.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import DiscussionPanel from './DiscussionPanel';

let mockDirty = false;
let latestPlayerProps: Record<string, unknown> = {};

jest.mock('../../context/PassageDetailContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: R.createContext({ state: {}, setState: jest.fn() }),
  };
});

jest.mock('./DiscussionList', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  const MockDiscussionList = (props: {
    onClose: () => void;
    onDirtyChange: (dirty: boolean) => void;
    player: React.ReactNode;
  }) => {
    R.useEffect(() => {
      props.onDirtyChange(mockDirty);
    });
    return (
      <div data-testid="discussion-list">
        {props.player}
        <button onClick={props.onClose}>close</button>
      </div>
    );
  };
  return { __esModule: true, default: MockDiscussionList };
});

jest.mock('../PassageDetail/PassageDetailPlayer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    latestPlayerProps = props;
    return <div data-testid="mini-player" />;
  },
}));

jest.mock('../../hoc/useOrbitData', () => ({ useOrbitData: () => [] }));
jest.mock('../../crud/useDiscussionCount', () => ({
  useDiscussionCount: () => () => 2,
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({ open: 'Open discussions' }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../selector', () => ({ discussionListSelector: jest.fn() }));

const setDiscussOpen = jest.fn();
const setPlaying = jest.fn();

const renderPanel = (discussOpen: boolean) =>
  render(
    <PassageDetailContext.Provider
      value={
        {
          state: {
            discussionSize: { width: 450, height: 700 },
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
      <DiscussionPanel />
    </PassageDetailContext.Provider>
  );

describe('DiscussionPanel drawer', () => {
  beforeEach(() => {
    mockDirty = false;
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

  it('closes on Escape when there are no unsaved edits', () => {
    renderPanel(true);
    fireEvent.keyDown(screen.getByTestId('discussion-list'), {
      key: 'Escape',
    });
    expect(setDiscussOpen).toHaveBeenCalledWith(false);
  });

  it('stays open on Escape while there are unsaved edits', () => {
    mockDirty = true;
    renderPanel(true);
    fireEvent.keyDown(screen.getByTestId('discussion-list'), {
      key: 'Escape',
    });
    expect(setDiscussOpen).not.toHaveBeenCalled();
  });

  it('closes from the list close button', () => {
    renderPanel(true);
    fireEvent.click(screen.getByText('close'));
    expect(setDiscussOpen).toHaveBeenCalledWith(false);
  });

  describe('drawer width', () => {
    const innerWidth = window.innerWidth;
    afterEach(() => {
      window.innerWidth = innerWidth;
    });

    const paperWidth = () =>
      getComputedStyle(
        document.querySelector('.MuiDrawer-paper') as HTMLElement
      ).width;

    it('uses the discussion width on a wide screen', () => {
      window.innerWidth = 1440;
      renderPanel(true);
      expect(paperWidth()).toBe('450px');
      expect(latestPlayerProps.width).toBe(450 - 16);
    });

    it('covers at most 95% of a phone-width screen', () => {
      window.innerWidth = 390;
      renderPanel(true);
      expect(paperWidth()).toBe('370px');
      expect(latestPlayerProps.width).toBe(370 - 16);
    });
  });
});
