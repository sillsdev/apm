import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { UploadType } from '../../UploadType';
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
    uploadProject: 'Upload {0}',
    currentResource: 'Current {0}',
    tip1a: 'Choose scope',
    passageResource: 'Passage Resource',
    noteResource: 'Note Resource',
    bookResource: 'Book Resource',
    movementResource: 'Movement Resource',
    findResource: 'Find {0}',
    findResourceDesc: 'Find resource description',
    sharedResource: 'Shared {0}',
    generalResources: 'General Resources',
    generalResourcesIndividually:
      'General resources should be uploaded individually',
    editAudioResource: 'Edit Audio Resource',
    editGeneralResource: 'Edit General Resource',
    editResource: 'Edit Resource',
    editingFile: 'You are editing {0}',
    selectPassagesSub: 'Select passages for {0}',
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
  ArtifactTypeSlug: {
    Vernacular: 'vernacular',
    WholeBackTranslation: 'wholebacktranslation',
    PhraseBackTranslation: 'backtranslation',
    CarefulSpeech: 'carefulspeech',
    Retell: 'retell',
    QandA: 'qanda',
    Comment: 'comment',
    Activity: 'activity',
    Resource: 'resource',
    SharedResource: 'sharedresource',
  },
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
  usePlan: () => ({ getPlan: jest.fn(() => null) }),
  useArtifactType: () => ({ getTypeId: jest.fn(() => '') }),
}));

// Stable module-level arrays: the real useOrbitData hook returns the same
// reference until the underlying data changes, so a mock that hands back a
// fresh array literal on every call would falsely destabilize useMemo/useEffect
// deps keyed on these results (e.g. resourceType/projResourceType above).
// Names are prefixed with `mock` so babel-plugin-jest-hoist allows referencing
// them from inside the hoisted jest.mock() factory below.
const mockArtifactTypesResult = [
  { id: 'resource-type', attributes: { typename: 'resource' } },
  {
    id: 'project-resource-type',
    attributes: { typename: 'projectresource' },
  },
];
const mockEmptyOrbitResult: unknown[] = [];

jest.mock('../../../hoc/useOrbitData', () => ({
  useOrbitData: (type: string) => {
    if (type === 'artifacttype') {
      return mockArtifactTypesResult;
    }
    return mockEmptyOrbitResult;
  },
}));

jest.mock('../../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const values: Record<string, unknown> = {
      memory: { cache: { query: jest.fn() }, keyMap: {} },
      importexportBusy: false,
      remoteBusy: false,
      offline: false,
      offlineOnly: false,
      progress: 0,
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

jest.mock('../../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../../utils', () => ({
  getSegments: jest.fn(() => '[]'),
  NamedRegions: { ProjectResource: 'ProjectResource' },
  removeExtension: jest.fn(() => ({ name: 'topic' })),
  isVisual: jest.fn(() => false),
  isUrl: jest.fn(() => true),
  useMobile: () => ({ isMobileWidth: false }),
  safeFileBasename: jest.requireActual('../../../utils/safeFileBasename')
    .safeFileBasename,
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

jest.mock('../../Uploader', () => ({
  __esModule: true,
  default: ({
    isOpen,
    uploadType,
    ready,
    validationMessage,
    onFiles,
    metaData,
  }: {
    isOpen?: boolean;
    uploadType?: UploadType;
    ready?: () => boolean;
    validationMessage?: string;
    onFiles?: (files: File[]) => void;
    metaData?: React.ReactNode;
  }) => {
    if (!isOpen) return null;
    return (
      <div>
        {metaData}
        <button
          type="button"
          onClick={() =>
            onFiles?.([
              new File(['a'], 'a.mp3', { type: 'audio/mpeg' }),
              new File(['b'], 'b.mp3', { type: 'audio/mpeg' }),
            ])
          }
        >
          select-two-files
        </button>
        {validationMessage && <div>{validationMessage}</div>}
        <button type="button" disabled={!ready?.()}>
          {uploadType === UploadType.ProjectResource ? 'Next' : 'Upload'}
        </button>
      </div>
    );
  },
}));

jest.mock('./SortableHeader', () => () => null);
jest.mock('.', () => ({
  AIGenerated: 'ai-generated',
  SortableItem: () => null,
  useFullReference: () => jest.fn(() => ''),
}));
jest.mock('../../../control/LinkEdit', () => ({
  LinkEdit: () => null,
}));

jest.mock('../../../control/MarkDownEdit', () => ({
  MarkDownEdit: () => null,
}));

jest.mock('../../../control/MarkDownView', () => ({
  MarkDownView: () => null,
}));

jest.mock('../../MediaUpload', () => ({
  __esModule: true,
  UriLinkType: 'text/uri-list',
  MarkDownType: 'text/markdown',
  FaithbridgeType: 'audio/mpeg/s3link',
}));
jest.mock('../../MediaDisplay', () => () => null);
jest.mock('./SelectSharedResource', () => () => null);
jest.mock('./SelectSections', () => () => null);
jest.mock('./ProjectResourceConfigure', () => () => null);
jest.mock('../../AlertDialog', () => () => null);
jest.mock('./FindTabs', () => () => null);
jest.mock('./FindBibleBrain', () => () => null);
jest.mock('../../LimitedMediaPlayer', () => () => null);
jest.mock('./PassageResourceButton', () => ({
  PassageResourceButton: () => null,
}));
jest.mock('../../Sheet/SelectArtifactCategory', () => {
  const MockSelectArtifactCategory = (): React.ReactElement => (
    <div>category-select</div>
  );
  return MockSelectArtifactCategory;
});

const mockUsePassageDetailContext =
  usePassageDetailContext as jest.MockedFunction<
    typeof usePassageDetailContext
  >;

describe('PassageDetailArtifacts general resource uploads', () => {
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

  it('disables Next and shows the validation message for multi-file general uploads', () => {
    render(
      <ThemeProvider theme={theme}>
        <PassageDetailArtifacts />
      </ThemeProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-audio-upload' }));
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Resource description' },
    });
    fireEvent.click(screen.getByLabelText('Upload Project'));
    fireEvent.click(screen.getByRole('button', { name: 'select-two-files' }));

    expect(
      screen.getByText('General resources should be uploaded individually')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
