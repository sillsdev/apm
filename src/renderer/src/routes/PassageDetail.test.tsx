import type { ReactNode } from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

type ShouldBlock = (args: { nextLocation: { pathname: string } }) => boolean;

const mockEnv = { isElectron: false };
const mockGlobals: Record<string, unknown> = {};
const mockBlocker = {
  state: 'unblocked',
  proceed: jest.fn(),
  reset: jest.fn(),
};
let mockShouldBlock: ShouldBlock | undefined;

jest.mock('react-router-dom', () => ({
  useParams: () => ({ prjId: 'p1', pasId: 's1' }),
  useLocation: () => ({ pathname: '/detail/p1/s1' }),
  useBlocker: (fn: ShouldBlock) => {
    mockShouldBlock = fn;
    return mockBlocker;
  },
}));

// Getter so each test can flip isElectron after the module is imported.
jest.mock('../../api-variable', () => ({
  get isElectron() {
    return mockEnv.isElectron;
  },
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => [mockGlobals[key], jest.fn()],
  useGetGlobal: () => (key: string) => mockGlobals[key],
}));

jest.mock('../utils/useMyNavigate', () => ({ navigationCancelled: jest.fn() }));

jest.mock('react-redux', () => ({
  useSelector: () => ({ leaveUnsavedChanges: 'Leave unsaved?' }),
}));
jest.mock('../selector', () => ({}));

jest.mock('../crud', () => ({
  useUrlContext: () => (id: string) => id,
  useProjectType: () => ({ setProjectType: () => true }),
}));

jest.mock('../utils/useMobile', () => ({
  useMobile: () => ({ isMobile: false }),
}));

const mockPassthrough = ({ children }: { children: ReactNode }) => children;
jest.mock('../components/App/AppLayout', () => mockPassthrough);
jest.mock('../context/PassageDetailContext', () => ({
  PassageDetailProvider: mockPassthrough,
}));
jest.mock('../components/PassageDetail/PassageDetailGrids', () => () => (
  <div data-testid="grids" />
));

// Not rendered on desktop; stubbed so their dependency trees stay out.
const mockNull = () => null;
jest.mock('../components/StickyRedirect', () => mockNull);
jest.mock('../components/usePaneWidth', () => ({}));
jest.mock('../components/PassageDetail/boldClauseTranscription', () => ({}));
jest.mock('../components/PassageDetail/PassageDetailMobileDetail', () => mockNull);
jest.mock('../components/PassageDetail/PassageDetailRecord', () => mockNull);
jest.mock('../components/PassageDetail/Internalization/PassageDetailsArtifactsMobile', () => mockNull);
jest.mock('../components/PassageDetail/mobile/MarkVerses/PassageDetailMarkVerses', () => mockNull);
jest.mock('../components/PassageDetail/PassageDetailCarefulSpeech', () => mockNull);
jest.mock('../components/PassageDetail/PassageDetailPhraseBackTranslate', () => mockNull);
jest.mock('../components/PassageDetail/PassageDetailLwcTranslation', () => mockNull);
jest.mock('../components/PassageDetail/PassageDetailLwcTranscription', () => mockNull);
jest.mock('../components/PassageDetail/mobile/TeamCheckReferenceMobile', () => mockNull);
jest.mock('../components/PassageDetail/Prompt/PassageDetailPrompt', () => mockNull);
jest.mock('../components/PassageDetail/mobile/transcribe/PassageDetailTranscribeMobile', () => mockNull);

import PassageDetail from './PassageDetail';
import { navigationCancelled } from '../utils/useMyNavigate';

const confirmSpy = jest.spyOn(window, 'confirm');

describe('PassageDetail', () => {
  beforeEach(() => {
    mockEnv.isElectron = false;
    mockBlocker.state = 'unblocked';
    mockShouldBlock = undefined;
    for (const key of Object.keys(mockGlobals)) delete mockGlobals[key];
  });

  it('renders the desktop grids', () => {
    render(<PassageDetail />);
    expect(screen.getByTestId('grids')).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  describe('LeaveUnsavedGuard', () => {
    it.each([
      ['allows leaving when nothing changed', false, false, '/team', false],
      ['blocks leaving with unsaved changes', true, false, '/team', true],
      ['allows same-passage moves', true, false, '/detail/p1/s1/x', false],
      ['allows leaving on Electron', true, true, '/team', false],
    ])('%s', (_, changed, isElectron, pathname, expected) => {
      render(<PassageDetail />);
      // Set after mount: the guard must read these at navigation time.
      mockGlobals.changed = changed;
      mockEnv.isElectron = isElectron;
      expect(mockShouldBlock!({ nextLocation: { pathname } })).toBe(expected);
    });

    it('proceeds when the user confirms leaving', () => {
      mockBlocker.state = 'blocked';
      confirmSpy.mockReturnValue(true);
      render(<PassageDetail />);
      expect(confirmSpy).toHaveBeenCalledWith('Leave unsaved?');
      expect(mockBlocker.proceed).toHaveBeenCalledTimes(1);
      expect(mockBlocker.reset).not.toHaveBeenCalled();
      expect(navigationCancelled).not.toHaveBeenCalled();
    });

    it('stays and signals cancellation when the user declines', () => {
      mockBlocker.state = 'blocked';
      confirmSpy.mockReturnValue(false);
      render(<PassageDetail />);
      expect(mockBlocker.reset).toHaveBeenCalledTimes(1);
      expect(mockBlocker.proceed).not.toHaveBeenCalled();
      expect(navigationCancelled).toHaveBeenCalledTimes(1);
    });
  });
});
