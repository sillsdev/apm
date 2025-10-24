import {
  useState,
  useEffect,
  useContext,
  useMemo,
  MouseEventHandler,
} from 'react';
import { useGlobal } from '../context/useGlobal';
import { shallowEqual } from 'react-redux';
import {
  IState,
  PassageD,
  User,
  IAssignmentTableStrings,
  IActivityStateStrings,
  Role,
  ISharedStrings,
  MediaFileD,
  SectionD,
} from '../model';
import { RecordIdentity } from '@orbit/records';
import { Button, Menu, MenuItem, styled } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import { AltButton, iconMargin } from '../control';
import { useSnackBar } from '../hoc/SnackBar';
import Confirm from './AlertDialog';
import AssignSection from './AssignSection';
import {
  related,
  sectionDescription,
  sectionCompare,
  passageCompare,
  useOrganizedBy,
  useRole,
  useSharedResRead,
  useOrgDefaults,
  orgDefaultPermissions,
} from '../crud';
import { TabAppBar, TabActions, PaddedBox, GrowingSpacer } from '../control';
import { ReplaceRelatedRecord, UpdateLastModifiedBy } from '../model/baseModel';
import { PlanContext } from '../context/PlanContext';
import { useOrbitData } from '../hoc/useOrbitData';
import { useSelector } from 'react-redux';
import {
  activitySelector,
  assignmentSelector,
  sharedSelector,
} from '../selector';
import { GetReference } from './AudioTab/GetReference';
import { OrganizationSchemeD } from '../model/organizationScheme';
import {
  GridColumnVisibilityModel,
  GridRenderCellParams,
  type GridColDef,
  type GridRowSelectionModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { TreeDataGrid } from './TreeDataGrid';
import { pad2 } from '../utils/pad2';

const AssignmentDiv = styled('div')(() => ({
  display: 'flex',
  '& tr > td > div > span.MuiButtonBase-root:nth-of-type(3)': {
    visibility: 'hidden',
  },
}));

interface IRow {
  id: number;
  recId: string;
  name: React.ReactNode;
  scheme: React.ReactNode;
  passages: string;
  parentId: string;
  sort: string;
}

export function AssignmentTable() {
  const t: IAssignmentTableStrings = useSelector(
    assignmentSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const activityState: IActivityStateStrings = useSelector(
    activitySelector,
    shallowEqual
  );
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const passages = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<SectionD[]>('section');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const users = useOrbitData<User[]>('user');
  const roles = useOrbitData<Role[]>('role');
  const schemes = useOrbitData<OrganizationSchemeD[]>('organizationscheme');
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [plan] = useGlobal('plan'); //will be constant here
  const [org] = useGlobal('organization');
  const { showMessage } = useSnackBar();
  const ctx = useContext(PlanContext);
  const { flat, sectionArr } = ctx.state;
  const [data, setData] = useState(Array<IRow>());
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [check, setCheck] = useState(Array<number>());
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });

  const [assignMenu, setAssignMenu] = useState<HTMLButtonElement>();
  const sectionMap = new Map<number, string>(sectionArr);
  const [selectedSections, setSelectedSections] = useState<SectionD[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [confirmAction, setConfirmAction] = useState('');
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [refresh, setRefresh] = useState(0);
  const { getSharedResource } = useSharedResRead();
  const { getOrgDefault } = useOrgDefaults();
  const isPermission = useMemo(
    () => Boolean(getOrgDefault(orgDefaultPermissions)),
    [getOrgDefault]
  );

  const handleView = (schemeId: string) => () => {
    setAssignMenu(undefined);
    setAssignSectionVisible(schemeId);
    setReadOnly(true);
  };

  const getSchemeName = (params: GridRenderCellParams) => {
    const sectionId = params.row.scheme as string;
    const section = sections.find((s) => s.id === sectionId);
    const schemeId = related(section, 'organizationScheme');
    const scheme = schemes.find((s) => s.id === schemeId);
    return (
      <Button onClick={handleView(schemeId)}>
        {scheme?.attributes?.name ?? ''}
      </Button>
    );
  };
  const getNameCell = (params: GridRenderCellParams) => {
    if (params.row.parentId === '') return params.row.name;
    const passage = passages.find((p) => p.id === params.row.recId) as PassageD;
    const sr = getSharedResource(passage);
    return (
      <GetReference
        passage={[passage]}
        bookData={allBookData}
        flat={false}
        sr={sr}
      />
    );
  };

  const columns: GridColDef[] = useMemo(
    () => {
      const newColumns: GridColDef[] = !flat
        ? [
            {
              field: 'name',
              headerName: organizedBy,
              width: 300,
              cellClassName: 'word-wrap',
              renderCell: getNameCell,
            },
            {
              field: 'passages',
              headerName: ts.passages,
              width: 100,
              align: 'right',
            },
            {
              field: 'scheme',
              headerName: isPermission ? ts.scheme : ts.scheme2,
              width: 200,
              renderCell: getSchemeName,
            },
            {
              field: 'sort',
              width: 10,
            },
          ]
        : [
            {
              field: 'name',
              headerName: organizedBy,
              width: 300,
              cellClassName: 'word-wrap',
              renderCell: getNameCell,
            },
            {
              field: 'scheme',
              headerName: isPermission ? ts.scheme : ts.scheme2,
              width: 200,
              renderCell: getSchemeName,
            },
            {
              field: 'sort',
              width: 10,
            },
          ];
      return [...newColumns];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flat, organizedBy, ts.passages, t.sectionstate, isPermission, data]
  );
  const [assignSectionVisible, setAssignSectionVisible] = useState<string>();
  const { userIsAdmin } = useRole();
  const orgSchemes = useMemo(() => {
    return schemes?.filter((s) => related(s, 'organization') === org);
  }, [schemes, org]);

  const getAssignments = () => {
    let sectionRow: IRow;
    const rowData: IRow[] = [];
    let id = 0;
    const plansections = sections
      .filter(
        (s) =>
          related(s, 'plan') === plan &&
          s.attributes &&
          s.attributes.sequencenum > 0
      )
      .sort(sectionCompare);

    plansections.forEach(function (section) {
      const sort = (section.attributes?.sequencenum || 0).toFixed(2).toString();
      sectionRow = {
        id: id++,
        recId: section.id as string,
        name: sectionDescription(section, sectionMap),
        scheme: section.id,
        passages: '0', //string so we can have blank, alternatively we could format in the tree to not show on passage rows
        parentId: '',
        sort,
      };
      rowData.push(sectionRow);
      const sectionps = passages
        .filter((p) => related(p, 'section') === section.id)
        .sort(passageCompare);
      sectionRow.passages = sectionps.length.toString();
      if (openSections.includes(section.id)) {
        sectionps.forEach(function (passage: PassageD) {
          rowData.push({
            id: id++,
            recId: passage.id,
            name: passage.id,
            scheme: '',
            passages: '',
            parentId: section.id,
            sort: `${sort}.${pad2(passage.attributes.sequencenum)}`,
          } as IRow);
        });
      }
    });
    return rowData as Array<IRow>;
  };

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (e) => {
    if (check.length === 0) {
      showMessage(t.selectRowsToAssign);
    } else {
      setAssignMenu(e.currentTarget);
    }
  };

  const handleClose = () => {
    setAssignMenu(undefined);
  };

  const handleAssignSection = (schemeId: string) => () => {
    if (check.length === 0) {
      showMessage(t.selectRowsToAssign);
    } else {
      setAssignMenu(undefined);
      setAssignSectionVisible(schemeId);
      setReadOnly(false);
    }
  };

  const handleRemoveAssignments = () => {
    if (check.length === 0) {
      showMessage(t.selectRowsToRemove);
    } else {
      let count = 0;
      check.forEach((i) => {
        const row = data[i] as IRow;
        const sectId = row.scheme as string;
        if (!sectId) return;
        const section = sections.find((s) => s.id === sectId);
        if (!section) return;
        const schemeId = related(section, 'organizationScheme');
        if (schemeId) count++;
      });
      if (count === 0) {
        showMessage(t.selectRowsToRemove);
      } else {
        setConfirmAction(t.removeSec + '? (' + count + ')');
      }
    }
  };

  const RemoveOneAssignment = async (s: SectionD) => {
    await memory.update((t) => [
      ...UpdateLastModifiedBy(t, s as RecordIdentity, user),
      ...ReplaceRelatedRecord(
        t,
        s as RecordIdentity,
        'transcriber',
        'user',
        ''
      ),
      ...ReplaceRelatedRecord(t, s as RecordIdentity, 'editor', 'user', ''),
      ...ReplaceRelatedRecord(
        t,
        s as RecordIdentity,
        'organizationScheme',
        'user',
        ''
      ),
      ...UpdateLastModifiedBy(
        t,
        { type: 'plan', id: related(s, 'plan') },
        user
      ),
    ]);
  };

  const hasAssignmentChange = (schemeId: string | undefined) => {
    if (schemeId === undefined) return false;
    const value = selectedSections.some(
      (s) => related(s, 'organizationScheme') !== schemeId
    );
    return value;
  };

  const handleRemoveAssignmentsConfirmed = async () => {
    setConfirmAction('');
    for (let i = 0; i < selectedSections.length; i += 1)
      await RemoveOneAssignment(selectedSections[i] as SectionD);
    setCheck([]);
    setSelectedSections([]);
    setSelectedRows({ type: 'include', ids: new Set() });
    setRefresh(refresh + 1);
  };
  const handleRemoveAssignmentsRefused = () => setConfirmAction('');

  const handleCloseAssignSection = (cancel?: boolean) => {
    setAssignSectionVisible(undefined);
    if (!cancel) {
      setCheck([]);
      setSelectedSections([]);
      setSelectedRows({ type: 'include', ids: new Set() });
    }
  };

  const handleRowSelectionChange = (newSelection: GridRowSelectionModel) => {
    if (newSelection.type === 'exclude') {
      const newSelectionIds = Array<number>();
      data.forEach((_r, i) => {
        if (!newSelection.ids.has(i)) newSelectionIds.push(i);
      });
      setCheck(newSelectionIds);
      setSelectedRows({ type: 'include', ids: new Set(newSelectionIds) });
      return;
    }
    const checks = Array.from(newSelection.ids).map((id) =>
      parseInt(id as string)
    );
    setCheck(checks);
    setSelectedRows(newSelection);
  };

  const sortSchemes = (a: OrganizationSchemeD, b: OrganizationSchemeD) =>
    a.attributes?.name.localeCompare(b.attributes?.name);

  useEffect(() => {
    setData(getAssignments());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    plan,
    passages,
    mediafiles,
    sections,
    users,
    roles,
    activityState,
    allBookData,
    refresh,
    openSections,
    schemes,
  ]);

  useEffect(() => {
    const selected = Array<SectionD>();
    let one: any;
    check.forEach((c) => {
      one = sections.find(function (s) {
        return c < data.length ? s.id === (data[c] as IRow).recId : undefined;
      });
      if (one !== undefined) selected.push(one);
    });
    setSelectedSections(selected);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check, sections]);

  const sortModel: GridSortModel = [{ field: 'sort', sort: 'asc' }];
  const columnVisibilityModel: GridColumnVisibilityModel = { sort: false };

  return (
    <AssignmentDiv id="AssignmentTable">
      <div>
        <TabAppBar position="fixed" color="default">
          <TabActions>
            {userIsAdmin && (
              <>
                <AltButton
                  id="assignAdd"
                  key="assign"
                  aria-label={t.assignSec}
                  onClick={handleMenu}
                >
                  {isPermission ? t.assignSec : t.assignSec2}
                  <DropDownIcon sx={iconMargin} />
                </AltButton>
                <AltButton
                  id="assignRem"
                  key="remove"
                  aria-label={t.removeSec}
                  onClick={handleRemoveAssignments}
                >
                  {isPermission ? t.removeSec : t.removeSec2}
                </AltButton>
              </>
            )}
            <GrowingSpacer />
          </TabActions>
        </TabAppBar>
        <PaddedBox>
          <TreeDataGrid
            columns={columns}
            rows={data}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectedRows}
            onRowSelectionModelChange={handleRowSelectionChange}
            recIdName="recId"
            expanded={setOpenSections}
            initialState={{
              sorting: { sortModel },
              columns: { columnVisibilityModel },
            }}
            sx={{ '& .word-wrap': { wordWrap: 'break-spaces' } }}
          />
        </PaddedBox>
      </div>
      <Menu
        id="assign-menu"
        anchorEl={assignMenu}
        open={Boolean(assignMenu)}
        onClose={handleClose}
      >
        {orgSchemes
          .filter(
            (s) =>
              related(s, 'organization') === org &&
              Boolean(s?.attributes?.name?.trim())
          )
          .sort(sortSchemes)
          .map((scheme) => (
            <MenuItem
              key={scheme.id}
              onClick={handleAssignSection(scheme.id)}
              id={'assign-' + scheme.id}
            >
              {scheme.attributes?.name}
            </MenuItem>
          ))}
        <MenuItem id="add-assign" onClick={handleAssignSection('')}>
          {isPermission ? t.addScheme : t.addScheme2}
        </MenuItem>
      </Menu>
      <AssignSection
        sections={selectedSections}
        scheme={assignSectionVisible}
        visible={assignSectionVisible !== undefined}
        closeMethod={handleCloseAssignSection}
        refresh={() => setRefresh(refresh + 1)}
        readOnly={readOnly}
        inChange={hasAssignmentChange(assignSectionVisible)}
      />
      {confirmAction !== '' ? (
        <Confirm
          text={confirmAction}
          yesResponse={handleRemoveAssignmentsConfirmed}
          noResponse={handleRemoveAssignmentsRefused}
        />
      ) : (
        <></>
      )}
    </AssignmentDiv>
  );
}

export default AssignmentTable;
