import { ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockPassages: Record<string, unknown> = {};
// Each rank's Reference Text is a stand-in whose id is the rank
jest.mock('../../../business/referenceText/useReferenceTextPassage', () => ({
  useProjectReferenceTexts: () => [{ id: 'primary' }, { id: 'secondary' }],
  useReferenceTextPassage: (_p: unknown, referenceText: { id: string }) =>
    mockPassages[referenceText.id] ?? { status: 'none' },
}));
jest.mock('../../../business/referenceText/speakReferenceText', () => ({
  speakReferenceText: jest.fn(),
}));
jest.mock('../../../crud/useOrgDefaults', () => ({
  orgDefaultTtsVoices: 'ttsVoices',
  useOrgDefaults: () => ({ getOrgDefault: () => undefined }),
}));
jest.mock('../../../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => ({
    passage: { id: 'p1', attributes: { book: 'JHN', reference: '3:16' } },
    setPlaying: jest.fn(),
    setItemPlaying: jest.fn(),
    setCommentPlaying: jest.fn(),
    handleOldVernacularPlayEnd: jest.fn(),
  }),
}));
jest.mock('./usePassageRef', () => ({
  usePassageRef: () => ({ passageRef: () => 'John 3:16' }),
}));
jest.mock('../../StepEditor', () => ({
  LightTooltip: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../control/WrapTitle', () => ({
  WrapTitle: ({ children }: { children: ReactNode }) => <h6>{children}</h6>,
}));
jest.mock('../../../hoc/BigDialog', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    onOpen,
  }: {
    title: string;
    children: ReactNode;
    onOpen: (open: boolean) => void;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
      <button onClick={() => onOpen(false)}>close</button>
    </div>
  ),
}));
jest.mock('../../../selector', () => ({
  vProjectSelector: () => ({
    primaryReferenceText: 'Primary Reference Text',
    secondaryReferenceText: 'Secondary Reference Text',
    licenseNotStated: 'License not stated',
    publicDomain: 'Dominio público',
  }),
  passageDetailArtifactsSelector: () => ({
    passageResource: 'Passage',
    referenceTextBookMissing: 'This Bible does not include this book.',
    referenceTextEmpty: 'This Bible has no text for these verses.',
    referenceTextFetchFailed: 'The passage could not be loaded.',
    referenceTextForbidden: 'You do not have access to this Reference Text.',
    referenceTextLoading: 'Loading passage…',
    referenceTextNoRange: 'This passage has no verse range.',
    referenceTextNoVoice: 'No voice for {0} on this device.',
    referenceTextNoVoiceOffline:
      'Voices for {0} on this device need the internet.',
    referenceTextRenewLogin: 'Renew login',
    referenceTextRetry: 'Try again',
    referenceTextSpeakFailed: 'The passage could not be spoken.',
    referenceTextUnauthorized:
      'Your login has expired. Renew it to load the passage.',
  }),
  resourceSelector: () => ({ passageResource: 'Passage' }),
  sharedSelector: () => ({ close: 'Close' }),
  mediaActionsSelector: () => ({
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    view: 'View',
  }),
  ttsVoicesSelector: () => ({
    windowsNote:
      'You can add Windows voices for other languages under Settings → Time & language → Speech → Add voices.',
    macNote:
      'You can add Mac voices for other languages under System Settings → Accessibility → Spoken Content → System voice → Manage Voices.',
    linuxNote:
      'Voices on Linux come from speech-dispatcher (for example espeak-ng). Install more voices with your package manager.',
  }),
}));
jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ strings: { lang: 'en' } }),
}));
// TableRow takes DragHandle from this barrel, which would load the store
jest.mock('.', () => ({ DragHandle: () => <span /> }));
jest.mock('../../../crud', () => ({
  useOrganizedBy: () => ({ getOrganizedBy: () => 'Section' }),
}));
const mockResetExpiresAt = jest.fn();
jest.mock('../../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: React.createContext({
      state: { resetExpiresAt: () => mockResetExpiresAt() },
    }),
  };
});

