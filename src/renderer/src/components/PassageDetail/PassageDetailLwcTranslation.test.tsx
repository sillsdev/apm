import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

let mockCarefulSpeechComplete = new Set<number>();
let mockLwcComplete = new Set<number>();
let controlsProps: Record<string, unknown> | undefined;

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    if (key === 'memory') return [{ keyMap: {}, update: jest.fn() }];
    if (key === 'plan') return ['plan1'];
    if (key === 'offline') return [false];
    return [undefined];
  }),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => [
    {
      id: 'm1',
      type: 'mediafile',
      attributes: { versionNumber: 1, segments: '[]' },
    },
  ]),
}));

jest.mock('../../context/usePassageDetailContext', () => () => ({
  passage: { id: 'p1', type: 'passage', attributes: {} },
  mediafileId: 'm1',
  rowData: [],
  currentstep: 'step1',
  section: { id: 's1', type: 'section' },
  forceRefresh: jest.fn(),
  isBoldWorkflow: true,
  setStepComplete: jest.fn(),
  stepComplete: jest.fn(() => false),
  setRecording: jest.fn(),
}));

jest.mock('../../crud', () => ({
  ArtifactTypeSlug: {
    CarefulSpeech: 'carefulspeech',
    PhraseBackTranslation: 'backtranslation',
  },
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  related: jest.fn(() => undefined),
  useArtifactType: () => ({
    getTypeId: (slug: string) =>
      slug === 'carefulspeech' ? 'cs-id' : 'pbt-id',
  }),
  useStepTool: () => ({ settings: { artifactTypeId: 'pbt-id' } }),
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: () => true }),
}));

jest.mock('../../context/UnsavedContext', () => ({
  UnsavedContext: React.createContext({
    state: {
      waitForSave: jest.fn().mockResolvedValue(undefined),
      startSave: jest.fn(),
    },
  }),
}));

jest.mock('../../selector', () => ({
  lwcTranslationSelector: { name: 'lwcTranslationSelector' },
  sharedSelector: { name: 'sharedSelector' },
}));
jest.mock('react-redux', () => ({
  useSelector: (selector: { name?: string }) => {
    if (selector.name === 'sharedSelector') {
      return { noAudio: 'No audio' };
    }
    return {
      boldOnly: 'BOLD only',
      noClauses: 'No clauses',
      prerequisite: 'Complete Careful Speech first',
      clauseIndex: 'Clause {0}/{1}',
      progress: '{0} of {1} clauses recorded',
    };
  },
  shallowEqual: jest.fn(),
}));

jest.mock('./lwcTranslation/useLwcTranslationClauses', () => ({
  useLwcTranslationClauses: jest.fn(() => ({
    clauseRegions: [{ start: 0, end: 5, label: '' }],
    bootstrapped: true,
    hasClauses: true,
  })),
}));

jest.mock('./carefulSpeech/carefulSpeechCompletion', () => ({
  getCompletedClauseIndices: jest.fn(
    (_regions: unknown[], _rows: unknown[], typeId: string) =>
      typeId === 'cs-id' ? mockCarefulSpeechComplete : mockLwcComplete
  ),
  getRecordingForClause: jest.fn(() => undefined),
  firstIncompleteClauseIndex: jest.fn(() => 0),
}));

jest.mock('./lwcTranslation/LwcTranslationReferencePlayer', () => ({
  __esModule: true,
  default: () => <div data-cy="lwc-reference-player" />,
}));

jest.mock('./lwcTranslation/LwcTranslationClauseNav', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    if (props.currentClauseRecorded) {
      return <div data-cy="lwc-clause-nav-recorded" />;
    }
    return <div data-cy="lwc-clause-nav" />;
  },
}));

jest.mock('./lwcTranslation/LwcTranslationControls', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    controlsProps = props;
    return <div data-cy="lwc-recorder" />;
  },
}));

jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'file.ogg',
}));

import { PassageDetailLwcTranslation } from './PassageDetailLwcTranslation';

describe('PassageDetailLwcTranslation', () => {
  beforeEach(() => {
    mockCarefulSpeechComplete = new Set<number>();
    mockLwcComplete = new Set<number>();
    controlsProps = undefined;
  });

  it('shows prerequisite when careful speech is incomplete', () => {
    render(<PassageDetailLwcTranslation width={400} />);
    expect(
      screen.getByText('Complete Careful Speech first')
    ).toBeInTheDocument();
  });

  it('shows the guided UI when careful speech is complete', () => {
    mockCarefulSpeechComplete = new Set([0]);
    render(<PassageDetailLwcTranslation width={400} />);
    expect(
      document.querySelector('[data-cy="lwc-reference-player"]')
    ).toBeTruthy();
    expect(document.querySelector('[data-cy="lwc-clause-nav"]')).toBeTruthy();
    expect(document.querySelector('[data-cy="lwc-recorder"]')).toBeTruthy();
  });

  it('opens on a recorded clause in review mode', async () => {
    mockCarefulSpeechComplete = new Set([0]);
    mockLwcComplete = new Set([0]);
    render(<PassageDetailLwcTranslation width={400} />);
    await waitFor(() => expect(controlsProps?.phase).toBe('recorded'));
    expect(controlsProps?.showRecorder).toBe(true);
    expect(
      document.querySelector('[data-cy="lwc-clause-nav-recorded"]')
    ).toBeTruthy();
  });
});
