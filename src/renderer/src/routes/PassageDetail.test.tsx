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

// The message TT-7694 agreed on for steps mobile does not implement yet.
const desktopOnlyEn =
  'This step is only available on computers right now. We are working to bring it to mobile phones soon.';

// Serves the selectors below; tests mutate it to change language.
const mockStrings = {
  shared: { leaveUnsavedChanges: 'Leave unsaved?', noAudio: 'No audio' },
  mobile: { desktopOnlyStep: desktopOnlyEn },
};

const mockMobile = { isMobile: false, isMobileWidth: false };
const mockStep = { tool: '' };
const mockPdState: {
  currentstep: string;
  isBoldWorkflow: boolean;
  discussOpen: boolean;
  rowData: { version: number }[];
} = {
  currentstep: 'step1',
  isBoldWorkflow: false,
  discussOpen: false,
  rowData: [{ version: 1 }],
};

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

// Run the real selectors against a stub strings state so a component that
// hard-codes English instead of reading its strings layout fails.
jest.mock('../selector', () => ({
  sharedSelector: (state: { strings: { shared: unknown } }) =>
    state.strings.shared,
  mobileSelector: (state: { strings: { mobile: unknown } }) =>
    state.strings.mobile,
}));
jest.mock('react-redux', () => ({
  useSelector: (sel: (state: unknown) => unknown) =>
    sel({ strings: mockStrings }),
  shallowEqual: jest.fn(),
}));

jest.mock('../crud', () => {
  const toolSlug =
    jest.requireActual<typeof import('../crud/toolSlug')>('../crud/toolSlug');
  return {
    ToolSlug: toolSlug.ToolSlug,
    toolAllowsEmptyVernacularAudio: toolSlug.toolAllowsEmptyVernacularAudio,
    useUrlContext: () => (id: string) => id,
    useProjectType: () => ({ setProjectType: () => true }),
    useStepTool: () => ({ tool: mockStep.tool, settings: '{}' }),
    useArtifactType: () => ({ slugFromId: () => null }),
    remoteIdGuid: () => undefined,
  };
});

jest.mock('../utils/useMobile', () => ({
  useMobile: () => ({ ...mockMobile }),
}));

const mockPassthrough = ({ children }: { children: ReactNode }) => children;
jest.mock('../components/App/AppLayout', () => mockPassthrough);

// Context created inside the factory so the provider and useContext always
// share one context object (see jest-testing-takeaways).
jest.mock('../context/PassageDetailContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const PassageDetailContext = React.createContext<unknown>(undefined);
  const PassageDetailProvider = ({ children }: { children: ReactNode }) => (
    <PassageDetailContext.Provider value={{ state: mockPdState }}>
      {children}
    </PassageDetailContext.Provider>
  );
  return { PassageDetailContext, PassageDetailProvider };
});

jest.mock('../components/PassageDetail/PassageDetailGrids', () => {
  function PassageDetailGrids() {
    return <div data-testid="grids" />;
  }

  return PassageDetailGrids;
});

// Stands in for the mobile layout: renders whichever branch the route chose.
jest.mock('../components/PassageDetail/PassageDetailMobileDetail', () => {
  function PassageDetailMobileDetail({
    showNoAudioPlaceholder,
    recordContent,
    noAudioText,
  }: {
    showNoAudioPlaceholder: boolean;
    recordContent: ReactNode;
    noAudioText: string;
  }) {
    return (
      <div data-testid="mobile-detail">
        {showNoAudioPlaceholder ? noAudioText : recordContent}
      </div>
    );
  }

  return PassageDetailMobileDetail;
});

jest.mock('../components/PassageDetail/PassageDetailRecord', () => {
  function PassageDetailRecord() {
    return <div data-testid="record" />;
  }

  return PassageDetailRecord;
});

// Not exercised by these tests; stubbed so their dependency trees stay out.
const mockNull = () => null;
jest.mock('../components/StickyRedirect', () => mockNull);
jest.mock('../components/usePaneWidth', () => ({
  usePaneWidth: () => ({ paneWidth: 320 }),
}));
jest.mock('../components/PassageDetail/boldClauseTranscription', () => ({
  isBoldClauseTranscriptionStep: () => false,
}));
jest.mock(
  '../components/PassageDetail/Internalization/PassageDetailsArtifactsMobile',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/mobile/MarkVerses/PassageDetailMarkVerses',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/PassageDetailCarefulSpeech',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/PassageDetailPhraseBackTranslate',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/PassageDetailLwcTranslation',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/PassageDetailLwcTranscription',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/mobile/TeamCheckReferenceMobile',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/Prompt/PassageDetailPrompt',
  () => mockNull
);
jest.mock(
  '../components/PassageDetail/mobile/transcribe/PassageDetailTranscribeMobile',
  () => mockNull
);

import PassageDetail from './PassageDetail';
import { navigationCancelled } from '../utils/useMyNavigate';
import { ToolSlug } from '../crud/toolSlug';

const confirmSpy = jest.spyOn(window, 'confirm');

describe('PassageDetail', () => {
  beforeEach(() => {
    mockEnv.isElectron = false;
    mockBlocker.state = 'unblocked';
    mockShouldBlock = undefined;
    mockMobile.isMobile = false;
    mockMobile.isMobileWidth = false;
    mockStep.tool = '';
    mockPdState.rowData = [{ version: 1 }];
    mockStrings.mobile.desktopOnlyStep = desktopOnlyEn;
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

  // TT-7694: steps mobile has no UI for showed a bare developer string,
  // "Not implemented". Users get an explanation instead, from the strings.
  describe('steps mobile does not implement yet', () => {
    beforeEach(() => {
      mockMobile.isMobile = true;
      mockMobile.isMobileWidth = true;
      mockStep.tool = ToolSlug.KeyTerm;
    });

    it('explains that the step is desktop-only for now', () => {
      render(<PassageDetail />);
      expect(screen.getByText(desktopOnlyEn)).toBeInTheDocument();
      expect(screen.queryByText('Not implemented')).not.toBeInTheDocument();
    });

    it.each([
      ToolSlug.KeyTerm,
      ToolSlug.Discuss,
      ToolSlug.WholeBackTranslate,
      ToolSlug.ConsultantCheck,
      ToolSlug.Paratext,
      ToolSlug.Community,
      ToolSlug.Export,
    ])('explains it for the %s step', (tool) => {
      mockStep.tool = tool;
      render(<PassageDetail />);
      expect(screen.getByText(desktopOnlyEn)).toBeInTheDocument();
    });

    // Discriminates a localized string from the agreed English hard-coded.
    it('shows the message in the current language', () => {
      const desktopOnlyEs =
        'Este paso solo está disponible en computadoras por ahora.';
      mockStrings.mobile.desktopOnlyStep = desktopOnlyEs;
      render(<PassageDetail />);
      expect(screen.getByText(desktopOnlyEs)).toBeInTheDocument();
      expect(screen.queryByText(desktopOnlyEn)).not.toBeInTheDocument();
    });

    it('renders the step itself when mobile does implement it', () => {
      mockStep.tool = ToolSlug.Record;
      render(<PassageDetail />);
      expect(screen.getByTestId('record')).toBeInTheDocument();
      expect(screen.queryByText(desktopOnlyEn)).not.toBeInTheDocument();
    });
  });
});