import { ReferenceTextRows } from './ReferenceTextRows';
import {
  SpeakOutcome,
  speakReferenceText,
} from '../../../business/referenceText/speakReferenceText';
import { ReferenceText } from '../../../business/referenceText/referenceText';

const bible = (over: Partial<ReferenceText> = {}): ReferenceText => ({
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books: 'JHN',
  ...over,
});
const arabic = bible({
  id: 'arb_vdv',
  name: 'الكتاب المقدس',
  englishName: 'Arabic Van Dyke',
  language: 'arb',
  textDirection: 'rtl',
  license: 'Public Domain',
  licenseUrl: 'https://example.org/pd',
});
const ready = (referenceText: ReferenceText, text = 'For God so loved') => ({
  status: 'ready',
  referenceText,
  text,
});

/** `speechPlatform` reads `navigator.platform` when `userAgentData` is absent. */
const setSpeechPlatform = (platform: string) => {
  const nav = globalThis.navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  delete nav.userAgentData;
  Object.defineProperty(nav, 'platform', {
    configurable: true,
    value: platform,
  });
};

const mockSpeak = speakReferenceText as jest.Mock;
let finishSpeaking: (outcome: SpeakOutcome) => void;
const stopSpeaking = jest.fn(() => finishSpeaking('stopped'));

beforeEach(() => {
  delete mockPassages.primary;
  delete mockPassages.secondary;
  stopSpeaking.mockClear();
  mockSpeak.mockReset().mockImplementation(() => ({
    done: new Promise<SpeakOutcome>((resolve) => (finishSpeaking = resolve)),
    stop: stopSpeaking,
  }));
});

