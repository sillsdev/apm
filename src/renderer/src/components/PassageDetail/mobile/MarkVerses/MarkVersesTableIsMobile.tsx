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
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useRef, useState, type RefObject } from 'react';
import { LightTooltip } from '../../../../control/LightTooltip';
import {
  isMarkVersesTableRowCompleted,
  MARK_VERSES_COMPLETED_RGBA,
  MARK_VERSES_CURRENT_RGBA,
} from '../../../../utils/markVersesSegmentColors';
import type { ICell } from './PassageDetailMarkVersesIsMobile';

interface MarkVersesTableIsMobileProps {
  data: ICell[][];
  onRowSelect?: (rowIndex: number) => void;
  /** Commit a hand-typed reference for the given data-row index. */
  onReferenceEdit?: (rowIndex: number, value: string) => void;
  /** Whether the user may hand-edit references inline. */
  canEdit?: boolean;
  tableRowRefs?: RefObject<(HTMLTableRowElement | null)[]>;
}

enum ColName {
  Limits,
  Ref,
}

export default function MarkVersesTableIsMobile({
  data,
  onRowSelect,
  onReferenceEdit,
  canEdit,
  tableRowRefs,
}: MarkVersesTableIsMobileProps) {
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
      }}
    >
      <Table stickyHeader size="small" aria-label="mobile mark verses table">
        <TableHead>
          <TableRow>
            <TableCell>
              {header[ColName.Limits]?.value ?? 'Start-Stop'}
            </TableCell>
            <TableCell>{header[ColName.Ref]?.value ?? 'Reference'}</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.map((row, index) => {
            const limits = row[ColName.Limits] as ICell;
            const reference = row[ColName.Ref] as ICell;
            const invalid = reference.className?.includes('Err');
            const warn = reference.className?.includes('Warn');
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
                  sx={{ backgroundColor: 'inherit', py: 0.75 }}
                  onClick={(event) => {
                    if (isEditing) {
                      event.stopPropagation();
                      return;
                    }
                    if (editable) {
                      // Click the reference to type into it directly; the limits
                      // cell and the rest of the row still seek the segment.
                      event.stopPropagation();
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
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelEditRef.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                      onBlur={() => finishEdit(rowIndex)}
                      autoFocus
                      variant="standard"
                      size="small"
                      fullWidth
                      inputProps={{
                        'aria-label': `verse-reference-input-${rowIndex}`,
                      }}
                      sx={{
                        '& input': {
                          fontSize: (theme) => theme.typography.body2.fontSize,
                        },
                      }}
                    />
                  ) : (
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        aria-label={`verse-reference-${rowIndex}`}
                        sx={{
                          color: invalid ? 'error.main' : 'text.primary',
                        }}
                      >
                        {reference.value || '-'}
                      </Typography>
                      {warn ? (
                        <LightTooltip
                          id={`verse-reference-warning-tip-${rowIndex}`}
                          title={reference.warning ?? ''}
                        >
                          <WarningAmberIcon
                            fontSize="small"
                            color="warning"
                            aria-label={`verse-reference-warning-${rowIndex}`}
                          />
                        </LightTooltip>
                      ) : null}
                    </Box>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
