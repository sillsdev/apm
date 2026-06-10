import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useGlobal } from '../../context/useGlobal';
import {
  ISharedStrings,
  ITranscriptionTabStrings,
  IVerseStrings,
  MediaFileD,
  Passage,
} from '../../model';
import {
  Box,
  Button,
  Paper,
  PaperProps,
  SxProps,
  Typography,
  debounce,
  styled,
} from '@mui/material';
import DataSheet from 'react-datasheet';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import {
  sharedSelector,
  transcriptionTabSelector,
  verseSelector,
} from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { findRecord } from '../../crud/tryFindRecord';
import { parseRef } from '../../crud/passage';
import { ActionRow } from '../../control/ActionRow';
import { AltButton } from '../../control/AltButton';
import { GrowingSpacer } from '../../control/GrowingSpacer';
import PassageDetailPlayer from './PassageDetailPlayer';
import {
  NamedRegions,
  updateSegments,
  getSortedRegions,
} from '../../utils/namedSegments';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import Confirm from '../AlertDialog';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useProjectSegmentSave } from './Internalization/useProjectSegmentSave';
import { IRegion } from '../../crud/useWavesurferRegions';
import { cleanClipboard } from '../../utils/cleanClipboard';
import { refMatch } from '../../utils/refMatch';
import { useArtifactType } from '../../crud/useArtifactType';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { PassageTypeEnum } from '../../model/passageType';
import { usePlanType } from '../../crud/usePlanType';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { useStepPermissions } from '../../utils/useStepPermission';
import { type WSAudioPlayerControls } from '../WSAudioPlayer';
import {
  MARK_VERSES_COMPLETED_RGBA,
  MARK_VERSES_CURRENT_RGBA,
  isMarkVersesTableRowCompleted,
  isMarkVersesTableTailIncomplete,
} from '../../utils/markVersesSegmentColors';
import {
  getMarkVersesAutosaveBlockers,
  getMarkVersesValidationIssues,
} from '../../utils/markVersesValidation';
import { verseToolId } from './markVersesTool';

const NotTable = 490;
/** Nudge past a join when seeking so the playhead lands in the right-hand segment. */
const SEGMENT_BOUNDARY_TOLERANCE_SEC = 0.1;
/** Table limits use one decimal; waveform uses float seconds — allow rounding drift. */
const SEGMENT_ROW_MATCH_TOLERANCE_SEC = 0.6;
const AUTOSAVE_DEBOUNCE_MS = 1200;

const paperProps = { p: 2, m: 'auto', width: `calc(100% - 32px)` } as SxProps;

type IVrs = [string, number[]];

const StyledPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  marginBottom: theme.spacing(1),
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  overflow: 'auto',
}));

const StyledTable = styled('div')(({ theme }) => ({
  padding: theme.spacing(2),
  '& .data-grid .cell': {
    height: '48px',
  },
  '& .cTitle': {
    fontWeight: 'bold',
  },
  '& .lim': {
    verticalAlign: 'inherit !important',
    '& .value-viewer': { textAlign: 'center' },
  },
  '& .ref': {
    verticalAlign: 'inherit !important',
    '& .value-viewer': { textAlign: 'center' },
  },
  '& .lim.done, & .ref.done': {
    verticalAlign: 'inherit !important',
    '& .value-viewer': {
      textAlign: 'center',
      backgroundColor: MARK_VERSES_COMPLETED_RGBA,
    },
  },
  '& .lim.cur, & .ref.cur': {
    verticalAlign: 'inherit !important',
    '& .value-viewer': {
      textAlign: 'center',
      backgroundColor: MARK_VERSES_CURRENT_RGBA,
    },
  },
  '& .data-grid .Err': { backgroundColor: 'orange' },
}));

interface ICell {
  value: any;
  readOnly?: boolean;
  width?: number;
  className?: string;
}

interface ICellChange {
  cell: any;
  row: number;
  col: number;
  value: string | null;
}

export interface MarkVersesProps {
  width: number;
}

