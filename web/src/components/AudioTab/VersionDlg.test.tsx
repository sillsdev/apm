/// <reference types="jest" />
import { act, render } from '@testing-library/react';
import VersionDlg from './VersionDlg';
import { findRecord, getVernacularMediaRec } from '../../crud';

interface TableProps {
  selectedId: string;
  setRefresh: () => void;
}

let table: TableProps;

const mockRows = [
  { id: 'v1', version: '1' },
  { id: 'v3', version: '3' },
  { id: 'v2', version: '2' },
];

jest.mock('./AudioTable', () => ({
  __esModule: true,
  default: (props: TableProps) => {
    table = props;
    return null;
  },
}));
jest.mock('./usePassageVersionAudioRows', () => ({
  usePassageVersionAudioRows: () => ({
    data: mockRows,
    sectionArr: [],
    shared: false,
    readonly: false,
    handleRefresh: jest.fn(),
  }),
}));
jest.mock('../../crud', () => ({
  findRecord: jest.fn(),
  getVernacularMediaRec: jest.fn(),
}));
jest.mock('../StepEditor', () => ({ ActionRow: () => null }));
jest.mock('../../control', () => ({ Button: () => null }));
jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));
jest.mock('../../hoc/useOrbitData', () => ({ useOrbitData: () => [] }));
jest.mock('../../model/baseModel', () => ({ UpdateRecord: jest.fn() }));
jest.mock('../../selector/selectors', () => ({ sharedSelector: jest.fn() }));
jest.mock('../../utils/index', () => ({
  doSort: () => (a: { version: string }, b: { version: string }) =>
    Number(b.version) - Number(a.version),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({}),
  shallowEqual: jest.fn(),
}));

const renderDlg = (onVersionApplied: () => void) =>
  render(
    <VersionDlg
      passId="p1"
      canSetDestination={false}
      hasPublishing={false}
      onVersionApplied={onVersionApplied}
    />
  );

describe('VersionDlg table change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVernacularMediaRec as jest.Mock).mockReturnValue({ id: 'v2' });
  });

  it('selects the next newest version and applies it when the active version is deleted', () => {
    (findRecord as jest.Mock).mockReturnValue(undefined);
    const onVersionApplied = jest.fn();
    renderDlg(onVersionApplied);

    act(() => table.setRefresh());

    expect(onVersionApplied).toHaveBeenCalledTimes(1);
    expect(table.selectedId).toBe('v2');
  });

  it('leaves the active version alone when its record still exists', () => {
    (findRecord as jest.Mock).mockReturnValue({ id: 'v3' });
    const onVersionApplied = jest.fn();
    renderDlg(onVersionApplied);

    act(() => table.setRefresh());

    expect(onVersionApplied).not.toHaveBeenCalled();
    expect(table.selectedId).toBe('v3');
  });
});
