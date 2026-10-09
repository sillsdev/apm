/// <reference types="jest" />
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PassageRecordDlg from './PassageRecordDlg';
import { UploadType } from './UploadType';

let capturedAllowRecord: boolean | undefined;
let mockIpRecs: unknown[] = [];

jest.mock('react-redux', () => ({
  useSelector: () => ({ selectSpeaker: 'Select Speaker' }),
  shallowEqual: jest.fn(),
}));
jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => [key === 'organization' ? 'org1' : undefined],
}));
jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: () => mockIpRecs,
}));
jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));
jest.mock('../crud', () => ({
  ...jest.requireActual('../crud/related'),
  useFetchMediaUrl: () => ({
    fetchMediaUrl: jest.fn(),
    mediaState: { id: '' },
  }),
  findRecord: jest.fn(),
  ArtifactTypeSlug: { IntellectualProperty: 'intellectualproperty' },
}));
jest.mock('./ProvideRights', () => () => null);
jest.mock('../control', () => ({
  Button: (props: { children?: React.ReactNode }) => (
    <button>{props.children}</button>
  ),
}));
jest.mock('../control/Button', () => ({
  Button: (props: { children?: React.ReactNode }) => (
    <button>{props.children}</button>
  ),
}));
jest.mock('../utils/getRefWidth', () => ({ getRefWidth: () => 600 }));
jest.mock('./MediaUploadContent', () => () => null);
jest.mock('./Busy', () => () => null);
jest.mock('./AlertDialog', () => () => null);
jest.mock('./PassageDetail/Internalization/UploadRecordToggle', () => ({
  __esModule: true,
  default: (props: { onMode: (mode: 'upload' | 'record') => void }) => (
    <button data-testid="tab-record" onClick={() => props.onMode('record')}>
      record
    </button>
  ),
}));
jest.mock('./MediaRecord', () => ({
  __esModule: true,
  default: (props: { allowRecord?: boolean }) => {
    capturedAllowRecord = props.allowRecord;
    return null;
  },
}));

const ipRec = (rightsHolder: string) => ({
  type: 'intellectualproperty',
  id: `ip-${rightsHolder}`,
  attributes: { rightsHolder },
  relationships: {
    organization: { data: { type: 'organization', id: 'org1' } },
  },
});

const openRecordTab = (speaker: string) => {
  render(
    <PassageRecordDlg
      onVisible={jest.fn()}
      onCancel={jest.fn()}
      mediaId=""
      artifactId={null}
      afterUploadCb={jest.fn().mockResolvedValue(undefined)}
      passageId="p1"
      defaultFilename="file"
      speaker={speaker}
      onSpeaker={jest.fn()}
      uploadType={UploadType.Media}
      uploadMethod={undefined}
    />
  );
  act(() => {
    fireEvent.click(screen.getByTestId('tab-record'));
  });
};

describe('PassageRecordDlg speaker rights', () => {
  beforeEach(() => {
    capturedAllowRecord = undefined;
    mockIpRecs = [];
  });

  it('allows recording for a preselected speaker with a rights record', () => {
    mockIpRecs = [ipRec('Alice')];
    openRecordTab('Alice');
    expect(capturedAllowRecord).toBe(true);
  });

  it('allows recording for a preselected speaker whose rights were deferred ("Do later")', () => {
    // No IP record exists for Bob: ProvideRights' "Do later" doesn't create one.
    openRecordTab('Bob');
    expect(capturedAllowRecord).toBe(true);
  });

  it('blocks recording when no speaker is selected', () => {
    mockIpRecs = [ipRec('Alice')];
    openRecordTab('');
    expect(capturedAllowRecord).toBe(false);
  });
});

describe('PassageRecordDlg reopens fresh', () => {
  beforeEach(() => {
    capturedAllowRecord = undefined;
    mockIpRecs = [];
  });

  const props = (over: Record<string, unknown> = {}) => ({
    onVisible: jest.fn(),
    onCancel: jest.fn(),
    mediaId: '',
    artifactId: null,
    afterUploadCb: jest.fn().mockResolvedValue(undefined),
    passageId: 'p1',
    defaultFilename: 'file',
    speaker: 'Alice',
    onSpeaker: jest.fn(),
    uploadType: UploadType.ProjectResource,
    uploadMethod: undefined,
    ...over,
  });

  // The dialog portals to document.body; record mode renders #recDlgContent.
  const inRecordMode = () => Boolean(document.querySelector('#recDlgContent'));

  it('mounts a fresh instance on each open (Uploader mounts only while open)', () => {
    // The Uploader renders this dialog only while open, so closing = unmount.
    const first = render(<PassageRecordDlg {...props()} />);
    act(() => {
      fireEvent.click(screen.getByTestId('tab-record'));
    });
    expect(inRecordMode()).toBe(true);

    // Closing unmounts the dialog (tears down the recorder/mic).
    first.unmount();
    expect(inRecordMode()).toBe(false);

    // Reopening mounts a new instance → back on the Upload tab.
    render(<PassageRecordDlg {...props()} />);
    expect(inRecordMode()).toBe(false);
  });
});
