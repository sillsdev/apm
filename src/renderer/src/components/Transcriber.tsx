import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  CSSProperties,
  useMemo,
  useCallback,
} from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { useParams } from 'react-router-dom';
import Confirm from './AlertDialog';
import {
  MediaFile,
  Project,
  ActivityStates,
  Passage,
  PassageD,
  Section,
  IState,
  Integration,
  ProjectIntegration,
  IActivityStateStrings,
  ISharedStrings,
  ITranscriberStrings,
  IVProjectStrings,
  SectionD,
  MediaFileD,
} from '../model';
import {
  Badge,
  Grid,
  Paper,
  Typography,
  IconButton,
  Box,
  Stack,
} from '@mui/material';
import { StyledTextAreaAutosize } from '../control/WebFontStyles';
import useTodo from '../context/useTodo';
import PullIcon from '@mui/icons-material/GetAppOutlined';
import { AltButton, GrowingDiv, LightTooltip, PriButton } from '../control';
import TranscribeReject from './TranscribeReject';
import { useSnackBar } from '../hoc/SnackBar';
import { formatTime } from '../control/formatTime';
import {
  related,
  FontData,
  getFontData,
  remoteIdNum,
  UpdateMediaStateOps,
  AddPassageStateChangeToOps,
  remoteId,
  ArtifactTypeSlug,
  useArtifactType,
  findRecord,
  useOrgDefaults,
  GetUser,
  saveFontData,
  loadFontData,
  resolveStepSpellCheck,
  pullTableList,
  orgDefaultFeatures,
  useOrganizedBy,
} from '../crud';
import { MainAPI } from '@model/main-api';
import { useGetAsrSettings } from '../crud/useGetAsrSettings';
import { parseStepLanguageField } from '../crud/transcribeStepAsrSettings';
import {
  insertAtCursor,
  logError,
  Severity,
  currentDateTime,
  getParatextDataPath,
  refMatch,
  integrationSlug,
  getSegments,
  NamedRegions,
  updateSegments,
  useWaitForRemoteQueue,
  getSortedRegions,
  isLangSet,
} from '../utils';
import { isElectron } from '../../api-variable';
import { TokenContext } from '../context/TokenProvider';
import { AllDone } from './AllDone';
import { LastEdit } from '../control';
import { UpdateRecord, UpdateRelatedRecord } from '../model/baseModel';
import * as action from '../store';
import { translateParatextError } from '../utils/translateParatextError';
import TranscribeAddNote from './TranscribeAddNote';
import PassageHistory from './PassageHistory';
import { HotKeyContext } from '../context/HotKeyContext';
import TaskFlag from './TaskFlag';
import Spelling from './Spelling';
import { UnsavedContext } from '../context/UnsavedContext';
import {
  activitySelector,
  playerSelector,
  sharedSelector,
  transcriberSelector,
  vProjectSelector,
} from '../selector';
import {
  IWsAudioPlayerStrings,
  OrganizationD,
  OrgWorkflowStepD,
} from '../model';
import { shallowEqual, useSelector } from 'react-redux';
import usePassageDetailContext from '../context/usePassageDetailContext';
import { IRegionParams } from '../crud/useWavesurferRegions';
import PassageDetailPlayer, {
  PLAYER_HEIGHT,
} from './PassageDetail/PassageDetailPlayer';
import { PlayInPlayer } from '../context/PlayInPlayer';
import Settings from '@mui/icons-material/Settings';
import { EditorSettings } from './Team/ProjectDialog';
import BigDialog from '../hoc/BigDialog';
import { BigDialogBp } from '../hoc/BigDialogBp';
import AsrButton from '../control/ConfButton';
import TranscriptionLogo from '../control/TranscriptionLogo';
import AsrProgress from '../business/asr/AsrProgress';
import { AsrTarget } from '../business/asr/AsrTarget';
import { IAsrState, asrStatesEqual } from '../business/asr/asrState';
import SelectAsrLanguage from '../business/asr/SelectAsrLanguage';
import { IFeatures } from './Team/TeamSettings';
import { useCheckOnline } from '../utils/useCheckOnline';
import { useMobile } from '../utils/useMobile';
import { useLocLangName } from '../utils/useLocLangName';
import IndexedDBSource from '@orbit/indexeddb';
import JSONAPISource from '@orbit/jsonapi';
import { useOrbitData } from '../hoc/useOrbitData';
import {
  InitializedRecord,
  RecordTransformBuilder,
  RecordOperation,
  RecordKeyMap,
} from '@orbit/records';
import { useDispatch } from 'react-redux';
import { PassageTypeEnum } from '../model/passageType';
import { addPt } from '../utils/addPt';
import { Paratext } from '../assets/brands';
import {
  initProjectState,
  IProjectDialog,
} from './Team/ProjectDialog/projectDialogTypes';
import { SaveSegments } from './PassageDetail/SaveSegments';

//import useRenderingTrace from '../utils/useRenderingTrace';

const HISTORY_KEY = 'F7,CTRL+7';
// Space under the textarea for Reject/Save/Submit (+ padding).
const ACTION_ROW_HEIGHT = 80;
// ~3 lines at large/xx-large; prefer this over fitting the action buttons.
const MIN_TEXT_BOX_HEIGHT = 120;
const ipc = window?.api as MainAPI | undefined;

interface IProps {
  defaultWidth: number;
  stepSettings?: string;
  hasChecking?: boolean;
  hasPermission?: boolean;
  setComplete?: (complete: boolean) => void;
  onReopen?: () => void;
  onReject?: (reason: string) => void;
  onReloadPlayer?: (mediafile: MediaFile) => void;
}

interface ITrans {
  transcription: string | undefined;
  position: number;
  segments?: string;
}

