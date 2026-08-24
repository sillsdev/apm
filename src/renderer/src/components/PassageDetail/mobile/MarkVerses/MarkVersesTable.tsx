import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import EditIcon from '@mui/icons-material/Edit';
import { useRef, useState, type RefObject } from 'react';
import { LightTooltip } from '../../../../control/LightTooltip';
import {
  isMarkVersesTableRowCompleted,
  MARK_VERSES_COMPLETED_RGBA,
  MARK_VERSES_CURRENT_RGBA,
  RefStatus,
} from '../../../../utils/markVersesSegmentColors';
import type { ICell } from './PassageDetailMarkVerses';
import { Button } from '../../../../control';

interface MarkVersesTableProps {
  data: ICell[][];
  onRowSelect?: (rowIndex: number) => void;
  /** Commit a hand-typed reference for the given data-row index. */
  onReferenceEdit?: (rowIndex: number, value: string) => void;
  /** Whether the user may hand-edit references inline. */
  canEdit?: boolean;
  /** Open the Edit Reference dialog for the given data-row index. */
  onEditReference?: (rowIndex: number) => void;
  /** Whether the Edit Reference button may be shown (respects permissions). */
  canEditReference?: boolean;
  /** Localized text shown on the Edit Reference button (e.g. "Edit"). */
  editLabel?: string;
  /** Localized label used as the Edit Reference button's tooltip / aria-label. */
  editReferenceLabel?: string;
  tableRowRefs?: RefObject<(HTMLTableRowElement | null)[]>;
}

enum ColName {
  Limits,
  Ref,
}

