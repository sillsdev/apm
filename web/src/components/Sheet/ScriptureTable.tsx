import React, {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  useCallback,
  ReactNode,
  MouseEventHandler,
} from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { Badge, Box } from '@mui/material';
import JSONAPISource from '@orbit/jsonapi';
import Memory from '@orbit/memory';
import { RecordKeyMap } from '@orbit/records';
import { debounce } from 'lodash';
import bookSortJson from '../../assets/akuosort.json';
import {
  IState,
  Section,
  IPlanSheetStrings,
  IScriptureTableStrings,
  ISharedStrings,
  MediaFileD,
  PlanD,
  ISheet,
  IwsKind,
  IWorkflowStepsStrings,
  GroupMembership,
  Discussion,
  IResourceStrings,
  SheetLevel,
  GraphicD,
  SectionD,
  PassageD,
  ProjectD,
  SharedResourceD,
  AltBkSeq,
  BookSeq,
} from '../../model';
import { UpdateRecord, UpdateLastModifiedBy } from '../../model/baseModel';
import { OrganizationSchemeStepD } from '../../model/organizationSchemeStep';
import { PassageTypeEnum } from '../../model/passageType';
import * as actions from '../../store';
import { PlanContext } from '../../context/PlanContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import {
  remoteIdNum,
  related,
  useOrganizedBy,
  usePlan,
  useFilteredSteps,
  VernacularTag,
  useDiscussionCount,
  getTool,
  ToolSlug,
  remoteId,
  remoteIdGuid,
  findRecord,
  useGraphicUpdate,
  useGraphicFind,
  lookupSharedResource,
  useNoteCategory,
  PublishDestinationEnum,
  usePublishDestination,
  useNotes,
  useShowAssignment,
} from '../../crud';
import { useGraphicCreate } from '../../crud/useGraphicCreate';
import { useMediaAttach } from '../../crud/useMediaAttach';
import {
  projDefBook,
  projDefFilterParam,
  projDefFirstMovement,
  useProjectDefaults,
} from '../../crud/useProjectDefaults';
import {
  lookupBook,
  waitForIt,
  useCheckOnline,
  currentDateTime,
  useDataChanges,
  useWaitForRemoteQueue,
  useCanPublish,
  useMobile,
  generateUUID,
} from '../../utils';
import { addPt } from '../../utils/addPt';
import { passageDefaultFilename } from '../../utils/passageDefaultFilename';
import { isPublishingTitle } from '../../control/passageTypeFromRef';
import { resolveSheetStartChapter } from './resolveSheetStartChapter';
import { graphicPickerRefString as buildGraphicPickerRef } from './graphicPickerRef';
import { isSheetFilterActive } from './isSheetFilterActive';
import { addPassageTo } from './sheetRowEdit';
import { getByIndex, sheetFirstBook } from './sheetRowIndex';
import { useScriptureSheetEdits } from './useScriptureSheetEdits';
import { useScriptureSheetSave } from './useScriptureSheetSave';
import BigDialog from '../../hoc/BigDialog';
import { useSnackBar } from '../../hoc/SnackBar';
import { useOrbitData } from '../../hoc/useOrbitData';
import {
  planSheetSelector,
  scriptureTableSelector,
  sharedResourceSelector,
  sharedSelector,
  workflowStepsSelector,
} from '../../selector';
import { useComputeRef } from '../../components/PassageDetail/Internalization/useComputeRef';
import Confirm from '../AlertDialog';
import ContentLayout from '../App/ContentLayout';
import AssignSection from '../AssignSection';
import VersionDlg from '../AudioTab/VersionDlg';
import { apmGraphic } from '../apmGraphic';
import GraphicPicker from '../GraphicPicker';
import { saveGraphicRecord, useGraphicPicker } from '../useGraphicPicker';
import { usePeerGroups } from '../Peers/usePeerGroups';
import ResourceTabs from '../ResourceEdit/ResourceTabs';
import StickyRedirect from '../StickyRedirect';
import Uploader from '../Uploader';
import {
  isSectionRow,
  isPassageRow,
  shtColumnHeads,
  useWfLocalSave,
  useWfOnlineSave,
  useWfPaste,
  getSheet,
  workSheet,
  refilterSheet,
  nextNum,
  getMinSection,
} from '.';
import { ISTFilterState } from './filterMenu';
import { getDefaultName } from './getDefaultName';
import { PlanBar } from './PlanBar';
import PlanSheet, { ICell } from './PlanSheet';
import { PlanView } from './PlanView';
import { createPendingTitleMediaQueue } from './pendingTitleMediaQueue';
import type { TitleMediaPending } from './pendingTitleMediaQueue';

const SaveWait = 500;

type IVrs = [string, number[]];

