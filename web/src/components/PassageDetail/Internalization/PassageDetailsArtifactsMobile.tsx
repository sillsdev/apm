import { useState } from 'react';
import AddResource from './AddResource';
import { IRow } from '../../../context/PassageDetailContext';
import { Button, GrowingSpacer } from '../../../control';
import { AudioResourceCard } from './mobile components/AudioResourceCard';
import { TextResourceCard } from './mobile components/TextResourceCard';
import { useRole, ArtifactTypeSlug } from '../../../crud';
import BigDialog from '../../../hoc/BigDialog';
import { BigDialogBp } from '../../../hoc/BigDialogBp';
import { MarkDownType, UriLinkType } from '../../MediaUpload';
import { Box, Stack, MenuItem, MenuList } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useMobile } from '../../../utils';
import { VertListDnd } from '../../../hoc/VertListDnd';
import { mediaContentType } from '../../../utils/contentType';
import { CompactMarkDownView } from '../../../control/MarkDownView';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import IconMenu from '../../../control/IconMenu';
import { usePassageDetailArtifacts } from './usePassageDetailArtifacts';
import { PassageDetailArtifactsDialogs } from './PassageDetailArtifactsDialogs';

export function PassageDetailArtifactsMobile() {
  const state = usePassageDetailArtifacts();
  const {
    t,
    ts,
    rowData,
    playItem,
    itemPlaying,
    offline,
    offlineOnly,
    hasPermission,
    modifiable,
    isScripture,
    otherResourcesAvailable,
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
    handleDone,
    handleDelete,
    handleEdit,
    onSortEnd,
    markDown,
    setMarkDown,
  } = state;
  const [markDownTitle, setMarkDownTitle] = useState('');
  const { userIsAdmin } = useRole();
  // Admins see badges for resources that are linked (shared) or general; other users don't.
  const typeBadge = (row: IRow) => {
    if (!userIsAdmin) return undefined;
    // The badge stays short: "General" where the Type column says
    // "General Resource".
    if (row.isGeneralResource) return t.general;
    if (row.artifactTypeSlug === ArtifactTypeSlug.SharedResource)
      return row.artifactType;
    return undefined;
  };
  const { isMobileWidth } = useMobile();
  const [expandedArtifactNameId, setExpandedArtifactNameId] = useState<
    string | null
  >(null);

  const handleMarkDownId = (id: string) => {
    setMarkDownTitle(
      rowData.find((r) => r.id === id)?.artifactName || t.textResource
    );
    state.handleMarkDownId(id);
  };

  return (
    <Box sx={{ maxWidth: '800px', margin: '0 auto' }}>
      <Stack sx={{ width: '100%' }} direction="row" spacing={1}>
        {isScripture && (
          <Box>
            <Button onClick={() => handleFindVisible(true)}>
              {t.research}
            </Button>
          </Box>
        )}
        {hasPermission && (!offline || offlineOnly) && !isMobileWidth && (
          <AddResource action={handleAction} />
        )}
        <GrowingSpacer />
        {otherResourcesAvailable && (
          <IconMenu icon={<SettingsOutlinedIcon />}>
            <MenuList dense>
              <MenuItem onClick={handleAllResources}>{t.allResources}</MenuItem>
            </MenuList>
          </IconMenu>
        )}
      </Stack>
      <Box sx={{ width: '100%' }}>
        <VertListDnd
          key={`sort-${sortKey}`}
          onDrop={onSortEnd}
          dragHandle
          dragHandleRegion="top-half"
          lockHorizontal
          itemSpacing={0.25}
          listPaddingX={0}
          itemPaddingX={0}
          isDragDisabled={!modifiable}
        >
          {selectedRows.map((value) => (
            <Box key={`item-${value.id}`} sx={{ width: '100%' }}>
              {mediaContentType(value.mediafile).startsWith('audio') ? (
                <AudioResourceCard
                  row={value}
                  subtitle={value.artifactCategory || undefined}
                  badge={typeBadge(value)}
                  isPlaying={playItem === value.id && itemPlaying}
                  onPlay={handlePlay}
                  expandedId={expandedArtifactNameId}
                  setExpandedId={setExpandedArtifactNameId}
                  onDone={handleDone}
                  onEdit={modifiable ? handleEdit : undefined}
                  onDelete={modifiable ? handleDelete : undefined}
                  onEnded={handleEnded}
                  limits={{ start: mediaStart ?? 0, end: mediaEnd ?? 0 }}
                />
              ) : (
                <TextResourceCard
                  row={value}
                  subtitle={value.artifactCategory || undefined}
                  badge={typeBadge(value)}
                  expandedId={expandedArtifactNameId}
                  setExpandedId={setExpandedArtifactNameId}
                  onView={
                    mediaContentType(value.mediafile) === UriLinkType
                      ? handleLinkId
                      : mediaContentType(value.mediafile) === MarkDownType
                        ? handleMarkDownId
                        : handleDisplayId
                  }
                  onDone={handleDone}
                  onEdit={modifiable ? handleEdit : undefined}
                  onDelete={modifiable ? handleDelete : undefined}
                />
              )}
            </Box>
          ))}
        </VertListDnd>
      </Box>
      <PassageDetailArtifactsDialogs
        state={state}
        variant="mobile"
        markDownDialog={
          markDown && (
            <BigDialog
              title={markDownTitle || t.textResource}
              titleStartAdornment={<VisibilityIcon fontSize="medium" />}
              titleVariant="h6"
              showTopCloseButton={false}
              showBottomCloseButton
              bottomCloseLabel={ts.close}
              paperOutlineColor="black"
              mobileThickScrollbar
              mobileNoHorizontalScroll
              isOpen={Boolean(markDown)}
              onOpen={() => {
                setMarkDown('');
                setMarkDownTitle('');
              }}
              bp={BigDialogBp.mobile}
            >
              <CompactMarkDownView value={markDown} wrapOverflow />
            </BigDialog>
          )
        }
      />
    </Box>
  );
}

export default PassageDetailArtifactsMobile;
