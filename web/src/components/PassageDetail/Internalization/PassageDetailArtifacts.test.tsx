import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import PassageDetailArtifacts from './PassageDetailArtifacts';
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
}));

jest.mock('../../../control', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

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
  default: ({ launch }: { launch: unknown }) => (
    <div data-testid="wizard-launch">
      {launch ? JSON.stringify(launch) : 'closed'}
    </div>
  ),
}));

jest.mock('./SortableHeader', () => () => null);
jest.mock('.', () => ({
  SortableItem: () => null,
}));
jest.mock('../../MediaUpload', () => ({
  __esModule: true,
  UriLinkType: 'text/uri-list',
  MarkDownType: 'text/markdown',
}));
jest.mock('../../MediaDisplay', () => () => null);
jest.mock('./SelectSharedResource', () => () => null);
jest.mock('./ResourceData', () => () => null);
jest.mock('../../AlertDialog', () => () => null);
jest.mock('./FindTabs', () => () => null);
jest.mock('./FindBibleBrain', () => () => null);
jest.mock('../../LimitedMediaPlayer', () => () => null);
jest.mock('./PassageResourceButton', () => ({
  PassageResourceButton: () => null,
}));
jest.mock('../../../control/MarkDownView', () => ({
  MarkDownView: () => null,
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
      setSelected: jest.fn(),
      playItem: '',
      setPlayItem: jest.fn(),
      setMediaSelected: jest.fn(),
      itemPlaying: false,
      setItemPlaying: jest.fn(),
      currentstep: {} as never,
      toggleDone: jest.fn(),
      forceRefresh: jest.fn(),
      handleItemPlayEnd: jest.fn(),
      handleItemTogglePlay: jest.fn(),
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
    expect(screen.getByTestId('wizard-launch')).toHaveTextContent('closed');
  });

  it('launches the wizard with an add request when Add Audio is chosen', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('button', { name: 'open-audio-upload' }));

    const launch = screen.getByTestId('wizard-launch');
    expect(launch).toHaveTextContent('"kind":"add"');
    expect(launch).toHaveTextContent('"action":"audio"');
  });
});
