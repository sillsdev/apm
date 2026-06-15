import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import CarefulSpeechControls from './CarefulSpeechControls';

const mockCarefulSpeechStrings = new LocalizedStrings({
  en: {
    startRecording: 'Start Recording',
    nextClause: 'Next Clause',
    clause: 'Clause: {0}',
    speaker: 'Speaker',
    listenPassHelp: 'Listen pass help',
    moreClauses: 'More Clauses',
    fewerClauses: 'Fewer Clauses',
    combineWithNextClause: 'Combine with Next Clause',
    undo: 'Undo',
  },
});

const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  carefulSpeech: mockCarefulSpeechStrings,
});

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
  })
);

const baseProps = {
  width: 360,
  currentRegion: { start: 0, end: 10, label: '' },
  speaker: '',
  onSpeakerChange: () => {},
  onMoreClauses: () => {},
  onFewerClauses: () => {},
  onCombineWithNext: () => {},
  onUndoCombine: () => {},
  canFewerClauses: true,
  canCombineWithNext: true,
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
};

function mountControls(
  props: React.ComponentProps<typeof CarefulSpeechControls>
) {
  cy.mount(
    <Provider store={mockStore}>
      <ThemeProvider theme={createTheme()}>
        <CarefulSpeechControls {...props} />
      </ThemeProvider>
    </Provider>
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

  it('shows Combine with Next Clause on recording pass', () => {
    mountControls({
      ...baseProps,
      phase: 'recordReady',
      recordingPassStarted: true,
    });

    cy.get('#careful-speech-combine').should('be.visible');
    cy.contains(mockCarefulSpeechStrings.combineWithNextClause).should(
      'be.visible'
    );
  });

  // MediaRecord pulls PassageDetailContext and WSAudioPlayer; covered in app E2E/manual.
  // The Next Clause button lives inside the showRecorder/MediaRecord block, so its
  // enabled/disabled state is exercised in CarefulSpeechControls.test.tsx (MediaRecord mocked).
});
