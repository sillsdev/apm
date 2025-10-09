import { useEffect, useMemo, useState } from 'react';
import { IMediaTabStrings } from '../../model';
import { FormControlLabel, Switch } from '@mui/material';
import { useOrganizedBy } from '../../crud';
import { IPRow } from '.';
import { useSelector } from 'react-redux';
import { mediaTabSelector } from '../../selector';
import {
  DataGrid,
  type GridFilterModel,
  type GridColDef,
  type GridSortModel,
  type GridRowSelectionModel,
} from '@mui/x-data-grid';

interface IProps {
  data: IPRow[];
  row: number;
  doAttach: (row: number, pRow: number) => void;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  uploadMedia: string | undefined;
  setUploadMedia: (uploadMedia: string | undefined) => void;
  mediaRow: (id: string) => number;
}

export const PassageChooser = (props: IProps) => {
  const { data, row, visible, uploadMedia } = props;
  const t: IMediaTabStrings = useSelector(mediaTabSelector);
  const { doAttach, setVisible, setUploadMedia, mediaRow } = props;
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [refTot, setRefTot] = useState(0);
  const [pcheck, setCheck] = useState(-1);
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });

  const columns: GridColDef<IPRow>[] = useMemo(
    () => [
      {
        field: 'sectionDesc',
        headerName: organizedBy,
        width: 150,
        align: 'left',
        cellClassName: 'word-wrap',
      },
      {
        field: 'reference',
        headerName: `${t.reference} (${refTot})`,
        width: 150,
        align: 'left',
        cellClassName: 'word-wrap',
        type: 'singleSelect',
      },
      {
        field: 'attached',
        headerName: t.associated,
        width: 100,
        align: 'left',
      },
      { field: 'sort', headerName: '\u00A0', width: 100, align: 'left' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizedBy, refTot]
  );

  const sortModel: GridSortModel = [{ field: 'sort', sort: 'asc' }];
  const [attachedFilter, setAttachedFilter] = useState<
    GridFilterModel['items'][number]
  >({
    field: 'attached',
    operator: '=',
    value: 'N',
  });

  const handleAttachedFilterChange = (e: any) => {
    setAttachedFilter({
      field: 'attached',
      operator: '=',
      value: e.target.checked ? 'Y' : 'N',
    });
  };

  const handleRowSelectionChange = (newSelection: GridRowSelectionModel) => {
    const checks = Array.from(newSelection.ids).map((id) => Number(id));
    let mRow = row;
    if (uploadMedia) {
      mRow = mediaRow(uploadMedia);
      setUploadMedia(undefined);
    }
    if (visible && checks.length === 1 && mRow >= 0) {
      doAttach(mRow, checks[0]);
      setVisible(false);
      return;
    }
    const newIds = checks[0] === pcheck ? checks[1] : checks[0];
    setCheck(newIds);
    setSelectedRows(newSelection);
  };

  useEffect(() => {
    const refs = data.map((r) => r.reference);
    const uniqueRefs = new Set(refs);
    setRefTot(uniqueRefs.size);
  }, [data]);

  return (
    <div>
      <FormControlLabel
        value="attached"
        labelPlacement="end"
        control={
          <Switch
            checked={attachedFilter.value === 'Y'}
            onChange={handleAttachedFilterChange}
          />
        }
        label={t.alreadyAssociated}
      />
      <DataGrid
        columns={columns}
        rows={data}
        initialState={{
          sorting: { sortModel },
          filter: { filterModel: { items: [attachedFilter] } },
          columns: { columnVisibilityModel: { sort: false, attached: false } },
        }}
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={handleRowSelectionChange}
        rowSelectionModel={selectedRows}
        sx={{ '& .wrap-text': { whiteSpace: 'break-spaces' } }}
      />
    </div>
  );
};

export default PassageChooser;
