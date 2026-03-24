import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Paper, SxProps, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../../../context/useGlobal';
import usePassageDetailContext from '../../../../context/usePassageDetailContext';
import { UnsavedContext } from '../../../../context/UnsavedContext';
import { ActionRow } from '../../../../control/ActionRow';
import { AltButton } from '../../../../control/AltButton';
import { GrowingSpacer } from '../../../../control/GrowingSpacer';
import { PriButton } from '../../../../control/PriButton';
import { passageTypeFromRef } from '../../../../control/passageTypeFromRef';
import { findRecord } from '../../../../crud/tryFindRecord';
import { parseRef } from '../../../../crud/passage';
import { ArtifactTypeSlug } from '../../../../crud/artifactTypeSlug';
import { useArtifactType } from '../../../../crud/useArtifactType';
import { usePlanType } from '../../../../crud/usePlanType';
import { IRegion } from '../../../../crud/useWavesurferRegions';
import { useSnackBar } from '../../../../hoc/SnackBar';
import {
  ISharedStrings,
  ITranscriptionTabStrings,
  IVerseStrings,
  MediaFileD,
  Passage,
} from '../../../../model';
import { PassageTypeEnum } from '../../../../model/passageType';
import {
  sharedSelector,
  transcriptionTabSelector,
  verseSelector,
} from '../../../../selector';
import { cleanClipboard } from '../../../../utils/cleanClipboard';
import {
  getSortedRegions,
  NamedRegions,
  updateSegments,
} from '../../../../utils/namedSegments';
import { refMatch } from '../../../../utils/refMatch';
import { useStepPermissions } from '../../../../utils/useStepPermission';
import Confirm from '../../../AlertDialog';
import PassageDetailPlayer from '../../PassageDetailPlayer';
import { useProjectSegmentSave } from '../../Internalization/useProjectSegmentSave';
import MarkVersesTableIsMobile from './MarkVersesTableIsMobile';

const verseToolId = 'VerseTool';
const paperProps = { p: 2, m: 'auto', width: 'calc(100% - 32px)' } as SxProps;
const readOnlys = [true, false];
const widths = [150, 150];
const cClass = ['lim', 'ref'];

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
    setStepComplete,
    gotoNextStep,
    rowData,
  } = usePassageDetailContext();
  const [memory] = useGlobal('memory');
  const [, setComplete] = useGlobal('progress');
  const [plan] = useGlobal('plan');
  const [data, setDatax] = useState<ICell[][]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [confirm, setConfirm] = useState('');
  const [numSegments, setNumSegments] = useState(0);
  const [pastedSegments, setPastedSegments] = useState('');
  const [engVrs, setEngVrs] = useState<Map<string, number[]>>(new Map());
  const savingRef = useRef(false);
  const canceling = useRef(false);
  const dataRef = useRef<ICell[][]>([]);
  const segmentsRef = useRef('{}');
  const passageRefs = useRef<string[]>([]);
  const resettingSegmentsRef = useRef(false);
  const { canDoSectionStep } = useStepPermissions();
  const hasPermission = canDoSectionStep(currentstep, section);
  const { localizedArtifactType } = useArtifactType();
  const t = useSelector(verseSelector, shallowEqual) as IVerseStrings;
  const ts = useSelector(sharedSelector, shallowEqual) as ISharedStrings;
  const tt = useSelector(
    transcriptionTabSelector,
    shallowEqual
  ) as ITranscriptionTabStrings;
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

  const emptyTable = () => [rowCells([t.startStop, t.reference], true)];

  const setData = (newData: ICell[][]) => {
    setDatax(newData);
    dataRef.current = newData;
  };

  useEffect(() => {
  if (dataRef.current.length === 0) {
    setData(emptyTable());
  }
}, [t.reference, t.startStop]);

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
        .replace(/(\d+)\.(\d+)/g, '$1:$2')
        .trim();

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
    if (!psg?.attributes?.book) return [];

    if (psg.attributes.reference) {
      const refsFromReference = getRefs(
        psg.attributes.reference,
        psg.attributes.book
      );
      if (refsFromReference.length > 0) return refsFromReference;
    }

    const {
      book,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
    } = psg.attributes;

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
  [engVrs, getRefs]
);

  useEffect(() => {
    const refs = getPassageRefs(passage);

    console.log('passage attributes:', passage?.attributes);
    console.log('expanded refs from passage:', refs);

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
            refs.push(...getRefs(value, passage.attributes.book));
          }
        });
      return refs;
    },
    [getRefs, passage.attributes.book]
  );

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
};

