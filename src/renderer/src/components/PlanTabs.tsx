import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  MouseEventHandler,
  ReactNode,
  ReactElement,
} from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import {
  IState,
  ISheet,
  IPlanTabsStrings,
  IPlanSheetStrings,
  IScriptureTableStrings,
  ISharedStrings,
  Plan,
  Section,
  Passage,
  flatScrColNames,
  flatGenColNames,
  levScrColNames,
  levGenColNames,
  MediaFileD,
  PlanD,
  OrganizationD,
  GraphicD,
  SectionD,
  PassageD,
  OrgWorkflowStepD,
  ProjectD,
  SharedResourceD,
  IwsKind,
  IMediaShare,
  WorkflowStep,
  OrgWorkflowStep,
  IWorkflowStepsStrings,
  GroupMembership,
  Discussion,
  SheetLevel,
  AltBkSeq,
  BookSeq,
  OptionType,
  IPassageTypeStrings,
} from '../model';
import { PassageTypeEnum } from '../model/passageType';
import * as actions from '../store';
import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { useSnackBar } from '../hoc/SnackBar';
import { PlanView } from './Sheet/PlanView';
import ScriptureTable from './Sheet/ScriptureTable';
import {
  AppBar,
  Badge,
  Tabs,
  Tab,
  Box,
  FormControl,
  NativeSelect,
  IconButton,
  OutlinedInput,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import PublishOffIcon from '@mui/icons-material/PublicOffOutlined';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import {
  related,
  useOrganizedBy,
  usePlan,
  useFilteredSteps,
  useDiscussionCount,
  getTool,
  ToolSlug,
  remoteId,
  remoteIdGuid,
  findRecord,
  useGraphicUpdate,
  useGraphicFind,
  useSharedResRead,
  PublishDestinationEnum,
  usePublishDestination,
  useMediaCounts,
  useSectionCounts,
  isPersonalTeam,
  useBible,
} from '../crud';
import {
  waitForIt,
  useCheckOnline,
  currentDateTime,
  useDataChanges,
  useWaitForRemoteQueue,
  useCanPublish,
  localUserKey,
  LocalKey,
  rememberCurrentPassage,
} from '../utils';
import {
  isSectionRow,
  isPassageRow,
  wfResequencePassages,
  useWfLocalSave,
  useWfOnlineSave,
  shtNumChanges,
  getSheet,
  isSectionFiltered,
  isPassageFiltered,
  nextNum,
  getMinSection,
} from './Sheet';
import StickyRedirect from './StickyRedirect';
import { useMediaAttach } from '../crud/useMediaAttach';
import { UpdateRecord } from '../model/baseModel';
import { PlanContext } from '../context/PlanContext';
import { UnsavedContext } from '../context/UnsavedContext';
import FilterMenu, { ISTFilterState } from './Sheet/filterMenu';
import {
  projDefBook,
  projDefFilterParam,
  projDefFirstMovement,
  useProjectDefaults,
} from '../crud/useProjectDefaults';
import {
  planSheetSelector,
  scriptureTableSelector,
  planTabsSelector,
  sharedSelector,
  workflowStepsSelector,
  passageTypeSelector,
} from '../selector';
import { UploadType } from './UploadType';
import { useGraphicCreate } from '../crud/useGraphicCreate';
import {
  ApmDim,
  CompressedImages,
  GraphicUploader,
  IGraphicInfo,
  Rights,
} from './GraphicUploader';
import Confirm from './AlertDialog';
import { getDefaultName } from './Sheet/getDefaultName';
import GraphicRights from './GraphicRights';
import { useOrbitData } from '../hoc/useOrbitData';
import { RecordIdentity, RecordKeyMap } from '@orbit/records';
import { getLastVerse } from '../business/localParatext/getLastVerse';
import { OrganizationSchemeStepD } from '../model/organizationSchemeStep';
import { usePeerGroups } from './Peers/usePeerGroups';
import bookSortJson from '../assets/akuosort.json';
import AudioTab from '../components/AudioTab/AudioTab';
import AssignmentTable from './AssignmentTable';
import TranscriptionTab from './TranscriptionTab';
import { HeadHeight } from '../App';
import { ActionHeight, LightTooltip } from '../control';
import { isPublishingTitle } from '../control/passageTypeFromRef';
import { PlanTabEnum } from './PlanTabsEnum';
import { grey } from '@mui/material/colors';
import { addPt } from '../utils/addPt';
import 'react-datasheet/lib/react-datasheet.css';
import MediaPlayer from './MediaPlayer';
import { rowTypes } from './Sheet/rowTypes';
import ConfirmPublishDialog from './ConfirmPublishDialog';
import { Akuo } from '../assets/brands';

const SaveWait = 500;

export interface ICell {
  value: any;
  component?: ReactElement;
  forceComponent?: boolean;
  readOnly?: boolean;
  width?: number;
  className?: string;
}

export interface ICellChange {
  cell: any;
  row: number;
  col: number;
  value: string | null;
}

interface IProps {
  checkSaved: (method: () => void) => void;
}

const ScrollableTabsButtonAuto = (props: IProps) => {
  const { checkSaved } = props;

  const isMobile = useMediaQuery('(max-width:600px)');

  const passages = useOrbitData<Passage[]>('passage');
  const passagesD = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<Section[]>('section');
  const sectionsD = useOrbitData<SectionD[]>('section');
  const plans = useOrbitData<Plan[]>('plan');
  const projects = useOrbitData<ProjectD[]>('project');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const discussions = useOrbitData<Discussion[]>('discussion');
  const sharedresources = useOrbitData<SharedResourceD[]>('sharedresource');
  const groupmemberships = useOrbitData<GroupMembership[]>('groupmembership');
  const graphics = useOrbitData<GraphicD[]>('graphic');
  const workflowSteps = useOrbitData<WorkflowStep[]>('workflowstep');
  const orgWorkflowSteps = useOrbitData<OrgWorkflowStep[]>('orgworkflowstep');
  const organizationSchemeSteps = useOrbitData<OrganizationSchemeStepD[]>(
    'organizationschemestep'
  );

  const t: IPlanTabsStrings = useSelector(planTabsSelector, shallowEqual);
  const st: IScriptureTableStrings = useSelector(
    scriptureTableSelector,
    shallowEqual
  );
  const s: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const wfStr: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const pt: IPassageTypeStrings = useSelector(
    passageTypeSelector,
    shallowEqual
  );

  const lang = useSelector((state: IState) => state.strings.lang);
  const bookSuggestions = useSelector(
    (state: IState) => state.books.suggestions
  );
  const bookMap = useSelector((state: IState) => state.books.map);
  const allBookData = useSelector((state: IState) => state.books.bookData);
  const dispatch = useDispatch();
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const fetchBooks = (lang: string) =>
    dispatch(actions.fetchBooks(lang) as any);
  const { prjId, tabNm } = useParams();
  const [width] = useState(window.innerWidth);
  const [organization] = useGlobal('organization');
  const [team] = useGlobal('organization');
  const [project] = useGlobal('project'); //will be constant here
  const [plan] = useGlobal('plan'); //will be constant here
  const [coordinator] = useGlobal('coordinator');
  const [developer] = useGlobal('developer');
  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const [user] = useGlobal('user');
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [, setBusy] = useGlobal('importexportBusy');
  const [playingMediaId, setPlayingMediaId] = useGlobal('playingMediaId');
  const myChangedRef = useRef(false);
  const savingRef = useRef(false);
  const updateRef = useRef(false);
  const doForceDataChanges = useRef(false);
  const { showMessage } = useSnackBar();
  const getGlobal = useGetGlobal();

  const ctx = React.useContext(PlanContext);
  const {
    flat,
    scripture,
    shared,
    sectionArr,
    tab,
    setTab,
    publishingOn,
    hidePublishing,
    setCanAddPublishing,
    togglePublishing,
    connected,
  } = ctx.state;

  const { getOrganizedBy } = useOrganizedBy();
  const organizedBy = getOrganizedBy(false);
  const organizedByPlural = getOrganizedBy(false);
  const [sheet, setSheetx] = useState<ISheet[]>([]);
  const sheetRef = useRef<ISheet[]>([]);
  const sheetDivRef = useRef<HTMLElement>(null);
  const [, setComplete] = useGlobal('progress');
  const [confirmPublishingVisible, setConfirmPublishingVisible] =
    useState(false);
  const [view] = useState('');
  const [lastSaved, setLastSaved] = useState<string>();
  const toolId = 'scriptureTable';
  const {
    saveRequested,
    clearRequested,
    clearCompleted,
    startSave,
    waitForSave,
    saveCompleted,
    toolChanged,
    toolsChanged,
    isChanged,
    anySaving,
  } = useContext(UnsavedContext).state;
  const forceDataChanges = useDataChanges();
  const [uploadGraphicVisible, setUploadGraphicVisible] = useState(false);
  const cancelled = useRef(false);
  const uploadItem = useRef<ISheet>();
  const [defaultFilename, setDefaultFilename] = useState('');
  const [uploadType, setUploadType] = useState<UploadType>();
  const [curGraphicRights, setCurGraphicRights] = useState('');
  const [graphicFullsizeUrl, setGraphicFullsizeUrl] = useState('');
  const graphicCreate = useGraphicCreate();
  const graphicUpdate = useGraphicUpdate();
  const graphicFind = useGraphicFind();
  const { getPlan } = usePlan();
  const localSave = useWfLocalSave({ setComplete });
  const onlineSave = useWfOnlineSave({ setComplete });
  const [detachPassage] = useMediaAttach();
  const checkOnline = useCheckOnline('ScriptureTable');
  const getStepsBusy = useRef(false);
  const [orgSteps, setOrgSteps] = useState<OrgWorkflowStepD[]>([]);
  const { myGroups } = usePeerGroups();
  const {
    getProjectDefault,
    setProjectDefault,
    canSetProjectDefault,
    getLocalDefault,
    setLocalDefault,
  } = useProjectDefaults();
  const { getSharedResource } = useSharedResRead();
  const getFilteredSteps = useFilteredSteps();
  const getDiscussionCount = useDiscussionCount({
    mediafiles,
    discussions,
    groupmemberships,
  });
  const { getPublishTo, publishStatus } = usePublishDestination();
  const [defaultFilterState, setDefaultFilterState] = useState<ISTFilterState>({
    minStep: '', //orgworkflow step to show this step or after
    maxStep: '', //orgworkflow step to show this step or before
    hideDone: false,
    minSection: 1,
    maxSection: -1,
    assignedToMe: false,
    disabled: false,
    canHideDone: true,
  });
  const [firstMovement, setFirstMovement] = useState(1);
  const [projFirstMovement, setProjFirstMovement] = useState(1);
  const [filterState, setFilterState] =
    useState<ISTFilterState>(defaultFilterState);

  const [planMedia, attached, trans] = useMediaCounts(plan, mediafiles);
  const [planSectionIds, assigned, planPassages] = useSectionCounts(
    plan,
    sections,
    passages
  );
  const { canAddPublishing } = useCanPublish();
  const [data] = useState(Array<Array<ICell>>());
  const suggestionRef = useRef<Array<OptionType>>();
  const saveTimer = useRef<NodeJS.Timeout>();
  const preventSaveRef = useRef<boolean>(false);
  const currentRowRef = useRef<number>(-1);
  const [, setCurrentRowx] = useState(-1);
  const [srcMediaId, setSrcMediaId] = useState('');
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [warning] = useState<string>();
  const [toRow, setToRow] = useState(0);
  const [changed] = useState(false); //for button enabling
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishSectionIndex, setPublishSectionIndex] = useState<number | null>(
    null
  );
  const changedRef = useRef(false); //for autosave
  const [saving, setSaving] = useState(false);
  const rowsPerPage = useRef(20);
  const [scrollCount] = useState(0);
  const [curTop, setCurTop] = useState(0);
  const [org] = useGlobal('organization');
  const [hasBible, setHasBible] = useState(false);
  const { getOrgBible } = useBible();

  const local: LocalStrings = {
    sectionSeq: organizedBy,
    title: st.title,
    passageSeq: st.passage,
    book: st.book,
    reference: st.reference,
    comment: st.description,
    action: st.extras,
  };

  const colNames = React.useMemo(() => {
    return scripture && flat
      ? flatScrColNames
      : scripture && !flat
        ? levScrColNames
        : flat
          ? flatGenColNames
          : levGenColNames;
  }, [scripture, flat]);

  const rowinfo = useMemo(() => {
    const totalSections = new Set(
      sheet
        .filter(
          (s) =>
            !s.deleted &&
            ((publishingOn && !hidePublishing) ||
              (s.sectionSeq > 0 && Math.trunc(s.sectionSeq) === s.sectionSeq))
        )
        .map((s) => s.sectionSeq)
    ).size;
    const specialSections =
      !publishingOn || hidePublishing
        ? 0
        : new Set(
            sheet
              .filter(
                (s) =>
                  s.sectionSeq < 0 || Math.trunc(s.sectionSeq) !== s.sectionSeq
              )
              .map((s) => s.sectionSeq)
          ).size;
    const filtered = sheet.filter((s) => !s.deleted && !s.filtered);
    const showingSections = new Set(filtered.map((s) => s.sectionSeq)).size;
    if (showingSections < totalSections) {
      local.sectionSeq = (
        <Badge
          badgeContent=" "
          variant="dot"
          color="secondary"
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          {organizedBy +
            ' (' +
            (showingSections - specialSections) +
            '/' +
            (totalSections - specialSections) +
            ')'}
        </Badge>
      );
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, width, colNames, flat, publishingOn, organizedBy]);

  const rowInfo = rowinfo;

  const { isMovement } = rowTypes(rowinfo);

  const showAssign = useMemo(
    () => !isPersonalTeam(team, teams) && !offlineOnly,
    [team, teams, offlineOnly]
  );

  const handleChange = (event: any, value: number) => {
    if (getGlobal('remoteBusy')) return;
    event.persist();
    setTab(value);
  };

  const firstBook = useMemo(
    () =>
      scripture
        ? (sheet.find((b) => !b.deleted && (b.book ?? '') !== '')?.book ?? '')
        : getProjectDefault(projDefBook),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scripture, sheet]
  );

  const publishingTitle = (passageType: PassageTypeEnum) =>
    passageType + ' ' + firstBook;

  const getFilter = (fs: ISTFilterState) => {
    const filter = (getLocalDefault(projDefFilterParam) ??
      getProjectDefault(projDefFilterParam) ??
      fs) as ISTFilterState;

    if (filter.minStep && !isNaN(Number(filter.minStep)))
      filter.minStep = remoteIdGuid(
        'orgworkflowstep',
        filter.minStep,
        memory?.keyMap as RecordKeyMap
      ) as string;
    return filter;
  };

  interface LocalStrings {
    [key: string]: ReactNode;
  }

  const onFilterChange = (
    filter: ISTFilterState | undefined | null,
    projDefault: boolean
  ) => {
    if (filter === null) filter = defaultFilterState;
    setLocalDefault(projDefFilterParam, filter);
    if (projDefault) {
      let def;
      if (filter) {
        def = { ...filter };
        //convert steps to remote id
        if (filter.minStep)
          def.minStep = remoteId(
            'orgworkflowstep',
            filter.minStep,
            memory?.keyMap as RecordKeyMap
          ) as string;
        if (filter.maxStep)
          def.maxStep = remoteId(
            'orgworkflowstep',
            filter.maxStep,
            memory?.keyMap as RecordKeyMap
          ) as string;
      }
      setProjectDefault(projDefFilterParam, def);
    }
    if (filter) setFilterState(() => filter as ISTFilterState);
    else setFilterState(getFilter(defaultFilterState));
  };

  const setSheet = (ws: ISheet[]) => {
    sheetRef.current = ws;
    setSheetx(ws);
    const anyPublishing = !getGlobal('offline')
      ? ws.some((s) => isPublishingTitle(s.reference ?? '', flat))
      : false;
    if (publishingOn !== anyPublishing) setCanAddPublishing(anyPublishing);
  };

  const setChanged = (value: boolean) => {
    myChangedRef.current = value;
    toolChanged(toolId, value);
  };

  const setUpdate = (value: boolean) => (updateRef.current = value);

  const insertAt = (arr: Array<any>, item: any, index?: number) => {
    if (index === undefined) {
      return [...arr.concat([item])];
    } else {
      const newArr = arr.map((v, i) =>
        i < index ? v : i === index ? item : arr[i - 1]
      );
      return [...newArr.concat([arr.pop()])];
    }
  };

  const updateRowAt = (arr: Array<any>, item: any, index: number) => {
    const newArr = arr.map((v, i) =>
      i < index ? v : i === index ? item : arr[i]
    );
    return newArr;
  };

  const addPassageTo = (
    level: SheetLevel,
    myWorkflow: ISheet[],
    ptype: PassageTypeEnum | undefined,
    i?: number,
    before?: boolean,
    title?: string,
    reference?: string
  ) => {
    let lastRow = myWorkflow.length - 1;
    while (lastRow >= 0 && (myWorkflow[lastRow] as ISheet).deleted)
      lastRow -= 1;
    let index = i === undefined && lastRow >= 0 ? lastRow : i || 0;
    const newRow = {
      ...myWorkflow[index],
      level: flat && level ? level : SheetLevel.Passage,
      kind: flat ? IwsKind.SectionPassage : IwsKind.Passage,
      book: scripture ? firstBook : '',
      reference: reference ?? ptype ?? '',
      mediaId: undefined,
      comment: title ?? '',
      passageUpdated: currentDateTime(),
      passage: undefined,
      passageType: ptype ?? PassageTypeEnum.PASSAGE,
      mediaShared: shared ? IMediaShare.None : IMediaShare.NotPublic,
      deleted: false,
      filtered: false,
    } as ISheet;

    if (flat && isSectionRow(myWorkflow[index] as ISheet)) {
      //no passage on this row yet
      myWorkflow = wfResequencePassages(
        updateRowAt(myWorkflow, newRow, index),
        index,
        flat
      );
      return myWorkflow;
    } else {
      myWorkflow = insertAt(
        myWorkflow,
        newRow,
        index < lastRow ? index + 1 : undefined
      );
      /* how could this have ever been true? We've checked flat and section row above
      if (
        before &&
        isSectionRow(myWorkflow[index]) &&
        isPassageRow(myWorkflow[index])
      ) {
        //move passage data from section row to new empty row
        xmovePassageDown(myWorkflow, index);
      } */
      while (index >= 0 && !isSectionRow(myWorkflow[index] as ISheet))
        index -= 1;
      return wfResequencePassages(myWorkflow, index, flat);
    }
  };

  const getByIndex = (ws: ISheet[], index: number) => {
    let n = 0;
    let i = 0;
    while (i < ws.length) {
      if (!(ws[i] as ISheet).deleted && !(ws[i] as ISheet).filtered) {
        if (n === index) break;
        n += 1;
      }
      i += 1;
    }
    return { ws: i < ws.length ? ws[i] : undefined, i };
  };

  const doDetachMedia = async (ws: ISheet | undefined) => {
    if (!ws) return false;
    if (ws.passage) {
      const attached = mediafiles.filter(
        (m) => related(m, 'passage') === ws.passage?.id
      ) as MediaFileD[];
      if (detachPassage) {
        for (let ix = 0; ix < attached.length; ix++) {
          await detachPassage(
            ws.passage?.id || '',
            related(ws.passage, 'section'),
            plan,
            (attached[ix] as MediaFileD).id
          );
        }
      }
    }
    return true;
  };

  const saveIfChanged = (cb: () => void) => {
    if (myChangedRef.current) {
      startSave();
      waitForSave(cb, SaveWait);
    } else cb();
  };

  const graphicsClosed = (v: boolean) => {
    setUploadType(v ? UploadType.Graphic : undefined);
    setUploadGraphicVisible(v);
  };

  const handleGraphic = (i: number) => {
    saveIfChanged(() => {
      setUploadType(UploadType.Graphic);
      const { ws } = getByIndex(sheetRef.current, i);
      const defaultName = getDefaultName(ws, 'graphic', memory, plan);
      setDefaultFilename(defaultName);
      uploadItem.current = ws;
      setGraphicFullsizeUrl(ws?.graphicFullSizeUrl ?? '');
      setCurGraphicRights(ws?.graphicRights ?? '');
    });
  };
  useEffect(() => {
    setUploadGraphicVisible(uploadType === UploadType.Graphic);
  }, [uploadType]);

  const handleRightsChange = (graphicRights: string) => {
    const ws = uploadItem.current;
    if (ws) uploadItem.current = { ...ws, graphicRights };
    setCurGraphicRights(graphicRights);
  };

  const afterConvert = async (images: CompressedImages[]) => {
    const ws = uploadItem.current;
    const resourceType = ws?.kind === IwsKind.Section ? 'section' : 'passage';
    const secRec: Section | undefined =
      ws?.kind === IwsKind.Section
        ? (findRecord(memory, 'section', ws?.sectionId?.id ?? '') as Section)
        : undefined;
    const resourceId =
      ws?.kind === IwsKind.Section
        ? parseInt(secRec?.keys?.remoteId ?? '0')
        : parseInt(ws?.passage?.keys?.remoteId ?? '0');
    const graphicRec = graphics.find(
      (g) =>
        g.attributes.resourceType === resourceType &&
        g.attributes.resourceId === resourceId
    );
    const curData = JSON.parse(
      graphicRec?.attributes?.info || '{}'
    ) as IGraphicInfo;
    if (curData[Rights] !== ws?.graphicRights || images.length > 0) {
      showMessage(ts.saving);
      const infoData: IGraphicInfo = {
        ...curData,
        [Rights]: ws?.graphicRights,
      };
      images.forEach((image) => {
        infoData[image.dimension.toString()] = image;
      });
      const info = JSON.stringify(infoData);
      if (graphicRec) {
        await graphicUpdate({
          ...graphicRec,
          attributes: { ...graphicRec.attributes, info },
        });
      } else if (images.length > 0) {
        await graphicCreate({ resourceType, resourceId, info });
      }
    }
    if (images.length > 0) showMessage(ts.uploadSuccess);
    setUploadType(undefined);
  };

  const handleUploadGraphicVisible = (v: boolean) => {
    if (!v && Boolean(uploadType)) {
      afterConvert([]).then(() => {
        graphicsClosed(false);
      });
    } else {
      graphicsClosed(v);
    }
  };

  const updateLastModified = async () => {
    const planRec = getPlan(plan) as PlanD;
    if (planRec !== null) {
      //do this even if the wait above failed
      //don't use sections here, it hasn't been updated yet
      const plansections = memory.cache.query((qb) =>
        qb.findRecords('section')
      ) as Section[];
      planRec.attributes.sectionCount = plansections.filter(
        (s) => related(s, 'plan') === plan
      ).length;
      await memory.update((t) => UpdateRecord(t, planRec, user));
    }
  };

  const getLastModified = (plan: string) => {
    if (plan) {
      const planRec = getPlan(plan) as PlanD;
      if (planRec !== null) setLastSaved(planRec.attributes.dateUpdated);
      else setLastSaved('');
    }
  };

  useEffect(() => {
    setFilterState(getFilter(defaultFilterState));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, defaultFilterState]);
  useEffect(() => {
    const fm = getProjectDefault(projDefFirstMovement) as number;
    setFirstMovement(fm ?? 1);
    setProjFirstMovement(fm ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  useEffect(() => {
    if (!getStepsBusy.current) {
      getStepsBusy.current = true;
      getFilteredSteps((orgSteps) => {
        getStepsBusy.current = false;
        const newOrgSteps = orgSteps.sort(
          (i, j) => i.attributes.sequencenum - j.attributes.sequencenum
        );
        setOrgSteps(newOrgSteps);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowSteps, orgWorkflowSteps, organization]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const minSection = useMemo(() => getMinSection(sheetRef.current), [sheet]);
  const maxSection = sheet[sheet.length - 1]?.sectionSeq ?? 0;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const filtered = useMemo(() => {
    return (
      !filterState.disabled &&
      (filterState.minStep !== '' ||
        filterState.maxStep !== '' ||
        filterState.hideDone ||
        filterState.minSection > minSection ||
        (filterState.maxSection > -1 && filterState.maxSection < maxSection) ||
        filterState.assignedToMe)
    );
  }, [filterState, minSection, maxSection]);

  useEffect(() => {
    if (minSection !== defaultFilterState.minSection) {
      setDefaultFilterState((fs) => ({ ...fs, minSection }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSection]);

  const doneStepId = useMemo(() => {
    if (getStepsBusy.current) return 'notready';
    const tmp = orgSteps.find(
      (s) => getTool(s.attributes?.tool) === ToolSlug.Done
    );

    if (defaultFilterState.canHideDone !== Boolean(tmp))
      setDefaultFilterState((fs) => ({
        ...fs,
        canHideDone: Boolean(tmp),
      }));
    return tmp?.id ?? 'noDoneStep';
  }, [defaultFilterState, orgSteps]);

  // Save locally or online in batches
  useEffect(() => {
    let prevSave = '';
    const handleSave = async () => {
      const numChanges = shtNumChanges(sheetRef.current, prevSave);
      if (firstMovement !== projFirstMovement)
        setProjectDefault(projDefFirstMovement, firstMovement);
      if (numChanges === 0) return;
      for (const ws of sheetRef.current) {
        if (ws.deleted) await doDetachMedia(ws);
      }
      setComplete(10);
      const saveFn = async (sheet: ISheet[]) => {
        if (!offlineOnly && numChanges > 10) {
          return await onlineSave(sheet, prevSave);
        } else {
          await localSave(sheet, sectionsD, passagesD, prevSave);
          return false;
        }
      };
      if (numChanges > 50) setBusy(true);
      let change = false;
      let start = 0;
      const newsht = [...sheetRef.current];
      if (!offlineOnly) {
        let end = 200;
        for (; start + 200 < newsht.length; start += end) {
          setComplete(Math.floor((90 * start) / numChanges) + 10);
          end = 200;
          while (!isSectionRow(newsht[start + end] as ISheet) && end > 0)
            end -= 1;
          if (end === 0) {
            //find the end
            end = 200;
            while (
              end < newsht.length &&
              !isSectionRow(newsht[start + end] as ISheet)
            )
              end++;
          }
          change = (await saveFn(newsht.slice(start, start + end))) || change;
        }
      }
      change = (await saveFn(newsht.slice(start))) || change;
      //update plan section count and lastmodified
      await updateLastModified();
      //not sure we need to do this because its going to be requeried next
      if (change) setSheet(newsht);
      setBusy(false);
    };
    const setSaving = (value: boolean) => (savingRef.current = value);
    const doneSaving = () => {
      setSaving(false);
      setLastSaved(currentDateTime()); //force refresh the sheet
      saveCompleted(toolId);
      setComplete(100);
      setUpdate(false);
    };
    const save = () => {
      if (!savingRef.current && !updateRef.current) {
        setSaving(true);
        setUpdate(true);
        setChanged(false);
        prevSave = lastSaved || '';
        showMessage(st.saving);
        handleSave().then(() => {
          if (doForceDataChanges.current) {
            waitForRemoteQueue(st.publishingWarning).then(() => {
              forceDataChanges().then(() => doneSaving());
            });
            doForceDataChanges.current = false;
          } else {
            doneSaving();
          }
        });
      }
    };
    myChangedRef.current = isChanged(toolId);
    if (saveRequested(toolId)) {
      //wait a beat for the save to register
      setTimeout(() => {
        waitForIt(
          'saving sheet recordings',
          () => !anySaving(toolId) && !updateRef.current,
          () => false,
          10000
        ).finally(() => {
          if (offlineOnly) {
            save();
          } else {
            checkOnline((online) => {
              if (!online) {
                saveCompleted(toolId, ts.NoSaveOffline);
                showMessage(ts.NoSaveOffline);
                setSaving(false);
                setUpdate(false);
              } else {
                save();
              }
            });
          }
        });
      }, 100);
    } else if (clearRequested(toolId)) {
      clearCompleted(toolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  // load data when tables change (and initally)
  useEffect(() => {
    if (scripture && allBookData.length === 0) fetchBooks(lang);
    if (
      !savingRef.current &&
      !myChangedRef.current &&
      plan &&
      !updateRef.current
    ) {
      setUpdate(true);
      const newWorkflow = getSheet({
        plan,
        sections: sectionsD,
        passages: passagesD,
        organizationSchemeSteps,
        flat,
        projectShared: shared,
        memory,
        orgWorkflowSteps: orgSteps,
        wfStr,
        filterState,
        minSection,
        hasPublishing: publishingOn,
        hidePublishing,
        doneStepId,
        getDiscussionCount,
        graphicFind,
        getPublishTo,
        publishStatus,
        getSharedResource,
        user,
        myGroups,
        isDeveloper: developer,
      });
      setSheet(newWorkflow);

      getLastModified(plan);
      setUpdate(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    organizationSchemeSteps,
    plan,
    sections,
    passages,
    mediafiles,
    graphics,
    sharedresources,
    flat,
    shared,
    orgSteps,
    lastSaved,
    hidePublishing,
  ]);

  useEffect(() => {
    const newWork: ISheet[] = [];
    let changed = false;
    let sectionfiltered = false;
    let filtered = false;

    if (!updateRef.current) {
      setUpdate(true);
      let sectionIndex = -1;
      let sectionScheme: RecordIdentity | undefined;
      let hasOnePassage = false;
      sheetRef.current.forEach((s: ISheet, index: number) => {
        if (isSectionRow(s)) {
          if (sectionIndex >= 0) {
            if (!hasOnePassage && filterState.assignedToMe && !flat) {
              (newWork[sectionIndex] as ISheet).filtered = true;
            }
          }
          sectionIndex = index;
          sectionScheme = s.scheme;
          hasOnePassage = false;
          sectionfiltered = isSectionFiltered(
            filterState,
            minSection,
            s.sectionSeq,
            hidePublishing,
            s.reference || ''
          );
          if (
            !sectionfiltered &&
            hidePublishing &&
            s.kind === IwsKind.Section &&
            s.level !== SheetLevel.Section
          ) {
            let allMyPassagesArePublishing = true;
            for (
              let ix = index + 1;
              ix < sheetRef.current.length &&
              isPassageRow(sheetRef.current[ix] as ISheet) &&
              allMyPassagesArePublishing;
              ix++
            ) {
              if (
                !isPublishingTitle(
                  (sheetRef.current[ix] as ISheet).reference,
                  flat
                )
              ) {
                allMyPassagesArePublishing = false;
              }
            }
            sectionfiltered = allMyPassagesArePublishing;
          }
        }
        if (isPassageRow(s)) {
          filtered =
            sectionfiltered ||
            isPassageFiltered(
              s,
              filterState,
              minSection,
              hidePublishing,
              orgSteps,
              doneStepId,
              sectionScheme,
              s.assign,
              user,
              myGroups
            );
        } else filtered = sectionfiltered;
        hasOnePassage ||= s.kind === IwsKind.Passage && filtered === false;
        if (filtered !== s.filtered) changed = true;
        newWork.push({
          ...s,
          filtered,
        });
      });
      if (sectionIndex >= 0) {
        if (!hasOnePassage && filterState.assignedToMe) {
          (newWork[sectionIndex] as ISheet).filtered = true;
        }
      }

      if (changed) {
        setSheet(newWork);
      }
      setUpdate(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSteps, filterState, doneStepId, hidePublishing, flat]);

  const bookSortMap = new Map<string, string>(
    bookSortJson as [string, string][]
  );

  const updateBook = (seq: number, book: string) => {
    const idx = sheet.findIndex((s) => s.sectionSeq === seq && !s.deleted);
    if (idx !== -1) {
      const newsht = [...sheetRef.current];
      const parse = sheet[idx]?.reference?.split(' ');
      const reference = `${parse?.[0]} ${book}`;
      newsht[idx] = { ...sheet[idx], reference } as ISheet;
      setSheet(newsht);
    }
  };

  useEffect(() => {
    if (firstBook && scripture) {
      const bookSrt = getProjectDefault(projDefBook);
      const firstSort = bookSortMap.get(firstBook as string) ?? '000';
      if (!bookSrt || bookSrt !== firstSort) {
        setProjectDefault(projDefBook, firstSort);
        updateBook(AltBkSeq, firstBook as string);
        updateBook(BookSeq, firstBook as string);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstBook, scripture]);

  useEffect(() => {
    if (tab === undefined) {
      setTab(tabNm && /^[0-4]+$/.test(tabNm) ? parseInt(tabNm) : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (org) {
      const bible = getOrgBible(org);
      setHasBible((bible?.attributes.bibleName ?? '') !== '');
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const handleSave = () => {
    startSave();
  };

  const handleOpenPublishDialog = (index: number) => {
    setPublishSectionIndex(index);
    setConfirmPublish(true);
  };
  const publishConfirm = async (destinations: PublishDestinationEnum[]) => {
    if (publishSectionIndex !== null) {
      await setSectionPublish(publishSectionIndex, destinations);
    }
    setConfirmPublish(false);
    setPublishSectionIndex(null);
  };
  const publishRefused = () => {
    setConfirmPublish(false);
    setPublishSectionIndex(null);
  };

  const bodyChildren = () => {
    if (!sheetDivRef.current) return undefined;
    const gridRef = (
      sheetDivRef.current as HTMLDivElement
    ).getElementsByClassName('data-grid-container');
    return gridRef[0]?.firstChild?.firstChild?.childNodes;
  };

  const sheetScroll = () => {
    if (sheetRef.current && currentRowRef.current) {
      const tbodyNodes = bodyChildren();
      const tbodyRef =
        tbodyNodes && (tbodyNodes[currentRowRef.current] as HTMLDivElement);
      //only scroll if it's not already visible
      if (tbodyRef && tbodyRef.offsetTop < document.documentElement.scrollTop) {
        window.scrollTo(0, tbodyRef.offsetTop - 10);
      } else if (
        tbodyRef &&
        tbodyRef.offsetTop >
          document.documentElement.scrollTop +
            document.documentElement.clientHeight -
            ActionHeight -
            200
      ) {
        const adjust = Math.min(rowsPerPage.current, currentRowRef.current);
        window.scrollTo(0, tbodyRef.offsetTop + 10 - adjust * 20);
      }
    }
    return false;
  };

  const setCurrentRow = (row: number) => {
    if (row > rowinfo.length) return;
    currentRowRef.current = row;
    setCurrentRowx(row);
    if (row > 0)
      rememberCurrentPassage(memory, rowinfo[row - 1].passage?.id ?? '');
  };

  const onPlayStatus = (mediaId: string) => {
    if (mediaId === srcMediaId) {
      // Toggle play/pause for the current media
      const newPlaying = !mediaPlaying;
      setMediaPlaying(newPlaying);
      setPlayingMediaId(newPlaying ? mediaId : '');
    } else {
      // Switch to a new media
      setSrcMediaId(mediaId);
      setMediaPlaying(true);
      setPlayingMediaId(mediaId);
    }
  };

  // Stop playing when another media starts playing elsewhere (e.g., in title column)
  useEffect(() => {
    if (playingMediaId !== srcMediaId && mediaPlaying) {
      setMediaPlaying(false);
    }
  }, [playingMediaId, srcMediaId, mediaPlaying]);

  const handleAutoSave = () => {
    if (
      changedRef.current &&
      !preventSaveRef.current &&
      !getGlobal('alertOpen')
    ) {
      handleSave();
    } else {
      startSaveTimer();
    }
  };

  const startSaveTimer = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => {
        handleAutoSave();
      },
      1000 * 60 * 5
    );
  };

  useEffect(() => {
    let timeoutRef: NodeJS.Timeout | undefined = undefined;
    if (rowInfo) {
      const lastPasId = localStorage.getItem(localUserKey(LocalKey.passage));
      let row = -1;
      if (lastPasId) {
        const pasGuid = remoteIdGuid(
          'passage',
          lastPasId,
          memory?.keyMap as RecordKeyMap
        );
        row = rowInfo.findIndex((r) => r.passage?.id === pasGuid);
      }
      if (row >= 0) {
        const tableNodes = bodyChildren();
        const tbodyRef = tableNodes && tableNodes[row + 1];
        if (tbodyRef) {
          setCurrentRow(row + 1);
          sheetScroll();
          // The useEffect will trigger when sheet is present but
          // if sheet is present and we aren't ready, set a half
          // second timeout and check again
        } else if (sheetRef.current) {
          timeoutRef = setTimeout(() => {
            setToRow(toRow + 1);
          }, 500);
        }
      }
    }

    return () => {
      if (timeoutRef) clearTimeout(timeoutRef);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowInfo, toRow]);

  useEffect(() => {
    changedRef.current = isChanged(toolId);
    if (changedRef.current !== changed) setChanged(changedRef.current);
    const isSaving = saveRequested(toolId);
    if (isSaving !== saving) setSaving(isSaving);
    if (clearRequested(toolId)) {
      changedRef.current = false;
      clearCompleted(toolId);
    }
    if (changedRef.current) {
      if (saveTimer.current === undefined) startSaveTimer();
      if (!connected && !offlineOnly) {
        checkOnline((online) => {
          if (!online) showMessage(ts.NoSaveOffline);
        }, true);
      }
    } else {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
    }
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = undefined;
      }
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [toolsChanged]);

  const handlePublishToggle: MouseEventHandler<HTMLButtonElement> = () => {
    if (!canAddPublishing && !publishingOn) {
      showMessage(addPt(s.paratextRequired));
      return;
    }
    if (filtered && !publishingOn) {
      showMessage(s.removeFilter);
      return;
    }
    if (warning) {
      showMessage(s.refErr);
      return;
    }
    onPublishing(false);
  };

  useEffect(() => {
    //if I set playing when I set the mediaId, it plays a bit of the old
    if (srcMediaId) setMediaPlaying(true);
  }, [srcMediaId]);

  useEffect(() => {
    suggestionRef.current = bookSuggestions;
  }, [bookSuggestions]);

  const playEnded = () => {
    setMediaPlaying(false);
    // Clear the global playing media ID when playback ends
    if (playingMediaId === srcMediaId) {
      setPlayingMediaId('');
    }
  };

  useEffect(() => {
    const tbodyNodes = bodyChildren();
    if (tbodyNodes) {
      const currentOff = document.documentElement.scrollTop;
      let bottom = 1;
      let top = tbodyNodes.length - 1;
      while (bottom < top) {
        const mid = Math.floor((bottom + top) / 2);
        if ((tbodyNodes[mid] as HTMLDivElement).offsetTop < currentOff) {
          bottom = mid + 1;
        } else {
          top = mid;
        }
      }
      if (bottom !== curTop) setCurTop(bottom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, scrollCount]);

  const setSectionPublish = async (
    index: number,
    destinations: PublishDestinationEnum[]
  ) => {
    await waitForRemoteQueue(st.publishingWarning);
    if (savingRef.current || updateRef.current) {
      showMessage(st.saving);
      return;
    }
    setUpdate(true);
    const { ws } = getByIndex(sheetRef.current, index);
    if (ws) {
      const newsht = [...sheetRef.current];
      newsht[index] = {
        ...ws,
        published: destinations,
        sectionUpdated: currentDateTime(),
      };
      //if this is a movement...publish all the sections below it
      if (
        ws.published !== destinations &&
        destinations.includes(PublishDestinationEnum.PropagateSection) &&
        ws.level === SheetLevel.Movement
      ) {
        let i = index + 1;
        while (i < newsht.length) {
          if ((newsht[i] as ISheet).level === SheetLevel.Movement) break;
          if (
            isSectionRow(newsht[i] as ISheet) &&
            (newsht[i] as ISheet).published !== destinations
          ) {
            newsht[i] = {
              ...newsht[i],
              published: destinations,
              sectionUpdated: currentDateTime(),
            } as ISheet;
          }
          i++;
        }
      }
      setSheet(newsht);
      setChanged(true);
      doForceDataChanges.current = true;
    }
    setUpdate(false);
  };

  const onPublishing = async (update: boolean) => {
    if (!firstBook) {
      showMessage(scripture ? st.setupScriptureBook : st.setupGeneralBook);
      return;
    }
    if (update) await doPublish();
    else if (!hidePublishing)
      togglePublishing(); //turn it off
    //if we're going to show now and we don't already have some rows...ask
    else if (!publishingOn) setConfirmPublishingVisible(true);
    else togglePublishing(); //turn it on - no update
  };
  const onPublishingReject = () => {
    setConfirmPublishingVisible(false);
  };
  const onPublishingConfirm = async () => {
    setConfirmPublishingVisible(false);
    await doPublish();
    togglePublishing();
  };

  const hasBookTitle = async (bookType: PassageTypeEnum) => {
    if (
      sheetRef.current.findIndex(
        (s: ISheet) => !s.deleted && s.passageType === bookType
      ) < 0
    ) {
      //see if we have this book anywhere in the team
      //ask remote about this if we have a remote
      const teamprojects = projects
        .filter((p) => related(p, 'organization') === organization)
        .map((p) => p.id);
      const teamplans = plans
        .filter((p) => teamprojects.includes(related(p, 'project')))
        .map((p) => p.id);
      let foundIt = Boolean(
        sections.find(
          (s) =>
            s.attributes?.state === publishingTitle(bookType) &&
            teamplans.includes(related(s, 'plan'))
        )
      );
      if (!foundIt && remote) {
        const bts = (await remote.query((qb) =>
          qb
            .findRecords('section')
            .filter({ attribute: 'state', value: publishingTitle(bookType) })
        )) as SectionD[];
        foundIt = Boolean(
          bts.find((s) => teamplans.includes(related(s, 'plan')))
        );
      }
      return foundIt;
    }
    return true;
  };

  const alternateName = (name: string) => st.alternateName.replace('{0}', name);

  const chapterNumberTitle = (chapter: number) =>
    st.chapter.replace('{0}', chapter.toString());

  const AddBook = (newsht: ISheet[], passageType: PassageTypeEnum) => {
    const sequencenum =
      passageType === PassageTypeEnum.BOOK ? BookSeq : AltBkSeq;
    const baseName = scripture
      ? firstBook
        ? (bookMap[firstBook as string] ?? '')
        : ''
      : (firstBook as string);

    if (baseName) {
      const title =
        passageType === PassageTypeEnum.BOOK
          ? baseName
          : alternateName(baseName as string);
      const newRow = {
        level: SheetLevel.Book,
        kind: IwsKind.Section,
        sectionSeq: sequencenum,
        passageSeq: 0,
        reference: publishingTitle(passageType),
        title,
        passageType: passageType,
      } as ISheet;
      return newsht.concat([newRow]);
    }
    return newsht;
  };

  const isKind = (
    row: number,
    kind: PassageTypeEnum,
    ws: ISheet[] = sheetRef.current
  ) => {
    return row >= 0 && row < ws.length
      ? (ws[row] as ISheet).passageType === kind &&
          (ws[row] as ISheet).deleted === false
      : false;
  };

  const chapterNumberReference = (chapter: number) =>
    PassageTypeEnum.CHAPTERNUMBER + ' ' + chapter.toString();

  const addChapterNumber = (newsht: ISheet[], chapter: number) => {
    if (chapter > 0) {
      const title = chapterNumberTitle(chapter);
      return addPassageTo(
        SheetLevel.Section,
        newsht,
        PassageTypeEnum.CHAPTERNUMBER,
        undefined,
        undefined,
        title,
        chapterNumberReference(chapter)
      );
    }
    return newsht;
  };

  const doPublish = async () => {
    let currentChapter = 0;

    const startChapter = (s: ISheet) => {
      const startchap = s.passage?.attributes?.startChapter ?? 0;
      const endchap = s.passage?.attributes?.endChapter ?? 0;
      if (startchap > 0 && startchap !== endchap) {
        const lastverse = getLastVerse(s.book ?? '', startchap) ?? 0;
        if (lastverse > 0) {
          const startverse = s.passage?.attributes.startVerse ?? 0;
          const endverse = s.passage?.attributes.endVerse ?? 0;
          if (endverse > lastverse - startverse + 1) {
            return endchap;
          }
        }
      }
      return startchap;
    };

    const chapterChanged = (s: ISheet) =>
      s.passageType === PassageTypeEnum.PASSAGE &&
      s.book === firstBook &&
      startChapter(s) > 0 &&
      startChapter(s) !== currentChapter;

    const haveChapterNumber = (
      sht: ISheet[],
      nextchap: number,
      startcheck: number,
      endcheck: number
    ) => {
      let gotit = false;

      while (startcheck++ < endcheck) {
        if (
          isKind(startcheck, PassageTypeEnum.CHAPTERNUMBER) &&
          (sht[startcheck] as ISheet).reference ===
            chapterNumberReference(nextchap)
        ) {
          gotit = true;
        }
      }
      return gotit;
    };
    let newworkflow: ISheet[] = [];
    if (savingRef.current || updateRef.current) {
      showMessage(st.saving);
      return;
    }
    setUpdate(true);
    if (!(await hasBookTitle(PassageTypeEnum.BOOK)))
      newworkflow = AddBook(newworkflow, PassageTypeEnum.BOOK);

    if (!(await hasBookTitle(PassageTypeEnum.ALTBOOK)))
      newworkflow = AddBook(newworkflow, PassageTypeEnum.ALTBOOK);
    let nextpsg = 0;
    const sht = sheetRef.current;
    sht.forEach((s: ISheet, index: number) => {
      //if flat the title has to come before the section
      //otherwise we want it as the first passage in the section
      if (isSectionRow(s)) {
        nextpsg = 0;

        //copy the section
        //we won't change sequence numbers on hierarchical
        newworkflow = newworkflow.concat([{ ...s }]);
        //do I need a chapter number?
        const vernpsg = sht.findIndex(
          (r: ISheet) =>
            !r.deleted &&
            r.passageType === PassageTypeEnum.PASSAGE &&
            r.sectionSeq === s.sectionSeq &&
            r.passageSeq > 0
        );

        if (vernpsg > 0 && chapterChanged(sht[vernpsg] as ISheet)) {
          const nextchap = startChapter(sht[vernpsg] as ISheet);
          if (!haveChapterNumber(sht, nextchap, index, vernpsg)) {
            newworkflow = addChapterNumber(newworkflow, nextchap);
            nextpsg += 0.01;
          }
          currentChapter = nextchap;
        }
      } //just a passage
      else {
        //do I need a chapter number?
        let prevrow = index - 1;
        while ((sht[prevrow] as ISheet).deleted) prevrow--;
        if (
          !isSectionRow(sht[prevrow] as ISheet) &&
          !s.deleted &&
          chapterChanged(s)
        ) {
          if (!haveChapterNumber(sht, startChapter(s), index - 2, index)) {
            newworkflow = addChapterNumber(newworkflow, startChapter(s));
            nextpsg += 0.01;
          }
          currentChapter = startChapter(s);
        }
        nextpsg = nextNum(nextpsg, s.passageType);
        newworkflow = newworkflow.concat([
          {
            ...s,
            passageSeq: nextpsg,
            passageUpdated:
              s.passageSeq !== nextpsg ? currentDateTime() : s.passageUpdated,
          },
        ]);
      }
    });
    setSheet(newworkflow);
    setChanged(true);
    setUpdate(false);
  };

  if (view !== '') return <StickyRedirect to={view} />;

  const onFiles = (files: File[]) => {
    if (files.length > 0) {
      setGraphicFullsizeUrl(URL.createObjectURL(files[0] as File));
    } else setGraphicFullsizeUrl('');
  };

  interface ITitle {
    text: string;
    status: string;
  }
  const Title = ({ text, status }: ITitle) => {
    return (
      <>
        {text}
        <Box sx={{ fontSize: 'x-small', color: grey[400] }}>{status}</Box>
      </>
    );
  };

  const statusMessage = (msg: string, val1: number, val2: number) =>
    msg.replace('{1}', val1.toString()).replace('{2}', val2.toString());

  if (tab !== undefined && tab.toString() !== tabNm)
    return <StickyRedirect to={`/plan/${prjId}/${tab}`} />;

  const selectOptions = [
    {
      value: '0',
      label: flat
        ? organizedBy
        : t.sectionsPassages.replace('{0}', organizedBy),
    },
    {
      value: '1',
      label: `${t.media} (${statusMessage(
        t.mediaStatus,
        (attached ?? []).length,
        (planMedia ?? []).length
      )})`,
    },
    ...(showAssign
      ? [
          {
            value: '2',
            label: `${t.assignments} (${statusMessage(
              t.sectionStatus.replace('{0}', organizedBy),
              (assigned ?? []).length,
              (planSectionIds ?? []).length
            )})`,
          },
        ]
      : []),
    {
      value: showAssign ? '3' : '2',
      label: `${t.transcriptions} (${statusMessage(
        t.passageStatus,
        (trans ?? []).length,
        (planPassages ?? []).length
      )})`,
    },
  ];

  return (
    <Box
      sx={{
        flexGrow: 1,
        width: '100%',
        backgroundColor: 'background.paper',
        flexDirection: 'column',
      }}
    >
      <AppBar
        position="fixed"
        color="default"
        sx={{
          top: `${HeadHeight}px`,
          // height: `${TabHeight}px`,
          left: 0,
          width: '100%',
          paddingInline: '.875rem',
          pt: '1rem',
          pb: '1rem',
        }}
      >
        {isMobile ? (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <FormControl
              sx={{
                marginInline: '.625rem',
                minHeight: 0,
                flex: '1 1 0',
              }}
              variant="outlined"
              hiddenLabel
            >
              <NativeSelect
                id="content-options"
                value={String(tab ?? 0)}
                onChange={(e) => {
                  const tabValue = Number(e.target.value);
                  checkSaved(() => setTab(tabValue));
                }}
                input={<OutlinedInput label="" sx={{ height: '2.5rem' }} />}
              >
                {selectOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </NativeSelect>
            </FormControl>
            {rowInfo.length !== 0 ? (
              <LightTooltip
                sx={{ backgroundColor: 'transparent' }}
                title={
                  !publishingOn || hidePublishing
                    ? s.showPublishing
                    : s.hidePublishing
                }
              >
                <IconButton onClick={handlePublishToggle}>
                  {!publishingOn || hidePublishing ? (
                    <PublishOnIcon sx={{ color: 'primary.light' }} />
                  ) : (
                    <PublishOffIcon sx={{ color: 'primary.light' }} />
                  )}
                </IconButton>
              </LightTooltip>
            ) : (
              <Box sx={{ width: 40, height: 40, visibility: 'hidden' }}>
                <IconButton>
                  <PublishOnIcon />
                </IconButton>
              </Box>
            )}
            <FilterMenu
              canSetDefault={canSetProjectDefault}
              state={filterState}
              onFilterChange={onFilterChange}
              orgSteps={orgSteps}
              minimumSection={minSection}
              maximumSection={maxSection}
              filtered={filtered}
              hidePublishing={hidePublishing}
              disabled={!filtered && rowinfo.length < 2}
            />
            {confirmPublishingVisible && (
              <Confirm
                title={st.confirmPublish}
                text={st.publishingWarning}
                yesResponse={onPublishingConfirm}
                noResponse={onPublishingReject}
              />
            )}
            {confirmPublish && publishSectionIndex !== null && (
              <ConfirmPublishDialog
                title={s.confirmPublish.replace(
                  '{0}',
                  isMovement(currentRowRef.current - 1) ? pt.MOVE : organizedBy
                )}
                propagateLabel={s.propagate
                  .replaceAll(
                    '{0}',
                    isMovement(currentRowRef.current - 1)
                      ? organizedByPlural.toLocaleLowerCase()
                      : ts.passages.toLocaleLowerCase()
                  )
                  .replaceAll(
                    '{1}',
                    isMovement(currentRowRef.current - 1)
                      ? s.movement.toLocaleLowerCase()
                      : organizedBy.toLocaleLowerCase()
                  )}
                description={
                  isMovement(currentRowRef.current - 1)
                    ? s.confirmPublishMovement.replaceAll(
                        '{0}',
                        organizedByPlural.toLocaleLowerCase()
                      )
                    : s.confirmPublishSection.replaceAll(
                        '{0}',
                        organizedBy.toLocaleLowerCase()
                      )
                }
                noPropagateDescription={
                  isMovement(currentRowRef.current - 1)
                    ? s.confirmPublishMovementNoPropagate
                        .replaceAll(
                          '{0}',
                          organizedByPlural.toLocaleLowerCase()
                        )
                        .replaceAll('{1}', Akuo)
                    : s.confirmPublishSectionNoPropagate.replaceAll(
                        '{0}',
                        organizedBy.toLocaleLowerCase()
                      )
                }
                yesResponse={publishConfirm}
                noResponse={publishRefused}
                current={rowInfo[publishSectionIndex]?.published ?? []}
                sharedProject={shared}
                hasPublishing={publishingOn}
                hasBible={hasBible}
                passageType={rowInfo[currentRowRef.current - 1]?.passageType}
              />
            )}
            <GraphicUploader
              dimension={[1024, 512, ApmDim]}
              defaultFilename={defaultFilename}
              isOpen={uploadGraphicVisible}
              onOpen={handleUploadGraphicVisible}
              showMessage={showMessage}
              hasRights={Boolean(curGraphicRights)}
              finish={afterConvert}
              cancelled={cancelled}
              uploadType={uploadType as UploadType}
              onFiles={onFiles}
              metadata={
                <>
                  <GraphicRights
                    value={curGraphicRights}
                    onChange={handleRightsChange}
                  />
                  {graphicFullsizeUrl && (
                    <img src={graphicFullsizeUrl} alt="new" width={400} />
                  )}
                </>
              }
            />
          </Box>
        ) : (
          <Tabs
            value={tab ?? 0}
            onChange={(e: any, v: number) =>
              checkSaved(() => handleChange(e, v))
            }
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              id="secPass"
              label={
                flat
                  ? organizedBy
                  : t.sectionsPassages.replace('{0}', organizedBy)
              }
            />
            <Tab
              id="audio"
              label={
                <Title
                  text={t.media}
                  status={statusMessage(
                    t.mediaStatus,
                    (attached ?? []).length,
                    (planMedia ?? []).length
                  )}
                />
              }
            />
            {showAssign && (
              <Tab
                id="assignments"
                label={
                  <Title
                    text={t.assignments}
                    status={statusMessage(
                      t.sectionStatus.replace('{0}', organizedBy),
                      (assigned ?? []).length,
                      (planSectionIds ?? []).length
                    )}
                  />
                }
                disabled={isOffline}
              />
            )}
            <Tab
              id="transcriptions"
              label={
                <Title
                  text={t.transcriptions}
                  status={statusMessage(
                    t.passageStatus,
                    (trans ?? []).length,
                    (planPassages ?? []).length
                  )}
                />
              }
            />
          </Tabs>
        )}
      </AppBar>
      <MediaPlayer
        srcMediaId={srcMediaId}
        onEnded={playEnded}
        requestPlay={mediaPlaying}
      />
      <Box>
        {isMobile
          ? tab === PlanTabEnum.sectionPassage && (
              <PlanView
                rowInfo={rowinfo}
                bookMap={bookMap}
                publishingView={!hidePublishing}
                handleOpenPublishDialog={handleOpenPublishDialog}
                handleGraphic={handleGraphic}
                srcMediaId={srcMediaId}
                mediaPlaying={mediaPlaying}
                onPlayStatus={onPlayStatus}
              />
            )
          : tab === PlanTabEnum.sectionPassage && (
              <ScriptureTable {...props} colNames={colNames} />
            )}
        {tab === PlanTabEnum.media && <AudioTab />}
        {showAssign && tab === PlanTabEnum.assignment && <AssignmentTable />}
        {(tab === PlanTabEnum.transcription ||
          (!showAssign && tab === PlanTabEnum.assignment)) && (
          <TranscriptionTab
            {...props}
            projectPlans={plans.filter((p) => p.id === plan)}
            sectionArr={sectionArr}
            planColumn={true}
          />
        )}
      </Box>
    </Box>
  );
};

export default ScrollableTabsButtonAuto;
