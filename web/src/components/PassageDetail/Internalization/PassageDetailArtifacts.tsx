import AddResource from './AddResource';
import SortableHeader from './SortableHeader';
import { Button } from '../../../control';
import { SortableItem } from '.';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import LimitedMediaPlayer from '../../LimitedMediaPlayer';
import {
  Badge,
  Box,
  BoxProps,
  Grid,
  Stack,
  styled,
  useTheme,
} from '@mui/material';
import { PassageResourceButton } from './PassageResourceButton';
import { VertListDnd } from '../../../hoc/VertListDnd';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { mediaContentType } from '../../../utils/contentType';
import { MarkDownView } from '../../../control/MarkDownView';
import { usePassageDetailArtifacts } from './usePassageDetailArtifacts';
import { PassageDetailArtifactsDialogs } from './PassageDetailArtifactsDialogs';

const MediaContainer = styled(Box)<BoxProps>(({ theme }) => ({
  marginRight: theme.spacing(2),
  marginTop: theme.spacing(1),
  width: '100%',
  '& audio': {
    height: '40px',
    display: 'flex',
    width: 'inherit',
  },
}));

export function PassageDetailArtifacts() {
  const theme = useTheme();
  const { handleItemTogglePlay } = usePassageDetailContext();
  const state = usePassageDetailArtifacts({ removeMediaOnCancel: true });
  const {
    t,
    ts,
    playItem,
    itemPlaying,
    offline,
    offlineOnly,
    hasPermission,
    modifiable,
    isScripture,
    otherResourcesAvailable,
    allResources,
    selectedRows,
    sortKey,
    mediaStart,
    mediaEnd,
    handleAction,
    handleFindVisible,
    handleAllResources,
    handlePlay,
    handleEnded,
    handleDisplayId,
    handleLinkId,
    handleMarkDownId,
    handleDone,
    handleDelete,
    handleEdit,
    onSortEnd,
    markDown,
    setMarkDown,
  } = state;

  const handleLoaded = () => {
    if (playItem !== '' && !itemPlaying) {
      setTimeout(() => handleItemTogglePlay(), 1000);
    }
  };

  return (
    <>
      <Stack sx={{ width: '100%', my: 2, pl: 2 }} direction="row" spacing={1}>
        <Grid
          container
          size={12}
          spacing={theme.layout.p}
          wrap="nowrap"
          sx={{
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            width: '100%',
            overflow: 'hidden',
          }}
        >
          {isScripture && (
            <Grid sx={{ flexShrink: 0 }}>
              <Button disableTypography onClick={() => handleFindVisible(true)}>
                <Badge badgeContent={`(${ts.ai})`}>{t.research}</Badge>
              </Button>
            </Grid>
          )}
          {hasPermission && (!offline || offlineOnly) && (
            <Grid sx={{ flexShrink: 0 }}>
              <AddResource action={handleAction} />
            </Grid>
          )}
          {playItem !== '' && (
            <Grid
              sx={{
                width: '50%',
                minWidth: 0,
                flexShrink: 1,
                overflow: 'hidden',
              }}
            >
              <MediaContainer>
                <LimitedMediaPlayer
                  srcMediaId={playItem}
                  requestPlay={itemPlaying}
                  onEnded={handleEnded}
                  onLoaded={handleLoaded}
                  onTogglePlay={handleItemTogglePlay}
                  controls={playItem !== ''}
                  limits={{ start: mediaStart ?? 0, end: mediaEnd ?? 0 }}
                />
              </MediaContainer>
            </Grid>
          )}
          {otherResourcesAvailable && (
            <Grid sx={{ flexShrink: 0 }}>
              <PassageResourceButton
                value={allResources}
                label={t.allResources}
                cb={handleAllResources}
              />
            </Grid>
          )}
        </Grid>
      </Stack>
      <SortableHeader showDragHandle={modifiable} />
      <VertListDnd
        key={`sort-${sortKey}`}
        onDrop={onSortEnd}
        dragHandle
        isDragDisabled={!modifiable}
      >
        {selectedRows.map((value) => (
          <SortableItem
            key={`item-${value.id}`}
            value={value as any}
            contentType={mediaContentType(value.mediafile)}
            isPlaying={playItem === value.id && itemPlaying}
            onPlay={handlePlay}
            onView={handleDisplayId}
            onLink={handleLinkId}
            onMarkDown={handleMarkDownId}
            onDone={handleDone}
            onDelete={modifiable ? handleDelete : undefined}
            onEdit={modifiable ? handleEdit : undefined}
            showDragHandle={modifiable}
          />
        ))}
      </VertListDnd>
      <PassageDetailArtifactsDialogs
        state={state}
        variant="desktop"
        markDownDialog={
          markDown && (
            <BigDialog
              title={t.textResource}
              isOpen={Boolean(markDown)}
              onOpen={() => setMarkDown('')}
              bp={BigDialogBp.sm}
            >
              <MarkDownView value={markDown} />
            </BigDialog>
          )
        }
      />
    </>
  );
}

export default PassageDetailArtifacts;
