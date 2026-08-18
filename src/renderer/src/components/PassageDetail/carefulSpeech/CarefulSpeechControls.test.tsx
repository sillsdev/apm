// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { describe, expect, it, afterEach, jest } from '@jest/globals';
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

import CarefulSpeechControls from './CarefulSpeechControls';

const controlStrings = {
  allComplete: 'All clauses are complete.',
  unitLabel: 'Clause: {0}',
  clearRecording: 'Clear Recording',
  combineWithNext: 'Combine with Next Clause',
  fewerUnits: 'Fewer Clauses',
  moreUnits: 'More Clauses',
  nextUnit: 'Next Clause',
  splitUnit: 'Split Clause',
  speaker: 'Speaker',
  startRecording: 'Start Recording',
  undo: 'Undo',
};

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
  strings: controlStrings,
  showBoundaryTools: true,
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

  it('Next Clause is disabled while the recording upload is in progress', () => {
    const { container } = render(
      <CarefulSpeechControls
        {...baseProps}
        allClausesComplete={false}
        savingRecording={true}
      />
    );
    const next = container.querySelector(
      '#careful-speech-next'
    ) as HTMLButtonElement | null;
    expect(next).toBeTruthy();
    expect(next?.disabled).toBe(true);
  });

  it('Combine with Next Clause is disabled while the recording upload is in progress', () => {
    const { container } = render(
      <CarefulSpeechControls
        {...baseProps}
        canCombineWithNext
        savingRecording
      />
    );
    const combine = container.querySelector(
      '#careful-speech-combine'
    ) as HTMLButtonElement | null;
    expect(combine).toBeTruthy();
    expect(combine?.disabled).toBe(true);
  });

  it('Split Clause is disabled while the recording upload is in progress', () => {
    const { container } = render(
      <CarefulSpeechControls {...baseProps} canSplitClause savingRecording />
    );
    const split = container.querySelector(
      '#careful-speech-split'
    ) as HTMLButtonElement | null;
    expect(split).toBeTruthy();
    expect(split?.disabled).toBe(true);
  });

  it('Undo Combine is disabled while the recording upload is in progress', () => {
    const { container } = render(
      <CarefulSpeechControls {...baseProps} showUndoCombine savingRecording />
    );
    const undo = container.querySelector(
      '#careful-speech-undo-combine'
    ) as HTMLButtonElement | null;
    expect(undo).toBeTruthy();
    expect(undo?.disabled).toBe(true);
  });

  it('hides Next Clause when sequential unit nav is enabled', () => {
    const { container } = render(
      <CarefulSpeechControls
        {...baseProps}
        sequentialUnitNavAroundRecord
        canPrevUnit
        canNextUnit
      />
    );
    expect(container.querySelector('#careful-speech-next')).toBeNull();
    expect(container.querySelector('#careful-speech-prev-unit')).toBeTruthy();
    expect(container.querySelector('#careful-speech-next-unit')).toBeTruthy();
  });

  it('highlights sequential next after save completes on a recorded segment', () => {
    const { container } = render(
      <CarefulSpeechControls
        {...baseProps}
        phase="recorded"
        sequentialUnitNavAroundRecord
        canNextUnit
        savingRecording={false}
      />
    );
    const next = container.querySelector('#careful-speech-next-unit');
    expect(next).toBeTruthy();
    expect(next?.getAttribute('data-highlighted')).toBe('true');
  });

  it('does not highlight sequential next on an unrecorded segment', () => {
    const { container } = render(
      <CarefulSpeechControls
        {...baseProps}
        phase="readyToRecord"
        sequentialUnitNavAroundRecord
        canNextUnit
        savingRecording={false}
      />
    );
    const next = container.querySelector('#careful-speech-next-unit');
    expect(next).toBeTruthy();
    expect(next?.getAttribute('data-highlighted')).toBeNull();
  });

  it('does not highlight sequential next while save is in progress', () => {
    const { container } = render(
      <CarefulSpeechControls
        {...baseProps}
        phase="recorded"
        sequentialUnitNavAroundRecord
        canNextUnit
        savingRecording
      />
    );
    const next = container.querySelector('#careful-speech-next-unit');
    expect(next).toBeTruthy();
    expect(next?.getAttribute('data-highlighted')).toBeNull();
  });
});

describe('CarefulSpeechControls linked note play-only (TT-5873)', () => {
  it('keeps playback and segment nav while hiding record and edit controls', () => {
    const { container, queryByLabelText, queryByText } = render(
      <CarefulSpeechControls
        {...baseProps}
        readOnly
        sequentialUnitNavAroundRecord
        canPrevUnit
        canNextUnit
        recordingPassStarted
        phase="recorded"
        showRecorder
      />
    );
    expect(container.querySelector('[data-testid="media-record"]')).toBeTruthy();
    expect(container.querySelector('#careful-speech-prev-unit')).toBeTruthy();
    expect(container.querySelector('#careful-speech-next-unit')).toBeTruthy();
    expect(queryByText('Start Recording')).toBeNull();
    expect(queryByLabelText('Clear Recording')).toBeNull();
    const speaker = container.querySelector(
      '#careful-speech-speaker'
    ) as HTMLInputElement | null;
    expect(speaker).toBeTruthy();
    expect(speaker?.disabled).toBe(true);
  });

  it('hides Start Recording when read-only', () => {
    const { queryByText } = render(
      <CarefulSpeechControls
        {...baseProps}
        readOnly
        recordingPassStarted={false}
        phase="readyToRecord"
        showRecorder={false}
      />
    );
    expect(queryByText('Start Recording')).toBeNull();
  });

  it('still allows recording on an owned note', () => {
    const { queryByText } = render(
      <CarefulSpeechControls
        {...baseProps}
        recordingPassStarted={false}
        phase="readyToRecord"
        showRecorder={false}
      />
    );
    expect(queryByText(/Start Recording/)).toBeTruthy();
  });
});
