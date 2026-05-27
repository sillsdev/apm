// react-router (via PassageDetailContext) requires TextEncoder in this Jest env.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { TextDecoder, TextEncoder } = require('util');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).TextEncoder = TextEncoder;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).TextDecoder = TextDecoder;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const React = require('react');
const { cleanup, render, screen } = require('@testing-library/react');
require('@testing-library/jest-dom');

const { ToolSlug } = require('../../../crud/toolSlug');

// Avoid importing the real PassageDetailContext (pulls localization reducers that import ESM).
const MockPassageDetailContext = React.createContext({
  state: {},
  setState: jest.fn(),
});
jest.mock('../../../context/PassageDetailContext', () => ({
  PassageDetailContext: MockPassageDetailContext,
}));

jest.mock('../../../crud', () => ({
  ToolSlug,
  useStepTool: () => ({ tool: ToolSlug.TeamCheck }),
}));

jest.mock('../../../utils', () => ({
  NamedRegions: { ProjectResource: 'ProjectResource' },
  getSegments: jest.fn(() => '[]'),
}));

jest.mock('../../../crud/useFetchMediaBlob', () => ({
  BlobStatus: { FETCHED: 'FETCHED' },
  useFetchMediaBlob: () => [
    { id: '', blobStat: 'IDLE', blob: undefined },
    jest.fn(),
  ],
}));

const { TeamCheckReferenceMobile } = require('./TeamCheckReferenceMobile');
const { PassageDetailPlayer } = require('../PassageDetailPlayer');

const PassageDetailPlayerMock =
  PassageDetailPlayer as jest.MockedFunction<typeof PassageDetailPlayer>;

jest.mock('../PassageDetailPlayer', () => ({
  PassageDetailPlayer: jest.fn(() => <div data-testid="passage-player" />),
}));
jest.mock('../Internalization/SelectMyResource', () => ({
  __esModule: true,
  default: () => <div data-testid="select-resource" />,
}));

jest.mock('../../../utils/storedCompareKey', () => ({
  storedCompareKey: () => ({
    removeStoredKeys: jest.fn(),
    saveKey: jest.fn(),
    storeKey: () => 'compare-store-key',
    SecSlug: 'SecSlug',
  }),
}));

function buildState(overrides: Record<string, unknown> = {}) {
  return {
    rowData: [],
    setPlayItem: jest.fn(),
    setMediaSelected: jest.fn(),
    playing: false,
    setPlaying: jest.fn(),
    section: { id: 'section-1' },
    passage: { id: 'passage-1' },
    currentstep: 'compare-step',
    ...overrides,
  };
}

function renderWithContext(stateOverrides?: Record<string, unknown>) {
  const state = buildState(stateOverrides);
  return render(
    <MockPassageDetailContext.Provider
      value={{ state: state as never, setState: jest.fn() }}
    >
      <TeamCheckReferenceMobile width={400} />
    </MockPassageDetailContext.Provider>
  );
}

describe('TeamCheckReferenceMobile', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
    (PassageDetailPlayer as unknown as jest.Mock).mockClear();
    global.localStorage.getItem = jest.fn(() => null);
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('does not render a PassageDetailChooser on mobile Compare', () => {
    renderWithContext();
    expect(screen.queryAllByTestId('passage-chooser')).toHaveLength(0);
  });

  it('renders vernacular player and reference resource selector', () => {
    renderWithContext();
    expect(screen.getAllByTestId('passage-player')).toHaveLength(2);
    expect(screen.getByTestId('select-resource')).toBeInTheDocument();
  });

  it('stops the top player when bottom player starts (TT-7280)', () => {
    const setTopPlaying = jest.fn();
    renderWithContext({
      playing: true,
      setPlaying: setTopPlaying,
    });

    expect(PassageDetailPlayerMock).toHaveBeenCalled();
    const calls = PassageDetailPlayerMock.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const bottomProps = calls[1][0];
    expect(bottomProps.playerState).toBeDefined();
    bottomProps.playerState.setPlaying(true);

    expect(setTopPlaying).toHaveBeenCalledWith(false);
  });
});
