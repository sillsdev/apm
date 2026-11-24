import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import PassageDetailArtifacts from './PassageDetailsArtifactsMobile';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { createAppTheme } from '../../../theme';
import { fireEvent } from '@testing-library/dom';

const theme = createAppTheme('en');

jest.mock('array-move', () => ({
  arrayMoveImmutable: jest.fn((items: unknown[]) => items),
}));

jest.mock('@wavesurfer/react', () => ({
  __esModule: true,
  default: jest.fn(),
  useWavesurfer: jest.fn(),
  WavesurferPlayer: jest.fn(() => null),
}));

jest.mock('../../../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('react-redux', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useSelector: () => ({
    title: 'Title',
    addAudioResource: 'Add Audio Resource',
    passageResource: 'Passage Resource',
    noteResource: 'Note Resource',
    bookResource: 'Book Resource',
    movementResource: 'Movement Resource',
    findResource: 'Find {0}',
    findResourceDesc: 'Find resource description',
    sharedResource: 'Shared {0}',
    editAudioResource: 'Edit Audio Resource',
    editGeneralResource: 'Edit General Resource',
    editResource: 'Edit Resource',
    confirmCloseTitle: 'Confirm Close',
    confirmClose: 'Discard changes?',
    keepOpen: 'Keep Open',
    discardAndClose: 'Discard and Close',
    deleteConfirm: 'Delete?',
    textResource: 'Text Resource',
    audioScripture: 'Audio Scripture',
    allResources: 'All Resources',
    research: 'Research',
    ai: 'AI',
  }),
}));

jest.mock('../../../selector', () => ({
  passageDetailArtifactsSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('../../../crud', () => ({
  remoteIdGuid: jest.fn(),
  useSecResCreate: () => ({
    AddSectionResource: jest.fn(),
    InternalizationStep: jest.fn(),
  }),
  useMediaResCreate: () => jest.fn(),
  useSecResUpdate: () => jest.fn(),
  useSecResDelete: () => jest.fn(),
  related: jest.fn(() => ''),
  useSecResUserCreate: () => jest.fn(),
  useSecResUserRead: () => jest.fn(),
  useSecResUserDelete: () => jest.fn(),
  useOrganizedBy: () => ({
    getOrganizedBy: (current: boolean) =>
      current ? 'Section Resource' : 'Project',
  }),
  findRecord: jest.fn(() => undefined),
  useArtifactCategory: () => ({
    getArtifactCategorys: jest.fn().mockResolvedValue([]),
  }),
  ArtifactCategoryType: { Resource: 'resource' },
  usePlanType: () => () => ({ scripture: false, flat: false }),
  mediaFileName: jest.fn(() => ''),
  ArtifactTypeSlug: { SharedResource: 'sharedresource' },
}));

jest.mock('./useRowTypeLabel', () => ({
  useRowTypeLabel:
    () =>
    ({ isGeneralResource }: { isGeneralResource: boolean }) =>
      isGeneralResource ? 'General' : 'Linked',
}));

const mockArtifactTypesResult = [
  { id: 'resource-type', attributes: { typename: 'resource' } },
  { id: 'project-resource-type', attributes: { typename: 'projectresource' } },
];
const mockEmptyOrbitResult: unknown[] = [];

jest.mock('../../../hoc/useOrbitData', () => ({
  useOrbitData: (type: string) =>
    type === 'artifacttype' ? mockArtifactTypesResult : mockEmptyOrbitResult,
}));

jest.mock('../../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const values: Record<string, unknown> = {
      memory: { cache: { query: jest.fn() }, keyMap: {} },
      importexportBusy: false,
      remoteBusy: false,
      offline: false,
      offlineOnly: false,
      plan: '',
    };
    return [values[key], jest.fn()];
  }),
  useGetGlobal: jest.fn(() => (key: string) => {
    if (key === 'progress') return 0;
    return undefined;
  }),
}));

jest.mock('./usePassageRef', () => ({
  usePassageRef: () => ({ passageRef: jest.fn(() => '') }),
}));

jest.mock('../../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: jest.fn(() => true) }),
}));

jest.mock('../../../crud/isLinkedNote', () => ({
  isLinkedNote: jest.fn(() => false),
}));

jest.mock('../../../utils', () => ({
  getSegments: jest.fn(() => '[]'),
  NamedRegions: { ProjectResource: 'ProjectResource' },
  isUrl: jest.fn(() => true),
  useMobile: () => ({ isMobileWidth: false }),
}));

