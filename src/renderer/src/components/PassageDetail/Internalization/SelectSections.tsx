import { useState, useEffect, useMemo } from 'react';
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
  debounce,
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
  marginBottom: theme.spacing(1),
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  overflow: 'auto',
}));

type IRow = SelectSectionRow;

interface IProps {
  initialItems?: RecordIdentity[];
  /** Visual resources are written immediately, so the button says so. */
  visual?: boolean;
  /**
   * True when clicking Next now performs the (deferred) media upload — the
   * new-add general-resource flow. The button then reads "Upload" instead of
   * "Next". Editing an existing resource leaves this false (Next just advances
   * to the configure step; the media already exists).
   */
  uploadsOnNext?: boolean;
  /**
   * True while the deferred upload triggered by this dialog's Upload button is
   * in flight. The dialog stays open (so selections survive) with the button
   * disabled and a spinner; on success the caller advances to the configure
   * step, on failure it re-enables so the user can retry without re-selecting.
   */
  uploading?: boolean;
  /**
   * `candidates` is every identity offered by the dialog; the caller needs it to
   * limit cleanup of unselected assignments to what the user could actually see.
   */
  onSelect?: (items: RecordIdentity[], candidates: RecordIdentity[]) => void;
}

export function SelectSections(props: IProps) {
  const { initialItems, visual, uploadsOnNext, uploading, onSelect } = props;
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
  const ta: IPassageDetailArtifactsStrings = useSelector(
    passageDetailArtifactsSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const setDimensions = () => {
    setHeightStyle({
      maxHeight: `${window.innerHeight - 200}px`,
    });
  };
  const planType = usePlanType();

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
   * A section's checkbox has its own selection state, independent of its
   * passages. Checking a section is the one cross-influence: as a convenience it
   * also checks every passage in the section. Unchecking a section only clears
   * the section itself and leaves its passages as they were.
   */
  const toggleSection = (sectionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      const sectionKey = `section:${sectionId}`;
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
        // Checking a section checks all of its passages (default behavior).
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

  /** Tick every row's box, or clear them all when everything is already ticked. */
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
    // Section and passage checkboxes are independent, so create an assignment
    // for each row whose own box is ticked: a checked section yields a section
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
      sx={{ pt: 2, display: 'flex', flexDirection: 'column', height: '100%' }}
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
      <StyledPaper
        id="PassageList"
        style={heightStyle}
        sx={{ flex: 1, minHeight: 0 }}
      >
        {/* Plain striped table (theme MuiTable variant="striped"); no row-hover
            tint, so hovering a row never greys it. The checkbox hover feedback
            is unaffected. */}
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
        <Box sx={{ ...rowSx, ml: 'auto', alignItems: 'center', gap: 1 }}>
          {uploading && <CircularProgress size={20} color="primary" />}
          <Button
            id="select-sections-next"
            color="primary"
            onClick={handleSelected}
            disabled={selected.size === 0 || uploading}
          >
            {visual ? ta.createResources : uploadsOnNext ? ts.upload : ta.next}
          </Button>
        </Box>
      </ActionRow>
    </Box>
  );
}

export default SelectSections;