describe('ReferenceTextRows', () => {
  it('renders nothing when the project has no Reference Text', () => {
    const { container } = render(<ReferenceTextRows variant="table" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists Primary then Secondary with rank and language', () => {
    mockPassages.primary = ready(bible());
    mockPassages.secondary = ready(arabic);
    const { container } = render(<ReferenceTextRows variant="table" />);
    const rows = container.querySelectorAll('[data-cy^="reference-text-"]');
    expect([...rows].map((r) => r.getAttribute('data-cy'))).toEqual([
      'reference-text-primary',
      'reference-text-secondary',
    ]);
    expect(rows[0]).toHaveTextContent('Berean Standard Bible');
    expect(rows[0]).toHaveTextContent('Primary Reference Text');
    expect(rows[0]).toHaveTextContent('English');
    expect(rows[1]).toHaveTextContent('Secondary Reference Text');
  });

  it('shows only the Reference Texts the project has', () => {
    mockPassages.secondary = ready(arabic);
    render(<ReferenceTextRows variant="table" />);
    expect(screen.queryByText('Primary Reference Text')).toBeNull();
    expect(screen.getByText('Secondary Reference Text')).toBeInTheDocument();
  });

  it('sets the Bible name in its own text direction', () => {
    mockPassages.primary = ready(arabic);
    render(<ReferenceTextRows variant="table" />);
    expect(screen.getByText(/الكتاب المقدس/)).toHaveAttribute('dir', 'rtl');
  });

  it('shows loading without play or view', () => {
    mockPassages.primary = { status: 'loading', referenceText: bible() };
    render(<ReferenceTextRows variant="table" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading passage…');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([
    ['bookNotInText', 'This Bible does not include this book.'],
    ['noRange', 'This passage has no verse range.'],
    ['empty', 'This Bible has no text for these verses.'],
    ['forbidden', 'You do not have access to this Reference Text.'],
  ])('explains %s without a retry', (error, message) => {
    mockPassages.primary = { status: 'error', referenceText: bible(), error };
    render(<ReferenceTextRows variant="table" />);
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers retry when the passage could not be loaded', () => {
    const retry = jest.fn();
    mockPassages.primary = {
      status: 'error',
      referenceText: bible(),
      error: 'fetchFailed',
      retry,
    };
    render(<ReferenceTextRows variant="table" />);
    expect(
      screen.getByText('The passage could not be loaded.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('offers to renew the login instead of retrying when the API rejects it', () => {
    mockPassages.primary = {
      status: 'error',
      referenceText: bible(),
      error: 'unauthorized',
    };
    render(<ReferenceTextRows variant="table" />);
    expect(
      screen.getByText('Your login has expired. Renew it to load the passage.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    const renew = screen.getByRole('button', { name: 'Renew login' });
    expect(renew).toHaveStyle({ whiteSpace: 'nowrap' });
    fireEvent.click(renew);
    expect(mockResetExpiresAt).toHaveBeenCalledTimes(1);
  });

  it('shows the text with a notice when play finds no voice', async () => {
    setSpeechPlatform('Win32');
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getByLabelText('Play'));
    expect(mockSpeak).toHaveBeenCalledWith(
      bible(),
      'For God so loved',
      expect.any(Function),
      {}
    );
    act(() => finishSpeaking('noVoice'));
    const dialog = await screen.findByRole('dialog', {
      name: 'Berean Standard Bible — John 3:16',
    });
    expect(dialog).toHaveTextContent('No voice for English on this device.');
    expect(dialog).toHaveTextContent(
      'Settings → Time & language → Speech → Add voices.'
    );
    expect(dialog).not.toHaveTextContent('Spoken Content');
    expect(dialog).toHaveTextContent('For God so loved');
    expect(dialog).toHaveTextContent('License not stated');
  });

  it('tells a Mac how to add a voice when this device has none', async () => {
    setSpeechPlatform('MacIntel');
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getByLabelText('Play'));
    act(() => finishSpeaking('noVoice'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      'System Settings → Accessibility → Spoken Content → System voice → Manage Voices.'
    );
    expect(dialog).not.toHaveTextContent('Add voices.');
  });

  it('shows the text with a notice when the only voices need the internet', async () => {
    setSpeechPlatform('Win32');
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getByLabelText('Play'));
    act(() => finishSpeaking('noVoiceOffline'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Voices for English on this device need the internet.'
    );
    expect(dialog).not.toHaveTextContent('Add voices.');
    expect(dialog).toHaveTextContent('For God so loved');
  });

  it('shows the text with a notice when speaking fails', async () => {
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getByLabelText('Play'));
    act(() => finishSpeaking('error'));
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'The passage could not be spoken.'
    );
  });

  it('offers Stop while speaking, then Play again once stopped', async () => {
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="card" />);
    fireEvent.click(screen.getByLabelText('Play'));
    fireEvent.click(await screen.findByLabelText('Stop'));
    expect(stopSpeaking).toHaveBeenCalled();
    expect(await screen.findByLabelText('Play')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not show the text when the passage is spoken', async () => {
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getByLabelText('Play'));
    act(() => finishSpeaking('ended'));
    await waitFor(() =>
      expect(screen.getByLabelText('Play')).toBeInTheDocument()
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('views the text with its license link, then closes', () => {
    mockPassages.primary = ready(bible());
    mockPassages.secondary = ready(arabic, 'لأنه هكذا أحب الله');
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getAllByLabelText('View')[1]);
    const dialog = screen.getByRole('dialog');
    expect(screen.getByText('لأنه هكذا أحب الله')).toHaveAttribute(
      'dir',
      'rtl'
    );
    expect(
      screen.getByRole('link', { name: 'Dominio público' })
    ).toHaveAttribute('href', 'https://example.org/pd');
    fireEvent.click(screen.getByText('close'));
    expect(dialog).not.toBeInTheDocument();
  });

  it('renders cards on mobile', () => {
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="card" />);
    expect(
      screen.getByRole('heading', { name: 'Berean Standard Bible' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Primary Reference Text · English')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('View'));
    expect(screen.getByRole('dialog')).toHaveTextContent('For God so loved');
  });
});
