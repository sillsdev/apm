import React, { useMemo } from 'react';
import {
  FilteringState,
  Filter,
  SummaryItem,
  IntegratedSorting,
  TableColumnWidthInfo,
  SortingState,
  Sorting,
  Grouping,
  GridColumnExtension,
} from '@devexpress/dx-react-grid';
import { TableBandHeader } from '@devexpress/dx-react-grid-material-ui';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { esES, frFR, ptBR, ruRU, zhCN } from '@mui/x-data-grid/locales';
import { useGlobal } from '../context/useGlobal';
interface MyColumn {
  name: string;
  title: string;
  renderCell?: (params: any) => JSX.Element;
}
interface IProps {
  columns: Array<MyColumn>;
  columnWidths?: Array<TableColumnWidthInfo>;
  columnFormatting?: Array<GridColumnExtension>;
  columnSorting?: Array<IntegratedSorting.ColumnExtension>;
  pageSizes?: Array<number>;
  sortingEnabled?: Array<SortingState.ColumnExtension>;
  filteringEnabled?: Array<FilteringState.ColumnExtension>;
  filters?: Filter[];
  hiddenColumnNames?: Array<string>;
  defaultGrouping?: Grouping[];
  expandedGroups?: string[];
  dataCell?: any;
  noDataCell?: any;
  numCols?: Array<string>;
  rows: Array<any>;
  sorting?: Array<Sorting>;
  shaping?: boolean;
  checks?: Array<number | string>;
  select?: (checks: Array<number>) => void;
  selectCell?: any;
  bandHeader?: TableBandHeader.ColumnBands[];
  summaryItems?: SummaryItem[];
}

function DataTable(props: IProps) {
  const {
    columns,
    columnWidths,
    columnFormatting,
    columnSorting /* special sortComparator function for each column as needed */,
    sortingEnabled /* whether sorting is enabled for each column */,
    filteringEnabled /* whether filtering is enabled for each column */,
    numCols,
    rows,
    checks,
    select,
    sorting,
  } = props;
  const [rowSelectionModel, setRowSelectionModel] =
    React.useState<GridRowSelectionModel>({
      type: 'include',
      ids: new Set(),
    });

  const [lang] = useGlobal('lang');
  const localeText = useMemo(() => {
    const locale = new Map([
      ['es', esES],
      ['fr', frFR],
      ['pt', ptBR],
      ['ru', ruRU],
      ['zh', zhCN],
    ]);
    return locale.get(lang)?.components.MuiDataGrid.defaultProps.localeText;
  }, [lang]);

  React.useEffect(() => {
    if (checks) {
      const newSelection = checks.map((c) =>
        typeof c === 'string' ? parseInt(c) : c
      );
      setRowSelectionModel({
        type: 'include',
        ids: new Set(newSelection),
      });
    }
  }, [checks]);

  const handleSelection = (selection: (number | string)[]) => {
    if (selection.length === 1 && selection[0] === -1) return;
    const numSelection =
      selection.length === 0
        ? []
        : selection.map((s) =>
            typeof s === 'string' ? rows.findIndex((r) => r.id === s) : s
          );
    select && select(numSelection);
  };

  const handleRowSelectionModelChange = (model: GridRowSelectionModel) => {
    setRowSelectionModel(model);
    const selection = Array.from(model.ids);
    handleSelection(selection);
  };

  const colSpec = React.useMemo(() => {
    const colSpec: GridColDef[] = columns.map((c) => {
      const col = {
        field: c.name,
        headerName: c.title ?? c.name,
        renderCell: c.renderCell,
      } as GridColDef;
      if (columnWidths) {
        const cw = columnWidths.find((w) => w.columnName === c.name);
        if (cw) {
          col.width =
            typeof cw.width === 'number' ? cw.width : parseInt(cw.width);
        }
      }
      if (numCols) {
        const nc = numCols.find((n) => n === c.name);
        if (nc) {
          col.align = 'right';
          col.type = 'number';
        }
      }
      if (columnFormatting) {
        const cf = columnFormatting.find((f) => f.columnName === c.name);
        if (cf) {
          col.align = cf.align ?? 'left';
          // col.wordWrapEnabled = cf.wordWrapEnabled ?? false;
          if (!col.width)
            col.width =
              typeof cf.width === 'string'
                ? parseInt(cf.width)
                : (cf?.width ?? 100);
        }
      }
      if (columnSorting) {
        const cs = columnSorting.find((s) => s.columnName === c.name);
        if (cs?.compare) {
          col.sortComparator = cs.compare;
        }
      }
      if (sortingEnabled) {
        const se = sortingEnabled.find((s) => s.columnName === c.name);
        if (se?.sortingEnabled !== undefined) {
          col.sortable = se?.sortingEnabled;
        }
        if (se?.sortingEnabled) {
          if (!col?.sortComparator) {
            col.sortComparator = (a: any, b: any) =>
              a === b ? 0 : a > b ? 1 : -1;
          }
        } else {
          col.sortComparator = undefined;
        }
      }
      if (sorting) {
        const ss = sorting.find((s) => s.columnName === c.name);
        if (ss?.direction === 'asc') {
          col.sortComparator = (a: any, b: any) =>
            a === b ? 0 : a > b ? 1 : -1;
        } else if (ss?.direction === 'desc') {
          col.sortComparator = (a: any, b: any) =>
            a === b ? 0 : a > b ? -1 : 1;
        }
      }
      if (filteringEnabled) {
        const fe = filteringEnabled.find((f) => f.columnName === c.name);
        if (fe) {
          col.filterable = fe.filteringEnabled;
        }
      }
      return col;
    });
    return colSpec;
  }, [
    columns,
    columnWidths,
    columnFormatting,
    columnSorting,
    sortingEnabled,
    sorting,
    filteringEnabled,
    numCols,
  ]);

  const myRows =
    rows.length > 0 && !rows[0]?.id
      ? rows.map((r, i) => ({ ...r, id: i }))
      : rows;

  return (
    <DataGrid
      rows={myRows.length > 0 ? myRows : [{ id: -1 }]}
      columns={colSpec}
      checkboxSelection
      rowSelectionModel={rowSelectionModel}
      onRowSelectionModelChange={handleRowSelectionModelChange}
      localeText={localeText}
    />
  );
}
export default DataTable;
