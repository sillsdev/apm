import { useEffect, useMemo, useRef, useState } from 'react';
import { IMediaTabStrings, IState, PassageD } from '../../model';
import { Box, debounce, FormControlLabel, Switch } from '@mui/material';
import { findRecord, useOrganizedBy } from '../../crud';
import { GetReference, IPRow } from '.';
import { useSelector } from 'react-redux';
import { mediaTabSelector } from '../../selector';
import {
  DataGrid,
  type GridFilterModel,
  type GridColDef,
  type GridSortModel,
  type GridRowSelectionModel,
  GridRenderCellParams,
  GridColumnVisibilityModel,
} from '@mui/x-data-grid';
import { useGlobal } from '../../context/useGlobal';

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
  const [memory] = useGlobal('memory');
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const t: IMediaTabStrings = useSelector(mediaTabSelector);
  const { doAttach, setVisible, setUploadMedia, mediaRow } = props;
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [pcheck, setCheck] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const [addWidth, setAddWidth] = useState(0);

  const [columnVisibilityModel] = useState<GridColumnVisibilityModel>({
    sort: false,
    attached: false,
  });
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });

  const refCell = (params: GridRenderCellParams<IPRow>) => {
    const passage = findRecord(
      memory,
      'passage',
      params.row.passageId
    ) as PassageD;
    return (
      <GetReference passage={[passage]} bookData={allBookData} flat={false} />
    );
  };

  const MinNameWidth = 150;

  const columns: GridColDef<IPRow>[] = useMemo(
    () => [
      {
        field: 'sectionDesc',
        headerName: organizedBy,
        width: MinNameWidth + addWidth / 2,
        align: 'left',
        cellClassName: 'word-wrap',
      },
      {
        field: 'reference',
        headerName: t.reference,
        width: MinNameWidth + addWidth / 2,
        align: 'left',
        cellClassName: 'word-wrap',
        type: 'singleSelect',
        renderCell: refCell,
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
    [organizedBy, addWidth]
  );

  const sortModel: GridSortModel = [{ field: 'sort', sort: 'asc' }];
  const [attachedFilter, setAttachedFilter] = useState<
    GridFilterModel['items'][number]
  >({
    field: 'attached',
    operator: 'contains',
    value: 'N',
  });

  const totalWidth = useMemo(
    () =>
      columns.reduce(
        (sum, col) =>
          !columnVisibilityModel[col.field]
            ? sum
            : ['sectionDesc', 'reference'].includes(col.field)
              ? sum + MinNameWidth
              : sum + (col.width ?? 0),
        0
      ),
    [columns, columnVisibilityModel]
  );

  // keep track of screen width
  const setDimensions = () => {
    const boxWidth = boxRef.current?.clientWidth ?? 0;
    setAddWidth(boxWidth > totalWidth ? boxWidth - totalWidth : 0);
  };

  useEffect(() => {
    setDimensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWidth]);

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);

    window.addEventListener('resize', handleResize);
    return () => {
      handleResize.clear();
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); //do this once to get the default;

  const handleAttachedFilterChange = (e: any) => {
    setAttachedFilter({
      field: 'attached',
      operator: 'contains',
      value: e.target.checked ? 'Y' : 'N',
    });
  };

  const handleRowSelectionChange = (newSelection: GridRowSelectionModel) => {
    let checks = Array.from(newSelection.ids).map((id) =>
      parseInt(id as string)
    );
    if (newSelection.type === 'exclude') {
      checks = [];
      data.forEach((_r, i) => {
        if (!newSelection.ids.has(i)) checks.push(i);
      });
    }
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

  return (
    <Box ref={boxRef}>
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
        rows={data.map((r, id) => ({ ...r, id }))}
        filterModel={{ items: [attachedFilter] }}
        initialState={{
          sorting: { sortModel },
          columns: { columnVisibilityModel },
        }}
        checkboxSelection
        disableRowSelectionOnClick
        onRowSelectionModelChange={handleRowSelectionChange}
        rowSelectionModel={selectedRows}
        sx={{ '& .wrap-text': { whiteSpace: 'break-spaces' } }}
      />
    </Box>
  );
};

export default PassageChooser;
