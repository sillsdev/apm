import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  debounce,
  IconButton,
  Paper,
  SxProps,
  Typography,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../../../context/useGlobal';
import usePassageDetailContext from '../../../../context/usePassageDetailContext';
import { UnsavedContext } from '../../../../context/UnsavedContext';
import { passageTypeFromRef } from '../../../../control/passageTypeFromRef';
import { findRecord } from '../../../../crud/tryFindRecord';
import { parseRef } from '../../../../crud/passage';
import { ArtifactTypeSlug } from '../../../../crud/artifactTypeSlug';
import { useArtifactType } from '../../../../crud/useArtifactType';
import { usePlanType } from '../../../../crud/usePlanType';
import { IRegion } from '../../../../crud/useWavesurferRegions';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import UndoIcon from '@mui/icons-material/Undo';
import {
  ISharedStrings,
  IVerseStrings,
  IWsAudioPlayerSegmentStrings,
  IWsAudioPlayerStrings,
  MediaFileD,
  Passage,
} from '../../../../model';
import { PassageTypeEnum } from '../../../../model/passageType';
import {
  audioPlayerSegmentSelector,
  sharedSelector,
  verseSelector,
  wsAudioPlayerSelector,
} from '../../../../selector';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
  updateSegments,
} from '../../../../utils/namedSegments';
import { prettySegment } from '../../../../utils/prettySegment';
import { refMatch } from '../../../../utils/refMatch';
import { useStepPermissions } from '../../../../utils/useStepPermission';
import Confirm from '../../../AlertDialog';
import { type WSAudioPlayerControls } from '../../../WSAudioPlayer';
import {
  createMarkVersesApplyRegionColor,
  isMarkVersesTableTailIncomplete,
  RefStatus,
} from '../../../../utils/markVersesSegmentColors';
import {
  editReferenceValuesEqual,
  formatMarkVersesReference,
  getEndingVerseOptions,
  incrementMarkVersesReferenceSuffix,
  markVersesReferenceHasLetterSuffix,
  normalizeEditReferenceDraft,
  normalizeEditReferenceForSave,
  parseMarkVersesReference,
  passageRefsToVerseOptions,
} from '../../../../utils/markVersesPassageVerses';
import PassageDetailPlayer from '../../PassageDetailPlayer';
import { useProjectSegmentSave } from '../../Internalization/useProjectSegmentSave';
import EditReferenceDropdown, {
  EditReferenceValue,
} from './EditReferenceDropdown';
import MarkVersesTableIsMobile from './MarkVersesTableIsMobile';
import { AltButton } from '../../../../control/AltButton';
import { LightTooltip } from '../../../../control/LightTooltip';
import { TabActions } from '../../../../control/TabActions';
import {
  createMarkVersesUndoStack,
  type MarkVersesSnapshot,
} from '../../../../utils/markVersesUndoStack';
import { HotKeyContext } from '../../../../context/HotKeyContext';
import {
  ADDREMSEG_KEY,
  DELREG_KEY,
} from '../../../../components/WSAudioPlayerSegment';
import { getMarkVersesAutosaveBlockers } from '../../../../utils/markVersesValidation';
import {
  evaluateMarkVersesEditReference,
  evaluateMarkVersesReferenceStatus,
  markVersesSkippedPassageRefs,
  type MarkVersesWarningReason,
} from '../../../../utils/markVersesEditReference';
import { getLastVerse } from '../../../../business/localParatext/getLastVerse';
import { verseToolId } from '../../markVersesTool';
const emptySegments = JSON.stringify({ regions: [] });
/** Distance (seconds) used for Add (must be away from boundaries) and Remove (must be at a join). */
const SEGMENT_BOUNDARY_TOLERANCE_SEC = 0.1;
/**
 * Before remove-next-boundary, if the playhead is on the right-hand segment, seek back by this amount
 * (tolerance + tolerance) so `currentRegion` is the left segment and the correct join is removed.
 */
const REMOVE_BOUNDARY_PLAYHEAD_NUDGE_SEC =
  SEGMENT_BOUNDARY_TOLERANCE_SEC + SEGMENT_BOUNDARY_TOLERANCE_SEC;
/** Table limits use decimal seconds; waveform uses float seconds — allow rounding drift. */
const SEGMENT_ROW_MATCH_TOLERANCE_SEC = 0.6;
const paperProps = { p: 2, m: 'auto', width: 'calc(100% - 32px)' } as SxProps;
const readOnlys = [true, false];
const widths = [150, 150];
const cClass = ['lim', 'ref'];

function isProgressNearAnyRegionBoundary(
  progressSec: number,
  regions: IRegion[],
  minDistanceSec: number
): boolean {
  if (Math.abs(progressSec) <= minDistanceSec) return true;
  if (regions.length === 0) return false;
  const boundaries = new Set<number>();
  for (const r of regions) {
    boundaries.add(r.start);
    boundaries.add(r.end);
  }
  for (const b of boundaries) {
    if (Math.abs(progressSec - b) <= minDistanceSec) return true;
  }
  return false;
}

/** Closest internal join within `tol` of `progressSec`, if any (tie: smallest distance). */
function findClosestInternalJoin(
  progressSec: number,
  regions: IRegion[],
  tol: number
): { join: number; leftSegment: IRegion } | undefined {
  if (regions.length < 2) return undefined;
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  let best: { join: number; leftSegment: IRegion; dist: number } | undefined;
  for (let i = 0; i < sorted.length - 1; i++) {
    const join = sorted[i].end;
    const d = Math.abs(progressSec - join);
    if (d <= tol && (!best || d < best.dist)) {
      best = { join, leftSegment: sorted[i], dist: d };
    }
  }
  return best ? { join: best.join, leftSegment: best.leftSegment } : undefined;
}

function isProgressNearInternalJoin(
  progressSec: number,
  regions: IRegion[],
  tol: number
): boolean {
  return findClosestInternalJoin(progressSec, regions, tol) !== undefined;
}

type IVrs = [string, number[]];

export interface ICell {
  value: any;
  readOnly?: boolean;
  width?: number;
  className?: string;
  status?: RefStatus;
  /** Tooltip text shown on the row's warning icon (set for either flagged
   * `status`, `RefStatus.Warn` or `RefStatus.Err`). */
  warning?: string;
}

enum ColName {
  Limits,
  Ref,
}

const AUTOSAVE_DEBOUNCE_MS = 1200;

interface IEditReferenceDialogState extends EditReferenceValue {
  rowIndex: number;
  limits: string;
  existingSplit: boolean;
  endVerseOptions: ReturnType<typeof getEndingVerseOptions>;
  /** Row carries a warning icon: the start verse becomes editable. */
  editStart: boolean;
}

export interface MarkVersesProps {
  width: number;
}