export function PassageDetailMarkVerses({ width }: MarkVersesProps) {
  const {
    mediafileId,
    section,
    passage,
    currentstep,
    currentSegment,
    currentSegmentIndex,
    setCurrentSegment,
    setStepComplete,
    gotoNextStep,
    rowData,
  } = usePassageDetailContext();
  const [memory] = useGlobal('memory');
  const [, setComplete] = useGlobal('progress');
  const [data, setDatax] = useState<ICell[][]>([]);
  const [saveIssues, setSaveIssues] = useState<string[]>([]);
  const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);
  const [numSegments, setNumSegments] = useState(0);
  const [pastedSegments, setPastedSegments] = useState('');
  const [heightStyle, setHeightStyle] = useState({
    maxHeight: `${window.innerHeight - NotTable}px`,
  });
  const [engVrs, setEngVrs] = useState<Map<string, number[]>>(new Map());
  const savingRef = useRef(false);
  const canceling = useRef(false);
  const dataRef = useRef<ICell[][]>([]);
  const segmentsRef = useRef('{}');
  const passageRefs = useRef<string[]>([]);
  const resettingSegmentsRef = useRef(false);
  const playerControlsRef = useRef<WSAudioPlayerControls | null>(null);
  const markVersesTailOpenRef = useRef(false);
  const lastIssuesNotifyRef = useRef('');
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission = canDoSectionStep(currentstep, section);
  const { localizedArtifactType } = useArtifactType();
  const t = useSelector(verseSelector, shallowEqual) as IVerseStrings;
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tt: ITranscriptionTabStrings = useSelector(
    transcriptionTabSelector,
    shallowEqual
  );
  const {
    toolChanged,
    toolsChanged,
    isChanged,
    saveRequested,
    saveCompleted,
    clearRequested,
    clearCompleted,
    checkSavedFn,
    waitForSave,
  } = useContext(UnsavedContext).state;
  const projectSegmentSave = useProjectSegmentSave();
  const { showMessage } = useSnackBar();
  const [plan] = useGlobal('plan'); //will be constant here
  const planType = usePlanType();

  const isFlat = useMemo(() => {
    return planType(plan)?.flat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const passType = useMemo(
    () => passageTypeFromRef(passage?.attributes?.reference, isFlat),
    [passage, isFlat]
  );

  const widths = [200, 150];
  const cClass = ['lim', 'ref'];

  enum ColName {
    Limits,
    Ref,
  }
  const setDimensions = () => {
    setHeightStyle({
      maxHeight: `${window.innerHeight - NotTable}px`,
    });
  };

  useEffect(() => {
    setDimensions();
    const handleResize = debounce(() => {
      setDimensions();
    }, 100);
    window.addEventListener('resize', handleResize);

    import('../../assets/eng-vrs').then((module) => {
      setEngVrs(new Map<string, number[]>(module.default as IVrs[]));
    });

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    markVersesTailOpenRef.current = isMarkVersesTableTailIncomplete(
      data,
      ColName.Limits
    );
    playerControlsRef.current?.applyMarkVersesRegionColors?.();
  }, [ColName.Limits, data, pastedSegments]);

  const rowCells = (row: string[], first = false) =>
    row.map(
      (v, i) =>
        ({
          value: v,
          width: widths[i],
          readOnly:
            first ||
            i === ColName.Limits ||
            (i === ColName.Ref && !`${row[ColName.Limits] ?? ''}`.trim()),
          className: first
            ? 'cTitle'
            : cClass[i] +
              (i === ColName.Ref && v && !refMatch(v) ? ' Err' : ''),
        }) as ICell
    );

  const emptyTable = () => [rowCells([t.startStop, t.reference], true)];

  const setData = (newData: ICell[][]) => {
    setDatax(newData);
    dataRef.current = newData;
  };

  const media = useMemo(
    () => findRecord(memory, 'mediafile', mediafileId) as MediaFileD,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediafileId]
  );

  const hasBtRecordings = useMemo(() => {
    const btType = localizedArtifactType(
      ArtifactTypeSlug.PhraseBackTranslation
    );
    return rowData.some((r) => r.artifactType === btType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowData]);

  const setupData = (items: string[]) => {
    passageRefs.current = items;
    const newData = emptyTable();
    items.forEach((v) => {
      newData.push(rowCells(['', v]));
    });
    setData(newData);
    if (segmentsRef.current) handleSegment(segmentsRef.current, true);
  };

  const getRefs = useCallback(
    (value: string, book: string) => {
      const refs: string[] = [];
      const psg = { attributes: { reference: value } } as Passage;
      parseRef(psg);
      const { startChapter, startVerse, endChapter, endVerse } = psg.attributes;
      const match = refMatch(psg.attributes.reference);
      let firstVerse = startVerse ?? 1;
      if (match && `${firstVerse}` !== match[2]) {
        firstVerse += 1;
        refs.push(`${startChapter}:${match[2]}`);
      }
      if (startChapter === endChapter) {
        for (let i = firstVerse; i < (endVerse ?? firstVerse ?? 1); i++) {
          refs.push(`${startChapter}:${i}`);
        }
        if (match) refs.push(`${endChapter}:${match[3] || match[2]}`);
      } else {
        const endChap1 = (engVrs.get(book) ?? [])[
          (startChapter ?? 1) - 1
        ] as number;
        for (let i = firstVerse; i <= endChap1; i++) {
          refs.push(`${startChapter}:${i}`);
        }
        for (let i = 1; i < (endVerse ?? 1); i++) {
          refs.push(`${endChapter}:${i}`);
        }
        if (match) refs.push(`${endChapter}:${match[4]}`);
      }
      return refs;
    },
    [engVrs]
  );

  useEffect(() => {
    if (passage?.attributes?.reference) {
      const refs = getRefs(
        passage.attributes.reference,
        passage.attributes.book
      );
      setupData(refs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage, engVrs]);

  const setStepCompleteRef = useRef(setStepComplete);
  setStepCompleteRef.current = setStepComplete;
  const gotoNextStepRef = useRef(gotoNextStep);
  gotoNextStepRef.current = gotoNextStep;
  const currentstepRef = useRef(currentstep);
  currentstepRef.current = currentstep;

  const handleComplete = (complete: boolean) => {
    waitForSave(undefined, 200).finally(async () => {
      await setStepCompleteRef.current(currentstepRef.current, complete);
      if (complete) gotoNextStepRef.current();
    });
  };

  const syncSegmentsRefFromTable = () => {
    const regions: IRegion[] = [];
    dataRef.current.forEach((r, i) => {
      if (i > 0) {
        const limits = `${r[ColName.Limits]?.value ?? ''}`.split('-');
        if (limits.length === 2) {
          regions.push({
            start: parseFloat(limits[0]),
            end: parseFloat(limits[1]),
            label: `${r[ColName.Ref]?.value ?? ''}`,
          });
        }
      }
    });
    segmentsRef.current = JSON.stringify({ regions });
  };

  const writeResources = async () => {
    if (!savingRef.current) {
      savingRef.current = true;
      syncSegmentsRefFromTable();
      if (!media) {
        savingRef.current = false;
        saveCompleted(verseToolId);
        return;
      }
      // update all three segment types: verse, transcription, backtranslation
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
      // remove TRTask segments that handle AI transcription
      segments = updateSegments(NamedRegions.TRTask, segments, '');
      projectSegmentSave({ media, segments })
        .then(() => {
          saveCompleted(verseToolId);
        })
        .catch((err) => {
          saveCompleted(verseToolId, err.message);
        })
        .finally(() => {
          savingRef.current = false;
          canceling.current = false;
          setComplete(0);
        });
    }
  };

  const collectRefs = (data: ICell[][]) => {
    const refs: string[] = [];
    data
      .filter((v, i) => i > 0)
      .forEach((v) => {
        const value = (v[ColName.Ref] as ICell).value;
        if (refMatch(value))
          refs.push(...getRefs(value, passage.attributes.book));
      });
    return refs;
  };

  const d1 = (d: number) => d.toFixed(1);

  const formLim = ({ start, end }: IRegion) => `${d1(start)}-${d1(end)}`;

  const getSegmentFromRow = (row?: ICell[]) => {
    if (!row) return undefined;
    const limits = `${row[ColName.Limits]?.value ?? ''}`.split('-');
    if (limits.length !== 2) return undefined;
    const start = parseFloat(limits[0]);
    const end = parseFloat(limits[1]);
    if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
    return { start, end } as IRegion;
  };

  const parseCurrentSegmentRegion = (value: string) => {
    const match = value.trim().match(/^([\d.]+)-([\d.]+)$/);
    if (!match) return undefined;
    const start = parseFloat(match[1]);
    const end = parseFloat(match[2]);
    if (Number.isNaN(start) || Number.isNaN(end)) return undefined;
    return { start, end } as IRegion;
  };

  const findCurrentTableRowIndex = (tableData: ICell[][]) => {
    const existingHighlight = tableData.findIndex(
      (row, index) =>
        index > 0 &&
        ((row[ColName.Limits] as ICell).className ?? '').includes('cur')
    );

    const target = parseCurrentSegmentRegion(currentSegment);

    if (target) {
      for (let i = 1; i < tableData.length; i++) {
        const seg = getSegmentFromRow(tableData[i]);
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
        const seg = getSegmentFromRow(tableData[i]);
        if (!seg) continue;
        if (
          Math.abs(seg.start - target.start) <= SEGMENT_ROW_MATCH_TOLERANCE_SEC
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
      getSegmentFromRow(tableData[currentSegmentIndex])
    ) {
      if (!target) return currentSegmentIndex;
      const rowSeg = getSegmentFromRow(
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

    return existingHighlight > 0 ? existingHighlight : -1;
  };

  const applyRowHighlight = (tableData: ICell[][], activeRow: number) => {
    tableData.forEach((row, index) => {
      if (index === 0) return;
      const limits = row[ColName.Limits] as ICell;
      const ref = row[ColName.Ref] as ICell;
      const baseLim = 'lim';
      const baseRef = (ref.className ?? 'ref')
        .replace(/\s*(cur|done)\b/g, '')
        .trim();
      const rowDone = isMarkVersesTableRowCompleted(
        tableData,
        index,
        ColName.Limits
      );
      const isCurrent = index === activeRow;
      limits.className = isCurrent
        ? `${baseLim} cur`
        : rowDone
          ? `${baseLim} done`
          : baseLim;
      ref.className = isCurrent
        ? `${baseRef} cur`
        : rowDone
          ? `${baseRef} done`
          : baseRef;
    });
  };

  const applyCurrentRowHighlight = (tableData: ICell[][]) => {
    applyRowHighlight(tableData, findCurrentTableRowIndex(tableData));
  };

  const resetSegments = (regions: IRegion[]) => {
    const segments = JSON.stringify({ regions });
    // Add slight delay before setting pasted segments
    setTimeout(() => {
      resettingSegmentsRef.current = true;
      setPastedSegments(segments);
    }, 40);
  };

  const handleSegment = (segments: string, init: boolean) => {
    segmentsRef.current = segments;
    if (resettingSegmentsRef.current) {
      resettingSegmentsRef.current = false;
      return;
    }
    if (!hasPermission && !init) {
      toolChanged(verseToolId, false);
      return;
    }
    const regions = getSortedRegions(segments);
    let change = numSegments !== regions.length;
    setNumSegments(regions.length);

    if (dataRef.current.length === 0) return;

    for (let i = regions.length + 1; i < dataRef.current.length; i++) {
      ((dataRef.current[i] as ICell[])[ColName.Limits] as ICell).value = '';
    }
    const newData = new Array<ICell[]>();
    newData.push(dataRef.current[0] as ICell[]); // copy title row

    const dLen = dataRef.current.length;
    let reset = false;
    regions.forEach((r, i) => {
      if (i + 1 >= dLen) {
        r.label = '';
        newData.push(rowCells([formLim(r), '']));
        change = true;
      } else {
        const row = dataRef.current[i + 1] as ICell[];
        if ((row[ColName.Limits] as ICell).value !== formLim(r)) {
          const limits = row[ColName.Limits] as ICell;
          limits.value = formLim(r);
          change = true;
        }
        const ref = row[ColName.Ref] as ICell;
        if (ref.value !== r.label) {
          const refsSoFar = collectRefs(newData);
          if (r?.label && init) {
            //use the saved values
            if (!refsSoFar.includes(r.label)) {
              ref.value = r.label;
              if (!refMatch(r.label)) ref.className = 'ref Err';
            }
          } else {
            //set the label on the region
            r.label = ref.value;
            reset = true;
          }
          change = true;
        }
        newData.push(row);
      }
    });

    const refs = collectRefs(newData);
    dataRef.current.slice(newData.length).forEach((r) => {
      const ref = r[ColName.Ref] as ICell;
      if (ref.value !== '' && !refs.includes(ref.value)) {
        newData.push(r);
      }
    });

    if (change) {
      applyCurrentRowHighlight(newData);
      setData(newData);
      if (reset) {
        resetSegments(regions);
      }
      if (!init) {
        if (!isChanged(verseToolId)) {
          toolChanged(verseToolId);
        }
        checkBlockersAndScheduleAutosave();
      }
    }
  };

  useEffect(() => {
    if (dataRef.current.length === 0) return;
    const newData = dataRef.current.map((row) =>
      row.map((cell) => ({ ...cell }))
    );
    applyCurrentRowHighlight(newData);
    setData(newData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSegment, currentSegmentIndex, numSegments]);

  const sheetData = useMemo(
    () =>
      hasPermission
        ? data.map((row, rowIndex) =>
            row.map((cell, colIndex) => ({
              ...cell,
              readOnly:
                rowIndex === 0 ||
                colIndex === ColName.Limits ||
                (colIndex === ColName.Ref &&
                  !`${(row[ColName.Limits] as ICell).value ?? ''}`.trim()),
            }))
          )
        : data.map((r) => r.map((c) => ({ ...c, readOnly: true }))),
    [ColName.Limits, ColName.Ref, data, hasPermission]
  );

  const handleRowClick = async (rowIndex: number) => {
    const row = dataRef.current[rowIndex] as ICell[] | undefined;
    const segment = getSegmentFromRow(row);
    if (!row || !segment) return;

    const limits = row[ColName.Limits] as ICell;
    if ((limits.className ?? '').includes('cur')) return;

    const newData = dataRef.current.map((r) => r.map((c) => ({ ...c })));
    applyRowHighlight(newData, rowIndex);
    setData(newData);
    setCurrentSegment(segment, rowIndex);

    const ctrl = playerControlsRef.current;
    if (ctrl?.isReady()) {
      const seekTime =
        segment.start > 0
          ? segment.start + SEGMENT_BOUNDARY_TOLERANCE_SEC
          : segment.start;
      await ctrl.gotoTime(seekTime, segment);
      setCurrentSegment(segment, rowIndex);
    }
  };

  const handleSheetSelect = (selection: DataSheet.Selection) => {
    const row = selection.start.i;
    const col = selection.start.j;
    if (row <= 0) return;
    if (col === ColName.Ref) {
      void handleRowClick(row);
    }
  };

  const handleValueRenderer = (cell: ICell, row: number, col: number) => {
    if (row > 0 && col === ColName.Limits && cell.value) {
      return (
        <span
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer', display: 'block', width: '100%' }}
          onClick={() => void handleRowClick(row)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              void handleRowClick(row);
            }
          }}
        >
          {cell.value}
        </span>
      );
    }
    return cell.value;
  };
  const setSegments = () => {
    //make an iRegions array from the dataRef.current
    const regions: IRegion[] = [];
    dataRef.current.forEach((r, i) => {
      if (i > 0) {
        const limits = r[ColName.Limits].value.split('-');
        if (limits.length === 2) {
          regions.push({
            start: parseFloat(limits[0]),
            end: parseFloat(limits[1]),
            label: r[ColName.Ref].value,
          });
        }
      }
    });
    resetSegments(regions);
  };
  const handleCellsChanged = (changes: Array<ICellChange>) => {
    const newData = dataRef.current.map((r) => r);
    let changed = false;
    changes.forEach((c) => {
      const value = c.value?.trim();
      const cell = (newData[c.row] as ICell[])[c.col] as ICell;
      if (value !== cell.value) {
        changed = true;
        if (c.col === ColName.Ref) {
          (newData[c.row] as ICell[])[c.col] = {
            ...cell,
            value,
            className: 'ref' + (c.value && !refMatch(c.value) ? ' Err' : ''),
          };
        } else {
          cell.value = value;
        }
      }
    });
    if (changed) {
      setData(newData);
      setSegments();
      if (!isChanged(verseToolId)) {
        toolChanged(verseToolId);
      }
      checkBlockersAndScheduleAutosave();
    }
  };

  const handleParsePaste = (clipBoard: string) => {
    const rawData = cleanClipboard(clipBoard);
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

  const handleCopy = () => {
    const config: string[] = [];
    dataRef.current
      .filter((v, i) => i > 0)
      .forEach((row) => {
        config.push(
          `${(row[ColName.Limits] as ICell).value}\t${(row[ColName.Ref] as ICell).value}`
        );
      });

    const content = config.join('\n');
    if (content.length > 0)
      navigator.clipboard
        .writeText(content)
        .then(() => {
          showMessage(tt.availableOnClipboard);
        })
        .catch(() => {
          showMessage(ts.cantCopy);
        });
    else showMessage(tt.noData.replace('{0}', t.markVerses));
  };

  const validationInput = () => ({
    rows: dataRef.current
      .filter((_, i) => i > 0)
      .map((row) => ({
        limits: `${(row[ColName.Limits] as ICell).value ?? ''}`,
        ref: `${(row[ColName.Ref] as ICell).value ?? ''}`,
      })),
    expandedRefs: collectRefs(dataRef.current),
    passageRefs: passageRefs.current,
    hasBtRecordings,
    strings: t,
  });

  const checkRefs = () => getMarkVersesValidationIssues(validationInput());

  const checkAutosaveBlockers = () =>
    getMarkVersesAutosaveBlockers(validationInput());

  const handleCancel = () => {
    if (savingRef.current) {
      showMessage(t.canceling);
      canceling.current = true;
      return;
    }
    checkSavedFn(() => {
      toolChanged(verseToolId, false);
      if (hasPermission) handleComplete(true); // cancel advances to next step
    });
  };

  const writeResourcesRef = useRef(writeResources);
  writeResourcesRef.current = writeResources;

  const scheduleAutosave = useMemo(
    () =>
      debounce(() => {
        void writeResourcesRef.current();
      }, AUTOSAVE_DEBOUNCE_MS),
    []
  );

  useEffect(
    () => () => {
      scheduleAutosave.clear();
    },
    [scheduleAutosave]
  );

  useEffect(() => {
    if (saveRequested(verseToolId) && !savingRef.current) {
      scheduleAutosave.clear();
      void writeResourcesRef.current();
    } else if (clearRequested(verseToolId)) clearCompleted(verseToolId);
    // saveRequested/clearRequested read live UnsavedContext refs via toolsChanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged, scheduleAutosave]);

  const checkBlockersAndScheduleAutosave = () => {
    if (!hasPermission) return;
    const allIssues = checkRefs();
    const blockers = checkAutosaveBlockers();
    setSaveIssues(allIssues);
    if (blockers.length > 0) {
      scheduleAutosave.clear();
      const fingerprint = blockers.join('\0');
      if (fingerprint !== lastIssuesNotifyRef.current) {
        lastIssuesNotifyRef.current = fingerprint;
        showMessage(
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <span>
              {t.autosaveSkipped.replace('{0}', String(blockers.length))}
            </span>
            <Button
              size="small"
              variant="text"
              onClick={() => setIssuesDialogOpen(true)}
            >
              {t.viewIssues}
            </Button>
          </Box>,
          AlertSeverity.Warning
        );
      }
      return;
    }
    lastIssuesNotifyRef.current = '';
    if (allIssues.length === 0) {
      setIssuesDialogOpen(false);
    }
    scheduleAutosave();
  };

  return Boolean(mediafileId) && passType !== PassageTypeEnum.NOTE ? (
    <Box>
      <PassageDetailPlayer
        width={width}
        data-testid="player"
        allowSegment={NamedRegions.Verse}
        onSegment={handleSegment}
        suggestedSegments={pastedSegments}
        allowZoomAndSpeed={true}
        controlsRef={playerControlsRef}
        markVersesTailOpenRef={markVersesTailOpenRef}
      />
      <StyledPaper style={heightStyle}>
        <StyledTable id="verse-sheet" data-testid="verse-sheet">
          <DataSheet
            data={sheetData}
            valueRenderer={handleValueRenderer}
            onCellsChanged={handleCellsChanged}
            onSelect={handleSheetSelect}
            parsePaste={handleParsePaste}
          />
        </StyledTable>
      </StyledPaper>
      <ActionRow>
        <AltButton
          id="copy-verse-sheet"
          onClick={handleCopy}
          disabled={numSegments === 0}
        >
          {ts.clipboardCopy}
        </AltButton>
        <GrowingSpacer />
        <AltButton id="cancel-mark-verse" onClick={handleCancel}>
          {ts.cancel}
        </AltButton>
      </ActionRow>
      {issuesDialogOpen && saveIssues.length > 0 && (
        <Confirm
          title={t.markupIssuesTitle}
          text=""
          jsx={
            <ul>
              {saveIssues.map((issue, j) => (
                <li key={`issue-${j}`}>{issue}</li>
              ))}
            </ul>
          }
          yes=""
          no={ts.close}
          noResponse={() => setIssuesDialogOpen(false)}
          yesResponse={() => {}}
        />
      )}
    </Box>
  ) : passType === PassageTypeEnum.NOTE ? (
    <Paper sx={paperProps}>
      <Typography variant="h2" align="center">
        {ts.notSupported}
      </Typography>
    </Paper>
  ) : (
    <Paper sx={paperProps}>
      <Typography variant="h2" align="center">
        {ts.noAudio}
      </Typography>
    </Paper>
  );
}

export default PassageDetailMarkVerses;
