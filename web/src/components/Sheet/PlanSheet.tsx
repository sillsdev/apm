import {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  MouseEventHandler,
  ReactElement,
  useCallback,
  KeyboardEventHandler,
} from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  styled,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import PublishOffIcon from '@mui/icons-material/PublicOffOutlined';
import PublishOnIcon from '@mui/icons-material/PublicOutlined';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { RecordKeyMap } from '@orbit/records';
import DataSheet from 'react-datasheet';
import 'react-datasheet/lib/react-datasheet.css';
import {
  IPlanSheetStrings,
  ISharedStrings,
  BookNameMap,
  OptionType,
  ISheet,
  OrgWorkflowStep,
  SheetLevel,
} from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { HotKeyContext } from '../../context/HotKeyContext';
import { PlanContext } from '../../context/PlanContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import {
  cleanClipboard,
  localUserKey,
  LocalKey,
  positiveWholeOnly,
  logError,
  Severity,
  useCheckOnline,
} from '../../utils';
import {
  useShowAssignment,
  PublishDestinationEnum,
  remoteIdGuid,
  usePublishDestination,
} from '../../crud';
import { useOrganizedBy } from '../../crud/useOrganizedBy';
import { useSnackBar } from '../../hoc/SnackBar';
import { planSheetSelector, sharedSelector } from '../../selector';
import {
  Button,
  AddSectionPassageButtons,
  ProjButtons,
  LightTooltip,
  spreadSx,
  rowSx,
} from '../../control';
import Confirm from '../AlertDialog';
import ContentLayout from '../App/ContentLayout';
import ConfirmPublishDialog from '../ConfirmPublishDialog';
import MediaPlayer from '../MediaPlayer';
import { ExtraIcon } from '.';
import FilterMenu, { ISTFilterState } from './filterMenu';
import { findPlanSheetRowFromReferenceQuery } from './findPlanSheetRowFromReferenceQuery';
import { firstReferenceErrorRow } from './firstReferenceErrorRow';
import { isSheetFilterActive } from './isSheetFilterActive';
import { remapSheetCellChanges } from './remapSheetCellChanges';
import { rowTypes } from './rowTypes';
import { lastPassageRowBelow, sectionRowAbove } from './sheetRowIndex';
import { sheetCopyRange, sheetCopyText } from './sheetCopyText';
import { usePlanSheetScroll } from './usePlanSheetScroll';
import { PlanSheetRowCtx } from './PlanActionMenu';
import { usePlanSheetFill } from './usePlanSheetFill';
import { shouldOpenSheetContextMenu } from './sheetContextMenu';
import { useRefErrTest } from './useRefErrTest';
import { useShowIcon } from './useShowIcon';

export const SectionSeqCol = 0;

/** Stable DataSheet row type — must not change identity or the grid remounts mid-drag. */
const SheetRow = ({
  row,
  children,
}: {
  row: number;
  children?: React.ReactNode;
}) => {
  const { sheetCurrentI } = useContext(PlanSheetRowCtx);
  return (
    <tr className={row === sheetCurrentI ? 'current-row' : undefined}>
      {children}
    </tr>
  );
};

const headerRule = '#DDD';

