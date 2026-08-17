// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import ConsultantCheck from './ConsultantCheck';
import { SimpleWf } from '../../context/PassageDetailContext';
import { ArtifactTypeSlug } from '../../crud';

let mockWorkflow: SimpleWf[] = [];
const mockSetStepComplete = jest.fn();
let mockCurrentStep = '';
let mockCompare: string[] = [];
let mockPassageStepComplete: string | null = null;
const mockUpdateRecord = jest.fn();

// Mock schema to avoid import.meta issues in Jest
const mockMemory = {
  cache: {
    query: jest.fn(() => []),
  },
  update: jest.fn(),
};

jest.mock('../../schema', () => ({
  memory: mockMemory,
  requestedSchema: 100,
}));

// Mock GlobalContext to avoid context errors
jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn((key: string) => {
    const mockValues: Record<string, any> = {
      memory: mockMemory,
      remoteBusy: false,
    };
    return [mockValues[key], jest.fn()];
  }),
  useGetGlobal: jest.fn(() =>
    jest.fn((key: string) => {
      const mockValues: Record<string, any> = {
        memory: mockMemory,
        remoteBusy: false,
      };
      return mockValues[key];
    })
  ),
}));

// Mock GlobalContext
jest.mock('../../context/GlobalContext', () => ({
  GlobalContext: React.createContext({
    globalState: {},
    setGlobalState: jest.fn(),
  }),
}));

jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({
    canDoSectionStep: jest.fn(() => true),
  }),
}));
jest.mock('../../crud', () => ({
  useArtifactType: () => ({
    localizedArtifactType: (slug: ArtifactTypeSlug) => {
      if (slug === 'vernacular') return 'Vernacular';
      else if (slug === 'backtranslation') return 'Phrase Back Translation';
      else return 'other';
    },
  }),
  findRecord: (memory: any, table: any, id: string) => {
    if (table === 'passage')
      return { attributes: { stepComplete: mockPassageStepComplete } };
    if (id === '1') return { attributes: { tool: '{"tool": "record"}' } };
    else if (id === '2')
      return { attributes: { tool: '{"tool": "phraseBackTranslate"}' } };
  },
  useOrgDefaults: () => ({
    getOrgDefault: () => {
      return mockCompare;
    },
    setOrgDefault: jest.fn(),
  }),
  useUpdateRecord: () => mockUpdateRecord,
  ArtifactTypeSlug: jest.requireActual('../../crud/artifactTypeSlug')
    .ArtifactTypeSlug,
  ToolSlug: jest.requireActual('../../crud/toolSlug').ToolSlug,
}));
jest.mock('../../context/usePassageDetailContext', () => () => ({
  workflow: mockWorkflow,
  stepComplete: () => false,
  setStepComplete: mockSetStepComplete,
  gotoNextStep: jest.fn(),
  currentstep: mockCurrentStep,
  passage: { attributes: { stepComplete: mockPassageStepComplete } },
}));
jest.mock('../MediaPlayer', () => {
  const MockMediaPlayer = () => <div>MediaPlayer</div>;
  MockMediaPlayer.displayName = 'MockMediaPlayer';
  return MockMediaPlayer;
});
jest.mock('./ConsultantCheckReview', () => {
  const MockConsultantCheckReview = ({ item }: { item: string }) => (
    <>
      <div>ConsultantCheckReview</div>
      <div>{item}</div>
    </>
  );
  MockConsultantCheckReview.displayName = 'MockConsultantCheckReview';
  return MockConsultantCheckReview;
});
jest.mock('../../control', () => ({
  ActionRow: jest.requireActual('../../control/ActionRow').ActionRow,
  AltButton: jest.requireActual('../../control/AltButton').AltButton,
  PriButton: jest.requireActual('../../control/PriButton').PriButton,
  GrowingDiv: jest.requireActual('../../control/GrowingDiv').GrowingDiv,
}));
jest.mock('../../selector', () => ({
  consultantSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    furtherReview: 'Further Review',
    approved: 'Approved',
    wait: 'Please wait.',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../hoc/BigDialog', () => {
  const MockBigDialog = (props: any) => (
    <>
      <div>BigDialog</div>
      <div>{props.isOpen ? 'compare-open' : 'compare-close'}</div>
      <div>{props.children}</div>
    </>
  );
  MockBigDialog.displayName = 'MockBigDialog';
  return MockBigDialog;
});
jest.mock('./ConsultantCheckCompare', () => {
  const MockConsultantCheckCompare = (props: any) => (
    <>
      <div>ConsultantCheckCompare</div>
      <div>{JSON.stringify(props, null, 2)}</div>
    </>
  );
  MockConsultantCheckCompare.displayName = 'MockConsultantCheckCompare';
  return MockConsultantCheckCompare;
});
jest.mock('../../model/baseModel', () => ({
  UpdateRecord: jest.fn(),
}));
jest.mock('@orbit/records', () => ({
  RecordTransformBuilder: jest.fn(),
}));
jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({
    showMessage: (message: string) => <div>{message}</div>,
  }),
}));