export default function MarkVersesTable({
  data,
  onRowSelect,
  onReferenceEdit,
  canEdit,
  onEditReference,
  canEditReference,
  editLabel,
  editReferenceLabel,
  tableRowRefs,
}: MarkVersesTableProps) {
  const rows = data.slice(1);
  const header = data[0] ?? [];

  // Inline reference editing: which data-row index is in edit mode, plus its
  // draft text. Escape cancels via `cancelEditRef` so the shared blur path can
  // tell a discard from a commit.
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const cancelEditRef = useRef(false);

  const beginEdit = (rowIndex: number, current: string) => {
    setDraft(current);
    setEditingRow(rowIndex);
  };

  const finishEdit = (rowIndex: number) => {
    const cancelled = cancelEditRef.current;
    cancelEditRef.current = false;
    setEditingRow(null);
    if (!cancelled) onReferenceEdit?.(rowIndex, draft);
  };

  return (
    <TableContainer
      component={Paper}
      id="verse-sheet"
      data-testid="verse-sheet"
      sx={{
        mt: 0.5,
        flex: '1 1 auto',
        minHeight: 0,
        overflowY: 'auto',
        width: '100%',
        maxWidth: 800,
        mx: 'auto',
        // Extra scrollable space below the last row so the user can scroll the
        // table up until no row is hidden behind the floating Discussions Fab
        // (position: fixed, bottom-right, ~40px tall, sitting just above the
        // mobile footer — see DiscussionPanel.tsx). Padding-bottom on the scroll
        // container is included in the scrollable area, giving that clearance.
        pb: 7,
      }}
    >
      <Table stickyHeader size="small" aria-label="mark verses table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 1.5 }}>
              {header[ColName.Limits]?.value ?? 'Start-Stop'}
            </TableCell>
            {/* Dedicated, always-present warning column so the reference text
                never shifts whether or not a row carries a warning icon. */}
            <TableCell padding="none" aria-hidden sx={{ width: 36 }} />
            <TableCell>{header[ColName.Ref]?.value ?? 'Reference'}</TableCell>
            {/* Action column: holds the Edit Reference button on the
                selected row; empty header keeps the columns aligned. */}
            <TableCell padding="none" aria-hidden sx={{ width: 88 }} />
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row, index) => {
            const limits = row[ColName.Limits] as ICell;
            const reference = row[ColName.Ref] as ICell;
            const invalid = reference.status === RefStatus.Err;
            const warn = reference.status === RefStatus.Warn;
            const isCurrentRow = (limits.className ?? '').includes('cur');
            const hasLimits = Boolean(limits.value);
            const rowIndex = index + 1;
            // Only rows backed by a segment (limits) can have their reference
            // hand-edited, mirroring the Edit Reference dialog's reach.
            const editable = Boolean(canEdit && onReferenceEdit && hasLimits);
            const isEditing = editingRow === rowIndex;
            const rowCompleted = isMarkVersesTableRowCompleted(
              data,
              index + 1,
              ColName.Limits
            );
            const rowBackground = isCurrentRow
              ? MARK_VERSES_CURRENT_RGBA
              : rowCompleted
                ? MARK_VERSES_COMPLETED_RGBA
                : 'background.paper';

            return (
              <TableRow
                key={`verse-row-${index}`}
                ref={(el) => {
                  if (tableRowRefs?.current) {
                    tableRowRefs.current[index] = el;
                  }
                }}
                data-row-index={index + 1}
                onClick={() => onRowSelect?.(index + 1)}
                sx={{
                  backgroundColor: rowBackground,
                  cursor: hasLimits ? 'pointer' : 'default',
                }}
              >
                <TableCell
                  sx={{
                    whiteSpace: 'nowrap',
                    width: '42%',
                    pl: 1.5,
                    backgroundColor: 'inherit',
                    py: 0.75,
                  }}
                  onClick={(event) => {
                    if (!hasLimits) return;
                    event.stopPropagation();
                    onRowSelect?.(index + 1);
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: limits.value ? 'text.primary' : 'text.disabled',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {limits.value || '-'}
                  </Typography>
                </TableCell>

                <TableCell
                  padding="none"
                  sx={{
                    width: 36,
                    backgroundColor: 'inherit',
                    py: 0.75,
                  }}
                  onClick={(event) => {
                    if (!hasLimits) return;
                    event.stopPropagation();
                    onRowSelect?.(rowIndex);
                  }}
                >
                  {/* Fixed-width slot reserved on every row so the warning icon
                      sits just left of the reference without shifting it. */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      width: 28,
                    }}
                  >
                    {warn || invalid ? (
                      <LightTooltip
                        id={`verse-reference-warning-tip-${rowIndex}`}
                        title={reference.warning ?? ''}
                        // On a touch device MUI's default 700ms long-press is
                        // required before a tooltip opens, so a tap on the
                        // warning icon never surfaced the message. Opening with
                        // no delay lets a tap show it (desktop hover is
                        // unaffected); the longer leave delay keeps it on screen
                        // long enough to read before it auto-dismisses.
                        enterTouchDelay={0}
                        leaveTouchDelay={4000}
                      >
                        {/* Wrap the icon in a span so LightTooltip's forwarded
                            className lands on the span, not the icon (which keeps
                            its own sx). The tap must not also select/seek the
                            row, so stop it from bubbling to the cell handler. */}
                        <Box
                          component="span"
                          onClick={(event) => event.stopPropagation()}
                          sx={{
                            display: 'inline-flex',
                            lineHeight: 0,
                            backgroundColor: 'transparent',
                          }}
                        >
                          <WarningIcon
                            aria-label={`verse-reference-warning-${rowIndex}`}
                            sx={{
                              color: 'warning.main',
                              backgroundColor: 'transparent',
                            }}
                          />
                        </Box>
                      </LightTooltip>
                    ) : null}
                  </Box>
                </TableCell>

                <TableCell
                  sx={{ backgroundColor: 'inherit', py: 0.75 }}
                  onClick={(event) => {
                    if (isEditing) {
                      event.stopPropagation();
                      return;
                    }
                    if (editable) {
                      // Click the reference to type into it directly
                      event.stopPropagation();
                      onRowSelect?.(rowIndex);
                      beginEdit(rowIndex, `${reference.value ?? ''}`);
                      return;
                    }
                    if (!hasLimits) return;
                    event.stopPropagation();
                    onRowSelect?.(rowIndex);
                  }}
                >
                  {isEditing ? (
                    <TextField
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => finishEdit(rowIndex)}
                      autoFocus
                      variant="standard"
                      size="small"
                      fullWidth
                      inputProps={{
                        'aria-label': `verse-reference-input-${rowIndex}`,
                        // onKeyDown must live on the native input (not the
                        // TextField root) so `currentTarget` is the input and
                        // `.blur()` actually commits via onBlur. Enter commits,
                        // Escape cancels.
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            cancelEditRef.current = true;
                            event.currentTarget.blur();
                          }
                        },
                      }}
                      sx={{
                        '& input': {
                          fontSize: (theme) => theme.typography.body2.fontSize,
                        },
                      }}
                    />
                  ) : (
                    <Typography
                      variant="body2"
                      aria-label={`verse-reference-${rowIndex}`}
                      sx={{
                        color: invalid ? 'error.main' : 'text.primary',
                      }}
                    >
                      {reference.value || '-'}
                    </Typography>
                  )}
                </TableCell>

                {/* Edit Reference button — rendered on every row but only
                    visible on the current (highlighted) row, so the control
                    sits beside the segment the user is working on. The cell is
                    always present to keep the column width stable. Its `py`
                    gives the button breathing room above/below within the row.
                    Sizing is font-relative (line-height + padding, no fixed
                    height) so it adapts when the label is localized. */}
                <TableCell
                  padding="none"
                  align="right"
                  sx={{
                    width: 88,
                    backgroundColor: 'inherit',
                    py: 0.5,
                    // Keep the button clear of the table's right edge so it
                    // reads as an action rather than being jammed in the corner.
                    pr: 2,
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {isCurrentRow &&
                  canEditReference &&
                  onEditReference &&
                  hasLimits ? (
                    <LightTooltip
                      id={`verse-edit-reference-tip-${rowIndex}`}
                      title={editReferenceLabel ?? ''}
                    >
                      <Button
                        aria-label={`verse-edit-reference-${rowIndex}`}
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditReference(rowIndex);
                        }}
                        sx={{
                          minWidth: 0,
                          // The theme pins small buttons to a fixed 36px height,
                          // but make this one more compact to fit nicely in the table row
                          height: 'auto',
                          minHeight: 0,
                          px: 1,
                          py: 0.25,
                          lineHeight: 1.4,
                          textTransform: 'none',
                          '& .MuiButton-startIcon': { mr: 0.25 },
                          '& .MuiButton-startIcon > svg': { fontSize: 16 },
                        }}
                      >
                        {editLabel ?? 'Edit'}
                      </Button>
                    </LightTooltip>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
