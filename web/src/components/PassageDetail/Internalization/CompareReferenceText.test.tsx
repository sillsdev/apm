import { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

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
jest.mock('../../../crud/useOrgDefaults', () => ({
  orgDefaultTtsVoices: 'ttsVoices',
  useOrgDefaults: () => ({ getOrgDefault: () => undefined }),
}));
jest.mock('./ReferenceTextDialog', () => ({ ReferenceTextDialog: () => null }));
// ReferenceTextStatus reads the login; the real provider loads auth0
jest.mock('../../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext({ state: {} }) };
});
jest.mock('../../StepEditor', () => ({
  LightTooltip: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../selector', () => ({
  passageDetailArtifactsSelector: () => ({
    referenceTextLoading: 'Loading passage…',
  }),
  mediaActionsSelector: () => ({ play: 'Play', stop: 'Stop', view: 'View' }),
}));
jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ strings: { lang: 'en' } }),
}));

import { CompareReferenceText } from './CompareReferenceText';
import {
  SpeakOutcome,
  speakReferenceText,
} from '../../../business/referenceText/speakReferenceText';

const ready = (id: string, text: string) => ({
  status: 'ready',
  referenceText: { id, language: 'eng' },
  text,
});

const mockSpeak = speakReferenceText as jest.Mock;
const stopSpeaking = jest.fn();

beforeEach(() => {
  mockPassages.primary = ready('BSB', 'For God so loved');
  mockPassages.secondary = ready('WEB', 'For God so loved the world');
  stopSpeaking.mockClear();
  mockSpeak.mockReset().mockImplementation(() => {
    let finish: (outcome: SpeakOutcome) => void = () => undefined;
    const done = new Promise<SpeakOutcome>((resolve) => (finish = resolve));
    stopSpeaking.mockImplementation(() => finish('stopped'));
    return { done, stop: stopSpeaking };
  });
});

describe('CompareReferenceText', () => {
  it('speaks the newly picked rank in place of the one speaking', async () => {
    const { rerender } = render(<CompareReferenceText rank="primary" />);
    fireEvent.click(screen.getByLabelText('Play'));
    await screen.findByLabelText('Stop');
    rerender(<CompareReferenceText rank="secondary" />);
    expect(mockSpeak).toHaveBeenLastCalledWith(
      { id: 'WEB', language: 'eng' },
      'For God so loved the world',
      expect.any(Function),
      {}
    );
    expect(await screen.findByLabelText('Stop')).toBeInTheDocument();
  });

  it('stops when the newly picked rank cannot be spoken', async () => {
    mockPassages.secondary = { status: 'loading', referenceText: {} };
    const { rerender } = render(<CompareReferenceText rank="primary" />);
    fireEvent.click(screen.getByLabelText('Play'));
    await screen.findByLabelText('Stop');
    rerender(<CompareReferenceText rank="secondary" />);
    expect(stopSpeaking).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('does not start speaking when switching while silent', () => {
    const { rerender } = render(<CompareReferenceText rank="primary" />);
    rerender(<CompareReferenceText rank="secondary" />);
    expect(mockSpeak).not.toHaveBeenCalled();
  });
});