describe('ConsultantCheck', () => {
  beforeEach(cleanup);
  afterEach(() => {
    mockWorkflow = [];
    mockCurrentStep = '';
    mockCompare = [];
    mockPassageStepComplete = null;
    mockSetStepComplete.mockClear();
    mockUpdateRecord.mockClear();
  });

  it('should render', () => {
    const { container } = render(<ConsultantCheck width={500} />);
    expect(container).not.toBe(null);
  });

  it('should render ConsultantCheckReview', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByText('ConsultantCheckReview')).not.toBe(null);
    expect(screen.getByText('vernacular')).not.toBe(null);
  });

  it('should render Vernacular tab', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByText('Vernacular')).not.toBe(null);
  });

  it('should render ActionRow', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByTestId('action-row')).not.toBe(null);
  });

  it('should render PriButton', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByTestId('pri-button')).not.toBe(null);
  });

  it('should render Alt Button when Pri Button is clicked', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    render(<ConsultantCheck width={500} />);
    fireEvent.click(screen.getByTestId('pri-button'));
    expect(screen.getByTestId('alt-button')).not.toBe(null);
    expect(screen.queryAllByTestId('pri-button')).toHaveLength(0);
  });

  it('should render remain selected when its the only tab and Pri Button is clicked', async () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    mockCurrentStep = 'record';
    render(<ConsultantCheck width={500} />);
    fireEvent.click(screen.getByTestId('pri-button'));
    expect(screen.getByText('Vernacular')).toHaveClass('Mui-selected');
    await waitFor(() => expect(mockSetStepComplete).toHaveBeenCalledTimes(1));
    expect(mockSetStepComplete).toHaveBeenCalledWith('record', true);
  });

  it('should update passage record and include completed when Pri Button is clicked', async () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    mockCurrentStep = 'record';
    render(<ConsultantCheck width={500} />);
    fireEvent.click(screen.getByTestId('pri-button'));
    await waitFor(() => expect(mockSetStepComplete).toHaveBeenCalledTimes(1));
    expect(mockSetStepComplete).toHaveBeenCalledWith('record', true);
    expect(mockUpdateRecord).toHaveBeenCalledTimes(1);
    const stepCompleteJson =
      mockUpdateRecord['mock'].calls[0][0]?.attributes?.stepComplete;
    const result = JSON.parse(stepCompleteJson);
    expect(result.completed).toEqual([]);
  });

  it('should update passage record and keep completed when Pri Button is clicked', async () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    mockCurrentStep = 'record';
    mockPassageStepComplete = `{"completed":["record"]}`;
    render(<ConsultantCheck width={500} />);
    fireEvent.click(screen.getByTestId('pri-button'));
    await waitFor(() => expect(mockSetStepComplete).toHaveBeenCalledTimes(1));
    expect(mockSetStepComplete).toHaveBeenCalledWith('record', true);
    expect(mockUpdateRecord).toHaveBeenCalledTimes(1);
    const stepCompleteJson =
      mockUpdateRecord['mock'].calls[0][0]?.attributes?.stepComplete;
    const result = JSON.parse(stepCompleteJson);
    expect(result.completed).toEqual(['record']);
  });

  it('should have a second tab when workflow has the right two items', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
      {
        id: '2',
        label: 'Phrase Back Translation',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByText('Vernacular')).not.toBe(null);
    expect(screen.getByText('Phrase Back Translation')).not.toBe(null);
  });

  it('should have selected PBT when it has two items', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
      {
        id: '2',
        label: 'Phrase Back Translation',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByText('Phrase Back Translation')).not.toBe(null);
    expect(screen.getByText('Phrase Back Translation')).toHaveClass(
      'Mui-selected'
    );
  });

  it('should select Vernacular when the primary button is clicked', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
      {
        id: '2',
        label: 'Phrase Back Translation',
      },
    ];
    render(<ConsultantCheck width={500} />);
    fireEvent.click(screen.getByTestId('pri-button'));
    expect(screen.getByText('Vernacular')).not.toBe(null);
    expect(screen.getByText('Vernacular')).toHaveClass('Mui-selected');
  });

  it('should open the compare dialog when compare button clicked', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
      {
        id: '2',
        label: 'Phrase Back Translation',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.getByText('compare-close')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('compare-button'));
    expect(screen.getByText('compare-open')).toBeInTheDocument();
  });

  it('should not have a compare button with one artifact type', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.queryAllByTestId('compare-button')).toHaveLength(0);
  });

  it('should render a table if compare set', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
      {
        id: '2',
        label: 'Phrase Back Translation',
      },
    ];
    mockCompare = ['1', '2'];
    const { container } = render(<ConsultantCheck width={500} />);
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('should only include each artifact type once in the list of tabs', () => {
    mockWorkflow = [
      {
        id: '1',
        label: 'Record',
      },
      {
        id: '2',
        label: 'Phrase Back Translation',
      },
      {
        id: '3',
        label: 'Phrase Back Translation',
      },
    ];
    render(<ConsultantCheck width={500} />);
    expect(screen.queryAllByText('Phrase Back Translation')).toHaveLength(1);
  });
});
