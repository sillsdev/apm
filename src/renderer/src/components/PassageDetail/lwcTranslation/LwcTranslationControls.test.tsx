// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

jest.mock('../../MediaRecord', () => ({
  __esModule: true,
  default: () => <div data-testid="media-record" />,
}));

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
    nextClause: 'Next Clause',
    speaker: 'Speaker',
    clearRecording: 'Clear recording',
  }),
  shallowEqual: jest.fn(),
}));

import LwcTranslationControls from './LwcTranslationControls';

const baseProps: React.ComponentProps<typeof LwcTranslationControls> = {
  width: 360,
  phase: 'recorded',
  speaker: 'Greg',
  onSpeakerChange: () => {},
  onNextClause: () => {},
  onClearRecording: () => {},
  allClausesComplete: false,
  highlightSpeaker: false,
  allowRecord: false,
  toolId: 'LwcTranslationTool',
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

describe('LwcTranslationControls — recorded clause panel', () => {
  it('shows Next Clause and clear recording when phase is recorded', () => {
    render(<LwcTranslationControls {...baseProps} />);
    expect(screen.getByRole('button', { name: 'Next Clause >' })).toBeTruthy();
    expect(screen.getByLabelText('Clear recording')).toBeTruthy();
  });

  it('shows the docked record button while recording', () => {
    const { container } = render(
      <LwcTranslationControls {...baseProps} phase="recordReady" />
    );
    expect(container.querySelector('#lwc-next-clause')).toBeNull();
    expect(container.querySelector('[data-cy="lwc-docked-record"]')).toBeTruthy();
  });
});