jest.mock('../../../control', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  GrowingSpacer: () => null,
}));

jest.mock('../../../control/IconMenu', () => () => null);

jest.mock('../../../hoc/VertListDnd', () => ({
  VertListDnd: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../../../control/LaunchLink', () => ({
  LaunchLink: () => null,
}));

jest.mock('./AddResource', () => ({
  __esModule: true,
  default: ({ action }: { action: (what: string) => void }) => (
    <button type="button" onClick={() => action('audio')}>
      open-audio-upload
    </button>
  ),
}));

// The wizard owns the whole upload flow; here we only assert the parent hands
// it the right launch request.
jest.mock('./AddResourceWizard', () => ({
  __esModule: true,
  default: ({ launchSource }: { launchSource: unknown }) => (
    <div data-testid="wizard-launch">{JSON.stringify(launchSource)}</div>
  ),
}));

jest.mock('./ReferenceTextRows', () => ({ ReferenceTextRows: () => null }));
jest.mock('./mobile components/AudioResourceCard', () => ({
  AudioResourceCard: () => null,
}));
jest.mock('./mobile components/TextResourceCard', () => ({
  TextResourceCard: ({ badge }: { badge?: string }) => (
    <div data-testid="text-card">{badge}</div>
  ),
}));
jest.mock('../../MediaDisplay', () => () => null);
jest.mock('./SelectSharedResource', () => () => null);
jest.mock('./ResourceData', () => () => null);
jest.mock('../../AlertDialog', () => () => null);
jest.mock('./FindTabs', () => () => null);
jest.mock('./FindBibleBrain', () => () => null);
jest.mock('../../../control/MarkDownView', () => ({
  CompactMarkDownView: () => null,
}));

const mockUsePassageDetailContext =
  usePassageDetailContext as jest.MockedFunction<
    typeof usePassageDetailContext
  >;

describe('PassageDetailArtifacts', () => {
  beforeEach(() => {
    mockUsePassageDetailContext.mockReturnValue({
      rowData: [],
      section: { id: 'section-1', attributes: { level: 0 } },
      passage: { id: 'passage-1', attributes: { reference: 'GEN 1:1' } },
      currentstep: {} as never,
      toggleDone: jest.fn(),
      forceRefresh: jest.fn(),
      sharedResource: undefined,
    } as never);
  });

  const renderComponent = () =>
    render(
      <ThemeProvider theme={theme}>
        <PassageDetailArtifacts />
      </ThemeProvider>
    );

  it('starts with the add-resource wizard closed', () => {
    renderComponent();
    expect(screen.queryByTestId('wizard-launch')).not.toBeInTheDocument();
  });

  it('launches the wizard with an add request when Add Audio is chosen', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: 'open-audio-upload' }));

    const launch = screen.getByTestId('wizard-launch');
    expect(launch).toHaveTextContent('"kind":"add"');
    expect(launch).toHaveTextContent('"action":"audio"');
  });

  it('shows the type badge on a linked resource', () => {
    mockUsePassageDetailContext.mockReturnValue({
      ...mockUsePassageDetailContext(),
      rowData: [
        {
          id: 'linked-1',
          isResource: true,
          passageId: '',
          artifactTypeSlug: 'sharedresource',
          isGeneralResource: false,
          mediafile: { attributes: { contentType: 'text/markdown' } },
        },
        {
          id: 'plain-1',
          isResource: true,
          passageId: '',
          artifactTypeSlug: 'resource',
          isGeneralResource: false,
          mediafile: { attributes: { contentType: 'text/markdown' } },
        },
      ],
    } as never);
    renderComponent();
    const [linked, plain] = screen.getAllByTestId('text-card');
    expect(linked).toHaveTextContent('Linked');
    expect(plain).toBeEmptyDOMElement();
  });

  it('shows the type badge on a chunk from a general resource', () => {
    mockUsePassageDetailContext.mockReturnValue({
      ...mockUsePassageDetailContext(),
      rowData: [
        {
          id: 'general-1',
          isResource: true,
          passageId: '',
          artifactTypeSlug: 'resource',
          isGeneralResource: true,
          mediafile: { attributes: { contentType: 'text/markdown' } },
        },
      ],
    } as never);
    renderComponent();
    expect(screen.getByTestId('text-card')).toHaveTextContent('General');
  });
});
