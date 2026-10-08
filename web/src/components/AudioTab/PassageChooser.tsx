import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IMediaTabStrings,
  ISharedStrings,
  IState,
  PassageD,
} from '../../model';
import {
  Box,
  debounce,
  FormControlLabel,
  Radio,
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
import { mediaTabSelector, sharedSelector } from '../../selector';
import { Button } from '../../control';
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
  const ts: ISharedStrings = useSelector(sharedSelector);
  const { doAttach, setVisible, setUploadMedia, mediaRow } = props;
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const boxRef = useRef<HTMLDivElement>(null);
  const [addWidth, setAddWidth] = useState(0);

  const [selectedId, setSelectedId] = useState<number | undefined>();

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

  const handleSelect = (id: number) => {
    setSelectedId(id);
  };

  const handleSave = () => {
    let mRow = row;
    if (uploadMedia) {
      mRow = mediaRow(uploadMedia);
      setUploadMedia(undefined);
    }
    // selectedId will be defined (otherwise the Save button
    // would have been disabled) but check for Typescript's sake
    if (visible && mRow >= 0 && selectedId !== undefined) {
      doAttach(mRow, selectedId);
      setVisible(false);
    }
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
        <Table
          size="small"
          stickyHeader
          variant="striped"
          sx={{ '& thead th': { backgroundColor: 'custom.headerBackground' } }}
        >
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell sx={{ width: colWidth }}>{organizedBy}</TableCell>
              <TableCell sx={{ width: colWidth }}>{t.reference}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell padding="checkbox">
                  <Radio
                    checked={selectedId === r.id}
                    onChange={() => handleSelect(r.id)}
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
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 2 }}>
        <Button
          id="passageChooserSave"
          color="primary"
          onClick={handleSave}
          disabled={selectedId === undefined}
        >
          {ts.save}
        </Button>
      </Box>
    </Box>
  );
};

export default PassageChooser;