export function Transcriber(props: IProps) {
  const {
    stepSettings,
    hasChecking,
    hasPermission,
    defaultWidth,
    setComplete,
    onReopen,
    onReject,
    onReloadPlayer,
  } = props;
  const paratext_textStatus = useSelector(
    (state: IState) => state.paratext.textStatus
  );
  const paratext_username = useSelector(
    (state: IState) => state.paratext.username
  );
  const paratext_usernameStatus = useSelector(
    (state: IState) => state.paratext.usernameStatus
  );
  const dispatch = useDispatch();
  const resetParatextText = () => dispatch(action.resetParatextText() as any);
  const getUserName = (token: string, errorReporter: any, msg: string) =>
    dispatch(action.getUserName(token, errorReporter, msg) as any);
  const getParatextText = (
    token: string,
    passageId: number,
    artifactId: string | null,
    errorReporter: any,
    pendingmsg: string
  ) =>
    dispatch(
      action.getParatextText(
        token,
        passageId,
        artifactId,
        errorReporter,
        pendingmsg
      ) as any
    );
  const getParatextTextLocal = (
    ptPath: string,
    passage: Passage,
    ptProjName: string,
    errorReporter: any,
    pendingmsg: string
  ) =>
    dispatch(
      action.getParatextTextLocal(
        ptPath,
        passage,
        ptProjName,
        errorReporter,
        pendingmsg
      ) as any
    );
  const { rowData, transSelected, setTransSelected, allDone, artifactId } =
    useTodo();
  const transcriberStr: ITranscriberStrings = useSelector(
    transcriberSelector,
    shallowEqual
  );
  const sharedStr: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const integrations = useOrbitData<Integration[]>('integration');
  const projintegrations =
    useOrbitData<ProjectIntegration[]>('projectintegration');

  const { slug } = useParams();
  /** Prefer transSelected over rowData[index] — index can lag after task list refresh (PBT). */
  const selectedMediaRow = useMemo(() => {
    if (!transSelected) return undefined;
    const asTranscriber = rowData.find(
      (r) => r.mediafile?.id === transSelected && r.role === 'transcriber'
    );
    if (asTranscriber) return asTranscriber;
    return rowData.find((r) => r.mediafile?.id === transSelected);
  }, [rowData, transSelected]);

  const { section, passage, mediafile, state, role } = selectedMediaRow || {
    section: {} as Section,
    passage: {} as Passage,
    mediafile: undefined,
    state: '',
    role: '',
  };

  const { toolChanged, saveCompleted } = useContext(UnsavedContext).state;
  const [memory] = useGlobal('memory');
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [project] = useGlobal('project'); //will be constant here
  const [projType] = useGlobal('projType'); //verified this is not used in a function 2/18/25
  const [user] = useGlobal('user');
  const [organization] = useGlobal('organization');
  const [coordinator] = useGlobal('coordinator');
  const [errorReporter] = useGlobal('errorReporter');
  const { accessToken } = useContext(TokenContext).state;
  const [assigned, setAssigned] = useState('');
  const [projData, setProjData] = useState<FontData>();
  const [availSpellLangs, setAvailSpellLangs] = useState<string[]>([]);
  const [suggestedSegs, setSuggestedSegs] = useState<string>();
  const verseSegs = useRef<string | undefined>(undefined);
  const [verseLabels, setVerseLabels] = useState<string[]>([]);
  const [contentVerses, setContentVerses] = useState<string[]>([]);
  const playedSecsRef = useRef<number>(0);
  const segmentsRef = useRef<string | undefined>(undefined);
  const stateRef = useRef<string>(state);
  const [transcribing] = useState(
    state === ActivityStates.Transcribing ||
      state === ActivityStates.TranscribeReady
  );

  const [showSettings, setShowSettings] = useState(false);
  const [settingsState, setSettingsState] = useState<IProjectDialog>();
  const vProjectStrings: IVProjectStrings = useSelector(
    vProjectSelector,
    shallowEqual
  );
  const [textValue, setTextValue] = useState('');
  const [lastSaved, setLastSaved] = useState('');
  const [defaultPosition, setDefaultPosition] = useState(0.0);
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const { showMessage } = useSnackBar();
  const showHistoryRef = useRef(false);
  const [showHistory, setShowHistoryx] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [addNoteVisible, setAddNoteVisible] = useState(false);
  const [hasParatextName, setHasParatextName] = useState(false);
  const [noParatext, setNoParatext] = useState(false);
  const [paratextProject, setParatextProject] = React.useState('');
  const [paratextIntegration, setParatextIntegration] = React.useState('');
  const transcriptionIn = React.useRef<string | undefined>(undefined);
  const saving = React.useRef(false);
  const {
    toolsChanged,
    saveRequested,
    clearRequested,
    clearCompleted,
    isChanged,
  } = useContext(UnsavedContext).state;
  const [changed, setChanged] = useState(false);
  const [confirm, setConfirm] = useState<ITrans>();
  const transcriptionRef = React.useRef<any>(null);
  const playingRef = useRef<boolean | undefined>(undefined);
  const mediaRef = useRef<MediaFile | undefined>(undefined);
  /** Last transSelected we loaded into the textarea; index can lag so we key off selection id. */
  const prevSyncedTransSelectedRef = useRef<string | undefined>(undefined);
  const autosaveTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const { subscribe, unsubscribe } = useContext(HotKeyContext).state;
  const t = transcriberStr;
  const {
    loading,
    playing,
    chooserSize,
    pdBusy,
    playerMediafile,
    setSelected,
    discussionSize,
    forceRefresh,
  } = usePassageDetailContext();
  const teams = useOrbitData<OrganizationD[]>('organization');
  const team = useMemo(
    () => teams.find((o) => o.id === organization),
    [teams, organization]
  );
  const { getAsrSettings, saveProjectAsrSettings, saveTeamAsrSettings } =
    useGetAsrSettings(team);
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const mediarecs = useOrbitData<MediaFileD[]>('mediafile');
  const tPlayer: IWsAudioPlayerStrings = useSelector(
    playerSelector,
    shallowEqual
  );
  const [getName] = useLocLangName();
  const checkOnline = useCheckOnline(tPlayer.recognizeSpeech);
  const { isMobile } = useMobile();
  const [features, setFeatures] = useState<IFeatures>();
  const [asrProgressVisible, setAsrProgressVisible] = useState(false);
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [phonetic, setPhonetic] = useState(false);
  const [asrOverride, setAsrOverride] = useState<IAsrState | undefined>(
    undefined
  );
  const { getOrganizedBy } = useOrganizedBy();
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  // Leave room for Reject/Save/Submit under the textarea; never go below ~3 lines.
  const [boxHeight, setBoxHeight] = useState(() =>
    Math.max(
      discussionSize.height - PLAYER_HEIGHT - chooserSize - ACTION_ROW_HEIGHT,
      MIN_TEXT_BOX_HEIGHT
    )
  );
  const [style, setStyle] = useState({
    cursor: 'default',
  });
  const getGlobal = useGetGlobal();

  const transcribeDefaultParams = {
    silenceThreshold: 0.004,
    timeThreshold: 0.02,
    segLenThreshold: 0.5,
  };
  const [segParams, setSegParams] = useState(transcribeDefaultParams);

  const { getOrgDefault, setOrgDefault, canSetOrgDefault } = useOrgDefaults();

  const [artifactTypeSlug, setArtifactTypeSlug] = useState(slug);
  const { slugFromId } = useArtifactType();

  const [textAreaStyle, setTextAreaStyle] = useState<CSSProperties>({
    overflow: 'auto !important',
    backgroundColor: '#cfe8fc',
    height: boxHeight,
    fontFamily: projData?.fontFamily,
    fontSize: projData?.fontSize,
    direction: projData?.fontDir as any,
    cursor: 'default',
    resize: 'none',
  });
  const ta: IActivityStateStrings = useSelector(activitySelector, shallowEqual);
  const toolId = 'transcriber';
  /* debug what props are changing to force renders
  useRenderingTrace(
    'Transcriber',
    {
      ...props,
      memory,
      offline,
      project,
      plan,
      user,
      orgRole,
      errorReporter,
      busy,
      assigned,
      changed,
      projData,
      fontStatus,
      transcribing,
      height,
      boxHeight,
      width,
      textValue,
      lastSaved,
      defaultPosition,
      showHistory,
      rejectVisible,
      addNoteVisible,
      hasParatextName,
      paratextProject,
      paratextIntegration,
      connected,
      coordinator,
      audioBlob,
      subscribe,
      unsubscribe,
      localizeHotKey,
      playerSize,
    },
    'log'
  ); */

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const def = getOrgDefault(
      NamedRegions.Transcription
    ) as typeof transcribeDefaultParams;
    if (def) setSegParams(def);
    else setSegParams(transcribeDefaultParams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  useEffect(() => {
    if (organization) {
      setFeatures(getOrgDefault(orgDefaultFeatures) as IFeatures);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  useEffect(() => {
    setStyle({
      cursor: pdBusy || loading ? 'progress' : 'default',
    });
    setTextAreaStyle({
      ...textAreaStyle,
      height: `${boxHeight}px !important`,
      fontFamily: projData?.fontFamily,
      fontSize: projData?.fontSize,
      direction: projData?.fontDir as any,
      cursor: pdBusy || loading ? 'progress' : 'default',
    });
    if (transcriptionRef.current) {
      const el = transcriptionRef?.current?.firstChild as HTMLTextAreaElement;
      if (el && !el.selectionStart && !el.selectionEnd) {
        el.selectionStart = el.selectionEnd = el.textLength;
      }
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdBusy, loading, boxHeight, projData]);

  const handleShowHistory = () => {
    setShowHistory(!showHistoryRef.current);
    return true;
  };

  const keys = [
    { key: HISTORY_KEY, cb: handleShowHistory },
    { key: 'SHIFT+ARROWRIGHT', cb: () => false },
    { key: 'SHIFT+ARROWLEFT', cb: () => false },
  ];

  useEffect(() => {
    const getParatextIntegration = () => {
      const intfind = integrations.findIndex(
        (i) =>
          i.attributes &&
          i.attributes.name ===
            integrationSlug(artifactTypeSlug, offlineOnly) &&
          Boolean(i.keys?.remoteId) !== offlineOnly
      );
      if (intfind > -1)
        setParatextIntegration((integrations[intfind] as InitializedRecord).id);
    };
    getParatextIntegration();

    keys.forEach((k) => subscribe(k.key, k.cb));

    return () => {
      keys.forEach((k) => unsubscribe(k.key));
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    if (!allDone) {
      keys.forEach((k) => subscribe(k.key, k.cb));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const allowSegment = useMemo(() => {
    return transSelected && role !== 'view'
      ? NamedRegions.Transcription
      : undefined;
  }, [transSelected, role]);

  useEffect(() => {
    const getParatextIntegration = () => {
      const intfind = integrations.findIndex(
        (i) =>
          i.attributes &&
          i.attributes.name ===
            integrationSlug(artifactTypeSlug, offlineOnly) &&
          Boolean(i.keys?.remoteId) !== offlineOnly
      );
      if (intfind > -1)
        setParatextIntegration(
          (integrations[intfind] as InitializedRecord).id as string
        );
    };

    getParatextIntegration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [integrations]);

  useEffect(() => {
    if (saveRequested(toolId)) {
      handleSave();
    } else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }
    const newchanged = isChanged(toolId);
    if (newchanged !== changed) setChanged(newchanged);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [toolsChanged]);

  useEffect(() => {
    let newBoxHeight =
      discussionSize.height - PLAYER_HEIGHT - chooserSize - ACTION_ROW_HEIGHT;
    if (defaultWidth < 700) newBoxHeight -= 40;
    // Prefer keeping ~3 lines of text over fitting the action buttons.
    newBoxHeight = Math.max(newBoxHeight, MIN_TEXT_BOX_HEIGHT);
    if (newBoxHeight !== boxHeight) setBoxHeight(newBoxHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussionSize, chooserSize, defaultWidth]);

  //user changes selected...tell the task table
  useEffect(() => {
    if (transSelected !== playerMediafile?.id)
      setTransSelected(playerMediafile?.id);
    segmentsRef.current = undefined; //when they're loaded we'll be notified
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMediafile]);

  const hasRow =
    transSelected && rowData.some((r) => r.mediafile.id === transSelected);
  //if task table has changed selected...tell the world
  useEffect(() => {
    const selectionChanged =
      transSelected !== prevSyncedTransSelectedRef.current;
    if (
      hasRow &&
      transSelected !== undefined &&
      transSelected !== playerMediafile?.id
    )
      setSelected(transSelected, PlayInPlayer.yes);
    if (!transSelected) {
      prevSyncedTransSelectedRef.current = undefined;
      showTranscription({
        transcription: undefined,
        position: 0,
      });
    } else if (!saving.current || selectionChanged) {
      showTranscription(getTranscription());
      prevSyncedTransSelectedRef.current = transSelected;
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [hasRow, transSelected]);

  useEffect(() => {
    if (mediaRef.current?.id !== mediafile?.id) {
      if (playerMediafile?.id !== mediafile?.id || '')
        setSelected(mediafile?.id || '', PlayInPlayer.yes);
    }
    if (mediafile) {
      const trans = getTranscription();
      if (
        transcriptionIn.current !== undefined &&
        (trans.transcription ?? '') !== transcriptionIn.current &&
        !saving.current
      ) {
        //if someone else changed it...let the user pick
        setConfirm(trans);
      }
      const defaultSegments = mediafile?.attributes?.segments;
      if (defaultSegments) {
        const segs = getSortedRegions(
          getSegments(NamedRegions.Verse, defaultSegments)
        );
        const verseLabels: string[] = [];
        segs.forEach((region) => {
          const vnum = region?.label?.split(':')[1];
          if (vnum) verseLabels.push(vnum);
        });
        setVerseLabels(verseLabels);
        if (segs.length > 0) {
          const textArea = transcriptionRef.current
            .firstChild as HTMLTextAreaElement;
          if (!textArea.value || textArea.value === 'undefined') {
            let refText = segs.find(
              (s) => s?.label && refMatch(s.label)
            )?.label;
            const vNum = refText?.split(':')[1];
            if (vNum) {
              refText = `\\v ${vNum} `;
              if (textArea.value === 'undefined') textArea.value = '';
              insertAtCursor(textArea, refText);
              setTextValue(textArea.value ?? '');
            }
          }
        }
        verseSegs.current = JSON.stringify({ regions: JSON.stringify(segs) });
        setSuggestedSegs(
          getSegments(NamedRegions.Transcription, defaultSegments)
        );
      }
    }
    mediaRef.current = mediafile;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [mediafile]);

  useEffect(() => {
    if (autosaveTimer.current === undefined) {
      launchTimer();
    } else {
      clearTimeout(autosaveTimer.current);
      launchTimer();
    }
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = undefined;
      }
    };
    /* any variable used in save that isn't in a ref needs to be here! */
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [passage]);

  useEffect(() => {
    if (paratext_textStatus?.errStatus) {
      showMessage(
        translateParatextError(
          paratext_textStatus,
          sharedStr,
          getOrganizedBy(true)
        )
      );
      resetParatextText();
    } else if (!paratext_textStatus?.complete && paratext_textStatus?.statusMsg)
      showMessage(paratext_textStatus?.statusMsg);
    else if (paratext_textStatus?.complete) {
      showTranscription({
        transcription: paratext_textStatus.statusMsg,
        position: 0,
      });
      toolChanged(toolId, true);
      save(
        mediafile?.attributes.transcriptionstate ||
          ActivityStates.TranscribeReady,
        0,
        segmentsRef.current,
        addPt(t.pullParatextStatus)
      );
      resetParatextText();
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [paratext_textStatus]);

  useEffect(() => {
    const thisint = projintegrations.findIndex(
      (pi) =>
        related(pi, 'project') === project &&
        related(pi, 'integration') === paratextIntegration
    );
    if (
      thisint > -1 &&
      (projintegrations[thisint] as ProjectIntegration).attributes.settings !==
        '{}'
    ) {
      const settings = JSON.parse(
        (projintegrations[thisint] as ProjectIntegration).attributes.settings
      );
      setParatextProject(settings.Name);
    } else setParatextProject('');
  }, [paratextIntegration, project, projintegrations]);

  useEffect(() => {
    if (isElectron) {
      ipc
        ?.availSpellLangs()
        .then((list: string[]) => setAvailSpellLangs(list ?? []))
        .catch(() => setAvailSpellLangs([]));
    } else {
      setAvailSpellLangs([]);
    }
  }, []);
  useEffect(() => {
    const lgSettings = JSON.parse(stepSettings || '{}');
    const { bcp47: stepLang } = parseStepLanguageField(lgSettings?.language);
    const hasStepLanguage = isLangSet(stepLang);

    const loadProjData = async () => {
      const r = project
        ? (findRecord(memory, 'project', project) as Project | undefined)
        : undefined;
      let langTag = hasStepLanguage ? stepLang : undefined;
      let defaultFont = lgSettings?.font as string | undefined;
      let rtl = lgSettings?.rtl ?? false;
      let defaultFontSize = lgSettings?.fontSize as string | undefined;
      const useProjectLang =
        artifactTypeSlug === ArtifactTypeSlug.Vernacular || !hasStepLanguage;
      if (useProjectLang && r) {
        langTag = r.attributes?.language ?? langTag;
        defaultFont = (defaultFont ?? r.attributes?.defaultFont) || undefined;
        rtl = r.attributes?.rtl ?? rtl;
        defaultFontSize =
          (defaultFontSize ?? r.attributes?.defaultFontSize) || undefined;
      }

      const spellCheck = resolveStepSpellCheck(
        lgSettings,
        artifactTypeSlug,
        langTag,
        availSpellLangs
      );

      const lastFontData = loadFontData(artifactId ?? 'project');
      defaultFontSize = lastFontData?.fontSize ?? defaultFontSize ?? 'large';

      const rec = {
        attributes: {
          language: langTag,
          defaultFont,
          defaultFontSize,
          rtl,
        },
      } as Project;
      const data = await getFontData(rec, artifactId);
      setProjData({ ...data, spellCheck });
    };

    loadProjData();

    const ptCheck =
      [ArtifactTypeSlug.Retell, ArtifactTypeSlug.QandA].includes(
        (artifactTypeSlug || '') as ArtifactTypeSlug
      ) || projType.toLowerCase() !== 'scripture';
    if (ptCheck !== noParatext) setNoParatext(ptCheck);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [
    project,
    projType,
    artifactTypeSlug,
    artifactId,
    offline,
    stepSettings,
    availSpellLangs,
  ]);

  useEffect(() => {
    const newAssigned = selectedMediaRow?.assigned;
    if (newAssigned !== assigned) setAssigned(newAssigned ?? '');
    stateRef.current = state;
    focusOnTranscription();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [selectedMediaRow, state]);

  useEffect(() => {
    if (!offline) {
      if (!paratext_usernameStatus && !noParatext) {
        getUserName(accessToken || '', errorReporter, '');
      }
      setHasParatextName(paratext_username !== '');
    } else setHasParatextName(true);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [paratext_username, paratext_usernameStatus, noParatext, offline]);

  const focusOnTranscription = () => {
    if (transcriptionRef.current) transcriptionRef.current.firstChild.focus();
  };
  const handleChange = (e: any) => {
    setTextValue(e.target.value ?? '');
    toolChanged(toolId, true);
  };

  const setShowHistory = (value: boolean) => {
    showHistoryRef.current = value;
    setShowHistoryx(value);
  };

  const handlePullParatext = () => {
    if (
      !refMatch(passage?.attributes?.reference || 'Err') ||
      !passage?.attributes?.book
    ) {
      showMessage(t.invalidReference);
      return;
    }
    if (getGlobal('offline')) {
      getParatextDataPath().then((ptPath: string | null | undefined) => {
        getParatextTextLocal(
          ptPath || '',
          passage,
          paratextProject,
          errorReporter,
          addPt(t.pullParatextStart)
        );
      });
    } else {
      getParatextText(
        accessToken || '',
        remoteIdNum(
          'passage',
          passage.id as string,
          memory?.keyMap as RecordKeyMap
        ),
        artifactId &&
          (remoteId(
            'artifacttype',
            artifactId,
            memory?.keyMap as RecordKeyMap
          ) as string),
        errorReporter,
        addPt(t.pullParatextStart)
      );
    }
  };

  const handleReject = () => {
    if (saving.current) {
      showMessage(t.saving);
      return;
    }
    setRejectVisible(true);
  };
  const handleRejected = useCallback(
    async (media: MediaFile, comment: string) => {
      setRejectVisible(false);
      await memory.update(
        UpdateMediaStateOps(
          media.id as string,
          passage.id as string,
          media.attributes.transcriptionstate,
          user,
          new RecordTransformBuilder(),
          [],
          memory,
          comment
        )
      );
      //todo ?? if (IsVernacular(media))
      setLastSaved(currentDateTime());
      if (onReject) onReject(media.attributes.transcriptionstate);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passage.id, user, onReject]
  );

  const handleRejectCancel = () => setRejectVisible(false);

  const handleAddNote = useCallback(
    async (pass: PassageD) => {
      setAddNoteVisible(false);
      const ops = [] as RecordOperation[];
      AddPassageStateChangeToOps(
        new RecordTransformBuilder(),
        ops,
        pass.id,
        '',
        pass.attributes.lastComment,
        user,
        memory
      );
      await memory.update(ops);
      pass.attributes.lastComment = '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );
  const handleAddNoteCancel = () => setAddNoteVisible(false);

  const next: { [key: string]: string } = {
    incomplete: ActivityStates.Transcribed,
    transcribing: ActivityStates.Transcribed,
    reviewing: ActivityStates.Approved,
    transcribeReady: ActivityStates.Transcribed,
    transcribed: ActivityStates.Approved,
    needsNewTranscription: ActivityStates.Transcribed,
  };

  const forcePosition = (position: number) => {
    setDefaultPosition(playedSecsRef.current || 0);
    setDefaultPosition(position);
  };

  const handleSubmit = useCallback(
    async () => {
      if (Object.prototype.hasOwnProperty.call(next, state)) {
        let nextState = next[state];
        if (nextState === ActivityStates.Transcribed && !hasChecking)
          nextState = ActivityStates.Approved;
        if (nextState === ActivityStates.Approved && noParatext)
          nextState = ActivityStates.Done;
        await save(
          nextState || ActivityStates.TranscribeReady,
          0,
          segmentsRef.current,
          ''
        );
        onReloadPlayer && mediaRef.current && onReloadPlayer(mediaRef.current);
        forcePosition(0);
        if (setComplete) setComplete(true);
      } else {
        logError(Severity.error, errorReporter, `Unhandled state: ${state}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [errorReporter, hasChecking, noParatext, state, setComplete]
  );

  const stateRole: { [key: string]: string } = {
    transcribing: 'transcriber',
    reviewing: 'editor',
    transcribeReady: 'transcriber',
    transcribed: 'editor',
  };

  const handleAssign = useCallback(
    async (curState: string) => {
      const secRec = findRecord(memory, 'section', section.id as string);
      const role = stateRole[curState];
      if (secRec && role) {
        const assigned = related(secRec, role);
        if (!assigned || assigned === '') {
          await memory.update(
            UpdateRelatedRecord(
              new RecordTransformBuilder(),
              section as SectionD,
              role,
              'user',
              user,
              user
            )
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, user]
  );

  const handleEditorSettings = (isOpen: boolean) => {
    if (!isOpen) {
      setShowSettings(false);
      return;
    }
    setSettingsState({
      rtl: projData?.fontDir === 'rtl',
      fontSize: projData?.fontSize,
      vProjectStrings,
    } as IProjectDialog);
    setShowSettings(true);
  };

  useEffect(() => {
    if (projData && settingsState) {
      let newData = projData;
      let change = false;
      if (settingsState?.fontSize !== newData.fontSize) {
        change = true;
        newData = { ...newData, fontSize: settingsState.fontSize };
      }
      if (change) setProjData(newData);
      saveFontData(newData, artifactId ?? 'project');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsState, artifactId]);

  const nextOnSave: { [key: string]: string } = {
    incomplete: ActivityStates.Transcribing,
    needsNewTranscription: ActivityStates.Transcribing,
    transcribeReady: ActivityStates.Transcribing,
    transcribed: ActivityStates.Reviewing,
  };

  const handleUpdateConfirmed = () => {
    if (confirm) showTranscription(confirm);
    setConfirm(undefined);
  };
  const handleUpdateRefused = () => {
    //it's been changed on the backend, but I want mine, so save mine over theirs
    handleSave();
    setConfirm(undefined);
  };

  const handleSave = async () => {
    //this needs to use the refs because it is called from a timer, which
    //apparently remembers the values when it is kicked off...not when it is run
    await save(
      nextOnSave[stateRef.current] ?? stateRef.current,
      playedSecsRef.current,
      segmentsRef.current,
      undefined
    );
  };

  const save = async (
    nextState: string,
    newPosition: number,
    segments: string | undefined,
    thiscomment: string | undefined
  ) => {
    if (transcriptionRef.current && mediaRef.current) {
      saving.current = true;
      const transcription = transcriptionRef.current.firstChild.value;
      const curState = stateRef.current;
      const tb = new RecordTransformBuilder();
      const ops: RecordOperation[] = [];
      //todo
      //always update the state, because we need the dateupdated to be updated
      if (stateRef.current !== nextState || thiscomment)
        if (typeof passage.id === 'string')
          AddPassageStateChangeToOps(
            tb,
            ops,
            passage.id,
            stateRef.current !== nextState ? nextState : '',
            thiscomment || '',
            user,
            memory
          );

      ops.push(
        ...UpdateRecord(
          tb,
          {
            type: 'mediafile',
            id: mediaRef.current.id,
            attributes: {
              ...mediaRef.current?.attributes,
              transcription: transcription,
              position: newPosition,
              segments: updateSegments(
                NamedRegions.Transcription,
                mediaRef.current.attributes?.segments,
                segments || '{}'
              ),
              transcriptionstate: nextState,
            },
          } as MediaFileD,
          user
        )
      );
      //have to do this before the mediafiles useEffect kicks in
      const prevtran = transcriptionIn.current;
      transcriptionIn.current = transcription;
      await memory
        .update(ops)
        .then(() => {
          //we come here before we get an error because we're non-blocking
          saveCompleted(toolId);
          setLastSaved(currentDateTime());
          saving.current = false;
          handleAssign(curState);
        })
        .catch((err) => {
          //so we don't come here...we go to continue/logout
          transcriptionIn.current = prevtran;
          saveCompleted(toolId, err.message);
          saving.current = false;
        });
    }
  };
  const handleSaveButton = () => {
    if (saving.current) {
      showMessage(t.saving);
      return;
    }
    handleSave();
  };

  const previous: { [key: string]: string } = {
    incomplete: ActivityStates.TranscribeReady,
    transcribed: ActivityStates.TranscribeReady,
    transcribing: ActivityStates.TranscribeReady,
    reviewing: ActivityStates.TranscribeReady,
    approved: ActivityStates.TranscribeReady,
    done: ActivityStates.TranscribeReady,
    synced: ActivityStates.TranscribeReady,
  };

  const doReopen = async () => {
    if (Object.prototype.hasOwnProperty.call(previous, state)) {
      await memory.update(
        UpdateMediaStateOps(
          (mediafile as MediaFileD).id,
          (passage as PassageD).id,
          previous[state] || ActivityStates.TranscribeReady,
          user,
          new RecordTransformBuilder(),
          [],
          memory,
          ''
        )
      );
      setLastSaved(currentDateTime());
      if (setComplete) setComplete(false);
    }
  };
  const handleReopen = async () => {
    waitForRemoteQueue('busy before reopen').then(() =>
      doReopen().then(() => onReopen && onReopen())
    );
  };

  const getTranscription = (): ITrans => {
    const attr = mediafile?.attributes;
    return {
      transcription: attr?.transcription || undefined,
      position: attr?.position || 0,
      segments: getSegments(NamedRegions.Transcription, attr?.segments ?? '{}'),
    };
  };

  useEffect(() => {
    const transcription = textValue;
    if (!transcription) return;
    const newContentVerses: string[] = [];
    verseLabels.forEach((label) => {
      const pat = new RegExp(`\\\\v\\s+${label}\\s+[^\\\\]`);
      if (pat.test(transcription as string)) {
        newContentVerses.push(label);
      }
    });
    if (newContentVerses.length === 0) {
      if (!/\\v/.test(transcription as string)) {
        newContentVerses.push('no-verses');
      }
    }
    if (JSON.stringify(contentVerses) !== JSON.stringify(newContentVerses)) {
      setContentVerses(newContentVerses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textValue, verseLabels, playerMediafile]);

  const showTranscription = (val: ITrans) => {
    transcriptionIn.current = val.transcription;
    setTextValue(val.transcription ?? '');
    setDefaultPosition(val.position);
    //focus on player
    if (transcriptionRef.current) {
      transcriptionRef.current.firstChild.value = val.transcription;
      focusOnTranscription();
    }
    setLastSaved(mediafile?.attributes?.dateUpdated || '');
  };

  const handleAutosave = async () => {
    if (!playingRef.current && !saving.current && transcriptionRef.current) {
      const transcription = transcriptionRef.current.firstChild.value;
      if ((transcriptionIn.current ?? '') !== transcription) {
        await handleSave();
      }
    }

    launchTimer();
  };

  const launchTimer = () => {
    autosaveTimer.current = setTimeout(() => {
      handleAutosave();
    }, 1000 * 30);
  };

  const paperStyle = useMemo(
    () => ({ width: defaultWidth - 20 }),
    [defaultWidth]
  );

  const onInteraction = () => {
    focusOnTranscription();
  };

  const onProgress = (progress: number) => (playedSecsRef.current = progress);

  const onSegmentChange = (segments: string) => {
    segmentsRef.current = segments;
  };
  const onSegmentParamChange = (
    params: IRegionParams,
    teamDefault: boolean
  ) => {
    setSegParams(params);
    if (teamDefault) setOrgDefault(NamedRegions.Transcription, params);
  };

  const addText = (text: string, atEnd?: boolean) => {
    if (transcriptionRef.current) {
      focusOnTranscription();
      const textArea = transcriptionRef.current
        .firstChild as HTMLTextAreaElement;
      if (atEnd) setTextValue(textArea.value ?? '');
      insertAtCursor(textArea, text);
      setTextValue(textArea.value ?? '');
    }
  };

  const handleAutoTranscribe = (trans: string) => {
    const cleanTrans = trans.replace(/[0-9]+:[0-9]+.[0-9]+: /g, '').trim();
    const curTrans: string = transcriptionRef.current?.firstChild?.value ?? '';
    if (curTrans.includes(cleanTrans)) return;
    const m = /\\v (\d+)\s?/.exec(cleanTrans);
    const index = m && curTrans.includes(m[0]) ? m[0].length : 0;
    const space = /\s$/.test(curTrans) ? '' : ' ';
    addText(space + cleanTrans.substring(index), true);
    toolChanged(toolId, true);
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

  const hasTranscription = useMemo(
    () => textValue !== '' && verseLabels.length <= contentVerses.length,
    [textValue, verseLabels.length, contentVerses.length]
  );
  const asrSettings = useMemo(
    () => getAsrSettings(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgSteps, getAsrSettings]
  );

  const asrTip = useMemo(() => {
    return (tPlayer.recognizeSpeech + '\u00A0\u00A0').replace(
      '{0}',
      asrSettings?.language?.languageName?.trim()
        ? `\u2039 ${
            getName(asrSettings?.language.bcp47) ||
            asrSettings?.language?.languageName
          } \u203A`
        : ''
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asrSettings]);

  const onPullTasks = (remoteId: string) => {
    pullTableList(
      'mediafile',
      Array(remoteId),
      memory,
      remote,
      backup,
      errorReporter
    ).then(() => {
      if (forceRefresh) forceRefresh();
    });
  };

  const startAsr = (asrOverrideState?: IAsrState) => {
    const asr = asrOverrideState ?? asrSettings;
    setAsrOverride(asrOverrideState);
    setPhonetic(asr?.target === AsrTarget.phonetic);
    setAsrProgressVisible(true);
  };

  const openAsrLanguageSettings = () => {
    setAsrLangVisible(true);
  };

  // Confirm step-resolved ASR settings; user may override for this run only.
  // When the resolved settings are already usable (a valid ASR language is
  // known from saved org/project settings), skip the dialog and start directly.
  const handleTranscribe = () => {
    checkOnline((online) => {
      if (!online) {
        showMessage(sharedStr.mustBeOnline);
        return;
      }
      if (isLangSet(asrSettings?.asrIso)) {
        startAsr(asrSettings);
        return;
      }
      openAsrLanguageSettings();
    });
  };

  const handleAsrLanguageClose = (
    cancel: boolean,
    asrState?: IAsrState,
    setAsTeamDefault?: boolean
  ) => {
    setAsrLangVisible(false);
    if (cancel) return;
    const asr = asrState ?? asrSettings;
    if (isLangSet(asr?.asrIso)) {
      if (setAsTeamDefault) saveTeamAsrSettings(asr);
      else saveProjectAsrSettings(asr);
      startAsr(asr);
    }
  };

  const handleAsrProgressVisible = (v: boolean) => {
    setAsrProgressVisible(v);
  };

  const onSaveProgress = (progress: number) => {
    const timeStamp = '(' + formatTime(progress) + ')';
    addText(timeStamp);
  };

  useEffect(() => {
    setArtifactTypeSlug(
      slug
        ? slug
        : artifactId
          ? slugFromId(artifactId)
          : ArtifactTypeSlug.Vernacular
    );
  }, [slug, artifactId, slugFromId]);

  const handleStartRegion = (position: number) => {
    const segs = getSortedRegions(verseSegs.current || '');
    const ref = segs.find((s) => s.start === position)?.label;
    const m = refMatch(ref || '');
    if (ref && m) {
      const vNum = ref.substring((m[1] as string).length + 1);
      let refText = `\\v ${vNum} `;
      const textArea = transcriptionRef.current
        .firstChild as HTMLTextAreaElement;
      const refPos = textArea.value.indexOf(refText);
      // look for alternate verse markup format too
      const refPos2 = textArea.value.indexOf(`\\v${vNum} `);
      if (refPos === -1 && refPos2 === -1) {
        // vNum is undefined for bad references
        refText = vNum ? ' ' + refText : '';
        if (parseInt(m[2] as string) === 1) {
          refText = ` \\c ${m[1]} ` + refText;
        }
        insertAtCursor(textArea, refText);
        setTextValue(textArea.value ?? '');
      }
    }
  };

  return (
    <GrowingDiv>
      <Paper sx={{ p: 0, m: 'auto' }} style={paperStyle}>
        {allDone ? (
          <AllDone />
        ) : (
          <Grid container direction="column" style={style}>
            <Grid
              container
              direction="row"
              sx={{ alignItems: 'center', whiteSpace: 'nowrap' }}
            >
              <Grid
                id="transcriberplayer"
                size={{ xs: 12 }}
                sx={{ minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}
              >
                <PassageDetailPlayer
                  width={paperStyle.width}
                  position={defaultPosition}
                  allowAutoSegment={true}
                  saveSegments={
                    allowSegment ? SaveSegments.saveButNoButton : undefined
                  }
                  defaultSegParams={segParams}
                  canSetDefaultParams={canSetOrgDefault}
                  allowSegment={allowSegment}
                  allowZoomAndSpeed={true}
                  onProgress={onProgress}
                  suggestedSegments={suggestedSegs}
                  verses={verseSegs.current}
                  onStartRegion={handleStartRegion}
                  onSegment={onSegmentChange}
                  onSegmentParamChange={onSegmentParamChange}
                  onInteraction={onInteraction}
                  parentToolId={toolId}
                  onSaveProgress={
                    !transSelected || role === 'view'
                      ? undefined
                      : onSaveProgress
                  }
                  role={role}
                  metaData={
                    <>
                      {role === 'transcriber' &&
                        hasParatextName &&
                        paratextProject &&
                        !noParatext &&
                        !passage?.attributes?.reference.startsWith(
                          PassageTypeEnum.NOTE
                        ) && (
                          <Grid>
                            <LightTooltip title={addPt(t.pullParatextTip)}>
                              <span>
                                <IconButton
                                  id="transcriber.pullParatext"
                                  onClick={handlePullParatext}
                                  disabled={!transSelected}
                                >
                                  <>
                                    <PullIcon />
                                    <Typography>{Paratext}</Typography>
                                  </>
                                </IconButton>
                              </span>
                            </LightTooltip>
                          </Grid>
                        )}
                      {features?.aiTranscribe && !offline && role && (
                        <LightTooltip
                          title={
                            <Badge badgeContent={sharedStr.ai}>
                              {asrTip ?? ''}
                            </Badge>
                          }
                        >
                          <span>
                            <AsrButton
                              id="asrButton"
                              onClick={handleTranscribe}
                              onSettings={openAsrLanguageSettings}
                              showSettings={false}
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
                    </>
                  }
                />
              </Grid>
            </Grid>

            <Grid size={{ xs: 12 }} container>
              <Grid
                ref={transcriptionRef}
                size={{ xs: showHistory ? 6 : 12 }}
                container
                direction="column"
              >
                <StyledTextAreaAutosize
                  autoFocus
                  id="transcriber.text"
                  value={textValue}
                  readOnly={!transSelected || role === 'view'}
                  family={projData?.fontConfig?.custom?.families[0] ?? ''}
                  url={projData?.fontConfig?.custom?.urls[0] ?? ''}
                  overrides={textAreaStyle}
                  onChange={handleChange}
                  lang={projData?.langTag || 'en'}
                  spellCheck={projData?.spellCheck === true}
                />
              </Grid>
              {showHistory && (
                <Grid size={{ xs: 6 }} container direction="column">
                  <PassageHistory
                    passageId={passage?.id || ''}
                    boxHeight={boxHeight - 16}
                  />
                </Grid>
              )}
            </Grid>

            <Stack
              direction="row"
              sx={{
                pt: '12px',
                width: '100%',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <TaskFlag
                  ta={ta}
                  state={mediafile?.attributes?.transcriptionstate || ''}
                />
                <LightTooltip title={vProjectStrings.editorSettings}>
                  <IconButton onClick={() => handleEditorSettings(true)}>
                    <Settings />
                  </IconButton>
                </LightTooltip>
                {isElectron && projData?.spellCheck === true && <Spelling />}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LastEdit
                  when={lastSaved}
                  cb={handleShowHistory}
                  t={sharedStr}
                />
                {role !== 'view' ? (
                  <>
                    <AltButton
                      id="transcriber.reject"
                      onClick={handleReject}
                      disabled={!transSelected || playing}
                    >
                      {t.reject}
                    </AltButton>
                    <LightTooltip
                      title={transcribing ? t.saveTip : t.saveReviewTip}
                    >
                      <span>
                        <AltButton
                          id="transcriber.save"
                          variant={changed ? 'contained' : 'outlined'}
                          onClick={handleSaveButton}
                          disabled={!transSelected || playing}
                        >
                          {t.save}
                        </AltButton>
                      </span>
                    </LightTooltip>
                    <LightTooltip
                      title={
                        transcribing
                          ? t.submitTranscriptionTip
                          : t.submitReviewTip
                      }
                    >
                      <span>
                        <PriButton
                          id="transcriber.submit"
                          onClick={handleSubmit}
                          disabled={!transSelected || playing}
                        >
                          {t.submit}
                        </PriButton>
                      </span>
                    </LightTooltip>
                  </>
                ) : (
                  <AltButton
                    id="transcriber.reopen"
                    onClick={handleReopen}
                    disabled={
                      !transSelected ||
                      !Object.prototype.hasOwnProperty.call(previous, state) ||
                      playing ||
                      !hasPermission
                    }
                  >
                    {t.reopen}
                  </AltButton>
                )}
                <Box sx={{ width: '45px' }}>{'\u00A0'}</Box>
              </Box>
            </Stack>
          </Grid>
        )}
        <TranscribeReject
          visible={rejectVisible}
          mediaIn={mediafile as MediaFileD}
          editMethod={handleRejected}
          cancelMethod={handleRejectCancel}
        />
        <TranscribeAddNote
          visible={addNoteVisible}
          passageIn={passage as PassageD}
          addMethod={handleAddNote}
          cancelMethod={handleAddNoteCancel}
        />
        {confirm && (
          <Confirm
            isDelete={false}
            text={t.updateByOther2
              .replace(
                '{0}',
                GetUser(memory, related(mediafile, 'lastModifiedByUser'))
                  .attributes?.name ?? 'unknown'
              )
              .replace('{1}', confirm.transcription ?? '')}
            yesResponse={handleUpdateConfirmed}
            noResponse={handleUpdateRefused}
          />
        )}
        <BigDialog
          title={vProjectStrings.editorSettings}
          isOpen={showSettings}
          onOpen={handleEditorSettings}
        >
          <EditorSettings
            state={settingsState ?? initProjectState}
            setState={setSettingsState as any}
          />
        </BigDialog>
        <BigDialog
          title={tPlayer.recognizeSpeechSettings}
          isOpen={asrLangVisible}
          onOpen={() => handleAsrLanguageClose(true)}
          bp={BigDialogBp.sm}
        >
          <SelectAsrLanguage
            key={asrLangVisible ? 'open' : 'closed'}
            team={team}
            onClose={handleAsrLanguageClose}
          />
        </BigDialog>
        {asrProgressVisible && (
          <BigDialog
            title={tPlayer.recognizeProgress}
            isOpen={asrProgressVisible}
            onOpen={handleAsrProgressVisible}
            bp={isMobile ? BigDialogBp.mobile : BigDialogBp.sm}
            mobileNoHorizontalScroll={isMobile}
            mobilePaperWidth={
              isMobile ? 'min(356px, calc(100vw - 4px))' : undefined
            }
            dialogContentSx={{ minWidth: 0, overflowX: 'hidden' }}
          >
            <AsrProgress
              mediaId={playerMediafile?.id ?? ''}
              phonetic={phonetic}
              asrState={asrOverride}
              force={!asrStatesEqual(asrOverride, asrSettings)}
              contentVerses={contentVerses}
              setTranscription={handleAutoTranscribe}
              onPullTasks={onPullTasks}
              onClose={() => handleAsrProgressVisible(false)}
            />
          </BigDialog>
        )}
      </Paper>
    </GrowingDiv>
  );
}

export default Transcriber;
