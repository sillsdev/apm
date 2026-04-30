import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, IconButton, Paper, SxProps, Typography } from '@mui/material';
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
import { useSnackBar } from '../../../../hoc/SnackBar';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import UndoIcon from '@mui/icons-material/Undo';
import {
  ISharedStrings,
  ITranscriptionTabStrings,
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
  transcriptionTabSelector,
  verseSelector,
  wsAudioPlayerSelector,
} from '../../../../selector';
import { cleanClipboard } from '../../../../utils/cleanClipboard';
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
import PassageDetailPlayer from '../../PassageDetailPlayer';
import { useProjectSegmentSave } from '../../Internalization/useProjectSegmentSave';
import EditReferenceDropdown, {
  EditReferenceValue,
} from './EditReferenceDropdown';
import MarkVersesTableIsMobile from './MarkVersesTableIsMobile';
import { AltButton } from '../../../../control/AltButton';
import { GrowingSpacer } from '../../../../control/GrowingSpacer';
import { LightTooltip } from '../../../../control/LightTooltip';
import { PriButton } from '../../../../control/PriButton';
import { TabActions } from '../../../../control/TabActions';
import { HotKeyContext } from '../../../../context/HotKeyContext';
import {
  ADDREMSEG_KEY,
  DELREG_KEY,
} from '../../../../components/WSAudioPlayerSegment';
import { useMobile } from '../../../../utils/useMobile';

const verseToolId = 'VerseTool';
const emptySegments = JSON.stringify({ regions: [] });
/** Distance (seconds) used for Add (must be away from boundaries) and Remove (must be at a join). */
const SEGMENT_BOUNDARY_TOLERANCE_SEC = 0.1;
/**
 * Before remove-next-boundary, if the playhead is on the right-hand segment, seek back by this amount
 * (tolerance + tolerance) so `currentRegion` is the left segment and the correct join is removed.
 */
const REMOVE_BOUNDARY_PLAYHEAD_NUDGE_SEC =
  SEGMENT_BOUNDARY_TOLERANCE_SEC + SEGMENT_BOUNDARY_TOLERANCE_SEC;
const paperProps = { p: 2, m: 'auto', width: 'calc(100% - 32px)' } as SxProps;
const readOnlys = [true, false];
const widths = [150, 150];
const cClass = ['lim', 'ref'];

function isProgressNearAnyRegionBoundary(
  progressSec: number,
  regions: IRegion[],
  minDistanceSec: number
): boolean {
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
}

export interface ICellChange {
  cell: any;
  row: number;
  col: number;
  value: string | null;
}

enum ColName {
  Limits,
  Ref,
}

interface IParsedReference {
  chapter: number;
  verse: number;
  suffix: string;
}

interface IEditReferenceDialogState extends EditReferenceValue {
  rowIndex: number;
  limits: string;
  existingSplit: boolean;
  maxVerse: number;
  verseOptions: number[];
}

interface IUndoState {
  tableData: ICell[][];
}

export interface MarkVersesProps {
  width: number;
}

