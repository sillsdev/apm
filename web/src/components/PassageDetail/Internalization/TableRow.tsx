import { CSSProperties, ReactNode, useEffect, useState } from 'react';
import { Tooltip, Box, Stack } from '@mui/material';
import { IRow } from '../../../context/PassageDetailContext';
import { DragHandle } from '.';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { useOrganizedBy } from '../../../crud';
import { useSelector, shallowEqual } from 'react-redux';
import { resourceSelector } from '../../../selector';

/** What each column shows; an IRow fits, and so do built-in rows with no mediafile. */
export type TableRowValue = Pick<IRow, 'passageId'> &
  Record<
    | 'playItem'
    | 'artifactName'
    | 'version'
    | 'artifactType'
    | 'artifactCategory'
    | 'done'
    | 'editAction',
    ReactNode
  >;

interface IProps {
  value: TableRowValue;
  header?: boolean;
  showDragHandle?: boolean;
  /** Keeps the drag handle's space but hides it, for rows outside the sortable list. */
  fixed?: boolean;
}

export const TableRow = ({ value, header, showDragHandle, fixed }: IProps) => {
  const [headBold, setHeadBold] = useState<CSSProperties>({});
  const [headHide, setHeadHide] = useState<CSSProperties>({});
  const { getOrganizedBy } = useOrganizedBy();
  const t: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  useEffect(() => {
    setHeadBold(header ? { fontWeight: 'bold' } : {});
    setHeadHide(header ? { visibility: 'hidden' } : {});
  }, [header]);

  return (
    <Stack direction="row" sx={{ alignItems: 'center' }}>
      {showDragHandle && (
        <span style={fixed ? { visibility: 'hidden' } : headHide}>
          <DragHandle />
          {'\u00A0'}
        </span>
      )}
      <Box style={headBold} sx={{ minWidth: 100, textAlign: 'center' }}>
        {value.playItem}
      </Box>
      <Box
        style={headBold}
        sx={{
          width: 300,
          whiteSpace: 'normal',
          overflow: 'hidden',
          wordBreak: 'break-all',
        }}
      >
        {value.artifactName}
      </Box>
      <Box style={headBold} sx={{ minWidth: 100, textAlign: 'center' }}>
        {value.version}
      </Box>
      <Tooltip
        title={value.passageId ? t.passageResource : getOrganizedBy(true)}
      >
        <Box style={headBold} sx={{ minWidth: 200 }}>
          {value.artifactType}
        </Box>
      </Tooltip>
      <Box style={headBold} sx={{ minWidth: 200 }}>
        {value.artifactCategory}
      </Box>
      <Box style={headBold} sx={{ minWidth: 100, textAlign: 'center' }}>
        {value.done}
      </Box>
      <Box style={headBold} sx={{ minWidth: 100, textAlign: 'center' }}>
        {value.editAction}
      </Box>
    </Stack>
  );
};
