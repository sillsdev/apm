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
import {
  ActionRow,
  AltButton,
  GrowingSpacer,
  PriButton,
} from '../../../control';
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
  /**
   * `candidates` is every identity offered by the dialog; the caller needs it to
   * limit cleanup of unselected assignments to what the user could actually see.
   */
  onSelect?: (items: RecordIdentity[], candidates: RecordIdentity[]) => void;
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

  /** `passage:<id>` keys of each section's passage rows, by section id. */
  const passageKeysBySection = useMemo(() => {
    const keys = new Map<string, string[]>();
    data.forEach((row) => {
      if (row.kind !== 'passage') return;
      const sectionKeys = keys.get(row.parentId) ?? [];
      sectionKeys.push(`passage:${row.recId}`);
      keys.set(row.parentId, sectionKeys);
    });
    return keys;
  }, [data]);

  /**
   * A section's own selection is independent of its passages: this button bulk
   * toggles the passage rows (its label says so), and only stands in for the
   * section itself when there are no passage rows (flat plans, TT-6936).
   * A section-level assignment coming from `initialItems` is left alone so that
   * ticking passages cannot silently delete it.
   */
  const toggleSection = (sectionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      const passageKeys = passageKeysBySection.get(sectionId) ?? [];
      if (passageKeys.length === 0) {
        const sectionKey = `section:${sectionId}`;
        if (next.has(sectionKey)) next.delete(sectionKey);
        else next.add(sectionKey);
        return next;
      }
      const allSelected = passageKeys.every((key) => next.has(key));
      passageKeys.forEach((key) =>
        allSelected ? next.delete(key) : next.add(key)
      );
      return next;
    });
  };

  const togglePassage = (passageId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      const passageKey = `passage:${passageId}`;
      if (next.has(passageKey)) next.delete(passageKey);
      else next.add(passageKey);
      return next;
    });
  };

  const isSectionSelected = (sectionId: string) => {
    const passageKeys = passageKeysBySection.get(sectionId) ?? [];
    return passageKeys.length === 0
      ? selected.has(`section:${sectionId}`)
      : passageKeys.every((key) => selected.has(key));
  };

  const handleSelected = () => {
    const identities = (rows: IRow[]) =>
      rows.map((row) => ({
        type: row.kind,
        id: row.recId,
      })) as RecordIdentity[];
    onSelect?.(
      identities(
        data.filter((row) => selected.has(`${row.kind}:${row.recId}`))
      ),
      identities(data)
    );
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
          const isSelected = isSectionSelected(row.recId);
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
            onChange={() => togglePassage(row.recId)}
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
      cellClassName: ({ row }) =>
        row.kind === 'passage' ? 'passage-row' : '',
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
        <AltButton id="select-sections-cancel" onClick={onCancel}>
          {ts.cancel}
        </AltButton>
        <PriButton
          id="select-sections-next"
          onClick={handleSelected}
          disabled={selected.size === 0}
        >
          {ta.next}
        </PriButton>
      </ActionRow>
    </Box>
  );
}

export default SelectSections;