interface IProps {
  colNames: string[];
}

export function ScriptureTable(props: Readonly<IProps>) {
  const { colNames } = props;
  const passages = useOrbitData<PassageD[]>('passage');
  const sections = useOrbitData<SectionD[]>('section');
  const sharedresources = useOrbitData<SharedResourceD[]>('sharedresource');
  const plans = useOrbitData<PlanD[]>('plan');
  const projects = useOrbitData<ProjectD[]>('project');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const discussions = useOrbitData<Discussion[]>('discussion');
  const groupmemberships = useOrbitData<GroupMembership[]>('groupmembership');
  const graphics = useOrbitData<GraphicD[]>('graphic');
  const organizationSchemeSteps = useOrbitData<OrganizationSchemeStepD[]>(
    'organizationschemestep'
  );
  const t: IScriptureTableStrings = useSelector(
    scriptureTableSelector,
    shallowEqual
  );
  const wfStr: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const s: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
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
  const { prjId } = useParams();
  const [width, setWidth] = useState(window.innerWidth);
  const { isMobile } = useMobile();
  const [organization] = useGlobal('organization');
  const [project] = useGlobal('project'); //will be constant here
  const [plan] = useGlobal('plan'); //will be constant here
  const [coordinator] = useGlobal('coordinator');
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [developer] = useGlobal('developer');
  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const [user] = useGlobal('user');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const showAssign = useShowAssignment();
  const [, setBusy] = useGlobal('importexportBusy');
  const myChangedRef = useRef(false);
  const savingRef = useRef(false);
  const updateRef = useRef(false);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const lastSavedRef = useRef<string | undefined>(undefined);
  const titleMediaApplyRef = useRef<(pending: TitleMediaPending) => void>(
    () => undefined
  );
  const titleMediaQueueRef = useRef<ReturnType<
    typeof createPendingTitleMediaQueue
  > | null>(null);
  const doForceDataChanges = useRef(false);
  /** Prevents overlapping sheet-save pipelines when toolsChanged re-fires (TT-7660). */
  const sheetSavePipelineRef = useRef(false);
  const { showMessage } = useSnackBar();
  const getGlobal = useGetGlobal();
  const ctx = React.useContext(PlanContext);
  const {
    flat,
    scripture,
    shared,
    hidePublishing,
    publishingOn,
    setSectionArr,
    setCanAddPublishing,
    togglePublishing,
    canPublish,
  } = ctx.state;
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState<string>(getOrganizedBy(true));
  const [saveColAdd, setSaveColAdd] = useState<number[]>();
  const [columns, setColumns] = useState<ICell[]>([
    { value: organizedBy, readOnly: true, width: 80 },
    { value: t.title, readOnly: true, width: 280 },
    { value: t.passage, readOnly: true, width: 80 },
    { value: t.reference, readOnly: true, width: 180 },
    { value: t.description, readOnly: true, width: 280 },
  ]);
  const [sheet, setSheetx] = useState<ISheet[]>([]);
  const sheetRef = useRef<ISheet[]>([]);
  const [, setComplete] = useGlobal('progress');
  const [confirmPublishingVisible, setConfirmPublishingVisible] =
    useState(false);
  const [view, setView] = useState('');
  const [lastSaved, setLastSavedx] = useState<string>();
  const setLastSaved = useCallback((value: string | undefined) => {
    lastSavedRef.current = value;
    setLastSavedx(value);
  }, []);
  const toolId = 'scriptureTable';
  const {
    saveRequested,
    clearRequested,
    clearCompleted,
    startSave,
    saveCompleted,
    waitForSave,
    toolChanged,
    toolsChanged,
    isChanged,
    anySaving,
  } = useContext(UnsavedContext).state;
  const forceDataChanges = useDataChanges();
  const [assignSectionVisible, setAssignSectionVisible] = useState(false);
  const [assignSections, setAssignSections] = useState<number[]>([]);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [graphicPickerRefString, setGraphicPickerRefString] =
    useState('1:1-25');
  const { curNoteRef } = useNotes();
  const { computeSectionRef, computeMovementRef } = useComputeRef();
  const [importList, setImportList] = useState<File[]>();
  const cancelled = useRef(false);
  const [engVrs, setEngVrs] = useState<Map<string, number[]>>(new Map());
  const uploadItem = useRef<ISheet | undefined>(undefined);
  const [editRow, setEditRow] = useState<ISheet>();
  const [versionRow, setVersionRow] = useState<ISheet>();
  const [isNote, setIsNote] = useState(false);
  const [defaultFilename, setDefaultFilename] = useState('');
  const [warningVisible, setWarningVisible] = useState<boolean>(false);
  const graphicCreate = useGraphicCreate();
  const graphicUpdate = useGraphicUpdate();
  const graphicPicker = useGraphicPicker(async (images, rights) => {
    const ws = uploadItem.current;
    const resourceType = ws?.kind === IwsKind.Section ? 'section' : 'passage';
    const secRec: Section | undefined =
      ws?.kind === IwsKind.Section
        ? (findRecord(memory, 'section', ws?.sectionId?.id ?? '') as Section)
        : undefined;
    const resourceId =
      ws?.kind === IwsKind.Section
        ? Number.parseInt(secRec?.keys?.remoteId ?? '0')
        : Number.parseInt(ws?.passage?.keys?.remoteId ?? '0');
    const graphicRec = graphics.find(
      (g) =>
        g.attributes.resourceType === resourceType &&
        g.attributes.resourceId === resourceId
    );
    const rec = await saveGraphicRecord({
      images,
      rights,
      graphicRec,
      resourceType,
      resourceId,
      graphicCreate,
      graphicUpdate,
      showMessage,
      saving: ts.saving,
      uploadSuccess: ts.uploadSuccess,
    });
    if (!rec || !ws) return;
    //force other users to update their local data
    const target =
      ws.kind === IwsKind.Section
        ? (secRec as SectionD)
        : (ws.passage as PassageD | undefined);
    if (target?.id) {
      await memory.update((t) => UpdateLastModifiedBy(t, target, user));
    }
    const gr = apmGraphic(rec);
    const index = sheetRef.current.findIndex((r) =>
      ws.kind === IwsKind.Section
        ? isSectionRow(r) && r.sectionId?.id === ws.sectionId?.id
        : r.passage?.id === ws.passage?.id
    );
    if (index < 0) return;
    const row = {
      ...sheetRef.current[index],
      graphicUri: gr?.graphicUri,
      graphicRights: gr?.graphicRights,
      graphicFullSizeUrl: gr?.url,
    };
    const next = sheetRef.current.map((r, i) => (i === index ? row : r));
    sheetRef.current = next;
    setSheetx(next);
  });
  const graphicFind = useGraphicFind();
  const { getPlan } = usePlan();
  const localSave = useWfLocalSave({ setComplete });
  const onlineSave = useWfOnlineSave({ setComplete });
  const { detachPassage } = useMediaAttach();
  const checkOnline = useCheckOnline('ScriptureTable');
  const [speaker, setSpeaker] = useState('');
  const { myGroups } = usePeerGroups();
  const {
    getProjectDefault,
    setProjectDefault,
    canSetProjectDefault,
    getLocalDefault,
    setLocalDefault,
  } = useProjectDefaults();
  const noteCategory = useNoteCategory();
  const orgSteps = useFilteredSteps();
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
  const resStr: IResourceStrings = useSelector(
    sharedResourceSelector,
    shallowEqual
  );
  const [firstMovement, setFirstMovement] = useState(1);
  const [projFirstMovement, setProjFirstMovement] = useState(1);
  const [filterState, setFilterState] =
    useState<ISTFilterState>(defaultFilterState);
  const secNumCol = React.useMemo(() => {
    return colNames.indexOf('sectionSeq');
  }, [colNames]);
  const { canAddPublishing } = useCanPublish();

  const firstBook = useMemo(
    () =>
      scripture
        ? sheetFirstBook(sheet)
        : ((getProjectDefault(projDefBook) as unknown as string | undefined) ??
          'LUK'),
    // getProjectDefault is a fresh function each render; the default is read when scripture is off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scripture, sheet]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const minSection = useMemo(() => getMinSection(sheetRef.current), [sheet]);

  useEffect(() => {
    if (minSection !== defaultFilterState.minSection) {
      setDefaultFilterState((fs) => ({ ...fs, minSection }));
    }
    import('../../assets/eng-vrs').then((module) => {
      setEngVrs(new Map<string, number[]>(module.default as IVrs[]));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSection]);

  const maximumSection = useMemo(
    () => sheet[sheet.length - 1]?.sectionSeq ?? 0,
    [sheet]
  );

  const filtered = useMemo(
    () => isSheetFilterActive(filterState, minSection, maximumSection),
    [filterState, minSection, maximumSection]
  );

  const publishingTitle = (passageType: PassageTypeEnum) =>
    passageType + ' ' + firstBook;

  const getFilter = (fs: ISTFilterState) => {
    const source = (getLocalDefault(projDefFilterParam) ??
      getProjectDefault(projDefFilterParam) ??
      fs) as ISTFilterState;
    const filter: ISTFilterState = { ...source };

    if (!showAssign && filter.assignedToMe) {
      filter.assignedToMe = false;
    }

    if (filter.minStep && !Number.isNaN(Number(filter.minStep)))
      filter.minStep = remoteIdGuid(
        'orgworkflowstep',
        filter.minStep,
        memory?.keyMap as RecordKeyMap
      ) as string;
    if (filter.maxStep && !Number.isNaN(Number(filter.maxStep)))
      filter.maxStep = remoteIdGuid(
        'orgworkflowstep',
        filter.maxStep,
        memory?.keyMap as RecordKeyMap
      ) as string;
    return filter;
  };

  interface LocalStrings {
    [key: string]: ReactNode;
  }
  const local: LocalStrings = {
    sectionSeq: organizedBy,
    title: t.title,
    passageSeq: t.passage,
    book: t.book,
    reference: t.reference,
    comment: t.description,
    action: t.extras,
  };
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
  const setSheet = useCallback(
    (ws: ISheet[]) => {
      sheetRef.current = ws;
      setSheetx(ws);
      const anyPublishing = !getGlobal('offline')
        ? ws.some((s) => isPublishingTitle(s.reference ?? '', flat))
        : false;
      if (publishingOn !== anyPublishing) setCanAddPublishing(anyPublishing);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publishingOn, flat]
  );
  const passNumCol = React.useMemo(() => {
    return colNames.indexOf('passageSeq');
  }, [colNames]);

  const findBook = (val: string) =>
    lookupBook({ book: val, allBookData, bookMap });

  const paste = useWfPaste({
    secNumCol,
    passNumCol,
    scripture,
    flat,
    shared,
    colNames,
    findBook,
    t,
  });

  const setChanged = (value: boolean) => {
    myChangedRef.current = value;
    toolChanged(toolId, value);
  };

  const setUpdate = useCallback((value: boolean) => {
    updateRef.current = value;
  }, []);

  const {
    sheetHasUnsavedChanges,
    blockWhileSavingOrUpdating,
    blockPublishingRows,
    showBlockedPublishingMessage,
    handleResequence,
    updatePassageRef,
    addSection,
    addPassage,
    movePassage,
    moveSection,
    doDetachMedia,
    handleDelete,
    getScheme,
    getSectionsWhere,
    handleTablePaste,
    updateData,
  } = useScriptureSheetEdits({
    sheet,
    sheetRef,
    savingRef,
    updateRef,
    setSheet,
    setChanged,
    setUpdate,
    setSectionArr,
    setEditRow,
    showMessage,
    savingMessage: t.saving,
    saveFirstMessage: t.saveFirst,
    nonNumberMessage: s.nonNumber,
    noSaveOfflineMessage: ts.NoSaveOffline,
    isChanged,
    toolId,
    flat,
    scripture,
    firstBook,
    shared,
    publishingTitle,
    graphicFind,
    mediafiles,
    detachPassage,
    plan,
    sections,
    offline,
    offlineOnly,
    paste,
    colNames,
    secNumCol,
    passNumCol,
    findBook,
  });

  const saveIfChanged = (cb: () => void) => {
    if (myChangedRef.current) {
      startSave();
      waitForSave(cb, SaveWait);
    } else cb();
  };
  const waitForPassageId = (i: number, cb: () => void) => {
    waitForIt(
      'passageId to be set',
      () => {
        return getByIndex(sheetRef.current, i).ws?.passage !== undefined;
      },
      () => false,
      SaveWait
    ).then(() => cb());
  };

  const handlePassageDetail = (i: number) => {
    saveIfChanged(async () => {
      waitForPassageId(i, () => {
        const { ws } = getByIndex(sheetRef.current, i);
        const id = ws?.passage?.id || '';
        const passageRemoteId =
          remoteIdNum('passage', id, memory?.keyMap as RecordKeyMap) || id;
        setView(`/detail/${prjId}/${passageRemoteId}`);
      });
    });
  };

  const handleAssign = (where: number[]) => () => {
    saveIfChanged(() => {
      setAssignSections(where);
      setAssignSectionVisible(true);
    });
  };

  const showUpload = (i: number) => {
    waitForPassageId(i, () => {
      const { ws } = getByIndex(sheetRef.current, i);
      uploadItem.current = ws;
      if (ws?.passage) {
        setDefaultFilename(
          passageDefaultFilename(
            ws?.passage,
            plan,
            memory,
            VernacularTag,
            getGlobal('offline')
          )
        );
      }
      setImportList(undefined);
      setUploadVisible(true);
    });
  };

  const handleUploadVisible = (v: boolean) => {
    setUploadVisible(v);
  };

  const handleUpload = (i: number) => () => {
    saveIfChanged(() => {
      showUpload(i);
    });
  };

  const handleEdit = (i: number) => () => {
    saveIfChanged(() => {
      waitForPassageId(i, () => {
        const { ws } = getByIndex(sheetRef.current, i);
        setEditRow(ws);
        setIsNote(ws?.passageType === PassageTypeEnum.NOTE);
      });
    });
  };

  const handleVersions = (i: number) => () => {
    saveIfChanged(() => {
      waitForPassageId(i, () => {
        const { ws } = getByIndex(sheetRef.current, i);
        setVersionRow(ws);
        setIsNote(ws?.passageType === PassageTypeEnum.NOTE);
      });
    });
  };

  const getGraphicPickerRefString = (i: number) => {
    const { ws } = getByIndex(sheetRef.current, i);
    const sectionId = ws?.sectionId?.id ?? '';
    return buildGraphicPickerRef({
      row: ws,
      flat,
      firstBook,
      verseCounts: engVrs,
      getNoteRef: () => curNoteRef(ws?.passage as PassageD),
      getMovementRef: () => computeMovementRef(sectionId),
      getSectionRef: () => computeSectionRef(sectionId),
    });
  };

  const handleGraphic = (i: number) => {
    saveIfChanged(() => {
      setGraphicPickerRefString(getGraphicPickerRefString(i));
      const { ws } = getByIndex(sheetRef.current, i);
      setDefaultFilename(getDefaultName(ws, 'graphic', memory, plan));
      uploadItem.current = ws;
      const resourceType = ws?.kind === IwsKind.Section ? 'section' : 'passage';
      const secRec =
        ws?.kind === IwsKind.Section
          ? (findRecord(memory, 'section', ws?.sectionId?.id ?? '') as
              Section | undefined)
          : undefined;
      const resourceId =
        ws?.kind === IwsKind.Section
          ? Number.parseInt(secRec?.keys?.remoteId ?? '0')
          : Number.parseInt(ws?.passage?.keys?.remoteId ?? '0');
      // if this graphic is a category or shared note graphic,
      // this passage doesn't own it.
      const owned = graphics.some(
        (g) =>
          g.attributes.resourceType === resourceType &&
          g.attributes.resourceId === resourceId
      );
      graphicPicker.open({
        url: owned ? (ws?.graphicFullSizeUrl ?? '') : '',
        rights: owned ? (ws?.graphicRights ?? '') : '',
      });
    });
  };

  const handleEditClose = () => {
    setEditRow(undefined);
  };

  const handleVerHistClose = () => {
    setVersionRow(undefined);
  };

  const handleNameChange = (name: string) => {
    setSpeaker(name);
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

  // keep track of screen width
  const setDimensions = () => {
    setWidth(window.innerWidth);
  };

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); //do this once to get the default;

  useEffect(() => {
    setFilterState(getFilter(defaultFilterState));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, defaultFilterState, showAssign]);
  useEffect(() => {
    const fm = getProjectDefault(projDefFirstMovement) as number;
    setFirstMovement(fm ?? 1);
    setProjFirstMovement(fm ?? 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  const doneStepId = useMemo(() => {
    const tmp = orgSteps.find(
      (s) => getTool(s.attributes?.tool) === ToolSlug.Done
    );
    return tmp?.id ?? 'noDoneStep';
  }, [orgSteps]);

  useEffect(() => {
    const canHideDone = orgSteps.some(
      (s) => getTool(s.attributes?.tool) === ToolSlug.Done
    );
    if (defaultFilterState.canHideDone !== canHideDone) {
      setDefaultFilterState((fs) => ({
        ...fs,
        canHideDone,
      }));
    }
  }, [orgSteps, defaultFilterState.canHideDone]);

  const refreshSheet = useCallback(() => {
    if (!plan) return;
    setUpdate(true);
    //because we ignore data changes if we are dirty,
    // we need to refresh the data when we do refresh the sheet
    const freshSections = memory.cache.query((q) =>
      q.findRecords('section')
    ) as SectionD[];
    const freshPassages = memory.cache.query((q) =>
      q.findRecords('passage')
    ) as PassageD[];
    const freshSchemeSteps = memory.cache.query((q) =>
      q.findRecords('organizationschemestep')
    ) as OrganizationSchemeStepD[];
    // race after save where myChanged is false, this runs,
    // orbit has the new passageid, but we don't yet so another new
    // row gets added in getSheet
    const cur = sheetRef.current;
    const canMerge = cur.every(
      (s) => !isPassageRow(s) || s.deleted || Boolean(s.passage?.id)
    );
    const getSharedResource = lookupSharedResource(
      memory.cache.query((q) =>
        q.findRecords('sharedresource')
      ) as SharedResourceD[]
    );
    setSheet(
      getSheet({
        plan,
        sections: freshSections,
        passages: freshPassages,
        organizationSchemeSteps: freshSchemeSteps,
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
        noteCategory,
        user,
        myGroups,
        isDeveloper: developer,
        current: canMerge ? cur.map((r) => ({ ...r })) : undefined,
      })
    );
    const planRec = getPlan(plan) as PlanD;
    setLastSaved(planRec !== null ? planRec.attributes.dateUpdated : '');
    setUpdate(false);
  }, [
    plan,
    flat,
    shared,
    memory,
    orgSteps,
    wfStr,
    filterState,
    minSection,
    publishingOn,
    hidePublishing,
    doneStepId,
    getDiscussionCount,
    graphicFind,
    getPublishTo,
    publishStatus,
    noteCategory,
    user,
    myGroups,
    developer,
    setSheet,
    setUpdate,
    getPlan,
    setLastSaved,
  ]);

  const handleAssignClose = useCallback(
    (cancel?: boolean) => {
      setAssignSectionVisible(false);
      if (!cancel) refreshSheet();
    },
    [refreshSheet]
  );
  const { updateTitleMedia } = useScriptureSheetSave({
    sheetRef,
    savingRef,
    updateRef,
    myChangedRef,
    lastSavedRef,
    titleSaveTimer,
    titleMediaApplyRef,
    titleMediaQueueRef,
    doForceDataChanges,
    sheetSavePipelineRef,
    setSheet,
    setChanged,
    setUpdate,
    setLastSaved,
    setComplete,
    setBusy,
    showMessage,
    t,
    ts,
    toolId,
    firstMovement,
    projFirstMovement,
    setProjectDefault,
    projDefFirstMovement,
    doDetachMedia,
    memory,
    offlineOnly,
    onlineSave,
    localSave,
    updateLastModified,
    saveCompleted,
    saveRequested,
    clearRequested,
    clearCompleted,
    isChanged,
    anySaving,
    startSave,
    checkOnline,
    waitForRemoteQueue,
    forceDataChanges,
    toolsChanged,
    lastSaved,
  });

  // load data when tables change (and initally)
  useEffect(() => {
    if (scripture && allBookData.length === 0) fetchBooks(lang);
    if (
      !savingRef.current &&
      !myChangedRef.current &&
      plan &&
      !updateRef.current
    ) {
      refreshSheet();
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
    discussions,
    groupmemberships,
    flat,
    shared,
    orgSteps,
    lastSaved,
    hidePublishing,
    scripture,
    //note rows show their category name, which noteCategory localizes, so a
    //language switch alone has to rebuild the sheet (no refresh allowed)
    lang,
  ]);

  // Reset column widths based on sheet content
  useEffect(() => {
    const curNames = [...colNames.concat(['action'])];

    const minWidth = {
      sectionSeq: 60,
      title: 100,
      passageSeq: 60,
      book: 170,
      reference: 120,
      comment: 100,
      action: 50,
    };
    const { colHead, colAdd } = shtColumnHeads(
      sheet,
      width,
      curNames,
      local,
      minWidth
    );
    let change = saveColAdd === undefined;
    saveColAdd?.forEach((n, i) => {
      change = change || n !== colAdd[i];
    });
    curNames.forEach((n, i) => {
      if (Object.hasOwn(local, n))
        change = change || local[n] !== (columns[i] as ICell).value;
    });
    if (change) {
      setColumns([...colHead]);
      setSaveColAdd([...colAdd]);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sheet, width, colNames, flat, lang]);

  useEffect(() => {
    if (!updateRef.current) {
      setUpdate(true);
      const { sheet: newWork, changed } = refilterSheet({
        sheet: sheetRef.current,
        filterState,
        minSection,
        hidePublishing,
        orgSteps,
        doneStepId,
        flat,
        user,
        myGroups,
      });
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

  const setSectionPublish = async (
    index: number,
    destinations: PublishDestinationEnum[]
  ) => {
    await waitForRemoteQueue(t.publishingWarning);
    // Destination edits are allowed while the sheet is unsaved; only block
    // adding infrastructure rows (doPublish) until save completes.
    if (blockWhileSavingOrUpdating()) {
      showMessage(t.saving);
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
    setTimeout(() => startSave(), 1000);
  };

  const onPublishing = async (update: boolean) => {
    if (!firstBook) {
      showMessage(scripture ? t.setupScriptureBook : t.setupGeneralBook);
      return;
    }
    if (update) {
      if (blockPublishingRows()) {
        showBlockedPublishingMessage();
        return;
      }
      await doPublish();
    } else if (!hidePublishing)
      togglePublishing(); //turn it off
    //if we're going to show now and we don't already have some rows...ask
    else if (!publishingOn) {
      if (sheetHasUnsavedChanges) {
        showMessage(t.saveFirst);
        return;
      }
      setConfirmPublishingVisible(true);
    } else togglePublishing(); //turn it on - no update
  };
  const onPublishingReject = () => {
    setConfirmPublishingVisible(false);
  };
  const onPublishingConfirm = async () => {
    setConfirmPublishingVisible(false);
    if (blockPublishingRows()) {
      showBlockedPublishingMessage();
      return;
    }
    await doPublish();
    togglePublishing();
  };

  const hasBookTitle = async (bookType: PassageTypeEnum) => {
    if (
      !sheetRef.current.some((s) => !s.deleted && s.passageType === bookType)
    ) {
      //see if we have this book anywhere in the team
      //ask remote about this if we have a remote
      const teamprojects = new Set(
        projects
          .filter((p) => related(p, 'organization') === organization)
          .map((p) => p.id)
      );
      const teamplans = new Set(
        plans
          .filter((p) => teamprojects.has(related(p, 'project')))
          .map((p) => p.id)
      );
      let foundIt = Boolean(
        sections.some(
          (s) =>
            s.attributes?.state === publishingTitle(bookType) &&
            teamplans.has(related(s, 'plan'))
        )
      );
      if (!foundIt && remote) {
        const bts = (await remote.query((qb) =>
          qb
            .findRecords('section')
            .filter({ attribute: 'state', value: publishingTitle(bookType) })
        )) as SectionD[];
        foundIt = Boolean(bts.some((s) => teamplans.has(related(s, 'plan'))));
      }
      return foundIt;
    }
    return true;
  };

  const alternateName = (name: string) => t.alternateName.replace('{0}', name);

  const chapterNumberTitle = (chapter: number) =>
    t.chapter.replace('{0}', chapter.toString());

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
        rowKey: generateUUID(),
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
    const sheetEdit = { flat, scripture, firstBook, shared };
    if (chapter > 0) {
      const title = chapterNumberTitle(chapter);
      return addPassageTo({
        level: SheetLevel.Section,
        sheet: newsht,
        passageType: PassageTypeEnum.CHAPTERNUMBER,
        title,
        reference: chapterNumberReference(chapter),
        ...sheetEdit,
      });
    }
    return newsht;
  };

  const doPublish = async () => {
    let currentChapter = 0;

    const startChapter = (s: ISheet) => resolveSheetStartChapter(s);

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
    if (blockPublishingRows()) {
      showBlockedPublishingMessage();
      return;
    }
    setUpdate(true);
    if (!(await hasBookTitle(PassageTypeEnum.BOOK)))
      newworkflow = AddBook(newworkflow, PassageTypeEnum.BOOK);

    if (!(await hasBookTitle(PassageTypeEnum.ALTBOOK)))
      newworkflow = AddBook(newworkflow, PassageTypeEnum.ALTBOOK);
    let nextpsg = 0;
    const sht = sheetRef.current;
    sht.forEach((s, index) => {
      //if flat the title has to come before the section
      //otherwise we want it as the first passage in the section
      if (isSectionRow(s)) {
        nextpsg = 0;

        //copy the section
        //we won't change sequence numbers on hierarchical
        newworkflow = newworkflow.concat([{ ...s }]);
        //do I need a chapter number?
        const vernpsg = sht.findIndex(
          (r) =>
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
  }, [sheet, width, colNames, flat, publishingOn, organizedBy, hidePublishing]);

  const rowdata = useMemo(
    () => workSheet(rowinfo, colNames, sheet),
    [rowinfo, colNames, sheet]
  );

  if (view !== '') return <StickyRedirect to={view} />;

  const afterUpload = async () => {
    uploadItem.current = undefined;
    if (!cancelled.current) setUploadVisible(false);
    cancelled.current = false;
    if (importList) {
      setImportList(undefined);
    }
  };
  const isReady = () => true;

  const handleLookupBook = (book: string) =>
    lookupBook({ book, allBookData, bookMap });

  const onFirstMovement = (newFM: number) => {
    if (newFM !== firstMovement) {
      setFirstMovement(newFM);
      setSectionArr([]);
      setChanged(true);
    }
  };

  const handlePublishToggle: MouseEventHandler<HTMLButtonElement> = () => {
    if (!canAddPublishing && !publishingOn) {
      showMessage(addPt(s.paratextRequired));
      return;
    }
    if (filtered && !publishingOn) {
      showMessage(s.removeFilter);
      return;
    }
    if (warningVisible) {
      showMessage(s.refErr);
      return;
    }
    onPublishing(false);
  };

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {isMobile ? (
        <ContentLayout
          header={
            <PlanBar
              publishingOn={publishingOn}
              hidePublishing={hidePublishing}
              handlePublishToggle={handlePublishToggle}
              data={rowdata}
              canSetDefault={canSetProjectDefault}
              filterState={filterState}
              onFilterChange={onFilterChange}
              orgSteps={orgSteps}
              minimumSection={minSection}
              maximumSection={sheet[sheet.length - 1]?.sectionSeq ?? 0}
              filtered={filtered}
              rowInfo={rowinfo}
            />
          }
          drawBottomBorder={true}
          contentSx={(theme) => ({ p: theme.layout.gap })}
        >
          <Box sx={(theme) => ({ p: theme.layout.p })}>
            <PlanView
              rowInfo={rowinfo}
              publishingView={publishingOn && !hidePublishing}
              handlePublish={(
                i: number,
                destinations: PublishDestinationEnum[]
              ) => {
                setSectionPublish(i, destinations);
              }}
              handleGraphic={canPublish && !offline ? handleGraphic : undefined}
            />
          </Box>
        </ContentLayout>
      ) : (
        <PlanSheet
          {...props}
          columns={columns}
          colSlugs={colNames}
          rowData={rowdata}
          rowInfo={rowinfo}
          bookMap={bookMap}
          bookSuggestions={bookSuggestions}
          firstMovement={firstMovement}
          action={handleDelete}
          addSection={addSection}
          addPassage={addPassage}
          movePassage={movePassage}
          moveSection={moveSection}
          updateData={updateData}
          updateTitleMedia={updateTitleMedia}
          paste={handleTablePaste}
          lookupBook={handleLookupBook}
          resequence={handleResequence}
          inlinePassages={flat}
          onPassageDetail={handlePassageDetail}
          onAssign={handleAssign}
          onUpload={handleUpload}
          onEdit={handleEdit}
          onHistory={handleVersions}
          onGraphic={handleGraphic}
          onFilterChange={onFilterChange}
          onFirstMovement={onFirstMovement}
          filterState={filterState}
          minimumSection={minSection}
          maximumSection={maximumSection}
          orgSteps={orgSteps}
          canSetDefault={canSetProjectDefault}
          toolId={toolId}
          onPublishing={onPublishing}
          setSectionPublish={setSectionPublish}
          handlePublishToggle={handlePublishToggle}
          onWarning={setWarningVisible}
          disablePublishingRows={sheetHasUnsavedChanges}
        />
      )}
      {assignSectionVisible && (
        <AssignSection
          scheme={getScheme(assignSections) as string}
          sections={getSectionsWhere(assignSections)}
          visible={assignSectionVisible}
          closeMethod={handleAssignClose}
        />
      )}
      <Uploader
        defaultFilename={defaultFilename}
        mediaId={uploadItem.current?.mediaId?.id || ''}
        importList={importList as File[]}
        isOpen={uploadVisible}
        onOpen={handleUploadVisible}
        showMessage={showMessage}
        multiple={false}
        finish={afterUpload}
        cancelled={cancelled}
        passageId={
          related(uploadItem.current?.sharedResource, 'passage') ??
          uploadItem.current?.passage?.id
        }
        performedBy={speaker}
        onSpeakerChange={handleNameChange}
        ready={isReady}
      />
      <GraphicPicker
        bookCode={firstBook}
        refString={graphicPickerRefString}
        scripture={scripture}
        isOpen={graphicPicker.isOpen}
        onOpen={graphicPicker.onOpen}
        cancelled={graphicPicker.cancelled}
        showMessage={graphicPicker.showMessage}
        dimension={graphicPicker.dimension}
        defaultFilename={defaultFilename}
        finish={graphicPicker.finish}
        onSelectedRights={graphicPicker.onSelectedRights}
        currentUrl={graphicPicker.currentUrl}
        currentRights={graphicPicker.currentRights}
      />
      <BigDialog
        title={ts.versionHistory}
        isOpen={versionRow !== undefined}
        onOpen={handleVerHistClose}
      >
        <VersionDlg
          passId={versionRow?.passage?.id || ''}
          canSetDestination={!offline && canPublish}
          hasPublishing={publishingOn}
          close={handleVerHistClose}
        />
      </BigDialog>
      <BigDialog
        title={
          isNote
            ? resStr.noteDetails
            : shared
              ? resStr.resourceEdit
              : ts.versionHistory
        }
        isOpen={editRow !== undefined}
        onOpen={handleEditClose}
      >
        {editRow && (shared || isNote) ? (
          <ResourceTabs
            passId={editRow?.passage?.id || ''}
            ws={editRow}
            onOpen={handleEditClose}
            onUpdRef={updatePassageRef}
            onSaving={(saving) => setUpdate(saving)}
            hasPublishing={publishingOn}
          />
        ) : (
          <></>
        )}
      </BigDialog>
      {confirmPublishingVisible && (
        <Confirm
          title={t.confirmPublish}
          text={t.publishingWarning}
          yesResponse={onPublishingConfirm}
          noResponse={onPublishingReject}
        />
      )}
    </Box>
  );
}

export default ScriptureTable;
