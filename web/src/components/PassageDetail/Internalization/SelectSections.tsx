import { useState, useMemo } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import { useSelector, shallowEqual } from 'react-redux';
import {
  passageDetailArtifactsSelector,
  sharedSelector,
} from '../../../selector';
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
  CircularProgress,
  Paper,
  PaperProps,
  styled,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@mui/material';
import { findRecord, useOrganizedBy, usePlanType } from '../../../crud';
import { RecordIdentity } from '@orbit/records';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { ActionRow, rowSx } from '../../../control';
import {
  buildSelectSectionRows,
  SelectSectionRow,
} from './buildSelectSectionRows';
import { Button } from '../../../control/Button';

const StyledPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  marginBottom: theme.spacing(2),
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  overflow: 'auto',
}));

type IRow = SelectSectionRow;

interface IProps {
  initialItems?: RecordIdentity[];
  uploadsOnNext?: boolean; // need to upload after selecting sections in the "deferred" flow of adding a new resource
  uploading?: boolean; // deferred upload is in flight, keep dialog open with button disabled and spinner, retry may be needed
  onSelect?: (items: RecordIdentity[], candidates: RecordIdentity[]) => void;
  onBack?: () => void; // show back button if present
}

export function SelectSections(props: IProps) {
  const { initialItems, uploadsOnNext, uploading, onSelect, onBack } = props;
  const passages = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<SectionD[]>('section');
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); // will be constant here
  const { getOrganizedBy } = useOrganizedBy();
  // There is no way for the user to change the language while dialog is open
  const ta: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  // Seeded once at mount; later changes to initialItems must not reset the
  // user's ticks (the wizard keeps this mounted across steps).
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set((initialItems ?? []).map((item) => `${item.type}:${item.id}`))
  );
  const planType = usePlanType();

  const planRec = useMemo(
    () => findRecord(memory, 'plan', plan) as Plan | undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan]
  );

  const isFlat = useMemo(() => {
    return planType(plan)?.flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const data = useMemo(
    () =>
      buildSelectSectionRows({
        passages,
        sections,
        bookData: allBookData,
        planId: planRec?.id,
        isFlat: Boolean(isFlat),
        organizedBy: getOrganizedBy(true),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, passages, sections, allBookData, isFlat]
  );

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
   * A section's checkbox has its own selection state, independent of its
   * passages. Checking a section also checks every passage in the section.
   * Unchecking a section only clears the section itself and leaves its passages as they were.
   */
  const toggleSection = (sectionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      const sectionKey = `section:${sectionId}`;
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
        (passageKeysBySection.get(sectionId) ?? []).forEach((key) =>
          next.add(key)
        );
      }
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

  const isSectionSelected = (sectionId: string) =>
    selected.has(`section:${sectionId}`);

  const rowKeys = () => data.map((row) => `${row.kind}:${row.recId}`);

  const allSelected =
    data.length > 0 && rowKeys().every((key) => selected.has(key));

  const toggleAll = () => {
    setSelected((current) =>
      rowKeys().every((key) => current.has(key))
        ? new Set<string>()
        : new Set(rowKeys())
    );
  };

  const handleSelected = () => {
    const identities = (rows: IRow[]) =>
      rows.map((row) => ({
        type: row.kind,
        id: row.recId,
      })) as RecordIdentity[];
    // Section and passage checkboxes are independent, a checked section yields a section
    // assignment, a checked passage a passage assignment.
    onSelect?.(
      identities(
        data.filter((row) => selected.has(`${row.kind}:${row.recId}`))
      ),
      identities(data)
    );
  };

  return (
    <Box
      id="SelectSections"
      sx={{
        pt: 2,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ ...rowSx, justifyContent: 'flex-start', pb: 1 }}>
        <Button
          id="select-sections-all"
          onClick={toggleAll}
          disabled={data.length === 0 || uploading}
        >
          {allSelected ? ta.deselectAll : ta.selectAll}
        </Button>
      </Box>
      <StyledPaper id="PassageList" sx={{ flex: '0 1 auto', minHeight: 0 }}>
        <Table
          size="small"
          variant="striped"
          sx={{ tableLayout: 'fixed', border: 1, borderColor: 'custom.black' }}
        >
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.id} sx={{ height: 40 }}>
                <TableCell
                  align="center"
                  sx={{
                    width: 52,
                    p: 0.5,
                    borderRight: 1,
                    borderColor: 'custom.black',
                    borderBottom: 0,
                  }}
                >
                  {row.kind === 'section' ? (
                    <Checkbox
                      aria-label={ta.selectSection.replace('{0}', row.name)}
                      checked={isSectionSelected(row.recId)}
                      onChange={() => toggleSection(row.recId)}
                      size="small"
                      sx={{
                        p: 0.5,
                        color: 'text.primary',
                        '&.Mui-checked': { color: 'text.primary' },
                      }}
                    />
                  ) : (
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
                  )}
                </TableCell>
                <TableCell
                  sx={{
                    minWidth: 240,
                    pl: 1,
                    borderBottom: 0,
                  }}
                >
                  {row.name}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </StyledPaper>
      <ActionRow>
        {onBack && (
          <Button
            id="select-sections-back"
            onClick={onBack}
            disabled={uploading}
          >
            {ta.back}
          </Button>
        )}
        <Box sx={{ ...rowSx, ml: 'auto', alignItems: 'center', gap: 1 }}>
          {uploading && <CircularProgress size={20} color="primary" />}
          <Button
            id="select-sections-next"
            color="primary"
            onClick={handleSelected}
            disabled={selected.size === 0 || uploading}
          >
            {uploadsOnNext ? ts.upload : ta.next}
          </Button>
        </Box>
      </ActionRow>
    </Box>
  );
}

export default SelectSections;
