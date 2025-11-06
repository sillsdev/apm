/* eslint-disable react/default-props-match-prop-types */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { shallowEqual, useSelector } from 'react-redux';
import {
  IState,
  IMediaTabStrings,
  MediaFileD,
  UserD,
  // ISharedStrings,
  SectionArray,
} from '../../model';
import { Box, Button, debounce, IconButton } from '@mui/material';
// import BigDialog from '../../hoc/BigDialog';
// import VersionDlg from './VersionDlg';
import TranscriptionShow from '../TranscriptionShow';
import MediaPlayer from '../MediaPlayer';
import Confirm from '../AlertDialog';
import {
  findRecord,
  PublishDestinationEnum,
  useBible,
  useOrganizedBy,
  usePublishDestination,
} from '../../crud';
import {
  numCompare,
  dateCompare,
  dateOrTime,
  useDataChanges,
  useWaitForRemoteQueue,
  strNumCompare,
  doSort,
} from '../../utils';
import PlayCell from './PlayCell';
import DetachCell from './DetachCell';
import { IRow } from '.';
import { UpdateRecord } from '../../model/baseModel';
import { mediaTabSelector } from '../../selector';
import UserAvatar from '../UserAvatar';
import ConfirmPublishDialog from '../ConfirmPublishDialog';
import {
  DataGrid,
  GridColumnVisibilityModel,
  GridSortModel,
  type GridColDef,
} from '@mui/x-data-grid';

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
  onAttach?: (checks: number[], attach: boolean) => void;
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
  } = props;
  const t: IMediaTabStrings = useSelector(mediaTabSelector, shallowEqual);
  // const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const lang = useSelector((state: IState) => state.strings.lang);
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [memory] = useGlobal('memory');
  const [org] = useGlobal('organization');
  const [user] = useGlobal('user');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [, setBusy] = useGlobal('remoteBusy');
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [confirmAction, setConfirmAction] = useState('');
  const [deleteItem, setDeleteItem] = useState(-1);
  const [showId, setShowId] = useState('');
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [publishItem, setPublishItem] = useState(-1);
  const [hasBible, setHasBible] = useState(false);
  const { getOrgBible } = useBible();
  // const [verHist, setVerHist] = useState('');
  const [verValue, setVerValue] = useState<number>();
  const { getPublishTo, setPublishTo, isPublished, publishStatus } =
    usePublishDestination();
  const forceDataChanges = useDataChanges();
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const boxRef = useRef<HTMLDivElement>(null);
  const [addWidth, setAddWidth] = useState(0);
  const [sortModel, setSortModel] = useState<GridSortModel>([]);
  useEffect(() => {
    setSortModel(
      onAttach
        ? [
            { field: 'planName', sort: 'asc' },
            { field: 'fileName', sort: 'asc' },
            { field: 'date', sort: 'desc' },
          ]
        : [{ field: 'version', sort: 'desc' }]
    );
  }, [onAttach]);

  const sortedData = useMemo(
    () => [...initialData].sort(doSort(sortModel)),
    [initialData, sortModel]
  );

  const handleShowTranscription = (id: string) => () => {
    const row = sortedData.find((r) => r.id === id);
    const rowVer = row?.version;
    if (rowVer) setVerValue(parseInt(rowVer));
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

  const handleChangeReadyToShare = (i: number) => () => {
    setPublishItem(i);
  };

  const handleCloseTranscription = () => {
    setShowId('');
  };

  const handleConfirmAction = (i: number) => {
    setDeleteItem(i);
    setConfirmAction('Delete');
  };

  const handleDelete = async (i: number) => {
    await memory.update((t) =>
      t.removeRecord({
        type: 'mediafile',
        id: sortedData[i].id,
      })
    );
    setBusy(false); // forces refresh of plan tabs
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
    if (org) {
      const bible = getOrgBible(org);
      setHasBible((bible?.attributes.bibleName ?? '') !== '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  useEffect(() => {
    //if I set playing when I set the mediaId, it plays a bit of the old
    if (playItem) setMediaPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playItem]);

  // // const handleVerHistOpen = (passId: string) => () => {
  // //   setVerHist(passId);
  // // };
  // const handleVerHistClose = () => {
  //   setVerHist('');
  // };

  const playEnded = () => {
    setPlayItem('');
    setMediaPlaying(false);
  };

  const getUser = (id: string) => {
    return findRecord(memory, 'user', id) as UserD;
  };

  const nameCount = useMemo(() => sortedData.length, [sortedData]);

  const canCreate = useMemo(
    () => !offline || offlineOnly,
    [offline, offlineOnly]
  );

  const planCol: GridColDef<IRow> = {
    field: 'planName',
    headerName: t.planName,
    width: 150,
  };

  const versionCol: GridColDef<IRow> = {
    field: 'version',
    headerName: t.version,
    width: 70,
    align: 'right',
    sortComparator: strNumCompare, // data has strings but they contain numbers
    // renderCell: (params) => (
    //   <Button
    //     color="primary"
    //     onClick={handleVerHistOpen(params.row.passId)}
    //   >
    //     {params.value}
    //   </Button>
    // ),
  };

  const durationCol: GridColDef<IRow> = {
    field: 'duration',
    headerName: t.duration,
    width: 80,
    align: 'right',
    // sortComparator: numCompare, // duration is already formatted as HH:MM:SS
  };

  const dateCol: GridColDef<IRow> = {
    field: 'date',
    headerName: t.date,
    align: 'right',
    width: 100,
    sortComparator: dateCompare,
    renderCell: (params) => dateOrTime(params.value, lang),
  };

  const sizeCol: GridColDef<IRow> = {
    field: 'size',
    headerName: t.size,
    width: 80,
    align: 'right',
    sortComparator: numCompare,
  };

  const userCol: GridColDef<IRow> = {
    field: 'user',
    headerName: t.user,
    width: 70,
    renderCell: (params) => <UserAvatar userRec={getUser(params.value)} />,
  };

  const refCol: GridColDef<IRow> = {
    field: 'reference',
    headerName: t.reference,
    width: 150,
    renderCell: (params) => (
      <Button color="primary" onClick={handleShowTranscription(params.row.id)}>
        {params.value}
      </Button>
    ),
  };

  const MinSectionWidth = 170;

  const columns: GridColDef<IRow>[] = useMemo(
    () =>
      shared || hasPublishing
        ? [
            planCol,
            {
              field: 'actions',
              headerName: '\u00A0',
              align: 'center',
              width: onAttach ? 75 : 60,
              sortable: false,
              filterable: false,
              renderCell: (params) => (
                <PlayCell
                  {...params}
                  canCreate={canCreate}
                  onAttach={onAttach}
                  readonly={readonly}
                  handleSelect={handleSelect}
                  playItem={playItem}
                  mediaPlaying={mediaPlaying}
                />
              ),
            },
            versionCol,
            {
              field: 'publishTo',
              headerName: t.published,
              width: 100,
              renderCell: (params) => (
                <IconButton
                  onClick={handleChangeReadyToShare(params.row.index)}
                  disabled={
                    (params.row.passId || '') === '' || !canSetDestination
                  }
                >
                  {publishStatus(
                    getPublishTo(params.value, hasPublishing, shared, true)
                  )}
                </IconButton>
              ),
            },
            {
              field: 'fileName',
              headerName: `${t.fileName} (${nameCount})`,
              width: 205,
            },
            {
              field: 'sectionDesc',
              headerName: organizedBy,
              align: 'left',
              cellClassName: 'word-wrap',
              width: MinSectionWidth + addWidth,
            },
            refCol,
            userCol,
            durationCol,
            sizeCol,
            dateCol,
            {
              field: 'detach',
              headerName: '\u00A0',
              width: 83,
              sortable: false,
              renderCell: (params) => (
                <DetachCell
                  {...params}
                  canCreate={canCreate}
                  readonly={readonly}
                  handleConfirmAction={handleConfirmAction}
                />
              ),
            },
          ]
        : [
            planCol,
            {
              field: 'actions',
              headerName: '\u00A0',
              align: 'center',
              width: onAttach ? 75 : 60,
              sortable: false,
              filterable: false,
              renderCell: (params) => (
                <PlayCell
                  {...params}
                  canCreate={canCreate}
                  onAttach={onAttach}
                  readonly={readonly}
                  handleSelect={handleSelect}
                  playItem={playItem}
                  mediaPlaying={mediaPlaying}
                />
              ),
            },
            versionCol,
            {
              field: 'fileName',
              headerName: `${t.fileName} (${nameCount})`,
              width: 205,
            },
            {
              field: 'sectionDesc',
              headerName: organizedBy,
              align: 'left',
              cellClassName: 'word-wrap',
              width: MinSectionWidth + addWidth,
            },
            refCol,
            userCol,
            durationCol,
            sizeCol,
            dateCol,
            {
              field: 'detach',
              headerName: '\u00A0',
              width: 83,
              sortable: false,
              renderCell: (params) => (
                <DetachCell
                  {...params}
                  canCreate={canCreate}
                  readonly={readonly}
                  handleConfirmAction={handleConfirmAction}
                />
              ),
            },
          ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      organizedBy,
      shared,
      hasPublishing,
      onAttach,
      nameCount,
      mediaPlaying,
      addWidth,
    ]
  );

  const totalWidth = useMemo(
    () =>
      columns.reduce(
        (sum, col) =>
          col.field === 'sectionDesc'
            ? sum + MinSectionWidth
            : sum + (col.width ?? 0),
        0
      ),
    [columns]
  );

  const ExtraWidth = 0;

  // keep track of screen width
  const setDimensions = () => {
    const boxWidth = boxRef.current?.clientWidth ?? 0;
    setAddWidth(boxWidth > totalWidth ? boxWidth - totalWidth - ExtraWidth : 0);
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

  const columnVisibilityModel: GridColumnVisibilityModel = { planName: false };

  return (
    <Box ref={boxRef} sx={{ width: '100%' }}>
      <DataGrid
        columns={columns}
        rows={sortedData}
        disableColumnSorting
        initialState={{
          columns: { columnVisibilityModel },
        }}
      />
      {/* {verHist && (
        <BigDialog
          title={ts.versionHistory}
          isOpen={Boolean(verHist)}
          onOpen={handleVerHistClose}
        >
          <VersionDlg
            passId={verHist}
            canSetDestination={canSetDestination}
            hasPublishing={hasPublishing}
          />
        </BigDialog>
      )} */}
      {publishItem !== -1 && (
        <ConfirmPublishDialog
          title={t.publish}
          propagateLabel={''}
          description={''}
          noPropagateDescription={''}
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
          hasBible={hasBible}
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
          text={t.deleteConfirm.replace('{0}', sortedData[deleteItem].fileName)}
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
