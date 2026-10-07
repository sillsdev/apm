import { useEffect, useMemo, useRef, useState } from 'react';
import { IMediaTabStrings, IState, PassageD } from '../../model';
import {
  Box,
  Checkbox,
  debounce,
  FormControlLabel,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';
import { findRecord, useOrganizedBy } from '../../crud';
import { GetReference, IPRow } from '.';
import { StatusL } from './getPassages';
import { useSelector } from 'react-redux';
import { mediaTabSelector } from '../../selector';
import { useGlobal } from '../../context/useGlobal';

interface IProps {
  data: IPRow[];
  row: number;
  doAttach: (row: number, pRow: number) => void;
  visible: boolean;
  setVisible: (visible: boolean) => void;
  uploadMedia: string | undefined;
  setUploadMedia: (uploadMedia: string | undefined) => void;
  mediaRow: (id: string) => number;
}

export const PassageChooser = (props: IProps) => {
  const { data, row, visible, uploadMedia } = props;
  const [memory] = useGlobal('memory');
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const t: IMediaTabStrings = useSelector(mediaTabSelector);
  const { doAttach, setVisible, setUploadMedia, mediaRow } = props;
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [pcheck, setCheck] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const [addWidth, setAddWidth] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const refCell = (pRow: IPRow) => {
    const passage = findRecord(memory, 'passage', pRow.passageId) as PassageD;
    return (
      <GetReference passage={[passage]} bookData={allBookData} flat={false} />
    );
  };

  const MinNameWidth = 150;
  const colWidth = MinNameWidth + addWidth / 2;

  const [showAttached, setShowAttached] = useState(false);

  // Filter (by the switch) and statically sort
  const rows = useMemo(
    () =>
      data
        .map((r, id) => ({ ...r, id }))
        .filter((r) =>
          showAttached ? r.attached === StatusL.Yes : r.attached !== StatusL.Yes
        )
        .sort((a, b) => String(a.sort).localeCompare(String(b.sort))),
    [data, showAttached]
  );

  const totalWidth = useMemo(() => 2 * MinNameWidth, []);

  // keep track of screen width
  const setDimensions = () => {
    const boxWidth = boxRef.current?.clientWidth ?? 0;
    setAddWidth(boxWidth > totalWidth ? boxWidth - totalWidth : 0);
  };

  useEffect(() => {
    setDimensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWidth]);

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);

    window.addEventListener('resize', handleResize);
    return () => {
      handleResize.clear();
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); //do this once to get the default;

  const handleAttachedFilterChange = (e: any) => {
    setShowAttached(e.target.checked);
  };

  const handleToggle = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const checks = Array.from(next);
    let mRow = row;
    if (uploadMedia) {
      mRow = mediaRow(uploadMedia);
      setUploadMedia(undefined);
    }
    if (visible && checks.length === 1 && mRow >= 0) {
      doAttach(mRow, checks[0]);
      setVisible(false);
      return;
    }
    const newId = checks[0] === pcheck ? checks[1] : checks[0];
    setCheck(newId);
    setSelectedIds(next);
  };

  return (
    <Box
      ref={boxRef}
      sx={{
        // Fixed height so the dialog stays the same size regardless of how many
        // rows the table has; the row list scrolls within this box.
        // So things don't jump around when the user toggles the filter
        height: '70vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <FormControlLabel
        value="attached"
        labelPlacement="end"
        control={
          <Switch
            checked={showAttached}
            onChange={handleAttachedFilterChange}
          />
        }
        label={t.alreadyAssociated}
      />
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell sx={{ width: colWidth }}>{organizedBy}</TableCell>
              <TableCell sx={{ width: colWidth }}>{t.reference}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedIds.has(r.id)}
                    onChange={() => handleToggle(r.id)}
                    slotProps={{
                      input: {
                        'aria-label': `${r.sectionDesc} ${r.reference}`.trim(),
                      },
                    }}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'break-spaces' }}>
                  {r.sectionDesc}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'break-spaces' }}>
                  {refCell(r)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

export default PassageChooser;
