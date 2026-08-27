import { useState, useEffect, useMemo, useRef } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import { useSelector, shallowEqual } from 'react-redux';
import { passageDetailArtifactsSelector } from '../../../selector';
import {
  IState,
  PassageD,
  SectionD,
  Plan,
  IPassageDetailArtifactsStrings,
  ISharedStrings,
} from '../../../model';
import {
  Box,
  Checkbox,
  debounce,
  IconButton,
  Paper,
  PaperProps,
  styled,
} from '@mui/material';
import { findRecord, useOrganizedBy, usePlanType } from '../../../crud';
import { sharedSelector } from '../../../selector';
import { RecordIdentity } from '@orbit/records';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import { ActionRow, GrowingSpacer } from '../../../control';
import {
  buildSelectSectionRows,
  SelectSectionRow,
} from './buildSelectSectionRows';
import { Button } from '../../../control/Button';

const StyledPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  marginBottom: theme.spacing(1),
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  overflow: 'auto',
  paddingTop: theme.spacing(2),
}));

type IRow = SelectSectionRow;

interface IProps {
  initialItems?: RecordIdentity[];
  onSelect?: (items: RecordIdentity[]) => void;
  onCancel?: () => void;
}

export function SelectSections(props: IProps) {
  const { initialItems, onSelect, onCancel } = props;
  const initialSelectionKey = (initialItems ?? [])
    .map((item) => `${item.type}:${item.id}`)
    .join('|');
  const passages = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<SectionD[]>('section');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); //will be constant here
  const [data, setData] = useState(Array<IRow>());
  const [heightStyle, setHeightStyle] = useState({
    maxHeight: `${window.innerHeight - 200}px`,
  });
  const { getOrganizedBy } = useOrganizedBy();
  // User cannot change the language while dialog is open, so for now it should be okay if this component does not
  // respond to changes in the language setting until the dialog is reopened.
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const ta: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const setDimensions = () => {
    setHeightStyle({
      maxHeight: `${window.innerHeight - 200}px`,
    });
  };
  const planType = usePlanType();
  const boxRef = useRef<HTMLDivElement>(null);
  const [tableHeight, setTableHeight] = useState<number>(300);

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const planRec = useMemo(
    () => findRecord(memory, 'plan', plan) as Plan | undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );

  const isFlat = useMemo(() => {
    return planType(plan)?.flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  useEffect(() => {
    setData(
      buildSelectSectionRows({
        passages,
        sections,
        bookData: allBookData,
        planId: planRec?.id,
        isFlat: Boolean(isFlat),
        organizedBy: getOrganizedBy(true),
      })
    );
    if (boxRef.current) {
      const height =
        boxRef.current.parentNode?.parentNode?.parentElement?.clientHeight;
      setTableHeight((height ?? 300) - 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, passages, sections, allBookData, isFlat]);

  useEffect(() => {
    setSelected(
      new Set(initialSelectionKey ? initialSelectionKey.split('|') : [])
    );
  }, [initialSelectionKey]);

  const toggleSection = (sectionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      const sectionKey = `section:${sectionId}`;
      const passageKeys = data
        .filter((row) => row.parentId === sectionId)
        .map((row) => `passage:${row.recId}`);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
        passageKeys.forEach((key) => next.delete(key));
      } else {
        next.add(sectionKey);
        passageKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const togglePassage = (passageId: string, sectionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      const passageKey = `passage:${passageId}`;
      if (next.has(passageKey)) next.delete(passageKey);
      else next.add(passageKey);

      const passageKeys = data
        .filter((row) => row.parentId === sectionId)
        .map((row) => `passage:${row.recId}`);
      const sectionKey = `section:${sectionId}`;
      if (passageKeys.length > 0 && passageKeys.every((key) => next.has(key))) {
        next.add(sectionKey);
      } else {
        next.delete(sectionKey);
      }
      return next;
    });
  };

  const handleSelected = () => {
    const results = data
      .filter((row) => selected.has(`${row.kind}:${row.recId}`))
      .map((row) => ({ type: row.kind, id: row.recId })) as RecordIdentity[];
    onSelect?.(results);
  };

  const columns: GridColDef<IRow>[] = [
    {
      field: 'selected',
      headerName: '',
      width: 52,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      display: 'flex',
      align: 'center',
      cellClassName: 'select-cell',
      renderCell: ({ row }) => {
        if (row.kind === 'section') {
          const isSelected = selected.has(`section:${row.recId}`);
          return (
            <IconButton
              aria-label={`Select all passages in ${row.name}`}
              aria-pressed={isSelected}
              onClick={() => toggleSection(row.recId)}
              size="small"
              sx={{ p: 0.5, color: 'text.primary' }}
            >
              <DoneAllIcon fontSize="small" />
            </IconButton>
          );
        }
        return (
          <Checkbox
            aria-label={row.name}
            checked={selected.has(`passage:${row.recId}`)}
            onChange={() => togglePassage(row.recId, row.parentId)}
            size="small"
            sx={{
              p: 0.5,
              color: 'text.primary',
              '&.Mui-checked': { color: 'text.primary' },
            }}
          />
        );
      },
    },
    {
      field: 'name',
      headerName: '',
      flex: 1,
      minWidth: 240,
      sortable: false,
      cellClassName: ({ row }) => (row.kind === 'passage' ? 'passage-row' : ''),
    },
  ];

  return (
    <Box
      id="SelectSections"
      ref={boxRef}
      sx={{ pt: 2, display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <StyledPaper
        id="PassageList"
        style={heightStyle}
        sx={{ flex: 1, minHeight: 0 }}
      >
        <DataGrid
          columns={columns}
          rows={data}
          disableColumnResize
          disableRowSelectionOnClick
          hideFooter
          columnHeaderHeight={0}
          rowHeight={40}
          getRowClassName={({ indexRelativeToCurrentPage }) =>
            indexRelativeToCurrentPage % 2 === 0 ? 'even-row' : 'odd-row'
          }
          sx={{
            border: 0,
            maxHeight: tableHeight,
            '& .MuiDataGrid-cell': { borderBottom: 0 },
            '& .select-cell': {
              px: 0.5,
              borderRight: 1,
              borderColor: 'divider',
            },
            '& .even-row': { backgroundColor: 'background.paper' },
            '& .odd-row': { backgroundColor: 'action.hover' },
            '& .passage-row': { pl: 1 },
          }}
        />
      </StyledPaper>
      <ActionRow>
        <GrowingSpacer />
        <Button id="select-sections-cancel" onClick={onCancel}>
          {ts.cancel}
        </Button>
        <Button
          id="select-sections-next"
          color="primary"
          onClick={handleSelected}
          disabled={selected.size === 0}
        >
          {ta.next}
        </Button>
      </ActionRow>
    </Box>
  );
}

export default SelectSections;