export const ContentDiv = styled('div')(({ theme }) => ({
  // Growing topPad must not scroll-anchor into a curTop feedback loop.
  overflowAnchor: 'none',
  '& .data-grid-container .data-grid .cell': {
    verticalAlign: 'middle',
    textAlign: 'left',
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
  },
  '& .data-grid-container .data-grid tr:first-of-type .cell': {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    boxShadow: `inset 0 1px 0 ${headerRule}, inset 0 -1px 0 ${headerRule}`,
  },
  '& .data-grid-container .data-grid tr:first-of-type .cell.selected': {
    boxShadow: `inset 0 1px 0 ${headerRule}, inset 0 -1px 0 ${headerRule}, inset 0 -100px 0 rgba(33, 133, 208, 0.15)`,
  },
  '& .data-grid-container .data-grid .cell.set': {
    backgroundColor: theme.palette.background.default,
  },
  '& .data-grid-container .data-grid .cell.setp': {
    backgroundColor: theme.palette.background.default,
  },
  '& .data-grid-container .data-grid .cell.setpErr': {
    backgroundColor: theme.palette.warning.main,
  },
  '& .data-grid-container .data-grid tr.current-row .cell': {
    borderStyle: 'double',
    borderColor: theme.palette.primary.light,
  },
  '& .data-grid-container .data-grid .cell.num': {
    textAlign: 'center',
  },
  '& .data-grid-container .data-grid .cell.num > input': {
    textAlign: 'center',
    padding: theme.spacing(1),
  },
  '& .data-grid-container .data-grid .cell.pass': {
    backgroundColor: theme.palette.background.paper,
    textAlign: 'left',
  },
  '& .data-grid-container .data-grid .cell.refErr': {
    backgroundColor: theme.palette.warning.main,
    textAlign: 'left',
  },
  '& .data-grid-container .data-grid .cell.pass > input': {
    backgroundColor: theme.palette.background.paper,
    textAlign: 'left',
    padding: theme.spacing(1),
  },
  '& .data-grid-container .data-grid .cell.bk': {
    backgroundColor: '#f1cdcd',
  },
  '& .data-grid-container .data-grid .cell.movement': {
    backgroundColor: '#cdeaf1',
  },
  '& .data-grid-container .data-grid .cell.shared': {
    backgroundColor: '#f2d6af',
  },
  '& .data-grid-container .data-grid .cell.beta': {
    backgroundColor: '#fffbe3',
  },
  '& .data-grid-container .data-grid .cell.beta *': {
    backgroundColor: 'unset',
  },
  '& .data-grid-container .data-grid .cell.empty': {
    paddingTop: theme.spacing(3),
  },
  '& tr td:first-of-type > span': {
    display: 'flex!important',
    justifyContent: 'center',
  },
  '& tr td:nth-of-type(2) > span': {
    display: 'flex!important',
    justifyContent: 'center',
  },
}));

const WarningDiv = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.warning.main,
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: theme.spacing(1),
  marginBottom: theme.spacing(1),
  cursor: 'pointer',
}));

const initialPosition = {
  mouseX: null,
  mouseY: null,
  i: 0,
  j: 0,
};

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
  toolId: string;
  columns: Array<ICell>;
  colSlugs: Array<string>;
  rowData: Array<Array<string | number>>;
  rowInfo: Array<ISheet>;
  bookSuggestions?: OptionType[];
  bookMap?: BookNameMap;
  filterState: ISTFilterState;
  minimumSection: number;
  maximumSection: number;
  orgSteps: OrgWorkflowStep[];
  canSetDefault: boolean;
  firstMovement: number;
  updateData: (changes: ICellChange[]) => void;
  updateTitleMedia: (index: number, mediaId: string) => void;
  paste: (rows: string[][]) => string[][];
  action: (what: string, where: number[]) => Promise<boolean>;
  addPassage: (ptype?: PassageTypeEnum, i?: number, before?: boolean) => void;
  movePassage: (i: number, before: boolean, section: boolean) => void;
  addSection: (level: SheetLevel, i?: number, ptype?: PassageTypeEnum) => void;
  moveSection: (i: number, before: boolean) => void;
  setSectionPublish: (i: number, dest: PublishDestinationEnum[]) => void;
  onPublishing: (doUpdate: boolean) => void;
  lookupBook: (book: string) => string;
  resequence: () => void;
  inlinePassages: boolean;
  onPassageDetail: (i: number) => void;
  onAssign: (where: number[]) => () => void;
  onUpload: (i: number) => () => void;
  onEdit: (i: number) => () => void;
  onHistory: (i: number) => () => void;
  onGraphic: (i: number) => void;
  onFilterChange: (
    newstate: ISTFilterState | undefined | null,
    isDefault: boolean
  ) => void;
  onFirstMovement: (newFM: number) => void;
  handlePublishToggle: MouseEventHandler<HTMLButtonElement>;
  onWarning: (visible: boolean) => void;
  disablePublishingRows?: boolean;
}

