import { ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockPassages: Record<string, unknown> = {};
jest.mock('../../../business/referenceText/useReferenceTextPassage', () => ({
  useReferenceTextPassage: (_p: unknown, role: string) =>
    mockPassages[role] ?? { status: 'none' },
}));
jest.mock('../../../business/referenceText/speakReferenceText', () => ({
  speakReferenceText: jest.fn(),
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
  }),
  passageDetailArtifactsSelector: () => ({
    passageResource: 'Passage',
    referenceTextBookMissing: 'This Bible does not include this book.',
    referenceTextEmpty: 'This Bible has no text for these verses.',
    referenceTextFetchFailed: 'The passage could not be loaded.',
    referenceTextLoading: 'Loading passage…',
    referenceTextNoRange: 'This passage has no verse range.',
    referenceTextNoVoice: 'No voice for {0} on this device.',
    referenceTextRetry: 'Try again',
    referenceTextSpeakFailed: 'The passage could not be spoken.',
  }),
  resourceSelector: () => ({ passageResource: 'Passage' }),
  sharedSelector: () => ({ close: 'Close' }),
  mediaActionsSelector: () => ({
    play: 'Play',
    pause: 'Pause',
    stop: 'Stop',
    view: 'View',
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

  it('lists Primary then Secondary with role and language', () => {
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

  it('shows the text with a notice when play finds no voice', async () => {
    mockPassages.primary = ready(bible());
    render(<ReferenceTextRows variant="table" />);
    fireEvent.click(screen.getByLabelText('Play'));
    expect(mockSpeak).toHaveBeenCalledWith(
      bible(),
      'For God so loved',
      expect.any(Function)
    );
    act(() => finishSpeaking('noVoice'));
    const dialog = await screen.findByRole('dialog', {
      name: 'Berean Standard Bible — John 3:16',
    });
    expect(dialog).toHaveTextContent('No voice for English on this device.');
    expect(dialog).toHaveTextContent('For God so loved');
    expect(dialog).toHaveTextContent('License not stated');
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
    expect(screen.getByRole('link', { name: 'Public Domain' })).toHaveAttribute(
      'href',
      'https://example.org/pd'
    );
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
