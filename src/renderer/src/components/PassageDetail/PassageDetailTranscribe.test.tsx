import React from 'react';
import { render, screen } from '@testing-library/react';

let captured: {
  hasPermission?: boolean;
  curRole?: string;
  collapseSegmentTakes?: boolean;
} = {};

/** Artifact the step under test is configured for; drives the slug mocks. */
let artifactSlug = 'vernacular';

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
    collapseSegmentTakes?: boolean;
    children?: React.ReactNode;
  }) => {
    captured.curRole = props.curRole;
    captured.collapseSegmentTakes = props.collapseSegmentTakes;
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
    slugFromId: () => artifactSlug,
  }),
}));

jest.mock('../../crud/artifactTypeSlug', () => ({
  ArtifactTypeSlug: { CarefulSpeech: 'carefulspeech' },
  artifactStampsStepLanguage: () => false,
  isPhraseSegmentArtifact: (slug: string) =>
    slug === 'backtranslation' || slug === 'carefulspeech',
}));

jest.mock('../../crud/related', () => ({
  related: jest.fn(() => 'mf1'),
  __esModule: true,
  default: jest.fn(() => 'mf1'),
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: () => true,
  }),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [],
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
  getSortedRegions: () => [],
  NamedRegions: { Clause: 'clause', BackTranslation: 'bt' },
}));

jest.mock('./carefulSpeech/carefulSpeechBoundary', () => ({
  hasPhraseRegions: () => false,
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

describe('PassageDetailTranscribe linked note (TT-5873)', () => {
  beforeEach(() => {
    captured = {};
    artifactSlug = 'vernacular';
    passageDetailCtx.rowData = [];
    passageDetailCtx.sharedResource = undefined;
    passageDetailCtx.mediafileId = 'mf1';
  });

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
 * TT-7643 - a phrase step records one take per segment and shows only the
 * newest, but nothing prunes the ones it replaced. The task list was built
 * from artifact type and step language alone, so every superseded take
 * arrived as its own transcribe task.
 */
describe('PassageDetailTranscribe segment takes (TT-7643)', () => {
  beforeEach(() => {
    captured = {};
    artifactSlug = 'vernacular';
    passageDetailCtx.rowData = [];
    passageDetailCtx.sharedResource = undefined;
    passageDetailCtx.mediafileId = 'mf1';
  });

  const renderForArtifact = (slug: string) => {
    artifactSlug = slug;
    passageDetailCtx.rowData = [
      { artifactType: 'bt', mediafile: { id: 'take-1' } },
    ] as unknown as typeof passageDetailCtx.rowData;
    render(<PassageDetailTranscribe width={400} artifactTypeId="at1" />);
  };

  it('collapses a Phrase BT segment to its newest take', () => {
    renderForArtifact('backtranslation');
    expect(captured.collapseSegmentTakes).toBe(true);
  });

  it('collapses Careful Speech the same way', () => {
    renderForArtifact('carefulspeech');
    expect(captured.collapseSegmentTakes).toBe(true);
  });

  it('leaves a step that is not per-segment listing everything', () => {
    // Whole BT, Q&A, Retell: one take for the passage, nothing to collapse.
    renderForArtifact('wholebacktranslation');
    expect(captured.collapseSegmentTakes).toBe(false);
  });
});
