/**
 * Discussion locate on a divided recording.
 *
 * PassageDetailPlayer.setPlayerSegments keeps a recording's saved divisions
 * when a discussion is located, so the discussion's start and end travel with
 * the play request instead. This harness sends WSAudioPlayer exactly that
 * request and records what actually plays.
 */
import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';

import bugsnagClient from '../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import { HotKeyContext } from '../context/HotKeyContext';
import { IOrbitContext } from '../hoc/OrbitContext';
import { OrbitContext } from '../hoc/OrbitContextProvider';
import localizationReducer from '../store/localization/reducers';
import bookReducer from '../store/book/reducers';
import WSAudioPlayer, { type WSAudioPlayerControls } from './WSAudioPlayer';
import { NamedRegions } from '../utils/namedSegments';
import type { RequestPlay } from '../business/player/usePlayerLogic';
import { createMinimalWavBlob } from '../../cypress/support/recordingMocks';

const mockStore = createStore(
  combineReducers({
    strings: () => {
      const initialState = localizationReducer(undefined, { type: '@@INIT' });
      return { ...initialState, loaded: true, lang: 'en' };
    },
    books: bookReducer,
  })
);

const memory = {
  cache: {
    query: () => [],
    liveQuery: () => ({ subscribe: () => () => {}, query: () => [] }),
  },
  update: () => {},
  keyMap: {
    idToKey: (_t: string, _a: string, id: string) => id,
    keyToId: (_t: string, _a: string, id: string) => id,
  },
} as unknown as Memory;

const initialState = {
  coordinator: {
    getSource: (name: string) => (name === 'memory' ? memory : {}),
  } as unknown as Coordinator,
  errorReporter: bugsnagClient,
  memory,
  organization: 'org-1',
  user: 'user-1',
  plan: 'plan-1',
  project: '',
  connected: true,
  offline: false,
  offlineOnly: false,
  mobileView: false,
} as unknown as GlobalState;

const orbitContextValue: IOrbitContext = {
  memory,
  getRecs: () => undefined as never,
  setRecs: () => {},
};

const DIVISIONS = JSON.stringify({
  regions: JSON.stringify([
    { start: 0, end: 4 },
    { start: 4, end: 8 },
  ]),
});
interface Range {
  start: number;
  end: number;
}

interface HarnessProps {
  blob: Blob;
  discussion: Range;
  controlsRef: React.RefObject<WSAudioPlayerControls | null>;
  onProgress: (p: number) => void;
  onPlayStatus: (playing: boolean) => void;
}

/** The divisions-kept branch of PassageDetailPlayer.setPlayerSegments. */
function LocateHarness(props: HarnessProps) {
  const [requestPlay, setRequestPlay] = useState<RequestPlay>({
    play: false,
    regionOnly: false,
    request: new Date(),
  });
  const [initialposition, setInitialPosition] = useState<number | undefined>(0);
  const locate = () => {
    setInitialPosition(props.discussion.start);
    setRequestPlay({
      play: true,
      regionOnly: true,
      request: new Date(),
      region: props.discussion,
    });
  };
  return (
    <>
      <button id="locate" onClick={locate}>
        locate
      </button>
      <WSAudioPlayer
        allowSegment={NamedRegions.Transcription}
        blob={props.blob}
        controlsRef={props.controlsRef}
        height={300}
        segments={DIVISIONS}
        initialposition={initialposition}
        setInitialPosition={setInitialPosition}
        isPlaying={requestPlay.play}
        regionOnly={requestPlay.regionOnly}
        request={requestPlay.request}
        playRange={requestPlay.region}
        onProgress={props.onProgress}
        onPlayStatus={props.onPlayStatus}
      />
    </>
  );
}

type WsCtSeam = { currentRegion: () => { start: number; end: number } };

/** Locate `discussion` on an 8 s divided recording; return what played. */
function locateAndRecord(discussion: Range) {
  const controlsRef = React.createRef<WSAudioPlayerControls | null>();
  const progress: number[] = [];
  let recording = false;
  let stopped = false;

  cy.mount(
    <Provider store={mockStore}>
      <ThemeProvider theme={createTheme()}>
        <GlobalProvider init={initialState}>
          <OrbitContext.Provider value={orbitContextValue}>
            <HotKeyContext.Provider
              value={{
                state: {
                  subscribe: () => {},
                  unsubscribe: () => {},
                  localizeHotKey: (key: string) => key,
                } as never,
                setState: (() => {}) as never,
              }}
            >
              <LocateHarness
                blob={createMinimalWavBlob(8)}
                discussion={discussion}
                controlsRef={controlsRef}
                onProgress={(p) => {
                  if (recording) progress.push(p);
                }}
                onPlayStatus={(playing) => {
                  if (recording && !playing) stopped = true;
                }}
              />
            </HotKeyContext.Provider>
          </OrbitContext.Provider>
        </GlobalProvider>
      </ThemeProvider>
    </Provider>
  );

  cy.wrap(null, { timeout: 15000 }).should(() => {
    expect(controlsRef.current?.isReady(), 'waveform ready').to.equal(true);
    expect(controlsRef.current?.getDuration()).to.be.closeTo(8, 0.1);
  });

  // The user's current selection is the first division.
  cy.then(() => controlsRef.current?.gotoTime(1));
  cy.window().should((win) => {
    const seam = (win as Window & { __wsCt?: WsCtSeam }).__wsCt;
    expect(seam?.currentRegion()?.start, 'selected division').to.equal(0);
  });

  cy.then(() => {
    recording = true;
  });
  cy.get('#locate').click();

  // Long enough for a wrong playback to run the whole recording, so a
  // failure reports where it played rather than a timeout.
  cy.wrap(null, { timeout: 12000 }).should(() => {
    expect(stopped, 'playback stopped').to.equal(true);
  });

  return cy.then(() => progress.filter((p) => p > 0));
}

describe('WSAudioPlayer discussion locate with divisions', () => {
  it('plays from the discussion start and stops at the discussion end', () => {
    const discussion = { start: 5, end: 6 };
    locateAndRecord(discussion).then((played) => {
      cy.log(`played ${played[0]} .. ${played[played.length - 1]}`);
      expect(played.length, 'progress samples').to.be.greaterThan(0);
      expect(Math.min(...played), 'earliest position').to.be.at.least(
        discussion.start - 0.1
      );
      expect(Math.max(...played), 'latest position').to.be.at.most(
        discussion.end + 0.25
      );
    });
  });

  it('does not rewind a discussion that starts near the recording end', () => {
    // Starts within the 0.2 s end-of-media rewind window.
    const discussion = { start: 7.9, end: 8 };
    locateAndRecord(discussion).then((played) => {
      cy.log(`played ${played[0]} .. ${played[played.length - 1]}`);
      expect(played.length, 'progress samples').to.be.greaterThan(0);
      expect(Math.min(...played), 'earliest position').to.be.at.least(
        discussion.start - 0.1
      );
    });
  });
});
