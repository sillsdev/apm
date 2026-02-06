import { useGlobal } from '../../context/useGlobal';
import { Badge, Box, IconButton, Typography } from '@mui/material';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  IRegionParams,
  IRegions,
  IRegion,
  parseRegions,
} from '../../crud/useWavesurferRegions';
import WSAudioPlayer, { WSAudioPlayerControls } from '../WSAudioPlayer';
import { useSelector, shallowEqual } from 'react-redux';
import {
  ISharedStrings,
  IWsAudioPlayerStrings,
  MediaFile,
  MediaFileD,
  OrganizationD,
  OrgWorkflowStepD,
} from '../../model';
import { UpdateRecord } from '../../model/baseModel';
import { playerSelector, sharedSelector } from '../../selector';
import {
  getSegments,
  NamedRegions,
  updateSegments,
} from '../../utils/namedSegments';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import ViewIcon from '@mui/icons-material/RemoveRedEye';
import TranscriptionShow from '../TranscriptionShow';
import { related } from '../../crud/related';
import {
  RequestPlay,
  usePlayerLogic,
} from '../../business/player/usePlayerLogic';
import TranscriptionLogo from '../../control/TranscriptionLogo';
import { useOrgDefaults, orgDefaultFeatures } from '../../crud/useOrgDefaults';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import SelectAsrLanguage from '../../business/asr/SelectAsrLanguage';
import AsrButton from '../../control/ConfButton';
import { IFeatures } from '../Team/TeamSettings';
import AsrProgress from '../../business/asr/AsrProgress';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { LightTooltip, PriButton, smallButtonProps } from '../StepEditor';
import { useOrbitData } from '../../hoc/useOrbitData';
import { pullTableList, ToolSlug, useStepTool } from '../../crud';
import IndexedDBSource from '@orbit/indexeddb';
import JSONAPISource from '@orbit/jsonapi';
import { useMobile } from '../../utils';
import { useCheckOnline } from '../../utils/useCheckOnline';
import { useSnackBar } from '../../hoc/SnackBar';
import { useLocLangName } from '../../utils/useLocLangName';
import { SaveSegments } from './SaveSegments';
import { AsrTarget } from '../../business/asr/AsrTarget';

export const PLAYER_HEIGHT = 120 + 80;
export const PLAYER_HEIGHT_MOBILE = 120 + 40;

export interface DetailPlayerProps {
  allowSegment?: NamedRegions | undefined;
  saveSegments?: SaveSegments | undefined;
  allowAutoSegment?: boolean;
  hideSegmentChange?: boolean;
  suggestedSegments?: string;
  verses?: string;
  defaultSegParams?: IRegionParams;
  canSetDefaultParams?: boolean;
  onSegment?: (segment: string, init: boolean) => void;
  onSegmentParamChange?:
    | ((params: IRegionParams, teamDefault: boolean) => void)
    | undefined;
  onStartRegion?: (position: number) => void;
  onProgress?: (progress: number) => void;
  onSaveProgress?: (progress: number) => void;
  onDuration?: (duration: number) => void;
  onInteraction?: () => void;
  onSegmentFinished?: (segment: IRegion) => void;
  onTranscription?: (transcription: string) => void;
  forceRegionOnly?: boolean;
  allowZoomAndSpeed?: boolean;
  position?: number;
  width: number;
  controlsRef?: React.RefObject<WSAudioPlayerControls | null>;
  hideToolbar?: boolean;
  hideSegmentControls?: boolean;
  highlightAutoSegment?: boolean;
  onAutoSegment?: () => void;
  parentToolId?: string;
  role?: string;
  hasTranscription?: boolean;
  contentVerses?: string[];
  metaData?: React.ReactNode;
  hasSegmentUndo?: boolean;
  segmentUndoValue?: string;
  hideZoom?: boolean;
}

