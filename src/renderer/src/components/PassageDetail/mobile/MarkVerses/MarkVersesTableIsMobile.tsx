import {
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
import { alpha } from '@mui/material/styles';
import type { ChangeEvent, ClipboardEvent } from 'react';
import { getSegmentRegionColor } from '../../../../crud/useWavesurferRegions';
import type { ICell, ICellChange } from './PassageDetailMarkVersesIsMobile';

interface MarkVersesTableIsMobileProps {
  data: ICell[][];
  onCellsChanged: (changes: Array<ICellChange>) => void;
  onParsePaste: (clipboard: string) => any[];
  onRowSelect?: (rowIndex: number) => void;
}

enum ColName {
  Limits,
  Ref,
}

export default function MarkVersesTableIsMobile({
  data,
  onCellsChanged,
  onParsePaste,
  onRowSelect,
}: MarkVersesTableIsMobileProps) {
  const rows = data.slice(1);
  const header = data[0] ?? [];

  const handleReferenceChange = (rowIndex: number, value: string) => {
    onCellsChanged([
      {
        cell: null,
        row: rowIndex + 1,
        col: ColName.Ref,
        value,
      },
    ]);
  };

  const handleReferencePaste = (
    event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    rowIndex: number
  ) => {
    const clipboard = event.clipboardData.getData('text');
    const parsed = onParsePaste(clipboard);

    if (!parsed.length) return;

    event.preventDefault();

    const changes = parsed.map((entry: string[] | string, offset: number) => ({
      cell: null,
      row: rowIndex + offset + 1,
      col: ColName.Ref,
      value: Array.isArray(entry) ? entry[0] : entry,
    }));

    onCellsChanged(changes);
  };

  const handleInputChange =
    (rowIndex: number) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleReferenceChange(rowIndex, event.target.value);
    };

  const handlePaste =
    (rowIndex: number) =>
    (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleReferencePaste(event, rowIndex);
    };

  return (
    <TableContainer
      component={Paper}
      id="verse-sheet"
      data-testid="verse-sheet"
      sx={{
        mt: 1,
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
            const rowColor = limits.value
              ? getSegmentRegionColor(index, 0.24)
              : 'transparent';

            return (
              <TableRow
                key={`verse-row-${index}`}
                onClick={() => onRowSelect?.(index + 1)}
                sx={(theme) => ({
                  backgroundColor: isCurrentRow
                    ? alpha(theme.palette.warning.main, 0.35)
                    : rowColor,
                })}
              >
                <TableCell
                  sx={{
                    whiteSpace: 'nowrap',
                    width: '42%',
                    backgroundColor: 'inherit',
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

                <TableCell sx={{ backgroundColor: 'inherit' }}>
                  <TextField
                    fullWidth
                    variant="standard"
                    value={reference.value || ''}
                    onChange={handleInputChange(index)}
                    disabled={reference.readOnly}
                    error={Boolean(invalid)}
                    inputProps={{
                      'aria-label': `verse-reference-${index + 1}`,
                      // Enabled during Edit Reference mode for tapping; typing still happens in the dialog.
                      readOnly: !reference.readOnly,
                      onPaste: reference.readOnly ? handlePaste(index) : undefined,
                    }}
                    sx={
                      reference.readOnly
                        ? {
                            // Disabled fields still capture clicks; row `onClick` uses pointer-events on the cell.
                            pointerEvents: 'none',
                          }
                        : undefined
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
