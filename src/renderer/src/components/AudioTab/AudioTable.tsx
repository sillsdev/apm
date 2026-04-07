import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { shallowEqual, useSelector } from 'react-redux';
import {
  IState,
  IMediaTabStrings,
  MediaFileD,
  SectionArray,
} from '../../model';
import { Box } from '@mui/material';
import TranscriptionShow from '../TranscriptionShow';
import MediaPlayer from '../MediaPlayer';
import Confirm from '../AlertDialog';
import {
  findRecord,
  PublishDestinationEnum,
  useOrganizedBy,
  usePublishDestination,
} from '../../crud';
import {
  useDataChanges,
  useWaitForRemoteQueue,
  doSort,
} from '../../utils';
import { IRow } from '.';
import { UpdateRecord } from '../../model/baseModel';
import { mediaTabSelector } from '../../selector';
import ConfirmPublishDialog from '../ConfirmPublishDialog';
import type { GridSortModel } from '@mui/x-data-grid';
import { AudioVersionCard } from '../../components/PassageDetail/mobile/record/AudioVersionCard';
import { isElectron } from '../../../api-variable';

interface IProps {
  data: IRow[];
  setRefresh: () => void;
  playItem: string;
  readonly: boolean;
  shared: boolean;
  canSetDestination: boolean;
  hasPublishing: boolean;
  sectionArr: SectionArray;
  setPlayItem: (item: string) => void;
  selectedId?: string;
  setSelectedId?: (item: string) => void;
  onAttach?: (checks: number[], attach: boolean) => void;
  /** Version dialog: show radio + selection highlight */
  showVersionRadio?: boolean;
}
export const AudioTable = (props: IProps) => {
  const { data: initialData, setRefresh } = props;
  const {
    playItem,
    setPlayItem,
    onAttach,
    readonly,
    shared,
    canSetDestination,
    hasPublishing,
    showVersionRadio,
  } = props;
  const t: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  const lang = useSelector((state: IState) => state.strings.lang);
  const [offline] = useGlobal('offline');
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [, setBusy] = useGlobal('remoteBusy');
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [confirmAction, setConfirmAction] = useState('');
  const [deleteItem, setDeleteItem] = useState(-1);
  const [showId, setShowId] = useState('');
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [publishItem, setPublishItem] = useState(-1);
  const [verValue, setVerValue] = useState<number>();
  const { getPublishTo, setPublishTo, isPublished, publishStatus } =
    usePublishDestination();
  const forceDataChanges = useDataChanges();
  const waitForRemoteQueue = useWaitForRemoteQueue();

  const [sortedData, setSortedData] = useState<IRow[]>([]);
  useEffect(() => {
    const sm: GridSortModel = onAttach
      ? [
          { field: 'planName', sort: 'asc' },
          { field: 'sectionDesc', sort: 'asc' },
          { field: 'reference', sort: 'asc' },
          { field: 'fileName', sort: 'asc' },
          { field: 'date', sort: 'desc' },
        ]
      : [{ field: 'version', sort: 'desc' }];
    setSortedData([...initialData].sort(doSort(sm)));
  }, [initialData, onAttach]);

  const handleShowTranscription = (id: string) => () => {
    const row = sortedData.find((r) => r.id === id);
    const rowVer = row?.version;
    if (rowVer) setVerValue(parseInt(rowVer, 10));
    setShowId(id);
  };
  const updateMediaRec = async (
    id: string,
    publishTo: PublishDestinationEnum[]
  ) => {
    const mediaRec = memory.cache.query((q) =>
      q.findRecord({ type: 'mediafile', id: id })
    ) as MediaFileD;
    mediaRec.attributes.publishTo = setPublishTo(publishTo);
    mediaRec.attributes.readyToShare = isPublished(publishTo);
    await memory.update((t) => UpdateRecord(t, mediaRec, user));
    await waitForRemoteQueue('publishTo');
    await forceDataChanges();
    setRefresh();
  };

  const publishConfirm = async (destinations: PublishDestinationEnum[]) => {
    await updateMediaRec(sortedData[publishItem].id, destinations);
    setPublishItem(-1);
  };
  const publishRefused = () => {
    setPublishItem(-1);
  };

  const handleChangeReadyToShare = (id: string) => () => {
    const index = sortedData.findIndex((r) => r.id === id);
    setPublishItem(index);
  };

  const handleCloseTranscription = () => {
    setShowId('');
  };

  const handleConfirmAction = (id: string) => {
    const index = sortedData.findIndex((r) => r.id === id);
    setDeleteItem(index);
    setConfirmAction('Delete');
  };

  const handleDelete = async (i: number) => {
    await memory.update((t) =>
      t.removeRecord({
        type: 'mediafile',
        id: sortedData[i].id,
      })
    );
    setBusy(false);
  };

  const handleActionConfirmed = () => {
    if (confirmAction === 'Delete') {
      handleDelete(deleteItem).then(() => {
        setDeleteItem(-1);
        setRefresh();
      });
    }
    setConfirmAction('');
  };

  const handleActionRefused = () => {
    setConfirmAction('');
    setDeleteItem(-1);
  };

  const handleSelect = (id: string) => {
    if (id === playItem) {
      if (mediaPlaying) setPlayItem('');
      setMediaPlaying(!mediaPlaying);
    } else {
      setPlayItem(id);
    }
  };

  useEffect(() => {
    if (playItem) setMediaPlaying(true);
  }, [playItem]);

  const playEnded = () => {
    setPlayItem('');
    setMediaPlaying(false);
  };

  const canCreate = useMemo(
    () => !offline || offlineOnly,
    [offline, offlineOnly]
  );

  const versionPickMode = Boolean(
    showVersionRadio ||
      props.selectedId !== undefined ||
      props.setSelectedId !== undefined
  );

  const [localSelectedId, setLocalSelectedId] = useState<string>('');
  const selectedId = props.selectedId ?? localSelectedId;
  const setSelectedIdInner = props.setSelectedId ?? setLocalSelectedId;

  const [expandedFileNameMediaId, setExpandedFileNameMediaId] = useState<
    string | null
  >(null);

  const setSelectedId = useCallback(
    (id: string) => {
      setExpandedFileNameMediaId((prev) =>
        prev && prev !== id ? null : prev
      );
      setSelectedIdInner(id);
    },
    [setSelectedIdInner]
  );

  const expandFileNameForMedia = useCallback(
    (id: string) => {
      setSelectedIdInner(id);
      setExpandedFileNameMediaId(id);
    },
    [setSelectedIdInner]
  );

  useEffect(() => {
    if (
      expandedFileNameMediaId &&
      !sortedData.some((r) => r.id === expandedFileNameMediaId)
    ) {
      setExpandedFileNameMediaId(null);
    }
  }, [sortedData, expandedFileNameMediaId]);

  useEffect(() => {
    if (!versionPickMode) return;
    if (props.selectedId || localSelectedId) return;
    const firstRowId = sortedData[0]?.id;
    if (firstRowId) {
      setLocalSelectedId(firstRowId);
    }
  }, [localSelectedId, props.selectedId, sortedData, versionPickMode]);

  const sheetAttach = Boolean(onAttach && !readonly);
  const showPublishing = shared || hasPublishing;

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '20rem',
        maxHeight: { xs: '20rem', sm: 'none' },
        overflowY: 'auto',
      }}
    >
      {sortedData.map((row) => {
        const canDelete = !readonly && !row.readyToShare;
        return (
          <AudioVersionCard
            key={row.id}
            {...row}
            isSelected={versionPickMode && row.id === selectedId}
            setIsSelected={setSelectedId}
            onSelectCard={
              versionPickMode ? () => setSelectedId(row.id) : undefined
            }
            lang={lang}
            handleSelect={handleSelect}
            playItem={playItem}
            mediaPlaying={mediaPlaying}
            showSelectionRadio={showVersionRadio}
            onShowTranscription={handleShowTranscription(row.id)}
            expandedFileNameId={expandedFileNameMediaId}
            setExpandedFileNameId={setExpandedFileNameMediaId}
            expandFileNameForMedia={expandFileNameForMedia}
            allowPlay={isElectron || canCreate}
            allowDownload={!onAttach || isElectron || canCreate}
            showMediaSheetMetadata={Boolean(onAttach)}
            sectionLabel={organizedBy}
            showAttachControl={sheetAttach}
            attached={Boolean(row.passId)}
            onAttachToggle={
              onAttach
                ? () => onAttach([row.index], !Boolean(row.passId))
                : undefined
            }
            canDeleteMedia={canDelete}
            onRequestDelete={
              canDelete ? () => handleConfirmAction(row.id) : undefined
            }
            showPublishControl={showPublishing}
            publishDisabled={
              (row.passId || '') === '' || !canSetDestination
            }
            onPublishClick={handleChangeReadyToShare(row.id)}
            publishStatusIcon={publishStatus(
              getPublishTo(row.publishTo, hasPublishing, shared, true)
            )}
          />
        );
      })}
      {publishItem !== -1 && (
        <ConfirmPublishDialog
          context="media"
          yesResponse={publishConfirm}
          noResponse={publishRefused}
          current={getPublishTo(
            sortedData[publishItem].publishTo,
            hasPublishing,
            shared,
            true
          )}
          sharedProject={shared}
          hasPublishing={hasPublishing}
          noDefaults={true}
          passageType={sortedData[publishItem]?.passageType}
        />
      )}
      {showId !== '' && (
        <TranscriptionShow
          id={showId}
          isMediaId={true}
          visible={showId !== ''}
          closeMethod={handleCloseTranscription}
          version={verValue}
        />
      )}
      {confirmAction === '' || (
        <Confirm
          text={t.deleteConfirm.replace(
            '{0}',
            sortedData[deleteItem].fileName
          )}
          yesResponse={handleActionConfirmed}
          noResponse={handleActionRefused}
        />
      )}
      <MediaPlayer
        srcMediaId={playItem}
        requestPlay={mediaPlaying}
        onEnded={playEnded}
      />
    </Box>
  );
};

export default AudioTable;