// TODO: after we finish making all changes for this PR, rename this to PassageDetailMarkVerses. Possibly wait until after review to do this.
export default function PassageDetailMarkVersesIsMobile({
  width,
}: MarkVersesProps) {
  const {
    mediafileId,
    section,
    passage,
    currentstep,
    currentSegment,
    currentSegmentIndex,
    setCurrentSegment,
    rowData,
  } = usePassageDetailContext();
  const [memory] = useGlobal('memory');
  const [, setComplete] = useGlobal('progress');
  const [plan] = useGlobal('plan');
  const [data, setDatax] = useState<ICell[][]>([]);
  const [numSegments, setNumSegments] = useState(0);
  // Keep this empty by default so `PassageDetailPlayer` loads the *saved* segments
  // from `media.attributes.segments` (it prefers `suggestedSegments` when non-empty).
  const [pastedSegments, setPastedSegments] = useState('');
  const [engVrs, setEngVrs] = useState<Map<string, number[]>>(new Map());
  const [editReferenceDialog, setEditReferenceDialog] =
    useState<IEditReferenceDialogState>();
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const undoStackRef = useRef(createMarkVersesUndoStack());
  const [playerResetKey, setPlayerResetKey] = useState(0);
  const [playerProgressSec, setPlayerProgressSec] = useState(0);
  /** Precise segment JSON from the waveform (table limits round to whole seconds). */
  const [waveSegmentsJson, setWaveSegmentsJson] = useState('{}');
  const playerControlsRef = useRef<WSAudioPlayerControls | null>(null);
  const markVersesTailOpenRef = useRef(false);
  const applyRegionColor = useMemo(
    () => createMarkVersesApplyRegionColor(markVersesTailOpenRef),
    []
  );
  const tableRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const prevRegionCountRef = useRef(0);
  const skipScrollIntoViewRef = useRef(false);
  const setSegmentsDebounceRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const savingRef = useRef(false);
  const canceling = useRef(false);
  const dataRef = useRef<ICell[][]>([]);
  const segmentsRef = useRef('{}');
  const passageRefs = useRef<string[]>([]);
  const resettingSegmentsRef = useRef(false);
  /** After local Reset, do not re-apply `savedVerseSegmentsJson` from the media record until save or media change. */
  const suppressVerseResyncFromMediaRef = useRef(false);
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission = canDoSectionStep(currentstep, section);
  const { localizedArtifactType } = useArtifactType();
  const t = useSelector(verseSelector, shallowEqual) as IVerseStrings;
  const ts = useSelector(sharedSelector, shallowEqual) as ISharedStrings;
  const tp = useSelector(
    audioPlayerSegmentSelector,
    shallowEqual
  ) as IWsAudioPlayerSegmentStrings;
  const tr = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  ) as IWsAudioPlayerStrings;
  const { localizeHotKey } = useContext(HotKeyContext).state;
  const {
    toolChanged,
    toolsChanged,
    isChanged,
    saveRequested,
    saveCompleted,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const hasChanged = useMemo(() => isChanged(verseToolId), [isChanged]);
  const projectSegmentSave = useProjectSegmentSave();
  const planType = usePlanType();

  const isFlat = useMemo(() => planType(plan)?.flat, [plan, planType]);

  const passType = useMemo(
    () => passageTypeFromRef(passage?.attributes?.reference, isFlat),
    [isFlat, passage]
  );

  useEffect(() => {
    import('../../../../assets/eng-vrs').then((module) => {
      setEngVrs(new Map<string, number[]>(module.default as IVrs[]));
    });
  }, []);

  useEffect(() => {
    segmentsRef.current = '{}';
    setNumSegments(0);
    setPastedSegments('');
    suppressVerseResyncFromMediaRef.current = false;
  }, [mediafileId]);

  const rowCells = useCallback(
    (row: string[], first = false) =>
      row.map((value, index) => {
        // Only reference cells carry a status; limits/title cells stay undefined.
        const isRef = !first && index === ColName.Ref;
        const illFormatted = isRef && Boolean(value) && !refMatch(value);
        return {
          value,
          width: widths[index],
          readOnly: first || readOnlys[index],
          className: first ? 'cTitle' : cClass[index],
          status: isRef
            ? illFormatted
              ? RefStatus.Err
              : RefStatus.Valid
            : undefined,
        } as ICell;
      }),
    []
  );

  const emptyTable = useCallback(
    () => [rowCells([t.startStop, t.reference], true)],
    [rowCells, t.reference, t.startStop]
  );

  const setData = useCallback((newData: ICell[][]) => {
    setDatax(newData);
    dataRef.current = newData;
  }, []);

  useEffect(() => {
    if (dataRef.current.length === 0) {
      setData(emptyTable());
    }
  }, [emptyTable, setData]);

  const tableSignature = useCallback(
    (tableData: ICell[][]) =>
      JSON.stringify(
        tableData.map((row) =>
          row.map((cell) => ({
            value: cell.value ?? '',
            className: cell.className ?? '',
            status: cell.status ?? '',
            readOnly: cell.readOnly ?? false,
          }))
        )
      ),
    []
  );

  const media = useMemo(
    () => findRecord(memory, 'mediafile', mediafileId) as MediaFileD,
    [mediafileId, memory]
  );

  /** Same extraction as `PassageDetailPlayer` / desktop so the table can hydrate when segments arrive or after the passage rows exist. */
  const savedVerseSegmentsJson = useMemo(
    () =>
      media?.attributes?.segments
        ? getSegments(NamedRegions.Verse, media.attributes.segments)
        : '{}',
    [media?.attributes?.segments]
  );

  const hasBtRecordings = useMemo(() => {
    const btType = localizedArtifactType(
      ArtifactTypeSlug.PhraseBackTranslation
    );
    return rowData.some((row) => row.artifactType === btType);
  }, [localizedArtifactType, rowData]);

  const setupData = (items: string[]) => {
    passageRefs.current = items;
    const newData = emptyTable();
    items.forEach((item) => {
      newData.push(rowCells(['', item]));
    });
    setData(newData);
    if (segmentsRef.current) handleSegment(segmentsRef.current, true);
  };

  const getRefs = useCallback(
    (value: string, book: string) => {
      const normalized = value
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[^\d]*/, '');

      const psg = {
        attributes: {
          reference: normalized,
          book,
        },
      } as Passage;

      parseRef(psg);

      const { startChapter, startVerse, endChapter, endVerse } = psg.attributes;

      if (!startChapter || !startVerse) return [];

      const finalChapter = endChapter ?? startChapter;
      const finalVerse = endVerse ?? startVerse;
      const refs: string[] = [];

      if (startChapter === finalChapter) {
        for (let verse = startVerse; verse <= finalVerse; verse += 1) {
          refs.push(`${startChapter}:${verse}`);
        }
        return refs;
      }

      for (let chapter = startChapter; chapter <= finalChapter; chapter += 1) {
        const fromVerse = chapter === startChapter ? startVerse : 1;
        const toVerse =
          chapter === finalChapter
            ? finalVerse
            : (engVrs.get(book) ?? [])[chapter - 1];

        if (!toVerse) continue;

        for (let verse = fromVerse; verse <= toVerse; verse += 1) {
          refs.push(`${chapter}:${verse}`);
        }
      }

      return refs;
    },
    [engVrs]
  );

  const getPassageRefs = useCallback(
    (psg?: Passage) => {
      if (!psg?.attributes) return [];

      const book = psg.attributes.book ?? '';
      if (psg.attributes.reference) {
        const refsFromReference = getRefs(psg.attributes.reference, book);
        if (refsFromReference.length > 0) return refsFromReference;
      }

      const { startChapter, startVerse, endChapter, endVerse } = psg.attributes;
      if (!startChapter || !startVerse) return [];

      const finalChapter = endChapter ?? startChapter;
      const finalVerse = endVerse ?? startVerse;
      const refs: string[] = [];

      if (startChapter === finalChapter) {
        for (let verse = startVerse; verse <= finalVerse; verse += 1) {
          refs.push(`${startChapter}:${verse}`);
        }
        return refs;
      }

      if (!book) return [];

      for (let chapter = startChapter; chapter <= finalChapter; chapter += 1) {
        const fromVerse = chapter === startChapter ? startVerse : 1;
        const toVerse =
          chapter === finalChapter
            ? finalVerse
            : (engVrs.get(book) ?? [])[chapter - 1];

        if (!toVerse) continue;

        for (let verse = fromVerse; verse <= toVerse; verse += 1) {
          refs.push(`${chapter}:${verse}`);
        }
      }

      return refs;
    },
    [engVrs, getRefs]
  );

  const passageRefsKey = useMemo(
    () => getPassageRefs(passage).join('\u001f'),
    [getPassageRefs, passage]
  );

  useEffect(() => {
    const refs = getPassageRefs(passage);
    if (refs.length > 0) {
      setupData(refs);
    } else if (dataRef.current.length === 0) {
      setData(emptyTable());
    }
    // setupData is intentionally local to keep the mobile render simple.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getPassageRefs, passage]);

  const collectRefs = useCallback(
    (tableData: ICell[][]) => {
      const refs: string[] = [];
      tableData
        .filter((_, index) => index > 0)
        .forEach((row) => {
          const value = (row[ColName.Ref] as ICell).value;
          if (refMatch(value)) {
            refs.push(...getRefs(value, passage?.attributes?.book ?? ''));
          }
        });
      return refs;
    },
    [getRefs, passage.attributes.book]
  );

  // There has been discussion about whether to display timestamps in the table
  // with mm::ss or ss.s format. Future work to look at the overall app and unify
  // timestamp formatting, including with Wavesurfer and Disucssions.
  //
  // To use mm:ss:
  // const formatTime = (value: number) =>
  //   (Math.round(value * 10) / 10).toFixed(1);
  // const formLim = useCallback(
  //   ({ start, end }: IRegion) => `${formatTime(start)}-${formatTime(end)}`,
  //   []
  // );
  //   const parseFormattedTime = (value: string) => {
  //   const trimmed = value.trim();
  //   if (!trimmed) return NaN;
  //   if (trimmed.includes(':')) {
  //     const [minPart, secPart] = trimmed.split(':');
  //     const minutes = parseInt(minPart, 10);
  //     const seconds = parseFloat(secPart);
  //     if (Number.isNaN(minutes) || Number.isNaN(seconds)) return NaN;
  //     return minutes * 60 + seconds;
  //   }
  //   return parseFloat(trimmed);
  // };
  //
  // To use ss.s:
  const d1 = (d: number) => d.toFixed(1);
  const formLim = useCallback(
    ({ start, end }: IRegion) => `${d1(start)}-${d1(end)}`,
    []
  );
  const parseFormattedTime = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    return parseFloat(trimmed);
  };

  const getSegmentFromRow = useCallback((row?: ICell[]) => {
    if (!row) return undefined;
    const limits = `${row[ColName.Limits]?.value ?? ''}`.split('-');
    if (limits.length !== 2) return undefined;
    const start = parseFormattedTime(limits[0]);
    const end = parseFormattedTime(limits[1]);
    if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
    return { start, end } as IRegion;
  }, []);

  const waveformRegions = useMemo(
    () => getSortedRegions(waveSegmentsJson),
    [waveSegmentsJson]
  );

  /** Prefer waveform bounds — table limits are decimal seconds and can round (e.g. 8.44s → 8.4). */
  const getActiveSegmentForRow = useCallback(
    (rowIndex: number, row?: ICell[]) => {
      if (rowIndex > 0 && waveformRegions[rowIndex - 1]) {
        return waveformRegions[rowIndex - 1];
      }
      return getSegmentFromRow(row);
    },
    [waveformRegions, getSegmentFromRow]
  );

  const rowHasSegment = useCallback(
    (rowIndex: number, row?: ICell[]) =>
      Boolean(getActiveSegmentForRow(rowIndex, row)),
    [getActiveSegmentForRow]
  );

  const addBoundaryTooCloseToExisting = useMemo(
    () =>
      isProgressNearAnyRegionBoundary(
        playerProgressSec,
        waveformRegions,
        SEGMENT_BOUNDARY_TOLERANCE_SEC
      ),
    [playerProgressSec, waveformRegions]
  );

  const removeBoundaryEnabled = useMemo(
    () =>
      isProgressNearInternalJoin(
        playerProgressSec,
        waveformRegions,
        SEGMENT_BOUNDARY_TOLERANCE_SEC
      ),
    [playerProgressSec, waveformRegions]
  );

  const syncProgressFromPlayer = useCallback(() => {
    const apply = () => {
      const c = playerControlsRef.current;
      if (c?.isReady()) setPlayerProgressSec(c.getProgress());
    };
    apply();
    requestAnimationFrame(apply);
  }, []);

  useEffect(() => {
    const ctrl = playerControlsRef.current;
    if (ctrl?.isReady()) {
      setPlayerProgressSec(ctrl.getProgress());
    }
  }, [waveSegmentsJson, playerResetKey]);

  useEffect(() => {
    markVersesTailOpenRef.current = isMarkVersesTableTailIncomplete(
      data,
      ColName.Limits
    );
    playerControlsRef.current?.applyRegionColors?.();
  }, [data, waveSegmentsJson]);

  const cloneTableData = useCallback(
    (tableData: ICell[][]) =>
      tableData.map((row) =>
        row.map((cell) => ({
          ...cell,
        }))
      ),
    []
  );

  const pushUndoSnapshot = useCallback(() => {
    const snapshot: MarkVersesSnapshot = {
      tableData: cloneTableData(
        dataRef.current
      ) as MarkVersesSnapshot['tableData'],
      segmentsJson: segmentsRef.current,
      pastedSegments,
      waveSegmentsJson,
      currentSegment,
      currentSegmentIndex,
    };
    undoStackRef.current.push(snapshot);
    setUndoAvailable(undoStackRef.current.canUndo());
  }, [
    cloneTableData,
    pastedSegments,
    waveSegmentsJson,
    currentSegment,
    currentSegmentIndex,
  ]);

  const setActiveRowHighlight = useCallback(
    (tableData: ICell[][], rowIndex: number) => {
      tableData.forEach((row, index) => {
        if (index === 0) return;
        const limits = row[ColName.Limits] as ICell;
        limits.className = limits.className?.replace(/\s*cur\b/g, '') || 'lim';
      });

      if (rowIndex > 0) {
        const activeRow = tableData[rowIndex] as ICell[] | undefined;
        const limits = activeRow?.[ColName.Limits] as ICell | undefined;
        if (limits) {
          limits.className = `${limits.className ?? 'lim'} cur`.trim();
        }
      }
    },
    []
  );

  const parseCurrentSegmentRegion = useCallback((value: string) => {
    const match = value.trim().match(/^([\d.]+)-([\d.]+)$/);
    if (!match) return undefined;
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);
    if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
    return { start, end } as IRegion;
  }, []);

  const findRowForPlayhead = useCallback(
    (tableData: ICell[][], playhead?: number) => {
      const livePlayhead =
        playhead ??
        playerControlsRef.current?.getProgress() ??
        playerProgressSec;
      const rowSegs: {
        idx: number;
        start: number;
        end: number;
      }[] = [];
      for (let i = 1; i < tableData.length; i++) {
        const seg = getActiveSegmentForRow(i, tableData[i] as ICell[]);
        if (seg) rowSegs.push({ idx: i, start: seg.start, end: seg.end });
      }
      rowSegs.sort((a, b) => a.start - b.start);
      for (let i = 0; i < rowSegs.length; i++) {
        const r = rowSegs[i];
        const isLast = i === rowSegs.length - 1;
        const inRegion =
          livePlayhead >= r.start - 0.01 &&
          (isLast
            ? livePlayhead <= r.end + 0.01
            : livePlayhead < r.end - SEGMENT_BOUNDARY_TOLERANCE_SEC);
        if (inRegion) return r.idx;
      }
      return -1;
    },
    [getActiveSegmentForRow, playerProgressSec]
  );

  const findCurrentTableRowIndex = useCallback(
    (tableData: ICell[][], preferPlayhead: boolean = false) => {
      if (preferPlayhead) {
        const playheadRow = findRowForPlayhead(tableData);
        if (playheadRow > 0) return playheadRow;
      }

      const existingHighlight = tableData.findIndex(
        (row, index) =>
          index > 0 &&
          ((row[ColName.Limits] as ICell).className ?? '').includes('cur')
      );

      const target = parseCurrentSegmentRegion(currentSegment);

      if (target) {
        for (let i = 1; i < tableData.length; i++) {
          const seg = getActiveSegmentForRow(i, tableData[i]);
          if (!seg) continue;
          if (
            Math.abs(seg.start - target.start) <=
              SEGMENT_ROW_MATCH_TOLERANCE_SEC &&
            Math.abs(seg.end - target.end) <= SEGMENT_ROW_MATCH_TOLERANCE_SEC
          ) {
            return i;
          }
        }
        let startOnlyMatch = -1;
        for (let i = 1; i < tableData.length; i++) {
          const seg = getActiveSegmentForRow(i, tableData[i]);
          if (!seg) continue;
          if (
            Math.abs(seg.start - target.start) <=
            SEGMENT_ROW_MATCH_TOLERANCE_SEC
          ) {
            startOnlyMatch = i;
          }
        }
        if (startOnlyMatch > 0) return startOnlyMatch;
      } else if (existingHighlight > 0) {
        return existingHighlight;
      }

      if (
        currentSegmentIndex > 0 &&
        currentSegmentIndex < tableData.length &&
        rowHasSegment(currentSegmentIndex, tableData[currentSegmentIndex])
      ) {
        if (!target) return currentSegmentIndex;
        const rowSeg = getActiveSegmentForRow(
          currentSegmentIndex,
          tableData[currentSegmentIndex] as ICell[]
        );
        if (
          rowSeg &&
          Math.abs(rowSeg.start - target.start) <=
            SEGMENT_ROW_MATCH_TOLERANCE_SEC &&
          Math.abs(rowSeg.end - target.end) <= SEGMENT_ROW_MATCH_TOLERANCE_SEC
        ) {
          return currentSegmentIndex;
        }
      }

      if (existingHighlight > 0) return existingHighlight;

      if (waveformRegions.length > 0) {
        const sorted = [...waveformRegions].sort((a, b) => a.start - b.start);
        for (let i = 0; i < sorted.length; i++) {
          const r = sorted[i];
          const isLast = i === sorted.length - 1;
          const inRegion =
            playerProgressSec >= r.start - 0.01 &&
            (isLast
              ? playerProgressSec <= r.end + 0.01
              : playerProgressSec < r.end - SEGMENT_BOUNDARY_TOLERANCE_SEC);
          if (inRegion) {
            const regionIndex = waveformRegions.findIndex(
              (wr) => wr.start === r.start && wr.end === r.end
            );
            if (regionIndex >= 0) return regionIndex + 1;
          }
        }
      }

      return -1;
    },
    [
      currentSegment,
      currentSegmentIndex,
      getActiveSegmentForRow,
      rowHasSegment,
      parseCurrentSegmentRegion,
      playerProgressSec,
      waveformRegions,
      findRowForPlayhead,
    ]
  );

  const applyActiveRowHighlight = useCallback(
    (tableData: ICell[][], preferPlayhead: boolean = false) => {
      const rowIndex = findCurrentTableRowIndex(tableData, preferPlayhead);
      if (rowIndex > 0) {
        setActiveRowHighlight(tableData, rowIndex);
      }
      return rowIndex;
    },
    [findCurrentTableRowIndex, setActiveRowHighlight]
  );

  /** Versification lookup bound to the passage's book (used for range checks). */
  const lastVerseForBook = useCallback(
    (chapter: number) => getLastVerse(passage?.attributes?.book ?? '', chapter),
    [passage]
  );

  /**
   * Localized tooltip for a flagged reference. Mirrors the message mapping the
   * Edit Reference save once did inline, so load-time and edit-time warnings
   * read identically. `passageRange` feeds the `skipsAhead` "verses skipped"
   * list.
   */
  const referenceWarningMessage = useCallback(
    (
      reason: MarkVersesWarningReason | undefined,
      reference: string,
      precedingReference: string | undefined,
      passageRange: string[]
    ): string | undefined => {
      switch (reason) {
        case 'illFormatted':
        case 'overlap':
          return t.badReferences;
        case 'outOfRange':
          return t.outsideReferences.replace('{0}', reference);
        case 'skipsAhead':
          return t.missingReferences.replace(
            '{0}',
            markVersesSkippedPassageRefs(
              precedingReference ?? '',
              reference,
              passageRange
            ).join(', ')
          );
        default:
          return undefined;
      }
    },
    [t]
  );

  const buildReferenceCell = useCallback(
    (value: string, cell: ICell, warning?: string) => {
      // TODO revisit this and the color
      const illFormatted = Boolean(value) && !refMatch(value);
      // `Err` (ill-formatted, fails refMatch) renders red; `Warn` (well-formed
      // but out of range / breaks consecutive numbering) renders a warning icon.
      // `warning` is the tooltip text and is shown for either flagged state.
      const status: ICell['status'] = illFormatted
        ? RefStatus.Err
        : warning
          ? RefStatus.Warn
          : RefStatus.Valid;
      return {
        ...cell,
        value,
        warning: warning || undefined,
        className: 'ref',
        status,
      };
    },
    []
  );

  /**
   * Flag every reference row in place using the shared per-row authority, so a
   * freshly-loaded table surfaces the same warnings an edit would. Mutates and
   * returns `tableData`; the header row (index 0) is left untouched.
   */
  const annotateReferenceWarnings = useCallback(
    (tableData: ICell[][], passageRange: string[]): ICell[][] => {
      const dataRefs = tableData
        .slice(1)
        .map((row) => `${(row[ColName.Ref] as ICell)?.value ?? ''}`);
      tableData.forEach((row, index) => {
        if (index === 0) return;
        const cell = row[ColName.Ref] as ICell;
        const value = `${cell?.value ?? ''}`;
        const rowIdx = index - 1;
        const { reason } = evaluateMarkVersesReferenceStatus(
          value,
          dataRefs,
          rowIdx,
          lastVerseForBook
        );
        const precedingReference =
          rowIdx > 0 ? dataRefs[rowIdx - 1] : undefined;
        const warning = referenceWarningMessage(
          reason,
          value,
          precedingReference,
          passageRange
        );
        row[ColName.Ref] = buildReferenceCell(value, cell, warning);
      });
      return tableData;
    },
    [lastVerseForBook, referenceWarningMessage, buildReferenceCell]
  );

  /** Assign passage refs after the saved range; add rows when the range no longer covers them. */
  const redistributeTableTailAfterSave = useCallback(
    (
      tableData: ICell[][],
      startRowIndex: number,
      passageRange: string[],
      endPassageIdx: number,
      leadingRef?: string
    ) => {
      if (endPassageIdx < 0) return;

      const tailPassageRefs = leadingRef
        ? [leadingRef, ...passageRange.slice(endPassageIdx + 1)]
        : passageRange.slice(endPassageIdx + 1);
      const insertIndex = startRowIndex + 1;
      const oldTail = tableData.splice(insertIndex);

      const newTail: ICell[][] = tailPassageRefs.map((passageRef, index) => {
        const oldRow = oldTail[index] as ICell[] | undefined;
        if (oldRow) {
          return [
            { ...(oldRow[ColName.Limits] as ICell) },
            buildReferenceCell(passageRef, oldRow[ColName.Ref] as ICell),
          ];
        }
        return rowCells(['', passageRef]);
      });

      for (
        let index = tailPassageRefs.length;
        index < oldTail.length;
        index += 1
      ) {
        const oldRow = oldTail[index] as ICell[] | undefined;
        if (!oldRow) continue;
        if (`${oldRow[ColName.Limits]?.value ?? ''}`.trim()) {
          newTail.push(oldRow.map((cell) => ({ ...cell })));
        }
      }

      tableData.push(...newTail);
    },
    [buildReferenceCell, rowCells]
  );

  const parseReferenceValue = useCallback(
    (value: string) => parseMarkVersesReference(value),
    []
  );

  const formatReferenceValue = useCallback(
    (value: EditReferenceValue) => formatMarkVersesReference(value),
    []
  );

  const findHighlightedRowIndex = useCallback((tableData: ICell[][]) => {
    return tableData.findIndex(
      (row, index) =>
        index > 0 &&
        ((row[ColName.Limits] as ICell).className ?? '').includes('cur')
    );
  }, []);

  const buildEditReferenceDialogState = useCallback(
    (rowIndex: number) => {
      const row = dataRef.current[rowIndex] as ICell[] | undefined;
      if (!row) return undefined;

      const currentValue = `${row[ColName.Ref]?.value ?? ''}`;
      const fallbackValue =
        passageRefs.current[rowIndex - 1] || currentValue || '1:1';
      const currentRef =
        parseReferenceValue(currentValue) || parseReferenceValue(fallbackValue);
      if (!currentRef) return undefined;

      const nextRow = dataRef.current[rowIndex + 1] as ICell[] | undefined;
      const nextValue = `${nextRow?.[ColName.Ref]?.value ?? ''}`;
      const nextRef = parseReferenceValue(nextValue);
      const hasLetterSuffix = markVersesReferenceHasLetterSuffix(currentRef);
      const spansMultipleVerses =
        currentRef.start.chapter !== currentRef.end.chapter ||
        currentRef.start.verse !== currentRef.end.verse;
      const existingSplit = spansMultipleVerses || hasLetterSuffix;
      const canSplit =
        existingSplit ||
        Boolean(nextRef) ||
        Boolean(`${nextRow?.[ColName.Ref]?.value ?? ''}`.trim()) ||
        Boolean(`${nextRow?.[ColName.Limits]?.value ?? ''}`.trim());
      const passageRange =
        passageRefs.current.length > 0
          ? passageRefs.current
          : getPassageRefs(passage);
      // Any flagged row — ill-formatted (`Err`) or well-formed but out of range /
      // non-consecutive (`Warn`) — lets the user fix the start verse, so both
      // dropdowns offer the full passage verse list rather than just the slice
      // from the current start onward.
      const refStatus = (row[ColName.Ref] as ICell)?.status;
      const editStart = Boolean(refStatus) && refStatus !== RefStatus.Valid;
      const endVerseOptions = editStart
        ? passageRefsToVerseOptions(passageRange)
        : getEndingVerseOptions(
            passageRange,
            currentRef.start.chapter,
            currentRef.start.verse
          );
      const defaultEnd =
        endVerseOptions.find(
          (option) =>
            option.chapter === currentRef.end.chapter &&
            option.verse === currentRef.end.verse
        ) ?? endVerseOptions[endVerseOptions.length - 1];

      return {
        rowIndex,
        limits: `${row[ColName.Limits]?.value ?? ''}`,
        canSplit,
        splitVerse: hasLetterSuffix,
        existingSplit,
        editStart,
        endVerseOptions,
        startChapter: currentRef.start.chapter,
        startVerse: currentRef.start.verse,
        startSuffix: hasLetterSuffix ? currentRef.start.suffix : '',
        endChapter: defaultEnd.chapter,
        endVerse: defaultEnd.verse,
        endSuffix: hasLetterSuffix ? currentRef.end.suffix : '',
      } as IEditReferenceDialogState;
    },
    [getPassageRefs, parseReferenceValue, passage]
  );

  const seekToRowSegment = useCallback(
    async (rowIndex: number) => {
      const row = dataRef.current[rowIndex] as ICell[] | undefined;
      if (!row) return;

      const activeSegment = getActiveSegmentForRow(rowIndex, row);
      const limits = row[ColName.Limits] as ICell;
      const alreadyCurrent = (limits.className ?? '').includes('cur');
      const newData = cloneTableData(dataRef.current);
      setActiveRowHighlight(newData, rowIndex);
      if (
        !alreadyCurrent ||
        tableSignature(dataRef.current) !== tableSignature(newData)
      ) {
        setData(newData);
      }

      if (!activeSegment) return;

      setCurrentSegment(activeSegment, rowIndex);
      const ctrl = playerControlsRef.current;
      if (ctrl?.isReady()) {
        // Nudge past the join so the waveform does not pick the prior segment at the boundary.
        const seekTime =
          activeSegment.start > 0
            ? activeSegment.start + SEGMENT_BOUNDARY_TOLERANCE_SEC
            : activeSegment.start;
        await ctrl.gotoTime(seekTime, activeSegment);
        setCurrentSegment(activeSegment, rowIndex);
        syncProgressFromPlayer();
      }
    },
    [
      getActiveSegmentForRow,
      cloneTableData,
      setActiveRowHighlight,
      tableSignature,
      setCurrentSegment,
      setData,
      syncProgressFromPlayer,
    ]
  );

  const scrollActiveRowIntoView = useCallback((rowIndex: number) => {
    if (rowIndex <= 0 || skipScrollIntoViewRef.current) return;
    const rowEl = tableRowRefs.current[rowIndex - 1];
    if (rowEl && typeof rowEl.scrollIntoView === 'function') {
      rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  const handleSelectRow = useCallback(
    (rowIndex: number) => {
      const row = dataRef.current[rowIndex] as ICell[] | undefined;
      if (!row || !rowHasSegment(rowIndex, row)) return;
      const limits = row[ColName.Limits] as ICell;
      if ((limits.className ?? '').includes('cur')) return;
      skipScrollIntoViewRef.current = true;
      void seekToRowSegment(rowIndex).finally(() => {
        skipScrollIntoViewRef.current = false;
      });
    },
    [rowHasSegment, seekToRowSegment]
  );

  const syncTableHighlightToCurrentSegment = useCallback(() => {
    if (dataRef.current.length === 0) return;

    const newData = cloneTableData(dataRef.current);
    const rowIndex = applyActiveRowHighlight(newData);
    if (tableSignature(dataRef.current) === tableSignature(newData)) return;
    setData(newData);
    scrollActiveRowIntoView(rowIndex);
  }, [
    applyActiveRowHighlight,
    cloneTableData,
    setData,
    tableSignature,
    scrollActiveRowIntoView,
  ]);

  useEffect(() => {
    syncTableHighlightToCurrentSegment();
  }, [
    currentSegment,
    currentSegmentIndex,
    waveSegmentsJson,
    syncTableHighlightToCurrentSegment,
  ]);

  const handleCloseSplitVerseDialog = () => {
    setEditReferenceDialog(undefined);
  };

  /**
   * Apply a new reference string to a data row, shared by the Edit Reference
   * dialog and inline hand-editing. Decides whether to re-number the tail, flag
   * the row with a warning, or leave numbering alone, then updates the table,
   * segments, and change state. Caller is responsible for any UI (e.g. closing
   * the dialog) and for skipping no-op edits before calling.
   */
  const applyReferenceEdit = (startRowIndex: number, newReference: string) => {
    if (!dataRef.current[startRowIndex]) return;

    pushUndoSnapshot();
    const newData = cloneTableData(dataRef.current);
    const row = newData[startRowIndex] as ICell[] | undefined;
    if (!row) return;

    const previousReference = `${(row[ColName.Ref] as ICell)?.value ?? ''}`;

    // Decide whether this edit re-numbers the tail or leaves numbering alone.
    // Versification is bound to the passage's book so the chapter-boundary rules
    // match the rest of the app. Warning flags are applied below by
    // annotateReferenceWarnings, not decided here.
    const tableReferences = dataRef.current
      .slice(1)
      .map((tableRow) => `${(tableRow[ColName.Ref] as ICell)?.value ?? ''}`);
    const precedingReference =
      startRowIndex > 1
        ? `${(newData[startRowIndex - 1]?.[ColName.Ref] as ICell)?.value ?? ''}`
        : undefined;
    const { action: editAction } = evaluateMarkVersesEditReference({
      previousReference,
      newReference,
      precedingReference,
      tableReferences,
      rowIndex: startRowIndex - 1,
      getLastVerse: lastVerseForBook,
    });

    const passageRange =
      passageRefs.current.length > 0
        ? passageRefs.current
        : getPassageRefs(passage);

    // Set the edited value; the whole-table warning pass below assigns its
    // status and tooltip (and re-evaluates every other row).
    row[ColName.Ref] = buildReferenceCell(
      newReference,
      row[ColName.Ref] as ICell
    );

    const parsed = parseReferenceValue(newReference);
    const startPassageIdx = parsed
      ? passageRange.findIndex((ref) => {
          const p = parseReferenceValue(ref);
          return (
            p?.start.chapter === parsed.start.chapter &&
            p.start.verse === parsed.start.verse
          );
        })
      : -1;
    const endPassageIdx = parsed
      ? passageRange.findIndex((ref) => {
          const p = parseReferenceValue(ref);
          return (
            p?.start.chapter === parsed.end.chapter &&
            p.start.verse === parsed.end.verse
          );
        })
      : -1;

    // When the edited reference ends mid-split (e.g. `1:3a`), the following row
    // should lead with the next letter (`1:3b`).
    const leadingRef = incrementMarkVersesReferenceSuffix(newReference);

    if (
      editAction === 'renumber' &&
      startPassageIdx >= 0 &&
      endPassageIdx >= 0
    ) {
      redistributeTableTailAfterSave(
        newData,
        startRowIndex,
        passageRange,
        endPassageIdx,
        leadingRef
      );
    }

    annotateReferenceWarnings(newData, passageRange);
    setActiveRowHighlight(newData, startRowIndex);
    setData(newData);
    setSegments();

    const activeSegment = getSegmentFromRow(newData[startRowIndex] as ICell[]);
    if (activeSegment) {
      setCurrentSegment(activeSegment, startRowIndex);
    }

    toolChanged(verseToolId);
  };

  const handleSaveSplitVerseDialog = (value: EditReferenceValue) => {
    if (!editReferenceDialog) return;

    const openingValue = normalizeEditReferenceDraft(editReferenceDialog);
    // Defense in depth: EditReferenceDropdown disables Save via the same helper;
    // keep both paths on editReferenceValuesEqual so semantics stay aligned.
    if (editReferenceValuesEqual(value, openingValue)) {
      setEditReferenceDialog(undefined);
      return;
    }

    const saveValue = normalizeEditReferenceForSave(value);
    applyReferenceEdit(
      editReferenceDialog.rowIndex,
      formatReferenceValue(saveValue)
    );
    setEditReferenceDialog(undefined);
  };

  /** Commit a reference typed directly into the table's reference cell. */
  const handleReferenceTextEdit = (rowIndex: number, rawValue: string) => {
    const row = dataRef.current[rowIndex] as ICell[] | undefined;
    if (!row) return;
    const previousReference = `${(row[ColName.Ref] as ICell)?.value ?? ''}`;
    const newReference = rawValue.trim();
    if (newReference === previousReference.trim()) return;
    applyReferenceEdit(rowIndex, newReference);
  };

  const resetSegments = (regions: IRegion[]) => {
    const segments = JSON.stringify({ regions });
    setTimeout(() => {
      resettingSegmentsRef.current = true;
      setPastedSegments(segments);
    }, 40);
  };

  const handleSegment = useCallback(
    (segments: string, init: boolean) => {
      segmentsRef.current = segments;
      setWaveSegmentsJson((prev) => (prev === segments ? prev : segments));

      if (resettingSegmentsRef.current) {
        resettingSegmentsRef.current = false;
        return;
      }
      if (!hasPermission && !init) {
        toolChanged(verseToolId, false);
        return;
      }
      const regions = getSortedRegions(segments);
      const autoRefs =
        passageRefs.current.length > 0
          ? passageRefs.current
          : getPassageRefs(passage);
      const previousData =
        dataRef.current.length > 0
          ? dataRef.current
          : [emptyTable()[0], ...autoRefs.map((ref) => rowCells(['', ref]))];

      if (passageRefs.current.length === 0 && autoRefs.length > 0) {
        passageRefs.current = autoRefs;
      }

      setNumSegments(regions.length);

      const newData = [rowCells([t.startStop, t.reference], true)];
      const currentLength = previousData.length;
      let reset = false;

      regions.forEach((region, index) => {
        const previousRow =
          index + 1 < currentLength
            ? (previousData[index + 1] as ICell[])
            : undefined;
        const previousReference = previousRow?.[ColName.Ref] as
          | ICell
          | undefined;
        let nextReference = `${previousReference?.value ?? ''}`;

        if (!nextReference && autoRefs[index]) {
          const priorNewRow = newData[newData.length - 1] as
            | ICell[]
            | undefined;
          const priorRef = `${priorNewRow?.[ColName.Ref]?.value ?? ''}`;
          const suffixIncrement = priorRef
            ? incrementMarkVersesReferenceSuffix(priorRef)
            : undefined;
          nextReference = suffixIncrement ?? autoRefs[index];
        }
        if (region.label && init) {
          const refsSoFar = collectRefs(newData);
          if (!refsSoFar.includes(region.label)) {
            nextReference = region.label;
          }
        } else if (region.label !== nextReference) {
          region.label = nextReference;
          reset = true;
        }

        const row = rowCells([formLim(region), nextReference]);
        // `rowCells` already flags an ill-formatted reference via `status`.
        newData.push(row);
      });

      const refs = collectRefs(newData);
      previousData.slice(newData.length).forEach((existingRow) => {
        const reference = existingRow[ColName.Ref] as ICell;
        if (reference.value !== '' && !refs.includes(reference.value)) {
          newData.push(rowCells(['', `${reference.value ?? ''}`]));
        }
      });

      // Flag out-of-range / overlapping / skipped-ahead references so they show
      // on load, exactly as an edit would. (Ill-formatted refs were already
      // flagged by rowCells; this assigns the matching tooltip too.)
      annotateReferenceWarnings(newData, autoRefs);

      const change =
        numSegments !== regions.length ||
        tableSignature(previousData) !== tableSignature(newData);
      const addedSegment = !init && regions.length > prevRegionCountRef.current;
      prevRegionCountRef.current = regions.length;

      if (change) {
        const rowIndex = applyActiveRowHighlight(newData, addedSegment);
        if (tableSignature(dataRef.current) !== tableSignature(newData)) {
          setData(newData);
        }
        if (reset) resetSegments(regions);
        if (!init && !isChanged(verseToolId)) toolChanged(verseToolId);
        if (addedSegment && rowIndex > 0) {
          // If audio is currently playing, don't seek to the new row — that
          // would jump the playhead backward to the start of the new segment.
          // The user is mid-listen; let playback continue. Just scroll the row
          // into view so they can see which segment was added.
          if (playerControlsRef.current?.isPlaying()) {
            scrollActiveRowIntoView(rowIndex);
          } else {
            queueMicrotask(() => {
              void seekToRowSegment(rowIndex);
            });
          }
        } else if (rowIndex > 0) {
          scrollActiveRowIntoView(rowIndex);
        }
      }
    },
    [
      hasPermission,
      getPassageRefs,
      passage,
      emptyTable,
      rowCells,
      t,
      collectRefs,
      numSegments,
      tableSignature,
      toolChanged,
      formLim,
      applyActiveRowHighlight,
      isChanged,
      setData,
      scrollActiveRowIntoView,
      seekToRowSegment,
      annotateReferenceWarnings,
    ]
  );

  const handleSegmentRef = useRef(handleSegment);
  handleSegmentRef.current = handleSegment;

  useEffect(() => {
    if (!mediafileId) return;
    if (suppressVerseResyncFromMediaRef.current) return;
    const regions = getSortedRegions(savedVerseSegmentsJson);
    if (regions.length === 0) return;
    if (!passageRefsKey) return;
    queueMicrotask(() => {
      handleSegmentRef.current(savedVerseSegmentsJson, true);
    });
  }, [mediafileId, passageRefsKey, savedVerseSegmentsJson]);

  const setSegments = useCallback(() => {
    const regions: IRegion[] = [];
    dataRef.current.forEach((row, index) => {
      if (index === 0) return;
      const segment = getSegmentFromRow(row);
      if (!segment) return;
      regions.push({
        ...segment,
        label: row[ColName.Ref].value,
      });
    });
    resetSegments(regions);
  }, [getSegmentFromRow]);

  const flushSetSegments = useCallback(() => {
    if (setSegmentsDebounceRef.current) {
      clearTimeout(setSegmentsDebounceRef.current);
      setSegmentsDebounceRef.current = undefined;
      setSegments();
    }
  }, [setSegments]);

  const flushSetSegmentsRef = useRef(flushSetSegments);
  flushSetSegmentsRef.current = flushSetSegments;

  const persistSegments = useCallback(async () => {
    if (savingRef.current || !media) return;
    flushSetSegmentsRef.current();
    savingRef.current = true;
    let segments = updateSegments(
      NamedRegions.Transcription,
      updateSegments(
        NamedRegions.Verse,
        media.attributes?.segments,
        segmentsRef.current
      ),
      segmentsRef.current
    );
    if (!hasBtRecordings) {
      segments = updateSegments(
        NamedRegions.BackTranslation,
        segments,
        segmentsRef.current
      );
    }
    segments = updateSegments(NamedRegions.TRTask, segments, '');
    try {
      await projectSegmentSave({ media, segments });
      saveCompleted(verseToolId);
      suppressVerseResyncFromMediaRef.current = false;
      toolChanged(verseToolId, false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      saveCompleted(verseToolId, message);
    } finally {
      savingRef.current = false;
      canceling.current = false;
      setComplete(0);
    }
  }, [
    media,
    hasBtRecordings,
    projectSegmentSave,
    saveCompleted,
    toolChanged,
    setComplete,
  ]);

  const restoreUndoSnapshot = useCallback(
    (snapshot: MarkVersesSnapshot) => {
      const restoredData = cloneTableData(snapshot.tableData as ICell[][]);
      segmentsRef.current = snapshot.segmentsJson;
      suppressVerseResyncFromMediaRef.current = true;
      resettingSegmentsRef.current = true;
      setWaveSegmentsJson(snapshot.waveSegmentsJson);
      // Reload waveform regions: clear first so React sees a distinct value
      // even when snapshot.segmentsJson matches the current pastedSegments.
      setPastedSegments('');
      setTimeout(() => {
        resettingSegmentsRef.current = true;
        setPastedSegments(snapshot.segmentsJson);
      }, 40);
      setData(restoredData);
      const restoredRegion = parseCurrentSegmentRegion(snapshot.currentSegment);
      setCurrentSegment(restoredRegion, snapshot.currentSegmentIndex);
      const highlightedRowIndex = findHighlightedRowIndex(restoredData);
      if (highlightedRowIndex > 0) {
        const activeSegment = getSegmentFromRow(
          restoredData[highlightedRowIndex] as ICell[]
        );
        if (activeSegment) {
          void playerControlsRef.current?.gotoTime(
            activeSegment.start > 0
              ? activeSegment.start + SEGMENT_BOUNDARY_TOLERANCE_SEC
              : activeSegment.start,
            activeSegment
          );
        }
      }
      toolChanged(verseToolId);
    },
    [
      cloneTableData,
      setData,
      parseCurrentSegmentRegion,
      setCurrentSegment,
      findHighlightedRowIndex,
      toolChanged,
      getSegmentFromRow,
    ]
  );

  const handleUndo = () => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) return;
    setUndoAvailable(undoStackRef.current.canUndo());
    restoreUndoSnapshot(snapshot);
  };

  const handleRemoveBoundaryClick = useCallback(async () => {
    const ctrl = playerControlsRef.current;
    if (!ctrl?.isReady() || !removeBoundaryEnabled) return;

    const p = ctrl.getProgress();
    const hit = findClosestInternalJoin(
      p,
      waveformRegions,
      SEGMENT_BOUNDARY_TOLERANCE_SEC
    );
    if (!hit) return;

    const { join, leftSegment } = hit;
    const sorted = [...waveformRegions].sort((a, b) => a.start - b.start);
    const leftIdx = sorted.findIndex(
      (r) => Math.abs(r.start - leftSegment.start) < 0.001
    );
    const rightEnd =
      leftIdx >= 0 && leftIdx < sorted.length - 1
        ? sorted[leftIdx + 1].end
        : join;

    pushUndoSnapshot();

    if (p >= join - 1e-6) {
      let target = join - REMOVE_BOUNDARY_PLAYHEAD_NUDGE_SEC;
      target = Math.max(leftSegment.start + 0.001, target);
      target = Math.min(target, join - 0.001);
      await ctrl.gotoTime(target);
    }
    ctrl.removeNextSegment();
    syncProgressFromPlayer();

    if (leftIdx >= 0) {
      const mergedSegment = {
        start: leftSegment.start,
        end: rightEnd,
      };
      const tableRowIndex = leftIdx + 1;
      skipScrollIntoViewRef.current = true;
      await seekToRowSegment(tableRowIndex);
      setCurrentSegment(mergedSegment, tableRowIndex);
      skipScrollIntoViewRef.current = false;
    }
  }, [
    removeBoundaryEnabled,
    waveformRegions,
    syncProgressFromPlayer,
    pushUndoSnapshot,
    seekToRowSegment,
    setCurrentSegment,
  ]);

  const persistSegmentsRef = useRef(persistSegments);
  persistSegmentsRef.current = persistSegments;

  const scheduleAutosave = useMemo(
    () =>
      debounce(() => {
        void persistSegmentsRef.current();
      }, AUTOSAVE_DEBOUNCE_MS),
    []
  );

  useEffect(
    () => () => {
      scheduleAutosave.clear();
      if (setSegmentsDebounceRef.current) {
        clearTimeout(setSegmentsDebounceRef.current);
      }
    },
    [scheduleAutosave]
  );

  const handleEditReference = () => {
    let rowIndex = findHighlightedRowIndex(dataRef.current);
    if (rowIndex <= 0 && currentSegment.trim()) {
      rowIndex = dataRef.current.findIndex((row, index) => {
        if (index === 0) return false;
        const segment = getSegmentFromRow(row);
        return (
          segment && prettySegment(segment).trim() === currentSegment.trim()
        );
      });
    }
    if (rowIndex <= 0) return;
    const row = dataRef.current[rowIndex] as ICell[] | undefined;
    if (!row || !getSegmentFromRow(row)) return;
    const nextDialog = buildEditReferenceDialogState(rowIndex);
    if (nextDialog) setEditReferenceDialog(nextDialog);
  };

  const performResetMarkup = () => {
    pushUndoSnapshot();
    const refs =
      passageRefs.current.length > 0
        ? passageRefs.current
        : getPassageRefs(passage);
    const newData = emptyTable();

    refs.forEach((ref) => {
      newData.push(rowCells(['', ref]));
    });

    const hadChanges =
      numSegments > 0 ||
      tableSignature(dataRef.current) !== tableSignature(newData);

    passageRefs.current = refs;
    segmentsRef.current = emptySegments;
    suppressVerseResyncFromMediaRef.current = true;
    setNumSegments(0);
    prevRegionCountRef.current = 0;
    setData(newData);
    setCurrentSegment(undefined, -1);
    setEditReferenceDialog(undefined);
    setPastedSegments(emptySegments);
    setWaveSegmentsJson(emptySegments);
    setPlayerResetKey((value) => value + 1);

    if (hadChanges) {
      toolChanged(verseToolId);
    }
  };

  const handleResetMarkup = () => {
    setResetConfirmOpen(true);
  };

  const handleAddSegment = () => {
    pushUndoSnapshot();
    playerControlsRef.current?.addSegment();
  };

  useEffect(() => {
    if (saveRequested(verseToolId) && !savingRef.current) {
      scheduleAutosave.clear();
      void persistSegmentsRef.current();
    } else if (clearRequested(verseToolId)) {
      clearCompleted(verseToolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged, scheduleAutosave]);

  const validationInput = useCallback(
    () => ({
      rows: dataRef.current
        .filter((_, index) => index > 0)
        .map((row) => ({
          limits: `${(row[ColName.Limits] as ICell).value ?? ''}`,
          ref: `${(row[ColName.Ref] as ICell).value ?? ''}`,
        })),
      expandedRefs: collectRefs(dataRef.current),
      passageRefs: passageRefs.current,
      hasBtRecordings,
      strings: t,
    }),
    [collectRefs, hasBtRecordings, t]
  );

  const checkAutosaveBlockers = useCallback(
    () => getMarkVersesAutosaveBlockers(validationInput()),
    [validationInput]
  );

  useEffect(() => {
    if (!hasChanged || !hasPermission || savingRef.current) return;
    if (checkAutosaveBlockers().length > 0) return;
    scheduleAutosave();
  }, [
    toolsChanged,
    hasChanged,
    hasPermission,
    scheduleAutosave,
    checkAutosaveBlockers,
  ]);

  const resetSave = () => {
    setResetConfirmOpen(false);
  };

  const pristineTableSignature = useMemo(() => {
    const pristine = emptyTable();
    const refs =
      passageRefs.current.length > 0
        ? passageRefs.current
        : getPassageRefs(passage);
    refs.forEach((ref) => {
      pristine.push(rowCells(['', ref]));
    });
    return tableSignature(pristine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emptyTable, rowCells, passage, getPassageRefs]);

  const hasResettableState = useMemo(
    () => numSegments > 0 || tableSignature(data) !== pristineTableSignature,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [numSegments, data, pristineTableSignature]
  );

  if (!mediafileId) {
    return (
      <Paper sx={paperProps}>
        <Typography variant="h2" align="center">
          {ts.noAudio}
        </Typography>
      </Paper>
    );
  }

  if (passType === PassageTypeEnum.NOTE) {
    return (
      <Paper sx={paperProps}>
        <Typography variant="h2" align="center">
          {ts.notSupported}
        </Typography>
      </Paper>
    );
  }

  const editReferenceLabel = t.editReference || 'Edit Reference';
  const splitVerseLabel = t.splitVerse || 'Split Verse';
  const resetLabel = t.reset || 'Reset';
  const cancelLabel = ts.cancel || 'Cancel';
  const saveLabel = ts.save || 'Save';

  return (
    <Box
      id="mark-verses-mobile"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <PassageDetailPlayer
        key={`mark-verses-player-${mediafileId}-${playerResetKey}`}
        width={width}
        data-testid="player"
        allowSegment={NamedRegions.Verse}
        hideSegmentControls={true}
        onSegment={handleSegment}
        suggestedSegments={pastedSegments}
        allowZoomAndSpeed={true}
        controlsRef={playerControlsRef}
        applyRegionColor={applyRegionColor}
        onProgress={setPlayerProgressSec}
        onInteraction={syncProgressFromPlayer}
      />
      <TabActions
        sx={{
          mt: 0.5,
          py: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 0.5,
          flexWrap: 'wrap',
          flexShrink: 0,
          width: '100%',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <LightTooltip
            id="markVersesSplitTip"
            title={tp.splitSegment.replace(
              '{0}',
              localizeHotKey(ADDREMSEG_KEY)
            )}
          >
            <IconButton
              onClick={handleAddSegment}
              disabled={!hasPermission || addBoundaryTooCloseToExisting}
              size="small"
              sx={{ pl: '0px !important' }}
            >
              <AddIcon fontSize="small" />
            </IconButton>
          </LightTooltip>
          <LightTooltip
            id="markVersesRemoveBoundaryTip"
            title={tp.removeSegment.replace('{0}', localizeHotKey(DELREG_KEY))}
          >
            <IconButton
              onClick={() => void handleRemoveBoundaryClick()}
              disabled={!hasPermission || !removeBoundaryEnabled}
              size="small"
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
          </LightTooltip>
          {undoAvailable && (
            <LightTooltip id="markVersesUndoTip" title={tr.undoTip}>
              <IconButton
                aria-label={tr.undoTip}
                size="small"
                onClick={handleUndo}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </LightTooltip>
          )}
        </Box>
        <AltButton
          onClick={handleEditReference}
          disabled={!hasPermission || numSegments === 0}
          sx={{ px: 1.5, py: 0.5 }}
        >
          <EditIcon sx={{ mr: 0.5 }} fontSize="small" />
          {editReferenceLabel}
        </AltButton>
        <AltButton
          onClick={handleResetMarkup}
          disabled={!hasPermission || !hasResettableState}
          sx={{ px: 1.5, py: 0.5 }}
        >
          {resetLabel}
        </AltButton>
      </TabActions>
      <MarkVersesTableIsMobile
        data={data}
        onRowSelect={handleSelectRow}
        onReferenceEdit={handleReferenceTextEdit}
        canEdit={hasPermission}
        tableRowRefs={tableRowRefs}
      />
      {editReferenceDialog && (
        <EditReferenceDropdown
          key={`edit-reference-${editReferenceDialog.rowIndex}-${editReferenceDialog.limits}-${editReferenceDialog.startChapter}-${editReferenceDialog.startVerse}-${editReferenceDialog.endChapter}-${editReferenceDialog.endVerse}`}
          open={Boolean(editReferenceDialog)}
          limits={editReferenceDialog.limits}
          endVerseOptions={editReferenceDialog.endVerseOptions}
          editStart={editReferenceDialog.editStart}
          title={`${editReferenceLabel} for`}
          cancelLabel={cancelLabel}
          saveLabel={saveLabel}
          splitVerseLabel={splitVerseLabel}
          value={editReferenceDialog}
          onCancel={handleCloseSplitVerseDialog}
          onSave={handleSaveSplitVerseDialog}
        />
      )}
      {resetConfirmOpen && (
        <Confirm
          text={`${resetLabel}?`}
          yesResponse={() => {
            performResetMarkup();
            resetSave();
          }}
          noResponse={resetSave}
        />
      )}
    </Box>
  );
}
