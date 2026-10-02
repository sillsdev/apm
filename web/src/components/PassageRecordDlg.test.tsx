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
      visible
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

describe('PassageRecordDlg record-tab persistence (wizard Next→Back)', () => {
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
  const staged = [new File(['a'], 'a.webm', { type: 'audio/webm' })];

  it('keeps the Record tab mounted when reopened with a staged take', () => {
    const { rerender } = render(<PassageRecordDlg visible {...props()} />);
    act(() => {
      fireEvent.click(screen.getByTestId('tab-record'));
    });
    expect(inRecordMode()).toBe(true);

    // Next: dialog closes but a take is staged — keepMounted keeps it in the DOM.
    rerender(
      <PassageRecordDlg visible={false} {...props({ initialFiles: staged })} />
    );
    expect(inRecordMode()).toBe(true);

    // Back: reopen with the staged take → still on the Record tab.
    rerender(<PassageRecordDlg visible {...props({ initialFiles: staged })} />);
    expect(inRecordMode()).toBe(true);
  });

  it('drops back to the Upload tab on a genuine close (no staged take)', () => {
    const { rerender } = render(<PassageRecordDlg visible {...props()} />);
    act(() => {
      fireEvent.click(screen.getByTestId('tab-record'));
    });
    expect(inRecordMode()).toBe(true);

    // Fully closed with nothing staged → unmount the recorder.
    rerender(<PassageRecordDlg visible={false} {...props()} />);
    expect(inRecordMode()).toBe(false);

    // Fresh reopen with no staged take → Upload tab.
    rerender(<PassageRecordDlg visible {...props()} />);
    expect(inRecordMode()).toBe(false);
  });
});