export default function PassageDetailMarkVersesIsMobile({
  width,
}: MarkVersesProps) {
  const {
    mediafileId,
    section,
    passage,
    currentstep,
    currentSegment,
    setCurrentSegment,
    setStepComplete,
    gotoNextStep,
    rowData,
  } = usePassageDetailContext();
  const [memory] = useGlobal('memory');
  const { isMobile } = useMobile();
  const [, setComplete] = useGlobal('progress');
  const [plan] = useGlobal('plan');
  const [data, setDatax] = useState<ICell[][]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [confirm, setConfirm] = useState('');
  const [numSegments, setNumSegments] = useState(0);
  // Keep this empty by default so `PassageDetailPlayer` loads the *saved* segments
  // from `media.attributes.segments` (it prefers `suggestedSegments` when non-empty).
  const [pastedSegments, setPastedSegments] = useState('');
  const [engVrs, setEngVrs] = useState<Map<string, number[]>>(new Map());
  const [isReferenceEditing, setIsReferenceEditing] = useState(false);
  const [editReferenceDialog, setEditReferenceDialog] =
    useState<IEditReferenceDialogState>();
  const [undoState, setUndoState] = useState<IUndoState>();
  const [playerResetKey, setPlayerResetKey] = useState(0);
  const [playerProgressSec, setPlayerProgressSec] = useState(0);
  /** Precise segment JSON from the waveform (table limits round to whole seconds). */
  const [waveSegmentsJson, setWaveSegmentsJson] = useState('{}');
  const playerControlsRef = useRef<WSAudioPlayerControls | null>(null);
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
  const tt = useSelector(
    transcriptionTabSelector,
    shallowEqual
  ) as ITranscriptionTabStrings;
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
    startSave,
    saveCompleted,
    clearRequested,
    clearCompleted,
    checkSavedFn,
    waitForSave,
  } = useContext(UnsavedContext).state;
  const hasChanged = useMemo(() => isChanged(verseToolId), [isChanged]);
  const projectSegmentSave = useProjectSegmentSave();
  const { showMessage } = useSnackBar();
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
      row.map(
        (value, index) =>
          ({
            value,
            width: widths[index],
            readOnly: first || readOnlys[index],
            className: first
              ? 'cTitle'
              : cClass[index] +
                (index === ColName.Ref && value && !refMatch(value)
                  ? ' Err'
                  : ''),
          }) as ICell
      ),
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

  const tableSignature = (tableData: ICell[][]) =>
    JSON.stringify(
      tableData.map((row) =>
        row.map((cell) => ({
          value: cell.value ?? '',
          className: cell.className ?? '',
          readOnly: cell.readOnly ?? false,
        }))
      )
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

  const handleComplete = (complete: boolean) => {
    waitForSave(undefined, 200).finally(async () => {
      await setStepComplete(currentstep, complete);
      if (complete) gotoNextStep();
    });
  };

  const writeResources = async () => {
    if (!savingRef.current && media) {
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
      projectSegmentSave({ media, segments })
        .then(() => {
          saveCompleted(verseToolId);
          suppressVerseResyncFromMediaRef.current = false;
        })
        .catch((err) => {
          saveCompleted(verseToolId, err.message);
        })
        .finally(() => {
          savingRef.current = false;
          canceling.current = false;
          setComplete(0);
          handleComplete(true);
        });
    }
  };

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

  const formatTime = (value: number) => {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value - minutes * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const parseFormattedTime = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    if (trimmed.includes(':')) {
      const [minPart, secPart] = trimmed.split(':');
      const minutes = parseInt(minPart, 10);
      const seconds = parseFloat(secPart);
      if (Number.isNaN(minutes) || Number.isNaN(seconds)) return NaN;
      return minutes * 60 + seconds;
    }
    return parseFloat(trimmed);
  };

  const formLim = useCallback(
    ({ start, end }: IRegion) => `${formatTime(start)}-${formatTime(end)}`,
    []
  );

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

    if (p >= join - 1e-6) {
      let target = join - REMOVE_BOUNDARY_PLAYHEAD_NUDGE_SEC;
      target = Math.max(leftSegment.start + 0.001, target);
      target = Math.min(target, join - 0.001);
      await ctrl.gotoTime(target);
    }
    ctrl.removeNextSegment();
    syncProgressFromPlayer();
  }, [removeBoundaryEnabled, waveformRegions, syncProgressFromPlayer]);

  useEffect(() => {
    const ctrl = playerControlsRef.current;
    if (ctrl?.isReady()) {
      setPlayerProgressSec(ctrl.getProgress());
    }
  }, [waveSegmentsJson, playerResetKey]);

  const cloneTableData = useCallback(
    (tableData: ICell[][]) =>
      tableData.map((row) =>
        row.map((cell) => ({
          ...cell,
        }))
      ),
    []
  );

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

  const buildReferenceCell = useCallback((value: string, cell: ICell) => {
    return {
      ...cell,
      value,
      className: `ref${value && !refMatch(value) ? ' Err' : ''}`,
    };
  }, []);

  const parseReferencePart = useCallback(
    (value: string, fallbackChapter: number) => {
      const match = /^(?:(\d+):)?(\d+)([a-e]?)$/i.exec(value.trim());
      if (!match) return undefined;
      return {
        chapter: match[1] ? parseInt(match[1], 10) : fallbackChapter,
        verse: parseInt(match[2], 10),
        suffix: (match[3] ?? '').toLowerCase(),
      } as IParsedReference;
    },
    []
  );

  const parseReferenceValue = useCallback(
    (value: string) => {
      const normalized = value.replace(/[–—]/g, '-').replace(/\s+/g, '').trim();
      if (!normalized) return undefined;

      const [startText, endText] = normalized.split('-', 2);
      const start = parseReferencePart(startText, 0);
      if (!start) return undefined;
      const end = endText ? parseReferencePart(endText, start.chapter) : start;
      if (!end) return undefined;
      return { start, end };
    },
    [parseReferencePart]
  );

  const formatReferenceValue = useCallback(
    ({
      startChapter,
      startVerse,
      startSuffix,
      endChapter,
      endVerse,
      endSuffix,
      splitVerse,
    }: EditReferenceValue) => {
      const startLabel = `${startChapter}:${startVerse}${startSuffix}`;
      const sameVerse = startChapter === endChapter && startVerse === endVerse;

      if (!splitVerse || sameVerse) {
        if (endSuffix && endSuffix !== startSuffix) {
          return `${startLabel}-${endVerse}${endSuffix}`;
        }
        return startLabel;
      }

      if (startChapter === endChapter) {
        return `${startLabel}-${endVerse}${endSuffix}`;
      }

      return `${startLabel}-${endChapter}:${endVerse}${endSuffix}`;
    },
    []
  );

  const getHighestVerseInput = useCallback(
    (tableData: ICell[][]) => {
      const highestVerse = tableData.reduce((maxVerse, row, index) => {
        if (index === 0) return maxVerse;
        const parsedReference = parseReferenceValue(
          `${row[ColName.Ref]?.value ?? ''}`
        );
        if (!parsedReference) return maxVerse;
        return Math.max(
          maxVerse,
          parsedReference.start.verse,
          parsedReference.end.verse
        );
      }, 0);

      return highestVerse > 0 ? highestVerse : 1;
    },
    [parseReferenceValue]
  );

  const getVerseOptionsFromInputs = useCallback(
    (tableData: ICell[][]) => {
      const verseNumbers = tableData.reduce<number[]>(
        (allVerses, row, index) => {
          if (index === 0) return allVerses;
          const parsedReference = parseReferenceValue(
            `${row[ColName.Ref]?.value ?? ''}`
          );
          if (!parsedReference) return allVerses;
          allVerses.push(
            parsedReference.start.verse,
            parsedReference.end.verse
          );
          return allVerses;
        },
        []
      );

      const uniqueSortedVerses = Array.from(new Set(verseNumbers)).sort(
        (left, right) => left - right
      );

      return uniqueSortedVerses.length > 0 ? uniqueSortedVerses : [1];
    },
    [parseReferenceValue]
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
      const existingSplit =
        currentRef.start.chapter !== currentRef.end.chapter ||
        currentRef.start.verse !== currentRef.end.verse;
      const canSplit =
        existingSplit ||
        Boolean(nextRef) ||
        Boolean(`${nextRow?.[ColName.Ref]?.value ?? ''}`.trim()) ||
        Boolean(`${nextRow?.[ColName.Limits]?.value ?? ''}`.trim());

      return {
        rowIndex,
        limits: `${row[ColName.Limits]?.value ?? ''}`,
        canSplit,
        splitVerse: existingSplit,
        existingSplit,
        maxVerse: Math.max(
          getHighestVerseInput(dataRef.current),
          currentRef.start.verse,
          currentRef.end.verse,
          nextRef?.start.verse ?? 0
        ),
        verseOptions: getVerseOptionsFromInputs(dataRef.current),
        startChapter: currentRef.start.chapter,
        startVerse: currentRef.start.verse,
        startSuffix: currentRef.start.suffix,
        endChapter: existingSplit
          ? currentRef.end.chapter
          : (nextRef?.start.chapter ?? currentRef.end.chapter),
        endVerse: existingSplit
          ? currentRef.end.verse
          : (nextRef?.start.verse ?? currentRef.end.verse),
        endSuffix: existingSplit
          ? currentRef.end.suffix
          : (nextRef?.start.suffix ?? currentRef.end.suffix),
      } as IEditReferenceDialogState;
    },
    [getHighestVerseInput, getVerseOptionsFromInputs, parseReferenceValue]
  );

  const handleSelectRow = useCallback(
    (rowIndex: number) => {
      const row = dataRef.current[rowIndex] as ICell[] | undefined;
      if (!row) return;

      if (isReferenceEditing) {
        const nextDialog = buildEditReferenceDialogState(rowIndex);
        if (nextDialog) {
          setEditReferenceDialog(nextDialog);
        }
        const activeSegment = getSegmentFromRow(row);
        const newData = cloneTableData(dataRef.current);
        setActiveRowHighlight(newData, rowIndex);
        setData(newData);
        if (activeSegment) {
          setCurrentSegment(activeSegment, rowIndex - 1);
        }
        return;
      }

      const activeSegment = getSegmentFromRow(row);
      if (!activeSegment) return;

      const newData = cloneTableData(dataRef.current);
      setActiveRowHighlight(newData, rowIndex);
      setData(newData);
      setCurrentSegment(activeSegment, rowIndex - 1);
    },
    [
      buildEditReferenceDialogState,
      cloneTableData,
      getSegmentFromRow,
      isReferenceEditing,
      setCurrentSegment,
      setData,
      setActiveRowHighlight,
    ]
  );

  const handleCloseSplitVerseDialog = () => {
    setEditReferenceDialog(undefined);
  };

  const handleSaveSplitVerseDialog = (value: EditReferenceValue) => {
    if (!editReferenceDialog) return;

    const previousData = cloneTableData(dataRef.current);
    const newData = cloneTableData(dataRef.current);
    const findRowIndexForVerse = (
      chapter: number,
      verse: number,
      startAt = 1
    ) =>
      newData.findIndex((existingRow, index) => {
        if (index < startAt) return false;
        const parsedReference = parseReferenceValue(
          `${existingRow[ColName.Ref]?.value ?? ''}`
        );
        return (
          parsedReference?.start.chapter === chapter &&
          parsedReference.start.verse === verse
        );
      });

    const startRowIndex = Math.max(
      findRowIndexForVerse(value.startChapter, value.startVerse),
      1
    );
    const endRowIndex = findRowIndexForVerse(
      value.endChapter,
      value.endVerse,
      startRowIndex + 1
    );
    const hasDistinctEndRow =
      endRowIndex > startRowIndex && Boolean(newData[endRowIndex]);
    const row = newData[startRowIndex] as ICell[] | undefined;
    if (!row) return;

    if (!value.splitVerse) {
      row[ColName.Ref] = buildReferenceCell(
        `${value.startChapter}:${value.startVerse}${value.startSuffix}`,
        row[ColName.Ref] as ICell
      );

      if (
        hasDistinctEndRow &&
        !editReferenceDialog.existingSplit &&
        newData[endRowIndex]
      ) {
        const nextRow = newData[endRowIndex] as ICell[];
        nextRow[ColName.Ref] = buildReferenceCell(
          `${value.endChapter}:${value.endVerse}${value.endSuffix}`,
          nextRow[ColName.Ref] as ICell
        );
      }
    } else {
      const referenceValues = newData.map(
        (existingRow) => `${existingRow[ColName.Ref]?.value ?? ''}`
      );
      const nextReference = formatReferenceValue(value);
      row[ColName.Ref] = buildReferenceCell(
        nextReference,
        row[ColName.Ref] as ICell
      );

      if (hasDistinctEndRow) {
        const deleteRowIndex = endRowIndex;

        for (let index = deleteRowIndex; index < newData.length; index += 1) {
          const shiftedValue = referenceValues[index + 1] ?? '';
          const referenceCell = newData[index]?.[ColName.Ref] as
            | ICell
            | undefined;
          if (!referenceCell) continue;
          newData[index][ColName.Ref] = buildReferenceCell(
            shiftedValue,
            referenceCell
          );
        }
      }
    }

    setUndoState({
      tableData: previousData,
    });
    setActiveRowHighlight(newData, startRowIndex);
    setData(newData);
    setSegments();

    const activeSegment = getSegmentFromRow(newData[startRowIndex] as ICell[]);
    if (activeSegment) {
      setCurrentSegment(activeSegment, startRowIndex - 1);
    }

    toolChanged(verseToolId);
    setEditReferenceDialog(undefined);
  };

  const handleUndoSplitVerseSave = () => {
    if (!undoState) return;

    const restoredData = cloneTableData(undoState.tableData);
    const highlightedRowIndex = findHighlightedRowIndex(restoredData);
    setData(restoredData);
    setSegments();

    if (highlightedRowIndex > 0) {
      const activeSegment = getSegmentFromRow(
        restoredData[highlightedRowIndex] as ICell[]
      );
      if (activeSegment) {
        setCurrentSegment(activeSegment, highlightedRowIndex - 1);
      }
    } else {
      setCurrentSegment(undefined, -1);
    }

    toolChanged(verseToolId);
    setUndoState(undefined);
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
          nextReference = autoRefs[index];
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
        const limits = row[ColName.Limits] as ICell;
        const reference = row[ColName.Ref] as ICell;
        // Match `PassageDetailContext` / desktop: `currentSegment` is `prettySegment`, not mm:ss.
        if (prettySegment(region).trim() === currentSegment.trim()) {
          limits.className = `${limits.className ?? 'lim'} cur`;
        }
        if (!refMatch(nextReference)) {
          reference.className = nextReference ? 'ref Err' : 'ref';
        }
        newData.push(row);
      });

      const refs = collectRefs(newData);
      previousData.slice(newData.length).forEach((existingRow) => {
        const reference = existingRow[ColName.Ref] as ICell;
        if (reference.value !== '' && !refs.includes(reference.value)) {
          newData.push(rowCells(['', `${reference.value ?? ''}`]));
        }
      });

      const change =
        numSegments !== regions.length ||
        tableSignature(previousData) !== tableSignature(newData);

      if (change) {
        setData(newData);
        if (reset) resetSegments(regions);
        if (!init && !isChanged(verseToolId)) toolChanged(verseToolId);
      }
    },
    [
      hasPermission,
      getPassageRefs,
      passage,
      emptyTable,
      rowCells,
      t.startStop,
      t.reference,
      collectRefs,
      numSegments,
      toolChanged,
      formLim,
      currentSegment,
      setData,
      isChanged,
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

  const setSegments = () => {
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
  };

  const handleCellsChanged = (changes: Array<ICellChange>) => {
    const newData = cloneTableData(dataRef.current);

    let changed = false;
    let activeRowIndex = -1;

    changes.forEach((change) => {
      const value = change.value?.trim() ?? '';
      const row = newData[change.row];
      if (!row) return;

      const cell = row[change.col] as ICell | undefined;
      if (!cell) return;

      if (value !== cell.value) {
        changed = true;
        activeRowIndex = change.row;

        if (change.col === ColName.Ref) {
          row[change.col] = {
            ...cell,
            value,
            className: `ref${value && !refMatch(value) ? ' Err' : ''}`,
          };
        } else {
          row[change.col] = {
            ...cell,
            value,
          };
        }
      }
    });

    if (changed) {
      setUndoState(undefined);
      setActiveRowHighlight(newData, activeRowIndex);
      const activeRow =
        activeRowIndex > 0 ? (newData[activeRowIndex] as ICell[]) : undefined;
      const activeSegment = getSegmentFromRow(activeRow);

      setData(newData);
      setSegments();
      if (activeSegment) {
        setCurrentSegment(activeSegment, activeRowIndex - 1);
      }
      toolChanged(verseToolId);
    }
  };

  const handleParsePaste = (clipboard: string) => {
    const rawData = cleanClipboard(clipboard);
    if (rawData.length === 0) {
      showMessage(tt.noData.replace('{0}', t.clipboard));
      return [];
    }
    const rawWidth = (rawData[0] as string[]).length;
    if (![1, 2].includes(rawWidth)) {
      showMessage(t.pasteFormat);
      return [];
    }

    if (rawWidth === 1) {
      toolChanged(verseToolId);
      return rawData;
    }

    showMessage('TODO: multi-column paste not implemented');
    return [];
  };

  // const handleCopy = () => {
  //   const content = dataRef.current
  //     .filter((_, index) => index > 0)
  //     .map(
  //       (row) =>
  //         `${(row[ColName.Limits] as ICell).value}\t${
  //           (row[ColName.Ref] as ICell).value
  //         }`
  //     )
  //     .join('\n');

  //   if (!content.length) {
  //     showMessage(tt.noData.replace('{0}', t.markVerses));
  //     return;
  //   }

  //   navigator.clipboard
  //     .writeText(content)
  //     .then(() => {
  //       showMessage(tt.availableOnClipboard);
  //     })
  //     .catch(() => {
  //       showMessage(ts.cantCopy);
  //     });
  // };

  const handleToggleReferenceEditing = () => {
    setIsReferenceEditing((value) => !value);
  };

  useEffect(() => {
    if (!isReferenceEditing) {
      setEditReferenceDialog(undefined);
    }
  }, [isReferenceEditing]);

  const handleResetMarkup = () => {
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
    setData(newData);
    setCurrentSegment(undefined, -1);
    setIsReferenceEditing(false);
    setEditReferenceDialog(undefined);
    setUndoState(undefined);
    setConfirm('');
    setIssues([]);
    // Non-empty so `usePlayerLogic` uses this instead of reloading Verse segments from the media record.
    setPastedSegments(emptySegments);
    setPlayerResetKey((value) => value + 1);

    if (hadChanges) {
      toolChanged(verseToolId);
    }
  };

  useEffect(() => {
    if (saveRequested(verseToolId) && !savingRef.current) {
      writeResources();
    } else if (clearRequested(verseToolId)) {
      clearCompleted(verseToolId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  const checkRefs = () => {
    const refs = collectRefs(dataRef.current);
    const noSegRefs = dataRef.current
      .filter((_, index) => index > 0)
      .filter(
        (row) =>
          (row[ColName.Ref] as ICell).value &&
          !(row[ColName.Limits] as ICell).value
      )
      .map((row) => (row[ColName.Ref] as ICell).value);
    const noRefSegs = dataRef.current
      .filter((_, index) => index > 0)
      .some(
        (row) =>
          !(row[ColName.Ref] as ICell).value &&
          (row[ColName.Limits] as ICell).value
      );
    const matchAll = refs.every((ref) => refMatch(ref));
    const refSet = new Set(passageRefs.current);
    const outsideRefs = new Set<string>();

    refs.forEach((ref) => {
      if (refSet.has(ref)) {
        refSet.delete(ref);
      } else if (refMatch(ref)) {
        outsideRefs.add(ref);
      }
    });

    const nextIssues: string[] = [];
    if (!matchAll) nextIssues.push(t.badReferences);
    if (noSegRefs.length > 0) {
      nextIssues.push(t.noSegments.replace('{0}', noSegRefs.join(', ')));
    }
    if (refSet.size > 0) {
      nextIssues.push(
        t.missingReferences.replace('{0}', Array.from(refSet).sort().join(', '))
      );
    }
    if (outsideRefs.size > 0) {
      nextIssues.push(
        t.outsideReferences.replace('{0}', Array.from(outsideRefs).join(', '))
      );
    }
    if (noRefSegs) nextIssues.push(t.noReferences);
    if (hasBtRecordings) nextIssues.push(t.btNotUpdated);
    return nextIssues;
  };

  const handleCancel = () => {
    if (savingRef.current) {
      showMessage(t.canceling);
      canceling.current = true;
      return;
    }
    checkSavedFn(() => {
      toolChanged(verseToolId, false);
      if (hasPermission) handleComplete(true);
    });
  };

  const resetSave = () => {
    setConfirm('');
    setIssues([]);
  };

  const handleNoIssueSave = () => {
    if (!hasPermission) return handleCancel();
    if (!saveRequested(verseToolId)) {
      startSave(verseToolId);
    }
    resetSave();
  };

  const handleSaveMarkup = () => {
    const nextIssues = checkRefs();
    if (nextIssues.length > 0) {
      setIssues(nextIssues);
      setConfirm(t.issues);
    } else {
      handleNoIssueSave();
    }
  };

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
  const doneEditingReferenceLabel = t.doneEditingReference || 'Done Editing';
  const splitVerseLabel = t.splitVerse || 'Split Verse';
  const resetLabel = t.reset || 'Reset';
  const saveLabel = ts.save || 'Save';
  const cancelLabel = ts.cancel || 'Cancel';

  return (
    <Box
      id="mark-verses-mobile"
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <PassageDetailPlayer
        key={`mark-verses-player-${mediafileId}-${playerResetKey}`}
        width={width}
        data-testid="player"
        allowSegment={NamedRegions.Verse}
        onSegment={handleSegment}
        suggestedSegments={pastedSegments}
        allowZoomAndSpeed={true}
        controlsRef={playerControlsRef}
        onProgress={setPlayerProgressSec}
        onInteraction={syncProgressFromPlayer}
      />
      <TabActions
        sx={{
          mt: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
          width: !isMobile ? 'calc(100% + 32px)' : '100%', // lines up with the end of the wave
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LightTooltip
            id="markVersesSplitTip"
            title={tp.splitSegment.replace(
              '{0}',
              localizeHotKey(ADDREMSEG_KEY)
            )}
          >
            <IconButton
              onClick={() => playerControlsRef.current?.addSegment()}
              disabled={!hasPermission || addBoundaryTooCloseToExisting}
              sx={{ pr: 2.5, pl: '0px !important' }}
            >
              <AddIcon />
            </IconButton>
          </LightTooltip>
          <LightTooltip
            id="markVersesRemoveBoundaryTip"
            title={tp.removeSegment.replace('{0}', localizeHotKey(DELREG_KEY))}
          >
            <IconButton
              onClick={() => void handleRemoveBoundaryClick()}
              disabled={!hasPermission || !removeBoundaryEnabled}
              sx={{ px: 1 }}
            >
              <RemoveIcon />
            </IconButton>
          </LightTooltip>
        </Box>
        <AltButton
          onClick={handleResetMarkup}
          disabled={!hasPermission}
          sx={{ px: 2.5, py: 0.75 }}
        >
          {resetLabel}
        </AltButton>
      </TabActions>
      <TabActions
        sx={{
          mt: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <GrowingSpacer />
        <AltButton
          onClick={handleToggleReferenceEditing}
          disabled={!hasPermission}
        >
          {!isReferenceEditing && <EditIcon sx={{ mr: 1 }} fontSize="small" />}
          {isReferenceEditing ? doneEditingReferenceLabel : editReferenceLabel}
        </AltButton>
        <GrowingSpacer />
        {undoState && (
          <LightTooltip id="markVersesUndoTip" title={tr.undoTip}>
            <IconButton
              aria-label={tr.undoTip}
              onClick={handleUndoSplitVerseSave}
            >
              <UndoIcon />
            </IconButton>
          </LightTooltip>
        )}
        {hasChanged && (
          <PriButton onClick={handleSaveMarkup} disabled={!hasPermission}>
            {saveLabel}
          </PriButton>
        )}
      </TabActions>
      <MarkVersesTableIsMobile
        data={
          hasPermission
            ? data.map((row, rowIndex) =>
                row.map((cell, colIndex) => ({
                  ...cell,
                  readOnly:
                    rowIndex === 0 ||
                    colIndex === ColName.Limits ||
                    (colIndex === ColName.Ref && !isReferenceEditing),
                }))
              )
            : data.map((row) =>
                row.map((cell) => ({
                  ...cell,
                  readOnly: true,
                }))
              )
        }
        onCellsChanged={handleCellsChanged}
        onParsePaste={handleParsePaste}
        onRowSelect={handleSelectRow}
      />
      {editReferenceDialog && (
        <EditReferenceDropdown
          open={Boolean(editReferenceDialog)}
          limits={editReferenceDialog.limits}
          maxVerse={editReferenceDialog.maxVerse}
          verseOptions={editReferenceDialog.verseOptions}
          title={`${editReferenceLabel} for`}
          cancelLabel={cancelLabel}
          saveLabel={saveLabel}
          splitVerseLabel={splitVerseLabel}
          value={editReferenceDialog}
          onCancel={handleCloseSplitVerseDialog}
          onSave={handleSaveSplitVerseDialog}
        />
      )}
      {confirm && (
        <Confirm
          jsx={
            <ul>
              {issues.map((issue, index) => (
                <li key={`issue-${index}`}>{issue}</li>
              ))}
            </ul>
          }
          text={confirm}
          noResponse={resetSave}
          yesResponse={handleNoIssueSave}
        />
      )}
    </Box>
  );
}
