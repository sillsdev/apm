import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
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
  phase: 'readyToRecord',
  recordingPassStarted: false,
  currentRegion: { start: 0, end: 10, label: '' },
  speaker: '',
  onSpeakerChange: () => {},
  onMoreClauses: () => {},
  onFewerClauses: () => {},
  onCombineWithNext: () => {},
  onSplitClause: () => {},
  onUndoCombine: () => {},
  canFewerClauses: true,
  canCombineWithNext: true,
  canSplitClause: true,
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
  showRecorder: false,
  strings: controlStrings,
  showBoundaryTools: true,
};

function mountControls(
  props: React.ComponentProps<typeof CarefulSpeechControls>
) {
  cy.mount(
    <ThemeProvider theme={createTheme()}>
      <CarefulSpeechControls {...props} />
    </ThemeProvider>
  );
}

describe('CarefulSpeechControls', () => {
  it('shows More Clauses, Fewer Clauses, and Start Recording on listen pass', () => {
    mountControls({
      ...baseProps,
      phase: 'readyToRecord',
      recordingPassStarted: false,
    });

    cy.get('#careful-speech-more-clauses').should('be.visible');
    cy.get('#careful-speech-fewer-clauses').should('be.visible');
    cy.get('#careful-speech-start').should('be.visible');
    cy.contains('Clause: 0:00 - 0:10').should('be.visible');
  });

  it('shows Split Clause and Combine with Next Clause on recording pass', () => {
    mountControls({
      ...baseProps,
      phase: 'recordReady',
      recordingPassStarted: true,
    });

    cy.get('#careful-speech-split').should('be.visible');
    cy.get('#careful-speech-combine').should('be.visible');
    cy.contains(controlStrings.splitUnit).should('be.visible');
    cy.contains(controlStrings.combineWithNext).should('be.visible');
  });

  // MediaRecord pulls PassageDetailContext and WSAudioPlayer; covered in app E2E/manual.
  // The Next Clause button lives inside the showRecorder/MediaRecord block, so its
  // enabled/disabled state is exercised in CarefulSpeechControls.test.tsx (MediaRecord mocked).
});