export function PassageDetailPlayer(props: DetailPlayerProps) {
  const {
    allowSegment,
    allowAutoSegment,
    saveSegments,
    hideSegmentChange,
    suggestedSegments,
    verses,
    defaultSegParams,
    canSetDefaultParams,
    onSegment,
    onSegmentParamChange,
    onStartRegion,
    onProgress,
    onSaveProgress,
    onDuration: onDurationProp,
    onInteraction,
    onSegmentFinished,
    onTranscription,
    forceRegionOnly,
    allowZoomAndSpeed,
    position,
    width,
    controlsRef,
    hideToolbar,
    hideSegmentControls,
    highlightAutoSegment,
    onAutoSegment,
    parentToolId,
    role,
    hasTranscription,
    contentVerses,
    metaData,
    hasSegmentUndo,
    segmentUndoValue,
    hideZoom,
  } = props;

  const [memory] = useGlobal('memory');
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [user] = useGlobal('user');
  const {
    toolChanged,
    toolsChanged,
    isChanged,
    saveRequested,
    clearRequested,
    clearCompleted,
    startSave,
    saveCompleted,
  } = useContext(UnsavedContext).state;
  const t: IWsAudioPlayerStrings = useSelector(playerSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const toolId = 'ArtifactSegments';
  const { isMobile: mobile } = useMobile();
  const [requestPlay, setRequestPlay] = useState<RequestPlay>({
    play: undefined,
    regionOnly: false,
    request: new Date(),
  });
  const [initialposition, setInitialPosition] = useState<number | undefined>(0);
  const {
    loading,
    pdBusy,
    setPDBusy,
    audioBlob,
    setupLocate,
    playing,
    setPlaying,
    currentstep,
    currentSegmentIndex,
    setCurrentSegment,
    discussionMarkers,
    handleHighlightDiscussion,
    playerMediafile,
    forceRefresh,
  } = usePassageDetailContext();

  const [defaultSegments, setDefaultSegments] = useState('{}');
  const [showTranscriptionId, setShowTranscriptionId] = useState('');
  const [coordinator] = useGlobal('coordinator');
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const [reporter] = useGlobal('errorReporter');
  const segmentsRef = useRef('');
  const baseSegmentsRef = useRef('{}');
  const userInteractedRef = useRef(false);
  const playingRef = useRef(playing);
  const savingRef = useRef(false);
  const mediafileRef = useRef<MediaFile | undefined>(undefined);
  const durationRef = useRef(0);
  const { getOrgDefault } = useOrgDefaults();
  const [org] = useGlobal('organization');
  const { getAsrSettings } = useGetAsrSettings();
  const teams = useOrbitData<OrganizationD[]>('organization');
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const mediarecs = useOrbitData<MediaFileD[]>('mediafile');
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [phonetic, setPhonetic] = useState(false);
  const [forceAi, setForceAi] = useState<boolean>();
  const [features, setFeatures] = useState<IFeatures>();
  const [asrProgressVisble, setAsrProgressVisble] = useState(false);
  const checkOnline = useCheckOnline(t.recognizeSpeech);
  const { showMessage } = useSnackBar();
  const [getName] = useLocLangName();
  const { tool } = useStepTool(currentstep);

  const { onPlayStatus, onCurrentSegment, setSegmentToWhole } = usePlayerLogic({
    allowSegment,
    suggestedSegments,
    position,
    playing,
    setPlaying,
    setCurrentSegment,
    playerMediafile,
    setDefaultSegments,
    setRequestPlay,
    setInitialPosition,
    mediafileRef,
    segmentsRef,
    durationRef,
    playingRef,
    onSegment,
  });

  const writeSegments = async () => {
    if (!savingRef.current) {
      savingRef.current = true;
      if (mediafileRef.current) {
        const mediafile = mediafileRef.current;
        await memory
          .update((t) => [
            ...UpdateRecord(
              t,
              {
                type: 'mediafile',
                id: mediafile.id,
                attributes: {
                  ...mediafile?.attributes,
                  segments: updateSegments(
                    allowSegment ?? NamedRegions.BackTranslation,
                    mediafile.attributes?.segments || '{}',
                    segmentsRef.current
                  ),
                },
              } as unknown as MediaFileD,
              user
            ),
          ])
          .then(() => {
            saveCompleted(toolId);
            savingRef.current = false;
          })
          .catch((err) => {
            //so we don't come here...we go to continue/logout
            saveCompleted(toolId, err.message);
            savingRef.current = false;
          });
      }
    }
  };

  const onPullTasks = (remoteId: string) => {
    pullTableList(
      'mediafile',
      Array(remoteId),
      memory,
      remote,
      backup,
      reporter
    )
      .then(() => {
        forceRefresh();
      })
      .finally(() => {
        setSegmentToWhole();
      });
  };

  const hasAiTasks = useMemo(() => {
    const mediaRec = mediarecs.find((m) => m.id === playerMediafile?.id);
    return (
      getSegments(
        NamedRegions.TRTask,
        mediaRec?.attributes?.segments || '{}'
      ) !== '{}'
    );
  }, [playerMediafile, mediarecs]);

  const handleDuration = (duration: number) => {
    durationRef.current = duration;
    if (
      mediafileRef.current &&
      !mediafileRef.current.attributes.sourceSegments &&
      duration &&
      Math.floor(duration) !==
        Math.floor(mediafileRef.current.attributes.duration)
    ) {
      console.log(
        `update duration to ${Math.floor(duration)} from
        ${Math.floor(mediafileRef.current.attributes.duration)}`
      );
      memory
        .update((t) =>
          t.replaceAttribute(
            mediafileRef.current as MediaFileD, //I already checked for undefined
            'duration',
            Math.floor(duration)
          )
        )
        .then(() => {
          forceRefresh();
        });
    }
    setSegmentToWhole();
    onDurationProp?.(duration);
  };

  useEffect(() => {
    userInteractedRef.current = false;
    baseSegmentsRef.current =
      allowSegment && suggestedSegments ? suggestedSegments : '{}';
  }, [
    playerMediafile?.id,
    allowSegment,
    suggestedSegments,
    verses,
    currentstep,
  ]);

  const handleInteraction = () => {
    userInteractedRef.current = true;
    onInteraction?.();
  };

  const setPlayerSegments = (segments: string) => {
    if (
      !allowSegment ||
      !segmentsRef.current ||
      segmentsRef.current.indexOf('},{') === -1
    ) {
      setDefaultSegments(segments);
      onSegment && onSegment(segments, true);
    }
    //TT 6149 but I wonder why this was here? if (!playingRef.current) {
    const segs = parseRegions(segments) as IRegions | undefined;
    if ((segs?.regions?.length ?? 0) > 0) {
      setInitialPosition(segs?.regions[0]?.start ?? 0);
      setRequestPlay({
        play: true,
        regionOnly: true,
        request: new Date(),
      });
    }
    //}
  };

  const onSegmentChange = (segments: string) => {
    segmentsRef.current = segments;
    setDefaultSegments(segments); //now we'll notice if we reset them in SetPlayerSegments
    onSegment && onSegment(segments, false);
    if (allowSegment && saveSegments !== undefined) {
      const isSegmentChanged = segments !== baseSegmentsRef.current;
      if (!isSegmentChanged) {
        toolChanged(parentToolId ?? toolId, false);
        return;
      }
      if (!userInteractedRef.current) return;
      //if I have a parentToolId it will save the segments
      toolChanged(parentToolId ?? toolId, true);
    } else {
      //not saving segments...so don't update changed
    }
  };

  const handleSegmentUndo = () => {
    if (!segmentUndoValue) return;
    userInteractedRef.current = true;
    onSegmentChange(segmentUndoValue);
  };

  useEffect(() => {
    setupLocate(setPlayerSegments);
    return () => {
      setupLocate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentstep, allowSegment]);

  useEffect(() => {
    if (mobile && isChanged(toolId) && !saveRequested(toolId)) {
      setTimeout(() => handleSave(), 100);
    }
    if (saveRequested(toolId) && !savingRef.current) writeSegments();
    else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  const handleSave = () => {
    if (!saveRequested(toolId)) {
      startSave(toolId);
    }
    //save the segments here
  };

  const handleShowTranscription = () => {
    setShowTranscriptionId(related(playerMediafile, 'passage') ?? '');
  };

  const handleCloseTranscription = () => {
    setShowTranscriptionId('');
  };

  const asrTip = useMemo(() => {
    const asr = getAsrSettings();
    return (t.recognizeSpeech + '\u00A0\u00A0').replace(
      '{0}',
      asr?.language?.languageName?.trim()
        ? `\u2039 ${
            getName(asr?.language.bcp47) || asr?.language?.languageName
          } \u203A`
        : ''
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, orgSteps]);

  const handleAsrSettings = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      setAsrLangVisible(true);
    });
  };

  const handleTranscribe = (forceAi?: boolean) => {
    checkOnline((online) => {
      if (!online) {
        showMessage(ts.mustBeOnline);
        return;
      }
      const asr = getAsrSettings();
      if (asr?.mmsIso === undefined || asr?.mmsIso === 'und') {
        setAsrLangVisible(true);
        return;
      }
      setPhonetic(asr?.target === AsrTarget.phonetic);
      setForceAi(forceAi);
      setTimeout(() => {
        setAsrLangVisible(false);
        setAsrProgressVisble(true);
      }, 200);
    });
  };

  useEffect(() => {
    if (org) {
      setFeatures(getOrgDefault(orgDefaultFeatures) as IFeatures);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const handleAsrProgressVisible = (v: boolean) => {
    setAsrProgressVisble(v);
  };

  return (
    <Box id="detailplayer" sx={{ width: width }}>
      <WSAudioPlayer
        id="audioPlayer"
        allowRecord={false}
        height={mobile ? PLAYER_HEIGHT_MOBILE : PLAYER_HEIGHT}
        width={width}
        blob={audioBlob}
        initialposition={initialposition}
        setInitialPosition={setInitialPosition}
        isPlaying={requestPlay.play}
        regionOnly={requestPlay.regionOnly}
        request={requestPlay.request}
        loading={loading}
        busy={pdBusy}
        allowSegment={allowSegment}
        allowAutoSegment={allowAutoSegment}
        defaultRegionParams={defaultSegParams}
        canSetDefaultParams={canSetDefaultParams}
        segments={defaultSegments}
        verses={verses}
        currentSegmentIndex={currentSegmentIndex}
        markers={discussionMarkers}
        onMarkerClick={handleHighlightDiscussion}
        setBusy={setPDBusy}
        onSegmentChange={onSegmentChange}
        onSegmentParamChange={onSegmentParamChange}
        onStartRegion={onStartRegion}
        onPlayStatus={onPlayStatus}
        onInteraction={handleInteraction}
        onCurrentSegment={onCurrentSegment}
        allowZoom={allowZoomAndSpeed}
        allowSpeed={allowZoomAndSpeed && !hideZoom}
        hideZoom={hideZoom}
        onProgress={onProgress}
        onSaveProgress={onSaveProgress}
        onDuration={handleDuration}
        onSegmentPlaybackEnd={onSegmentFinished}
        forceRegionOnly={forceRegionOnly}
        controlsRef={controlsRef}
        hideToolbar={hideToolbar}
        hideSegmentControls={hideSegmentControls || hideSegmentChange}
        highlightAutoSegment={highlightAutoSegment}
        onAutoSegment={onAutoSegment}
        hasSegmentUndo={hasSegmentUndo ?? Boolean(segmentUndoValue)}
        onSegmentUndo={handleSegmentUndo}
        metaData={
          <>
            {playerMediafile?.attributes?.transcription &&
            tool !== ToolSlug.Transcribe ? (
              <IconButton
                id="show-transcription"
                onClick={handleShowTranscription}
              >
                <ViewIcon fontSize="small" />
              </IconButton>
            ) : (
              <></>
            )}
            {features?.aiTranscribe && !offline && onTranscription && role && (
              <LightTooltip
                title={<Badge badgeContent={ts.ai}>{asrTip ?? ''}</Badge>}
              >
                <span>
                  <AsrButton
                    id="asrButton"
                    onClick={handleTranscribe}
                    onSettings={handleAsrSettings}
                    disabled={role !== 'transcriber'}
                  >
                    {!hasTranscription &&
                    hasAiTasks &&
                    role === 'transcriber' ? (
                      <Badge variant="dot" color="primary">
                        <TranscriptionLogo
                          disabled={role !== 'transcriber'}
                          sx={{ height: 18, width: 18 }}
                        />
                      </Badge>
                    ) : (
                      <TranscriptionLogo
                        disabled={role !== 'transcriber'}
                        sx={{ height: 18, width: 18 }}
                      />
                    )}
                  </AsrButton>
                </span>
              </LightTooltip>
            )}
            {saveSegments === SaveSegments.showSaveButton &&
            !mobile &&
            isChanged(toolId) ? (
              <PriButton
                id="segment-save"
                onClick={handleSave}
                disabled={!isChanged(toolId)}
                sx={smallButtonProps}
              >
                {t.saveSegments}
              </PriButton>
            ) : (
              <></>
            )}
            {metaData}
          </>
        }
      />
      {showTranscriptionId !== '' && (
        <TranscriptionShow
          id={showTranscriptionId}
          visible={showTranscriptionId !== ''}
          closeMethod={handleCloseTranscription}
        />
      )}
      {asrLangVisible && onTranscription && (
        <BigDialog
          title={t.recognizeSpeechSettings}
          description={
            <Typography variant="body2" sx={{ maxWidth: 500 }}>
              {t.recognizePrompt}
            </Typography>
          }
          isOpen={asrLangVisible}
          onOpen={() => setAsrLangVisible(false)}
        >
          <SelectAsrLanguage
            onOpen={(cancel, forceAi) =>
              cancel ? setAsrLangVisible(false) : handleTranscribe(forceAi)
            }
            canBegin={true}
          />
        </BigDialog>
      )}
      {asrProgressVisble && onTranscription && (
        <BigDialog
          title={t.recognizeProgress}
          isOpen={asrProgressVisble}
          onOpen={handleAsrProgressVisible}
          bp={BigDialogBp.sm}
        >
          <AsrProgress
            mediaId={playerMediafile?.id ?? ''}
            phonetic={phonetic}
            force={forceAi}
            contentVerses={contentVerses}
            setTranscription={onTranscription}
            onPullTasks={onPullTasks}
            onClose={() => handleAsrProgressVisible(false)}
          />
        </BigDialog>
      )}
    </Box>
  );
}

export default PassageDetailPlayer;
