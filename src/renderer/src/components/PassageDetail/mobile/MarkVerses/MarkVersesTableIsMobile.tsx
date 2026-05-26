import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { RefObject } from 'react';
import {
  isMarkVersesTableRowCompleted,
  MARK_VERSES_COMPLETED_RGBA,
  MARK_VERSES_CURRENT_RGBA,
} from '../../../../utils/markVersesSegmentColors';
import type { ICell } from './PassageDetailMarkVersesIsMobile';

interface MarkVersesTableIsMobileProps {
  data: ICell[][];
  onRowSelect?: (rowIndex: number) => void;
  tableRowRefs?: RefObject<(HTMLTableRowElement | null)[]>;
}

enum ColName {
  Limits,
  Ref,
}

export default function MarkVersesTableIsMobile({
  data,
  onRowSelect,
  tableRowRefs,
}: MarkVersesTableIsMobileProps) {
  const rows = data.slice(1);
  const header = data[0] ?? [];

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
            const isCurrentRow = (limits.className ?? '').includes('cur');
            const hasLimits = Boolean(limits.value);
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
                    if (!hasLimits) return;
                    event.stopPropagation();
                    onRowSelect?.(index + 1);
                  }}
                >
                  <Typography
                    variant="body2"
                    aria-label={`verse-reference-${index + 1}`}
                    sx={{
                      color: invalid ? 'error.main' : 'text.primary',
                    }}
                  >
                    {reference.value || '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
