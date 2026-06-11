import React from 'react';
import { render } from '@testing-library/react';
import { PassageDetailPlayer } from './PassageDetailPlayer';
import { NamedRegions, updateSegments } from '../../utils/namedSegments';

var mockToolChanged: jest.Mock;
var mockIsChanged: jest.Mock;
let capturedOnSegmentChange: ((segments: string) => void) | undefined;

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'memory') return [{ update: jest.fn() }, jest.fn()];
    if (key === 'user') return ['test-user', jest.fn()];
    return [undefined, jest.fn()];
  },
}));

jest.mock('../../context/UnsavedContext', () => {
  const React = require('react');
  mockToolChanged = jest.fn();
  mockIsChanged = jest.fn(() => false);
  return {
    UnsavedContext: React.createContext({
      state: {
        toolChanged: mockToolChanged,
        toolsChanged: {},
        isChanged: mockIsChanged,
        saveRequested: jest.fn(() => false),
        clearRequested: jest.fn(() => false),
        clearCompleted: jest.fn(),
        startSave: jest.fn(),
        saveCompleted: jest.fn(),
      },
    }),
  };
});

jest.mock('../../context/usePassageDetailContext', () => () => ({
  loading: false,
  pdBusy: false,
  setPDBusy: jest.fn(),
  audioBlob: undefined,
  setupLocate: jest.fn(),
  playing: false,
  setPlaying: jest.fn(),
  currentstep: 'step-1',
  currentSegmentIndex: 0,
  setCurrentSegment: jest.fn(),
  discussionMarkers: [],
  handleHighlightDiscussion: jest.fn(),
  playerMediafile: {
    id: 'media-1',
    attributes: {
      transcription: '',
      segments: updateSegments(
        NamedRegions.BackTranslation,
        '{}',
        '{"regions":[{"start":0,"end":1}]}'
      ),
      duration: 1,
    },
  },
  forceRefresh: jest.fn(),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [
    {
      id: 'media-1',
      attributes: {
        segments: updateSegments(
          NamedRegions.BackTranslation,
          '{}',
          '{"regions":[{"start":0,"end":1}]}'
        ),
      },
    },
  ],
}));

jest.mock('../../business/player/usePlayerLogic', () => ({
  usePlayerLogic: () => ({
    onPlayStatus: jest.fn(),
    onCurrentSegment: jest.fn(),
    setSegmentToWhole: jest.fn(),
  }),
}));

jest.mock('../../crud', () => ({
  ToolSlug: { Transcribe: 'Transcribe' },
  useStepTool: () => ({ tool: 'PhraseBackTranslation' }),
  related: jest.fn(),
}));

jest.mock('../../crud/related', () => ({
  related: jest.fn(),
}));

jest.mock('../WSAudioPlayer', () => ({
  __esModule: true,
  default: (props: { onSegmentChange: (segments: string) => void }) => {
    capturedOnSegmentChange = props.onSegmentChange;
    return <div data-testid="ws-audio-player" />;
  },
}));

jest.mock('../TranscriptionShow', () => () => (
  <div data-testid="transcription-show" />
));

jest.mock('../StepEditor', () => ({
  smallButtonProps: {},
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({ saveSegments: 'Save Segments' }),
  shallowEqual: jest.fn(),
}));

describe('PassageDetailPlayer unsaved state', () => {
  beforeEach(() => {
    mockToolChanged.mockClear();
    mockIsChanged.mockReset();
    mockIsChanged.mockReturnValue(false);
    capturedOnSegmentChange = undefined;
  });

  it('clears the dirty flag when segments are reset back to the saved value', () => {
    render(
      <PassageDetailPlayer
        width={400}
        allowSegment={NamedRegions.BackTranslation}
        allowAutoSegment={true}
        saveSegments={0}
      />
    );

    const changedSegments = '{"regions":[{"start":0,"end":2}]}';
    const savedSegments = '{"regions":[{"start":0,"end":1}]}';

    capturedOnSegmentChange?.(changedSegments);
    expect(mockToolChanged).toHaveBeenLastCalledWith('ArtifactSegments');

    mockIsChanged.mockReturnValue(true);
    capturedOnSegmentChange?.(savedSegments);
    expect(mockToolChanged).toHaveBeenLastCalledWith('ArtifactSegments', false);
  });
});
