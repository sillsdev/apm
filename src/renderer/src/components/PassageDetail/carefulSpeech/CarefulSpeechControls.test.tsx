// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { cleanup, render } from '@testing-library/react';

// MediaRecord pulls PassageDetailContext + WSAudioPlayer; stub it so we can
// render the recorder section (which contains the Next Clause button) in
// isolation. The CT (CarefulSpeechControls.cy.tsx) covers the listen-pass
// buttons that live outside the showRecorder block.
jest.mock('../../MediaRecord', () => ({
  __esModule: true,
  default: () => <div data-testid="media-record" />,
}));

// The control barrel transitively imports react-localization (ESM) and fails
// to parse under jest; we only need PriButton here.
jest.mock('../../../control', () => ({
  PriButton: ({
    children,
    id,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    id?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" id={id} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('../../../selector', () => ({ carefulSpeechSelector: jest.fn() }));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    startRecording: 'Start Recording',
    nextClause: 'Next Clause',
    clause: 'Clause: {0}',
    speaker: 'Speaker',
    listenPassHelp: 'Listen pass help',
    moreClauses: 'More Clauses',
    fewerClauses: 'Fewer Clauses',
    combineWithNextClause: 'Combine with Next Clause',
    splitClause: 'Split Clause',
    undo: 'Undo',
  }),
  shallowEqual: jest.fn(),
}));

import CarefulSpeechControls from './CarefulSpeechControls';

const baseProps: React.ComponentProps<typeof CarefulSpeechControls> = {
  width: 360,
  phase: 'recorded',
  recordingPassStarted: true,
  currentRegion: { start: 0, end: 10, label: '' },
  speaker: 'Greg',
  onSpeakerChange: () => {},
  onMoreClauses: () => {},
  onFewerClauses: () => {},
  onCombineWithNext: () => {},
  onSplitClause: () => {},
  onUndoCombine: () => {},
  canFewerClauses: false,
  canCombineWithNext: false,
  canSplitClause: false,
  showUndoCombine: false,
  onStartRecording: () => {},
  onNextClause: () => {},
  onClearRecording: () => {},
  allClausesHeard: false,
  allClausesComplete: false,
  highlightSpeaker: false,
  allowRecord: false,
  toolId: 'CarefulSpeechTool',
  passageId: 'p1',
  artifactId: 'art1',
  sourceMediaId: 'mf1',
  sourceSegments: '{}',
  defaultFilename: 'test.ogg',
  afterUploadCb: async () => {},
  onRecording: () => {},
  resetMedia: false,
  setResetMedia: () => {},
  setCanSave: () => {},
  setStatusText: () => {},
  showRecorder: true,
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('CarefulSpeechControls — Next Clause completion state', () => {
  it('Next Clause is enabled while clauses remain to record', () => {
    const { container } = render(
      <CarefulSpeechControls {...baseProps} allClausesComplete={false} />
    );
    const next = container.querySelector(
      '#careful-speech-next'
    ) as HTMLButtonElement | null;
    expect(next).toBeTruthy();
    expect(next?.disabled).toBe(false);
  });

  it('Next Clause is disabled once every clause is recorded', () => {
    const { container } = render(
      <CarefulSpeechControls {...baseProps} allClausesComplete={true} />
    );
    const next = container.querySelector(
      '#careful-speech-next'
    ) as HTMLButtonElement | null;
    expect(next).toBeTruthy();
    expect(next?.disabled).toBe(true);
  });
});
