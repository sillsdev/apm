import {
  useState,
  useEffect,
  useLayoutEffect,
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
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  debounce,
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
  rememberCurrentPassage,
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
import { rowTypes } from './rowTypes';
import { PlanSheetRowCtx } from './PlanActionMenu';
import { usePlanSheetFill } from './usePlanSheetFill';
import { useRefErrTest } from './useRefErrTest';
import { useShowIcon } from './useShowIcon';
import {
  curTopFromViewport,
  isSheetScrollTarget,
  overflowScrollParent,
  overscanOf,
  minDataRowHeight,
  pageSizeForView,
  scrollTopFloorForPad,
  sheetWindow,
  visibleClip,
} from './sheetWindow';

const DOWN_ARROW = 'ARROWDOWN';
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

const ContentDiv = styled('div')(({ theme }) => ({
  // Growing topPad must not scroll-anchor into a curTop feedback loop.
  overflowAnchor: 'none',
  '& .data-grid-container .data-grid .cell': {
    verticalAlign: 'middle',
    textAlign: 'left',
    paddingLeft: theme.spacing(0.5),
    paddingRight: theme.spacing(0.5),
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
    //we'll find a section before we get past 0
    let row = currentRowRef.current - 1;
    while (!isSectionType(row)) row -= 1;
    addSection(SheetLevel.Movement, row, PassageTypeEnum.MOVEMENT);
  };
  const onSectionAbove = () => {
    //we'll find a section before we get past 0
    let row = currentRowRef.current - 1;
    while (!isSectionType(row)) row -= 1;
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
    //we're on a section so find our last row and add it below it
    let row = currentRowRef.current;
    while (isPassageType(row + 1)) row++;
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
  const sheetToAbs = (sheetI: number) =>
    sheetI <= 0 ? sheetI : sheetI + windowFirstRef.current - 1;
  const absToSheet = (absI: number) =>
    absI <= 0 ? absI : absI - windowFirstRef.current + 1;

  const sheetClip = (el: HTMLElement) => overflowScrollParent(el) ?? el;

  const syncViewport = (remeasure = false) => {
    const scroller = scrollRef.current;
    const table = sheetRef.current?.querySelector(
      'table.data-grid'
    ) as HTMLTableElement | null;
    const firstH = table?.rows?.[1]?.offsetHeight || 0;
    if (firstH > 0 && (remeasure || rowHeightRef.current === 0)) {
      setRowHeight(firstH);
    }
    const h = rowHeightRef.current;
    if (!scroller || h <= 0) return;
    const { height: clipHeight } = visibleClip(scroller, 0, window.innerHeight);
    const total = Math.max(0, data.length - 1);
    const minH = minDataRowHeight(table) || h;
    setPageSize(
      Math.min(pageSizeForView(minH, clipHeight), Math.max(1, total || 1))
    );
  };

  const releaseScrollCurTopIgnore = () => {
    window.clearTimeout(ignoreScrollTimerRef.current);
    ignoreScrollTimerRef.current = window.setTimeout(() => {
      ignoreScrollTimerRef.current = 0;
      ignoreScrollCurTopRef.current = false;
    }, 200);
  };

  /** Slide virtual window only if `row` is not mounted. Do not recenter. */
  const pinWindowToRow = (row: number): false | 'start' | 'end' => {
    if (row < 1) return false;
    const first = windowFirstRef.current;
    const last = windowLastRef.current;
    if (row >= first && row < last) return false;
    const n = pageSizeRef.current;
    const desiredTop = Math.min(
      Math.max(1, data.length - n),
      row < first ? row : Math.max(1, row - n + 1)
    );
    const edge = row < first ? 'start' : 'end';
    if (desiredTop === curTop) return edge;
    ignoreScrollCurTopRef.current = true;
    setCurTop(desiredTop);
    return edge;
  };

  /** Scroll the scroller only if the row is clipped. `force` after a remount. */
  const alignRowInScroller = (
    scroller: HTMLElement,
    el: HTMLElement,
    force?: 'start' | 'end'
  ) => {
    const er = el.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    if (force === 'start' || er.top < sr.top) {
      scroller.scrollTop += er.top - sr.top;
    } else if (force === 'end' || er.bottom > sr.bottom) {
      scroller.scrollTop += er.bottom - sr.bottom;
    }
  };

  /** Keep absolute data row in view. No scroll while it is fully visible. */
  const sheetScroll = () => {
    const scroller = scrollRef.current;
    const row = currentRowRef.current;
    if (!scroller || row < 1) return false;

    if (row <= 1) {
      ignoreScrollCurTopRef.current = true;
      // rows[1] is the first *mounted* row (windowFirst), not absolute row 1.
      const remounted = windowFirstRef.current > 1;
      if (curTop !== 1) setCurTop(1);
      if (scroller.scrollTop !== 0) scroller.scrollTop = 0;
      const intoView = () => {
        const table = sheetRef.current?.querySelector(
          'table.data-grid'
        ) as HTMLTableElement | null;
        const first = table?.rows?.[1] as HTMLElement | undefined;
        const clip = sheetClip(scroller);
        // Align in an ancestor only if row 1 is clipped — do not reset AppLayout to 0.
        if (first && clip !== scroller) alignRowInScroller(clip, first);
        releaseScrollCurTopIgnore();
      };
      window.cancelAnimationFrame(sheetScrollRafRef.current);
      if (remounted) {
        sheetScrollRafRef.current = requestAnimationFrame(() => {
          sheetScrollRafRef.current = requestAnimationFrame(() => {
            sheetScrollRafRef.current = 0;
            intoView();
          });
        });
      } else intoView();
      return false;
    }

    const remounted = pinWindowToRow(row);
    const intoView = (force?: 'start' | 'end') => {
      const table = sheetRef.current?.querySelector(
        'table.data-grid'
      ) as HTMLTableElement | null;
      const el = table?.rows?.[absToSheet(row)] as HTMLElement | undefined;
      if (el) alignRowInScroller(sheetClip(scroller), el, force);
      if (remounted) releaseScrollCurTopIgnore();
    };
    window.cancelAnimationFrame(sheetScrollRafRef.current);
    if (remounted) {
      sheetScrollRafRef.current = requestAnimationFrame(() => {
        sheetScrollRafRef.current = requestAnimationFrame(() => {
          sheetScrollRafRef.current = 0;
          intoView(remounted);
        });
      });
    } else intoView();
    return false;
  };
  const sheetScrollRef = useRef(sheetScroll);
  sheetScrollRef.current = sheetScroll;
  const syncViewportRef = useRef(syncViewport);
  syncViewportRef.current = syncViewport;

  // Debounced: toolbar state + passage memory + ensure row is in view.
  const commitCurrentRowNow = () => {
    const row = currentRowRef.current;
    if (row < 0) return;
    setCurrentRowx((prev) => (prev === row ? prev : row));
    if (row > 0) {
      rememberCurrentPassage(memory, rowInfo[row - 1]?.passage?.id ?? '');
    }
    sheetScroll();
  };
  const commitCurrentRowNowRef = useRef(commitCurrentRowNow);
  commitCurrentRowNowRef.current = commitCurrentRowNow;

  const scheduleCommitCurrentRow = useMemo(
    () => debounce(() => commitCurrentRowNowRef.current(), 100),
    []
  );

  useEffect(
    () => () => scheduleCommitCurrentRow.clear(),
    [scheduleCommitCurrentRow]
  );

  const setCurrentRow = (row: number) => {
    if (row > rowInfo.length) return;
    if (row === currentRowRef.current && row === currentRow) return;
    currentRowRef.current = row;
    startRowRef.current = row;
    const j = selectColRef.current;
    setAbsSel({ startI: row, endI: row, startJ: j, endJ: j });
    scheduleCommitCurrentRow.clear();
    commitCurrentRowNow();
  };

  const handleSelect = (loc: DataSheet.Selection) => {
    const sheetEnd = loc.end?.i;
    if (sheetEnd === undefined) return;

    // Sheet index 0 is the header: paste-target at the top, scroll-up when windowed.
    if (sheetEnd === 0) {
      if (windowFirstRef.current > 1) {
        const rh = rowHeightRef.current;
        const scroller = scrollRef.current;
        if (scroller && rh) {
          const target = sheetClip(scroller);
          target.scrollTop = Math.max(
            0,
            target.scrollTop - rh * overscanOf(pageSizeRef.current)
          );
        }
        return;
      }
      // True header (windowFirst === 1): whole-plan paste via parsePaste.
      if (currentRowRef.current === 0 && startRowRef.current === 0) return;
      currentRowRef.current = 0;
      startRowRef.current = 0;
      const j = loc.end?.j ?? 0;
      selectColRef.current = j;
      setAbsSel({ startI: 0, endI: 0, startJ: j, endJ: j });
      setCurrentRowx((prev) => (prev === 0 ? prev : 0));
      scheduleCommitCurrentRow();
      return;
    }

    const absLocEnd = sheetToAbs(sheetEnd);
    const absLocStart = sheetToAbs(loc.start?.i ?? sheetEnd);
    if (
      absLocEnd < windowFirstRef.current ||
      absLocEnd >= windowLastRef.current
    ) {
      return;
    }
    const endJ = loc.end?.j ?? 0;
    const startJ = loc.start?.j ?? endJ;
    const isPoint = loc.start?.i === loc.end?.i && startJ === endJ;
    // DataSheet `end` is the moving cell (drag / shift). Keep our original
    // click as the range anchor — after we put focus in selected.start,
    // loc.start is no longer the anchor.
    const freezeAnchor =
      !isPoint &&
      startRowRef.current >= 1 &&
      startRowRef.current !== currentRowRef.current;
    const absFocus = absLocEnd;
    const absAnchor = isPoint
      ? absFocus
      : freezeAnchor
        ? startRowRef.current
        : absLocStart;
    const focusJ = endJ;
    const sameAnchor =
      absFocus === currentRowRef.current && absAnchor === startRowRef.current;
    currentRowRef.current = absFocus;
    startRowRef.current = absAnchor;
    selectColRef.current = focusJ;
    setAbsSel((prev) => {
      const next = {
        startI: absAnchor,
        endI: absFocus,
        startJ: freezeAnchor ? prev.startJ : startJ,
        endJ: focusJ,
      };
      return prev.startI === next.startI &&
        prev.endI === next.endI &&
        prev.startJ === next.startJ &&
        prev.endJ === next.endJ
        ? prev
        : next;
    });
    if (sameAnchor) return;
    setCurrentRowx((prev) => (prev === absFocus ? prev : absFocus));
    if (isPoint) queueMicrotask(() => sheetScrollRef.current());
    scheduleCommitCurrentRow();
  };

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
    const colChanges = changes.map((c) => ({
      ...c,
      row: sheetToAbs(c.row) - 1,
      col:
        !hidePublishing && publishingOn
          ? c.col - PrefixedCols - 1
          : c.col - PrefixedCols,
    }));
    updateData(colChanges);
  };

  const handleContextMenu: DataSheet.ContextMenuHandler<ICell> = (
    e,
    cell,
    i,
    j
  ) => {
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
    let content = '';
    start = start ?? 0;
    end = end ?? rowData.length;
    if (
      startRowRef.current !== -1 &&
      startRowRef.current !== currentRowRef.current
    ) {
      start = startRowRef.current - 1;
      end = currentRowRef.current;
    }
    for (let idx = start; idx < end; idx++) {
      const row = [...rowData[idx]];
      if (Boolean(row[0]) && (row[2] as string).startsWith('(')) row[2] = '';
      content += row.join('\t') + '\n';
    }
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

  const filtered = useMemo(() => {
    return (
      !filterState.disabled &&
      (filterState.minStep !== '' ||
        filterState.maxStep !== '' ||
        filterState.hideDone ||
        filterState.minSection > minimumSection ||
        (filterState.maxSection > -1 &&
          filterState.maxSection < maximumSection) ||
        filterState.assignedToMe)
    );
  }, [filterState, minimumSection, maximumSection]);

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

  const handleRowsPerPage = useMemo(
    () => debounce(() => syncViewportRef.current(false), 100),
    []
  );

  const scrolled = useMemo(
    () =>
      debounce(() => {
        if (ignoreScrollCurTopRef.current) return;
        const rh = rowHeightRef.current;
        const scroller = scrollRef.current;
        if (!rh || !scroller) return;
        const table = sheetRef.current?.querySelector(
          'table.data-grid'
        ) as HTMLTableElement | null;
        const firstData = table?.rows?.[1];
        const clip = sheetClip(scroller);
        const { top: clipTop } = visibleClip(scroller, 0, window.innerHeight);
        // Padding and WarningDiv sit above the grid; measure the first mounted
        // data row against the visible clip (inner scroller or AppLayout).
        const next = firstData
          ? curTopFromViewport(
              clipTop,
              firstData.getBoundingClientRect().top,
              windowFirstRef.current,
              rh
            )
          : Math.max(1, Math.floor(clip.scrollTop / rh));
        setCurTop((t) => (t === next ? t : next));
      }, 100),
    []
  );

  useEffect(() => {
    syncViewport();
    const scroller = scrollRef.current;
    window.addEventListener('resize', handleRowsPerPage);
    const onScroll = (e: Event) => {
      if (!isSheetScrollTarget(scrollRef.current, e.target)) return;
      scrolled();
    };
    // Capture: AppLayout (or any ancestor) can be the element that actually scrolls.
    window.addEventListener('scroll', onScroll, true);
    const ro =
      typeof ResizeObserver !== 'undefined' && scroller
        ? new ResizeObserver(() => handleRowsPerPage())
        : undefined;
    if (scroller && ro) ro.observe(scroller);
    const onDown = () => sheetScrollRef.current();
    subscribe(DOWN_ARROW, onDown);

    return () => {
      unsubscribe(DOWN_ARROW);
      window.removeEventListener('resize', handleRowsPerPage);
      window.removeEventListener('scroll', onScroll, true);
      ro?.disconnect();
      handleRowsPerPage.clear();
      scrolled.clear();
      window.clearTimeout(ignoreScrollTimerRef.current);
      window.cancelAnimationFrame(sheetScrollRafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    let refErr = false;
    let firstErrRow: number | undefined;
    if (refCol > 0) {
      rowData.forEach((row, rowIndex) => {
        if (isPassageType(rowIndex)) {
          const hasRefErr = refErrTest(row[refCol]);
          const missingBook = !row[bookCol]; // book is required
          if (hasRefErr || missingBook) {
            if (firstErrRow === undefined) firstErrRow = rowIndex + 1;
            refErr = true;
          }
        }
      });
    }
    if (refErr) {
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

  const { first: windowFirst, last: windowLast } = sheetWindow(
    curTop,
    pageSize,
    data.length
  );
  windowFirstRef.current = windowFirst;
  windowLastRef.current = windowLast;

  const visibleData = useMemo(() => {
    if (data.length <= 1) return data as any[][];
    return [data[0], ...data.slice(windowFirst, windowLast)] as any[][];
  }, [data, windowFirst, windowLast]);

  // Measure after rows exist and when rowHeight first locks (spacers appear).
  useLayoutEffect(() => {
    if (data.length <= 1) return;
    syncViewport(rowHeightRef.current === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length, rowHeight]);

  const topPad = rowHeight > 0 ? (windowFirst - 1) * rowHeight : 0;
  const bottomPad =
    rowHeight > 0 ? Math.max(0, data.length - windowLast) * rowHeight : 0;

  // Programmatic window moves grow/shrink topPad; keep scrollTop in lockstep
  // so the spacer never sits in the viewport (gap above the grid).
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    const rh = rowHeightRef.current;
    const prev = prevWindowFirstRef.current;
    prevWindowFirstRef.current = windowFirst;
    if (!scroller || !rh || prev === windowFirst) return;
    if (!ignoreScrollCurTopRef.current) return;
    const clip = sheetClip(scroller);
    const pad = topPadElRef.current;
    const floor = scrollTopFloorForPad(
      clip.scrollTop,
      clip.getBoundingClientRect().top,
      pad?.getBoundingClientRect().bottom ?? 0,
      pad?.offsetHeight ?? 0
    );
    clip.scrollTop = Math.max(
      floor,
      clip.scrollTop + (windowFirst - prev) * rh
    );
  }, [windowFirst, topPad]);

  const clearActive = useCallback(() => setActive(-1), []);
  const sheetCurrentI = useMemo(() => {
    if (currentRow === 0) return windowFirst === 1 ? 0 : -1;
    if (currentRow < windowFirst || currentRow >= windowLast) return -1;
    return currentRow - windowFirst + 1;
  }, [currentRow, windowFirst, windowLast]);
  const rowCtx = useMemo(
    () => ({ currentRow, activeRow: active, sheetCurrentI, clearActive }),
    [currentRow, active, sheetCurrentI, clearActive]
  );

  const selected = useMemo((): DataSheet.Selection | null => {
    const { startI, endI, startJ, endJ } = absSel;
    if (endI < 0 && startI < 0) return null;
    if (startI === 0 && endI === 0) {
      return { start: { i: 0, j: startJ }, end: { i: 0, j: endJ } };
    }
    const lo = Math.min(startI, endI);
    const hi = Math.max(startI, endI);
    if (hi < windowFirst || lo >= windowLast) return null;
    const toSheet = (abs: number) => {
      if (abs <= 0) return 0;
      const clamped = Math.min(Math.max(abs, windowFirst), windowLast - 1);
      return clamped - windowFirst + 1;
    };
    return {
      // DataSheet treats `start` as the current cell (arrows, Enter, typing).
      start: { i: toSheet(endI), j: endJ },
      end: { i: toSheet(startI), j: startJ },
    };
  }, [absSel, windowFirst, windowLast]);

  return (
    <ContentLayout
      header={
        <Box sx={spreadSx}>
          {!readonly && (
            <Box sx={rowSx}>
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
            </Box>
          )}
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
      drawBottomBorder={true}
      contentSx={(theme) => ({ p: theme.layout.gap, position: 'relative' })}
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
