import React from 'react';
import { render, screen } from '@testing-library/react';

let captured: {
  hasPermission?: boolean;
  curRole?: string;
  phraseRegions?: unknown;
} = {};

/** Per-test knobs for the phrase-segment path (TT-7666). */
const phrase = {
  isPhraseArtifact: false,
  slug: 'vernacular',
  regions: [] as unknown[],
  /** What `related()` answers for a row's sourceMedia. */
  sourceMedia: undefined as string | undefined,
};

const linkedSharedResource = {
  id: 'sr1',
  type: 'sharedresource',
  relationships: {
    passage: { data: { type: 'passage', id: 'source-p' } },
  },
};

const passageDetailCtx = {
  mediafileId: 'mf1',
  section: { id: 's1', type: 'section' },
  currentstep: 'step-transcribe',
  orgWorkflowSteps: [
    {
      id: 'step-transcribe',
      attributes: {
        sequencenum: 1,
        tool: '{"tool":"transcribe","settings":{}}',
      },
    },
  ],
  setStepComplete: jest.fn(),
  setCurrentStep: jest.fn(),
  gotoNextStep: jest.fn(),
  rowData: [],
  psgCompleted: [],
  passage: { id: 'p1', type: 'passage' },
  sharedResource: undefined as unknown,
};

jest.mock(
  '../../context/usePassageDetailContext',
  () => () => passageDetailCtx
);

jest.mock('../../context/PassageDetailContext', () => ({
  PassageDetailContext: React.createContext({ setState: jest.fn() }),
}));

jest.mock('../../context/TranscriberContext', () => ({
  TranscriberProvider: (props: {
    curRole?: string;
    phraseRegions?: unknown;
    children?: React.ReactNode;
  }) => {
    captured.curRole = props.curRole;
    captured.phraseRegions = props.phraseRegions;
    return <>{props.children}</>;
  },
}));

jest.mock('../Transcriber', () => ({
  __esModule: true,
  default: (props: { hasPermission?: boolean }) => {
    captured.hasPermission = props.hasPermission;
    return <div data-testid="transcriber" />;
  },
}));

jest.mock('../TaskList', () => ({
  __esModule: true,
  default: () => null,
  TaskTableWidth: 0,
}));

jest.mock('../../utils/perf', () => ({
  useRenderProfiler: () => {},
  useWhyRender: () => {},
}));

jest.mock('../../utils', () => ({
  JSONParse: (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return {};
    }
  },
}));

jest.mock('../../crud', () => ({
  ToolSlug: { Transcribe: 'transcribe', Record: 'record' },
  useStepTool: () => ({ settings: '{}' }),
}));

jest.mock('../../crud/useArtifactType', () => ({
  useArtifactType: () => ({
    localizedArtifactTypeFromId: () => 'bt',
    slugFromId: () => phrase.slug,
  }),
}));

jest.mock('../../crud/artifactTypeSlug', () => ({
  ArtifactTypeSlug: { CarefulSpeech: 'carefulspeech' },
  artifactStampsStepLanguage: () => false,
  isPhraseSegmentArtifact: () => phrase.isPhraseArtifact,
}));

jest.mock('../../crud/related', () => ({
  related: () => phrase.sourceMedia,
  __esModule: true,
  default: () => phrase.sourceMedia,
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: () => true,
  }),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [
    {
      id: 'mf1',
      type: 'mediafile',
      attributes: { versionNumber: 1, segments: '[]' },
    },
  ],
}));

jest.mock('../../context/UnsavedContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: ReactActual.createContext({
      state: { waitForSave: jest.fn(() => Promise.resolve()) },
    }),
  };
});

jest.mock('../../selector', () => ({
  sharedSelector: jest.fn(),
  transcriberSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({ noAudio: 'no audio', missingSegmentRecordings: '' }),
  shallowEqual: jest.fn(),
}));

jest.mock('../../utils/namedSegments', () => ({
  getSegments: () => '{}',
  getSortedRegions: () => phrase.regions,
  NamedRegions: { Clause: 'clause', BackTranslation: 'bt' },
}));

jest.mock('./carefulSpeech/carefulSpeechBoundary', () => ({
  hasPhraseRegions: () => phrase.regions.length > 0,
}));

jest.mock('./carefulSpeech/matchesGuidedOutputRow', () => ({
  mediaMatchesStepLanguage: () => true,
  parseMediaLanguageField: () => ({ bcp47: 'und' }),
  phraseBtBoundaryRegionName: () => 'bt',
}));

jest.mock('./phraseSegmentRecordingComplete', () => ({
  hasIncompletePhraseSegmentRecordings: () => false,
}));

jest.mock('./boldClause/StepMessage', () => () => null);

import { PassageDetailTranscribe } from './PassageDetailTranscribe';

const resetKnobs = () => {
  captured = {};
  passageDetailCtx.sharedResource = undefined;
  passageDetailCtx.mediafileId = 'mf1';
  passageDetailCtx.rowData = [];
  phrase.isPhraseArtifact = false;
  phrase.slug = 'vernacular';
  phrase.regions = [];
  phrase.sourceMedia = undefined;
};

describe('PassageDetailTranscribe linked note (TT-5873)', () => {
  beforeEach(resetKnobs);

  it('keeps transcribe permission on the source note', () => {
    render(<PassageDetailTranscribe width={400} artifactTypeId={null} />);
    expect(screen.getByTestId('transcriber')).toBeTruthy();
    expect(captured.hasPermission).toBe(true);
    expect(captured.curRole).not.toBe('view');
  });

  it('is view-only on a linked note while still showing the transcriber', () => {
    passageDetailCtx.sharedResource = linkedSharedResource;
    render(<PassageDetailTranscribe width={400} artifactTypeId={null} />);
    expect(screen.getByTestId('transcriber')).toBeTruthy();
    expect(screen.queryByText('no audio')).toBeNull();
    expect(captured.hasPermission).toBe(false);
    expect(captured.curRole).toBe('view');
  });
});

/**
 * TT-7666 - the task list is built from every take attached to the vernacular,
 * so the takes left behind by a segment-boundary adjustment showed up beside
 * the ones recorded after it: two segments, four tasks to transcribe. Which
 * takes are still current is decided against the segment boundaries the step is
 * reading, so the provider has to be told what they are.
 */
describe('PassageDetailTranscribe phrase takes (TT-7666)', () => {
  const clauseRegions = [
    { start: 0, end: 6, label: '' },
    { start: 6, end: 10, label: '' },
  ];

  beforeEach(() => {
    resetKnobs();
    phrase.sourceMedia = 'mf1';
    passageDetailCtx.rowData = [
      { artifactType: 'bt', mediafile: { id: 'take1', type: 'mediafile' } },
    ] as never;
  });

  it('hands the current segment boundaries to the transcriber provider', () => {
    phrase.isPhraseArtifact = true;
    phrase.slug = 'carefulspeech';
    phrase.regions = clauseRegions;
    render(<PassageDetailTranscribe width={400} artifactTypeId={'art1'} />);
    expect(captured.phraseRegions).toEqual(clauseRegions);
  });

  it('leaves a non-phrase artifact unscoped', () => {
    render(<PassageDetailTranscribe width={400} artifactTypeId={'art1'} />);
    expect(captured.phraseRegions ?? []).toEqual([]);
  });
});