const parseFormattedTime = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.includes(':')) {
    const [minPart, secPart] = trimmed.split(':');
    const minutes = parseInt(minPart, 10);
    const seconds = parseFloat(secPart);

    if (Number.isNaN(minutes) || Number.isNaN(seconds)) return NaN;
    return minutes * 60 + seconds;
  }

  return parseFloat(trimmed);
};

const formLim = ({ start, end }: IRegion) =>
  `${formatTime(start)}-${formatTime(end)}`;

  

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

      console.log('passage reference:', passage?.attributes?.reference);
      console.log('passageRefs.current:', passageRefs.current);

      if (resettingSegmentsRef.current) {
        resettingSegmentsRef.current = false;
        return;
      }
      if (!hasPermission && !init) {
        toolChanged(verseToolId, false);
        return;
      }
      const regions = getSortedRegions(segments);
      const previousData =
        dataRef.current.length > 0 ? dataRef.current : emptyTable();

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

        if (!nextReference && passageRefs.current[index]) {
          nextReference = passageRefs.current[index];
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
        if (formLim(region) === currentSegment.trim()) {
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
      collectRefs,
      currentSegment,
      hasPermission,
      isChanged,
      numSegments,
      rowCells,
      t.reference,
      t.startStop,
      toolChanged,
    ]
  );

  const setSegments = () => {
    const regions: IRegion[] = [];
    dataRef.current.forEach((row, index) => {
      if (index === 0) return;
      const limits = `${row[ColName.Limits].value}`.split('-');
      if (limits.length === 2) {
        regions.push({
          start: parseFloat(limits[0]),
          end: parseFloat(limits[1]),
          label: row[ColName.Ref].value,
        });
      }
    });
    resetSegments(regions);
  };

  const handleCellsChanged = (changes: Array<ICellChange>) => {
    const newData = dataRef.current.map((row) =>
      row.map((cell) => ({
        ...cell,
      }))
    );

    let changed = false;

    changes.forEach((change) => {
      const value = change.value?.trim() ?? '';
      const row = newData[change.row];
      if (!row) return;

      const cell = row[change.col] as ICell | undefined;
      if (!cell) return;

      if (value !== cell.value) {
        changed = true;

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
      setData(newData);
      setSegments();
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

  const handleCopy = () => {
    const content = dataRef.current
      .filter((_, index) => index > 0)
      .map(
        (row) =>
          `${(row[ColName.Limits] as ICell).value}\t${
            (row[ColName.Ref] as ICell).value
          }`
      )
      .join('\n');

    if (!content.length) {
      showMessage(tt.noData.replace('{0}', t.markVerses));
      return;
    }

    navigator.clipboard
      .writeText(content)
      .then(() => {
        showMessage(tt.availableOnClipboard);
      })
      .catch(() => {
        showMessage(ts.cantCopy);
      });
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

  console.log('MARK VERSES table data:', data);

  return (
    <Box>
      <PassageDetailPlayer
        width={width}
        data-testid="player"
        allowSegment={NamedRegions.Verse}
        onSegment={handleSegment}
        suggestedSegments={pastedSegments}
        allowZoomAndSpeed={true}
      />
      <MarkVersesTableIsMobile
        data={
          hasPermission
            ? data
            : data.map((row) =>
                row.map((cell) => ({
                  ...cell,
                  readOnly: true,
                }))
              )
        }
        onCellsChanged={handleCellsChanged}
        onParsePaste={handleParsePaste}
      />
      <ActionRow sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <AltButton
          id="copy-verse-sheet"
          onClick={handleCopy}
          disabled={numSegments === 0}
        >
          {ts.clipboardCopy}
        </AltButton>
        <GrowingSpacer />
        <PriButton
          id="create-mark-verse"
          onClick={handleSaveMarkup}
          disabled={
            numSegments === 0 ||
            savingRef.current ||
            !isChanged(verseToolId) ||
            !hasPermission
          }
        >
          {t.saveVerseMarkup}
        </PriButton>
        <AltButton id="cancel-mark-verse" onClick={handleCancel}>
          {ts.cancel}
        </AltButton>
      </ActionRow>
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