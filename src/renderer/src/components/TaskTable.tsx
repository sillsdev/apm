import { useState, useEffect, useRef, CSSProperties } from 'react';
import { useGlobal } from '../context/useGlobal';
import { Typography, Box, BoxProps, styled } from '@mui/material';
import useTodo from '../context/useTodo';
import TaskItem from './TaskItem';
import { useOrganizedBy, usePlan } from '../crud';
import usePassageDetailContext from '../context/usePassageDetailContext';
import {
  DataGrid,
  type GridColDef,
  type GridColumnVisibilityModel,
  type GridSortModel,
} from '@mui/x-data-grid';
import { IRowData } from '../context/TranscriberContext';

export const TaskItemWidth = 240;
export const TaskTableWidth = 265;

const TaskTableDiv = styled('div')(() => ({
  td: {
    padding: 0,
  },
  '&[data-list="true"] table': {
    minWidth: `${TaskItemWidth}px !important`,
  },
  '&[data-list="true"] thead': {
    display: 'none',
  },
  '& .MuiListItem-root': {
    padding: '0 16px',
  },
  '& .MuiListItem-root .item-desc': {
    width: `${TaskItemWidth - 80}px!important`,
    height: '60px !important',
    lineHeight: '2 !important',
    whiteSpace: 'normal',
    overflow: 'hidden',
  },
  '& .MuiList-root': {
    padding: 0,
  },
  '& colgroup col:first-of-type': {
    width: '1px !important',
  },
  '&[data-list="true"] colgroup col:nth-of-type(2)': {
    width: `${TaskItemWidth}px !important`,
  },
}));

const StyledPaper = styled(Box)<BoxProps>(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignContent: 'center',
  [theme.breakpoints.up('sm')]: {
    paddingLeft: 0,
    paddingRight: 0,
  },
}));

// see: https://mui.com/material-ui/customization/how-to-customize/
export const Header = styled(Box)<BoxProps>(({ theme }) => ({
  paddingLeft: theme.spacing(2),
  paddingTop: theme.spacing(1),
  paddingBottom: '8px',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  width: `${TaskItemWidth - 30}px`,
}));

export function TaskTable() {
  const { rowData, todoStr } = useTodo();
  const { playerMediafile, loading, pdBusy, discussionSize } =
    usePassageDetailContext();
  const t = todoStr;
  const { getPlan } = usePlan();
  const [planId] = useGlobal('plan'); //will be constant here
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const isInline = useRef(false);

  const [sortModel] = useState<GridSortModel>([
    { field: 'rowKey', sort: 'asc' },
  ]);
  const [columnVisibilityModel] = useState<GridColumnVisibilityModel>({
    mediaId: false,
    rowKey: false,
  });
  const extraHeight = 86;
  const [style, setStyle] = useState<CSSProperties>({
    height: discussionSize.height + extraHeight,
    overflowY: 'auto',
    cursor: 'default',
  });
  const formRef = useRef<any>();
  const selectedRef = useRef<any>();
  const notSelectedRef = useRef<any>();
  const busyRef = useRef(false);

  useEffect(() => {
    busyRef.current = pdBusy || loading;
    setStyle((style) => ({
      ...style,
      height: discussionSize.height + extraHeight,
      cursor: busyRef.current ? 'progress' : 'default',
    }));
  }, [pdBusy, loading, discussionSize]);

  useEffect(() => {
    if (formRef.current && selectedRef.current) {
      formRef.current.scrollTo(0, selectedRef.current.offsetTop);
    }
  });

  useEffect(() => {
    const planRec = getPlan(planId);
    isInline.current = Boolean(planRec?.attributes?.flat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const selBacking: CSSProperties = { background: 'lightgrey' };
  const noSelBacking: CSSProperties = { background: 'transparent' };

  const columns: GridColDef<IRowData>[] = [
    {
      field: 'composite',
      headerName: '\u00A0',
      width: TaskItemWidth,
      align: 'left',
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box
          key={params.row.mediafile.id}
          ref={
            params.row.mediafile.id === playerMediafile?.id
              ? selectedRef
              : notSelectedRef
          }
          style={{
            ...(params.row.mediafile.id === playerMediafile?.id
              ? selBacking
              : noSelBacking),
          }}
        >
          <TaskItem
            item={rowData.findIndex(
              (r) => r.mediafile.id === params.row.mediafile.id
            )}
            organizedBy={organizedBy}
            flat={isInline.current}
          />
        </Box>
      ),
    },
  ];

  return (
    <TaskTableDiv id="TaskTable" ref={formRef} style={style} data-list={'true'}>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <StyledPaper>
          <Header>
            <Typography variant="h6">{t.tasks}</Typography>
          </Header>
          <DataGrid
            columns={columns}
            rows={rowData.map((r, i) => ({ ...r, id: i }))}
            initialState={{
              sorting: { sortModel },
              columns: { columnVisibilityModel },
            }}
            rowHeight={120}
          />
        </StyledPaper>
      </Box>
    </TaskTableDiv>
  );
}

export default TaskTable;