export function PlanSheet(props: IProps) {
  const {
    toolId,
    columns,
    colSlugs,
    rowData,
    rowInfo,
    bookSuggestions,
    bookMap,
    filterState,
    minimumSection,
    maximumSection,
    orgSteps,
    canSetDefault,
    firstMovement,
    updateData,
    updateTitleMedia,
    action,
    addPassage,
    movePassage,
    addSection,
    moveSection,
    paste,
    resequence,
    inlinePassages,
    lookupBook,
    onPassageDetail,
    onFilterChange,
    onPublishing,
    setSectionPublish,
    onFirstMovement,
    handlePublishToggle,
    onWarning,
    disablePublishingRows,
  } = props;
  const ctx = useContext(PlanContext);
  const {
    hidePublishing,
    publishingOn,
    connected,
    canEditSheet,
    sectionArr,
    shared,
    canPublish,
    scripture,
  } = ctx.state;

  const [memory] = useGlobal('memory');
  const [errorReporter] = useGlobal('errorReporter');
  const [playingMediaId, setPlayingMediaId] = useGlobal('playingMediaId');
  const { showMessage } = useSnackBar();
  const [position, setPosition] = useState<{
    mouseX: null | number;
    mouseY: null | number;
    i: number;
    j: number;
  }>(initialPosition);
  const [data, setData] = useState(Array<Array<ICell>>());
  const [check, setCheck] = useState(Array<number>());
  const [confirmAction, setConfirmAction] = useState('');
  const suggestionRef = useRef<Array<OptionType> | undefined>(undefined);
  const saveTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly');
  const [pasting, setPasting] = useState(false);
  const preventSaveRef = useRef<boolean>(false);
  const [preventSave, setPreventSavex] = useState(false);
  const [anyRecording, setAnyRecording] = useState(false);
  const currentRowRef = useRef<number>(-1);
  const startRowRef = useRef<number>(-1);
  const selectColRef = useRef(0);
  const windowFirstRef = useRef(1);
  const windowLastRef = useRef(1);
  const prevWindowFirstRef = useRef(1);
  // After scrollIntoView / setCurTop-for-nav, ignore scrollTop→curTop briefly.
  const ignoreScrollCurTopRef = useRef(false);
  const ignoreScrollTimerRef = useRef(0);
  const sheetScrollRafRef = useRef(0);
  const topPadElRef = useRef<HTMLDivElement>(null);
  const rowHeightRef = useRef(0);
  const [rowHeight, setRowHeightx] = useState(0); // pad/scroll; locked after first measure
  const pageSizeRef = useRef(1);
  const [pageSize, setPageSizex] = useState(1);
  const setRowHeight = (h: number) => {
    if (h <= 0 || h === rowHeightRef.current) return;
    rowHeightRef.current = h;
    setRowHeightx(h);
  };
  const setPageSize = (n: number) => {
    const next = Math.max(1, n);
    if (next === pageSizeRef.current) return;
    pageSizeRef.current = next;
    setPageSizex(next);
  };
  const [currentRow, setCurrentRowx] = useState(-1);
  const [absSel, setAbsSel] = useState({
    startI: -1,
    endI: -1,
    startJ: 0,
    endJ: 0,
  });
  const [active, setActive] = useState(-1); // used for action menu to display
  const sheetRef = useRef<any>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null); //the scrolling content region
  const {
    startSave,
    toolsChanged,
    saveRequested,
    isChanged,
    clearRequested,
    clearCompleted,
    toolChanged,
  } = useContext(UnsavedContext).state;
  const [srcMediaId, setSrcMediaId] = useState('');
  const [mediaPlaying, setMediaPlaying] = useState(false);
  const [warning, setWarning] = useState<string>();
  const [warningRow, setWarningRow] = useState<number | undefined>();
  const [toRow, setToRow] = useState(0);
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { subscribe, unsubscribe } = useContext(HotKeyContext).state;
  const { isPassageType, isSectionType, isMovement } = rowTypes(rowInfo);
  const { isPublished } = usePublishDestination();
  const { getOrganizedBy } = useOrganizedBy();
  const organizedBy = getOrganizedBy(true);

  const showIcon = useShowIcon({
    canEditSheet,
    canPublish,
    rowInfo,
    inlinePassages,
    hidePublishing,
  });
  const [changed, setChanged] = useState(false); //for button enabling
  const [confirmPublish, setConfirmPublish] = useState(false);
  const changedRef = useRef(false); //for autosave
  const [saving, setSaving] = useState(false);
  const refErrTest = useRefErrTest();

  const [curTop, setCurTop] = useState(1);
  const [goToOpen, setGoToOpen] = useState(false);
  const [goToQuery, setGoToQuery] = useState('');
  const goToInputRef = useRef<HTMLInputElement>(null);
  const moveUp = true;
  const moveDown = false;
  const moveToNewSection = true;
  const getGlobal = useGetGlobal();
  const checkOnline = useCheckOnline('PlanSheet');

  const showAssign = useShowAssignment();

  useEffect(() => {
    if (!goToOpen) return;
    const id = window.setTimeout(() => {
      const el = goToInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }, 100);
    return () => clearTimeout(id);
  }, [goToOpen]);

  const handleSave = () => {
    startSave();
  };

  const warningEvent = () => {
    if (warningRow === undefined) return;
    setCurrentRow(warningRow);
  };

  const handleWarningClick: MouseEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    warningEvent();
  };

  const handleWarningKeyDown: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      warningEvent();
    }
  };

  const publishConfirm = async (destinations: PublishDestinationEnum[]) => {
    setConfirmPublish(false);
    setSectionPublish(currentRowRef.current - 1, destinations);
  };
  const publishRefused = () => {
    setConfirmPublish(false);
  };

  const onPublish = () => {
    setConfirmPublish(true);
  };

  const onMovementAbove = () => {
    const row = sectionRowAbove(currentRowRef.current - 1, isSectionType);
    addSection(SheetLevel.Movement, row, PassageTypeEnum.MOVEMENT);
  };
  const onSectionAbove = () => {
    const row = sectionRowAbove(currentRowRef.current - 1, isSectionType);
    addSection(SheetLevel.Section, row);
  };

  const onNote = () => {
    if (inlinePassages)
      addSection(
        SheetLevel.Section,
        currentRowRef.current,
        PassageTypeEnum.NOTE
      );
    else addPassage(PassageTypeEnum.NOTE, currentRowRef.current - 1, true);
  };
  const onPassageBelow = () => {
    addPassage(undefined, currentRowRef.current - 1, false);
  };
  const onPassageLast = () => {
    const row = lastPassageRowBelow(currentRowRef.current, isPassageType);
    addPassage(undefined, row, false);
  };

  const onPassageToPrev = () => {
    //convert from currentRow with includes header
    movePassage(currentRowRef.current - 1, moveUp, moveToNewSection);
  };

  const onPassageToNext = () => {
    //convert from currentRow with includes header
    movePassage(currentRowRef.current - 1, moveDown, moveToNewSection);
  };
  const onPassageUp = () => {
    //convert from currentRow with includes header
    movePassage(currentRowRef.current - 1, moveUp, !moveToNewSection);
  };
  const onPassageDown = () => {
    //convert from currentRow with includes header
    movePassage(currentRowRef.current - 1, moveDown, !moveToNewSection);
  };
  const onSectionUp = () => {
    moveSection(currentRowRef.current - 1, moveUp);
  };
  const onSectionDown = () => {
    moveSection(currentRowRef.current - 1, moveDown);
  };
  const onSectionEnd = () => {
    addSection(SheetLevel.Section);
  };

  const onPassageEnd = () => {
    addPassage();
  };
  const updatePublishing = () => {
    onPublishing(true);
  };
  interface IActionMap {
    [key: number]: () => void;
  }
  const actionMap: IActionMap = {
    [ExtraIcon.Publish]: onPublish, //section publish
    [ExtraIcon.Publishing]: updatePublishing, //menuitem in add section
    [ExtraIcon.Note]: onNote,
    [ExtraIcon.PassageBelow]: onPassageBelow,
    [ExtraIcon.MovementAbove]: onMovementAbove,
    [ExtraIcon.SectionAbove]: onSectionAbove,
    [ExtraIcon.PassageDown]: onPassageDown,
    [ExtraIcon.PassageToNext]: onPassageToNext,
    [ExtraIcon.PassageUp]: onPassageUp,
    [ExtraIcon.PassageToPrev]: onPassageToPrev,
    [ExtraIcon.PassageLast]: onPassageLast,
    [ExtraIcon.SectionUp]: onSectionUp,
    [ExtraIcon.SectionDown]: onSectionDown,
    [ExtraIcon.SectionEnd]: onSectionEnd,
    [ExtraIcon.PassageEnd]: onPassageEnd,
  };
  const onAction = (row: number, what: ExtraIcon) => {
    if (row + 1 !== currentRow) setCurrentRow(row + 1);
    actionMap[what]();
  };
  const myOnFirstMovement = (row: number, newFM: number) => {
    if (row + 1 !== currentRow) setCurrentRow(row + 1);
    onFirstMovement(newFM);
  };

  // DataSheet only mounts a window of rows; map sheet index ↔ absolute row.
  const {
    sheetToAbs,
    setCurrentRow,
    handleSelect,
    visibleData,
    topPad,
    bottomPad,
    selected,
    rowCtx,
  } = usePlanSheetScroll({
    data,
    rowInfo,
    memory,
    rowHeight,
    pageSize,
    curTop,
    setCurTop,
    setRowHeight,
    setPageSize,
    currentRow,
    setCurrentRowx,
    active,
    setActive,
    absSel,
    setAbsSel,
    currentRowRef,
    startRowRef,
    selectColRef,
    windowFirstRef,
    windowLastRef,
    prevWindowFirstRef,
    ignoreScrollCurTopRef,
    ignoreScrollTimerRef,
    sheetScrollRafRef,
    topPadElRef,
    rowHeightRef,
    pageSizeRef,
    sheetRef,
    scrollRef,
    subscribe,
    unsubscribe,
  });

  const handleValueRender: DataSheet.ValueRenderer<ICell> = (cell) => {
    return cell?.className?.substring(0, 4) === 'book' && bookMap
      ? bookMap[cell.value]
      : cell?.className?.includes('num')
        ? cell.value < 0 || Math.floor(cell.value) !== cell.value
          ? ''
          : cell.value
        : cell.value;
  };
  const handleDataRender = (cell: ICell) => cell.value;

  const handleConfirmDelete = (rowIndex: number) => () => {
    if (isPublished(rowInfo[rowIndex]?.published)) {
      showMessage(t.noPublishDelete);
      return;
    }
    const toDelete = [rowIndex];
    if (isSectionType(rowIndex)) {
      let psg = rowIndex + 1;
      while (psg < rowData.length && !isSectionType(psg)) {
        toDelete.push(psg);
        psg++;
      }
    }
    setCheck(toDelete);
    setConfirmAction('Delete');
  };

  const handleActionConfirmed = () => {
    if (action != null) {
      action(confirmAction, check).then(() => {
        setCheck(Array<number>());
      });
    }
    setConfirmAction('');
  };

  const handleActionRefused = () => {
    setConfirmAction('');
    setCheck(Array<number>());
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

  const onRecording = (recording: boolean) => {
    onSetPreventSave(recording);
    setAnyRecording(recording);
    if (recording) toolChanged(toolId);
  };

  const PrefixedCols = useMemo(() => (showAssign ? 4 : 3), [showAssign]);

  const readonly = useMemo(
    () => !canEditSheet && !canPublish,
    [canEditSheet, canPublish]
  );

  const handleCellsChanged = (changes: Array<ICellChange>) => {
    if (readonly) return; //readonly
    const colChanges = remapSheetCellChanges(changes, {
      windowFirst: windowFirstRef.current,
      prefixedCols: PrefixedCols,
      hidePublishing,
      publishingOn,
    });
    updateData(colChanges);
  };

  const handleContextMenu: DataSheet.ContextMenuHandler<ICell> = (
    e,
    cell,
    i,
    j
  ) => {
    if (!shouldOpenSheetContextMenu(e.target)) return;
    e.preventDefault();
    const absI = sheetToAbs(i);
    if (absI > 0 && !readonly) {
      setPosition({
        mouseX: e.clientX - 2,
        mouseY: e.clientY - 4,
        i: absI,
        j,
      });
    }
  };

  const handleNoContextMenu = () => setPosition(initialPosition);

  const handleSheetCopy = (start?: number, end?: number) => {
    const range = sheetCopyRange(
      start,
      end,
      rowData.length,
      startRowRef.current,
      currentRowRef.current
    );
    const content = sheetCopyText(rowData, range.start, range.end);
    navigator.clipboard.writeText(content).catch((reason) => {
      logError(
        Severity.error,
        errorReporter,
        new Error(`${ts.cantCopy}: ${reason}`)
      );
    });
  };

  const parsePaste = (clipBoard: string) => {
    if (readonly) return Array<Array<string>>();
    // Header selected at top of sheet (handleSelect sets currentRowRef to 0).
    if (currentRowRef.current === 0) {
      setPasting(true);
      showMessage(t.pasting);
      try {
        return paste(cleanClipboard(clipBoard));
      } finally {
        setPasting(false);
      }
    }
    return cleanClipboard(clipBoard);
  };
  const handleTablePaste = () => {
    if (typeof navigator.clipboard.readText !== 'function') {
      showMessage(t.useCtrlV);
      return;
    }
    setPasting(true);
    showMessage(t.pasting);
    void navigator.clipboard
      .readText()
      .then((clipText) => {
        paste(cleanClipboard(clipText));
      })
      .catch(() => {
        showMessage(t.useCtrlV);
      })
      .finally(() => setPasting(false));
  };
  const handleResequence = () => {
    resequence();
  };

  const onSetPreventSave = (val: boolean) => {
    preventSaveRef.current = val;
    setPreventSavex(val);
  };

  const doSetActive = () => setActive(currentRowRef.current);

  const disableFilter = () => {
    onFilterChange({ ...filterState, disabled: true }, false);
  };

  const filtered = useMemo(
    () => isSheetFilterActive(filterState, minimumSection, maximumSection),
    [filterState, minimumSection, maximumSection]
  );

  const planSheetFill = usePlanSheetFill({
    ...props,
    onSetPreventSave,
    doSetActive,
    disableFilter,
    onPlayStatus,
    onPassageDetail,
    onAction,
    hidePublishing,
    publishingOn,
    firstMovement,
    filtered,
    onDelete: handleConfirmDelete,
    cellsChanged: updateData,
    titleMediaChanged: updateTitleMedia,
    onRecording: onRecording,
    onFirstMovement: myOnFirstMovement,
  });

  const handleGoToSubmit = useCallback(() => {
    const result = findPlanSheetRowFromReferenceQuery(goToQuery, rowInfo, {
      publishingOn,
      hidePublishing,
      filtered,
      sectionArr,
      inlinePassages,
      lookupBook,
      scripture,
      currentRowIndex0:
        currentRowRef.current >= 1 ? currentRowRef.current - 1 : -1,
    });

    if (result.ok === false) {
      if (result.error === 'ms_unavailable_filtered') {
        showMessage(t.referenceFilteredNoPublishingLabels);
      } else {
        showMessage(t.referenceNotFound);
      }
      return;
    }

    setGoToOpen(false);
    setCurrentRow(result.rowIndex + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filtered,
    goToQuery,
    hidePublishing,
    inlinePassages,
    lookupBook,
    publishingOn,
    rowInfo,
    scripture,
    sectionArr,
    showMessage,
    t.referenceFilteredNoPublishingLabels,
    t.referenceNotFound,
  ]);

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
      if (row >= 0 && currentRowRef.current < 0) {
        if (data.length > row) {
          setCurrentRow(row + 1);
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
  }, [rowInfo, toRow, data.length]);

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

  const warningTest = (bookCol: number, refCol: number) => {
    const firstErrRow = firstReferenceErrorRow({
      rowData,
      bookCol,
      refCol,
      isPassage: isPassageType,
      hasRefError: (cell) => refErrTest(cell),
    });
    if (firstErrRow !== undefined) {
      if (!warning) {
        setWarning(t.refErr);
        onWarning(true);
      }
      setWarningRow(firstErrRow);
    } else {
      if (warning) {
        setWarning(undefined);
        onWarning(false);
      }
      setWarningRow(undefined);
    }
  };

  useEffect(() => {
    if (rowData.length !== rowInfo.length) {
      setData([]);
    } else {
      // Do not pass currentRow into fill / deps: rebuilding cell data on
      // every arrow key remounts the grid and loops through DataSheet onSelect.
      // PlanActionMenu open/close uses PlanSheetRowCtx instead.
      // Refill when publishing/permission flags change: first paint can
      // precede canEditSheet, which omits the shared-resource pencil.
      const data = planSheetFill({
        srcMediaId,
        mediaPlaying,
        check,
        filtered,
        anyRecording,
      });
      const bookCol = colSlugs.indexOf('book');
      if (bookCol > -1) {
        warningTest(bookCol, colSlugs.indexOf('reference'));
      }
      setData(data);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rowData,
    rowInfo,
    columns,
    srcMediaId,
    mediaPlaying,
    filtered,
    check,
    anyRecording,
    firstMovement,
    sectionArr,
    hidePublishing,
    publishingOn,
    canEditSheet,
    canPublish,
    shared,
  ]);

  useEffect(() => {
    if (active > 0 && active !== currentRow) setActive(-1);
  }, [active, currentRow]);

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
  const currentRowSectionSeqNum = useMemo(() => {
    if (currentRowRef.current < 1) return undefined;
    let row = currentRowRef.current - 1;
    while (row >= 0 && !isSectionType(row)) row--;
    return row >= 0 ? (rowData[row][SectionSeqCol] as number) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRow, rowData, rowInfo]);

  const currentWholeRowSectionNum = useMemo(
    () => positiveWholeOnly(currentRowSectionSeqNum),
    [currentRowSectionSeqNum]
  );

  const currentRowPassageSeqNum = useMemo(
    () =>
      currentRowRef.current < 0 || !isPassageType(currentRowRef.current - 1)
        ? undefined
        : rowInfo[currentRowRef.current - 1].passage?.attributes?.sequencenum,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentRow, rowData, rowInfo, inlinePassages]
  );

  const currentWholeRowPassageNum = useMemo(
    () => positiveWholeOnly(currentRowPassageSeqNum),
    [currentRowPassageSeqNum]
  );
  const currentRowPublishLevel = useMemo(
    () =>
      currentRowRef.current < 1 || !rowInfo[currentRowRef.current - 1]
        ? []
        : rowInfo[currentRowRef.current - 1].published,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentRow, rowInfo]
  );
  const dataRowisSection = useMemo(() => {
    return isSectionType(currentRow - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRow]);

  return (
    <ContentLayout
      header={
        <Box sx={spreadSx}>
          <Box sx={rowSx}>
            {!readonly && (
              <>
                <AddSectionPassageButtons
                  inlinePassages={inlinePassages}
                  numRows={rowInfo.length}
                  canEditSheet={canEditSheet}
                  readonly={anyRecording}
                  isSection={dataRowisSection}
                  isPassage={isPassageType(currentRow - 1)}
                  mouseposition={position}
                  handleNoContextMenu={handleNoContextMenu}
                  sectionSequenceNumber={currentWholeRowSectionNum}
                  passageSequenceNumber={currentWholeRowPassageNum}
                  onDisableFilter={filtered ? disableFilter : undefined}
                  showIcon={showIcon(
                    filtered,
                    offline && !offlineOnly,
                    currentRow - 1
                  )}
                  onAction={(what: ExtraIcon) => onAction(currentRow - 1, what)}
                  disablePublishingRows={disablePublishingRows}
                />
                {canEditSheet && (
                  <ProjButtons
                    {...props}
                    noCopy={pasting || filtered}
                    noPaste={pasting || anyRecording || readonly || filtered}
                    noReseq={
                      pasting ||
                      data.length < 2 ||
                      anyRecording ||
                      !canEditSheet ||
                      filtered ||
                      !hidePublishing
                    }
                    noImExport={anyRecording || pasting}
                    noIntegrate={anyRecording || pasting || data.length < 2}
                    onCopy={handleSheetCopy}
                    onPaste={handleTablePaste}
                    onReseq={handleResequence}
                  />
                )}
              </>
            )}
          </Box>
          <Box sx={rowSx}>
            {data.length > 1 &&
              !offline &&
              !inlinePassages &&
              !anyRecording && (
                <LightTooltip
                  sx={{ backgroundColor: 'transparent' }}
                  title={
                    !publishingOn || hidePublishing
                      ? t.showPublishing
                      : t.hidePublishing
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
              )}
            <FilterMenu
              canSetDefault={canSetDefault}
              state={filterState}
              onFilterChange={onFilterChange}
              orgSteps={orgSteps}
              minimumSection={minimumSection}
              maximumSection={maximumSection}
              filtered={filtered}
              hidePublishing={hidePublishing}
              disabled={!filtered && (rowInfo.length < 2 || anyRecording)}
            />
            <LightTooltip
              sx={{ backgroundColor: 'transparent' }}
              title={t.goToReference}
            >
              <IconButton
                aria-label={t.goToReference}
                onClick={() => setGoToOpen(true)}
                disabled={rowInfo.length < 2}
              >
                <SearchIcon sx={{ color: 'primary.light' }} />
              </IconButton>
            </LightTooltip>
            {!readonly && (
              <Button
                id="planSheetSave"
                key="save"
                aria-label={t.save}
                variant="outlined"
                color={connected ? 'primary' : 'secondary'}
                onClick={handleSave}
                disabled={saving || !changed || preventSave}
                startIcon={<SaveIcon />}
              >
                {t.save}
              </Button>
            )}
          </Box>
        </Box>
      }
      contentSx={{ position: 'relative' }}
      contentRef={scrollRef}
    >
      <Dialog open={goToOpen} onClose={() => setGoToOpen(false)} maxWidth="sm">
        <DialogTitle>{t.goToReferenceTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            <>
              {t.goToReferenceDescription}
              <ul>
                {scripture && <li>{t.goToReferenceScripture}</li>}
                <li>
                  {(publishingOn && !hidePublishing
                    ? t.goToReferencePublishing
                    : t.goToReferencePassage
                  ).replace('{0}', organizedBy)}
                </li>
                <li>{t.goToReferencePhrase.replace('{0}', organizedBy)}</li>
              </ul>
            </>
          </Typography>
          <TextField
            autoFocus
            inputRef={goToInputRef}
            fullWidth
            margin="dense"
            value={goToQuery}
            onChange={(e) => setGoToQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleGoToSubmit();
              }
            }}
            slotProps={{
              input: {
                endAdornment: goToQuery ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={t.goToReferenceClear}
                      edge="end"
                      size="small"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setGoToQuery('')}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGoToOpen(false)}>{ts.cancel}</Button>
          <Button variant="contained" onClick={handleGoToSubmit}>
            {t.goToReferenceSubmit}
          </Button>
        </DialogActions>
      </Dialog>
      <ContentDiv id="PlanSheet" ref={sheetRef}>
        {warning && (
          <WarningDiv
            onClick={handleWarningClick}
            onKeyDown={handleWarningKeyDown}
            role="button"
            tabIndex={0}
          >
            {warning}
          </WarningDiv>
        )}
        <div
          aria-hidden
          ref={topPadElRef}
          style={{ height: topPad, overflowAnchor: 'none' }}
        />
        <PlanSheetRowCtx.Provider value={rowCtx}>
          <DataSheet
            data={visibleData}
            selected={selected}
            rowRenderer={SheetRow}
            valueRenderer={handleValueRender}
            dataRenderer={handleDataRender}
            onContextMenu={handleContextMenu}
            onCellsChanged={handleCellsChanged}
            parsePaste={parsePaste}
            onSelect={handleSelect}
          />
        </PlanSheetRowCtx.Provider>
        <div
          aria-hidden
          style={{ height: bottomPad, overflowAnchor: 'none' }}
        />
        {confirmAction !== '' ? (
          <Confirm
            text={t.confirm
              .replace('{0}', confirmAction)
              .replace('{1}', check.length.toString())}
            yesResponse={handleActionConfirmed}
            noResponse={handleActionRefused}
          />
        ) : (
          <></>
        )}
        {confirmPublish && (
          <ConfirmPublishDialog
            context="plan"
            isMovement={isMovement(currentRowRef.current - 1)}
            yesResponse={publishConfirm}
            noResponse={publishRefused}
            current={currentRowPublishLevel}
            sharedProject={shared}
            hasPublishing={publishingOn}
            passageType={rowInfo[currentRowRef.current - 1]?.passageType}
          />
        )}
        <MediaPlayer
          srcMediaId={srcMediaId}
          onEnded={playEnded}
          requestPlay={mediaPlaying}
        />
      </ContentDiv>
    </ContentLayout>
  );
}

export default PlanSheet;
