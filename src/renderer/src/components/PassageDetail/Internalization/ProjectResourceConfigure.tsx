import { useState, useEffect, useRef, useContext, ChangeEvent } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import {
  Section,
  IPassageDetailArtifactsStrings,
  ITranscriptionTabStrings,
  ISharedStrings,
  MediaFileD,
  SectionResource,
  BookName,
} from '../../../model';
import {
  Box,
  Paper,
  PaperProps,
  Stack,
  TextField,
  debounce,
  styled,
} from '@mui/material';
import DataSheet from 'react-datasheet';
import 'react-datasheet/lib/react-datasheet.css';
import { PassageDetailPlayer } from '../PassageDetailPlayer';
import { parseRegions, IRegion } from '../../../crud/useWavesurferRegions';
import { prettySegment } from '../../../utils/prettySegment';
import { cleanClipboard } from '../../../utils/cleanClipboard';
import { NamedRegions, updateSegments } from '../../../utils/namedSegments';
import { findRecord } from '../../../crud/tryFindRecord';
import { related } from '../../../crud/related';
import {
  resourceSelector,
  sharedSelector,
  transcriptionTabSelector,
} from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { UnsavedContext } from '../../../context/UnsavedContext';
import { useProjectResourceSave } from './useProjectResourceSave';
import { useProjectSegmentSave } from './useProjectSegmentSave';
import { useFullReference, IInfo } from './useFullReference';
import { useSnackBar } from '../../../hoc/SnackBar';
import {
  ActionRow,
  AltButton,
  GrowingSpacer,
  LightTooltip,
  PriButton,
} from '../../../control';
import { RecordIdentity, RecordTransformBuilder } from '@orbit/records';
import { useOrbitData } from '../../../hoc/useOrbitData';

const NotTable = 408;

const wizToolId = 'ProjResWizard';

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
    '& .value-viewer': {
      textAlign: 'center',
    },
  },
  '& .ref': {
    verticalAlign: 'inherit !important',
  },
  '& .des': {
    verticalAlign: 'inherit !important',
    '& .value-viewer': {
      textAlign: 'left',
    },
  },
}));

interface Segs {
  start: number;
  end: number;
}

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

interface IProps {
  width: number;
  media: MediaFileD | undefined;
  items: RecordIdentity[];
  onOpen?: (open: boolean) => void;
  bookData?: BookName[];
}

export const ProjectResourceConfigure = (props: IProps) => {
  const { width, media, items, onOpen } = props;
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const sectionResources = useOrbitData<SectionResource[]>('sectionresource');
  const [memory] = useGlobal('memory');
  const [, setComplete] = useGlobal('progress');
  const [data, setDatax] = useState<ICell[][]>([]);
  const [suffix, setSuffix] = useState('');
  const [numSegments, setNumSegments] = useState(0);
  const [pastedSegments, setPastedSegments] = useState('');
  const [heightStyle, setHeightStyle] = useState({
    maxHeight: `${window.innerHeight - NotTable}px`,
  });
  const dataRef = useRef<ICell[][]>([]);
  const infoRef = useRef<IInfo[]>([]);
  const segmentsRef = useRef('{}');
  const fullReference = useFullReference(props.bookData);
  const t: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  const tt: ITranscriptionTabStrings = useSelector(
    transcriptionTabSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
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
  } = useContext(UnsavedContext).state;
  const savingRef = useRef(false);
  const canceling = useRef(false);
  const projectResourceSave = useProjectResourceSave();
  const projectSegmentSave = useProjectSegmentSave();
  const { showMessage } = useSnackBar();

  const readOnlys = [false, true, false];
  const widths = [150, 200, 300];
  const cClass = ['lim', 'ref', 'des'];

  enum ColName {
    Limits,
    Ref,
    Desc,
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
    return () => {
      window.removeEventListener('resize', handleResize);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const rowCells = (row: string[], first = false) =>
    row.map(
      (v, i) =>
        ({
          value: v,
          width: widths[i],
          readOnly: first || readOnlys[i],
          className: first ? 'cTitle' : cClass[i],
        }) as ICell
    );

  const emptyTable = () => [
    rowCells([t.startStop, t.reference, t.description], true),
  ];

  const setData = (newData: ICell[][]) => {
    setDatax(newData);
    dataRef.current = newData;
  };
  useEffect(() => {
    if (items?.length > 0) {
      const newData: ICell[][] = emptyTable();
      const newInfo = items.map((v) => {
        const rec = findRecord(memory, v.type, v.id);
        if (!rec) return {} as IInfo;
        if (v?.type === 'passage') {
          const section = findRecord(
            memory,
            'section',
            related(rec, 'section')
          ) as Section;
          if (!section) return {} as IInfo;
          const secNum = section?.attributes?.sequencenum || 0;
          return { secNum, section, passage: rec } as IInfo;
        } else {
          const section = rec as Section;
          const secNum = section?.attributes?.sequencenum || 0;
          return { secNum, section } as IInfo;
        }
      });
      newInfo.forEach((v) => {
        newData.push(rowCells(['', fullReference(v), '']));
      });
      infoRef.current = newInfo;
      setData(newData);
      if (segmentsRef.current) handleSegment(segmentsRef.current, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const writeResources = async () => {
    if (!savingRef.current) {
      savingRef.current = true;
      if (media) {
        const t = new RecordTransformBuilder();
        let ix = 0;
        const d = dataRef.current;
        const total = infoRef.current.length;
        for (const i of infoRef.current) {
          if (canceling.current) break;
          ix += 1;
          let row = d[ix] as ICell[];
          while ((row[ColName.Ref] as ICell).value === '' && ix < d.length) {
            ix += 1;
            row = d[ix] as ICell[];
          }
          const limitValue = (row[ColName.Limits] as ICell).value;
          const refValue = (row[ColName.Ref] as ICell).value;
          const topic = `${
            media.attributes.topic ? media.attributes.topic + ' -' : ''
          }${
            (row[ColName.Desc] as ICell).value
              ? (row[ColName.Desc] as ICell).value
              : refValue
          } ${suffix}`;
          if (limitValue && refValue) {
            await projectResourceSave({
              t,
              media,
              i,
              topicIn: topic,
              limitValue,
              mediafiles,
              sectionResources,
            });
          }
          setComplete(Math.min((ix * 100) / total, 100));
        }
        projectSegmentSave({
          media,
          segments: updateSegments(
            NamedRegions.ProjectResource,
            media.attributes?.segments,
            segmentsRef.current
          ),
        })
          .then(() => {
            saveCompleted(wizToolId);
          })
          .catch((err) => {
            //so we don't come here...we go to continue/logout
            saveCompleted(wizToolId, err.message);
          })
          .finally(() => {
            savingRef.current = false;
            canceling.current = false;
            setComplete(0);
            onOpen && onOpen(false);
          });
      }
    }
  };

  const handleCreate = () => {
    if (!saveRequested(wizToolId)) {
      startSave(wizToolId);
    }
  };

  useEffect(() => {
    if (saveRequested(wizToolId) && !savingRef.current) writeResources();
    else if (clearRequested(wizToolId)) clearCompleted(wizToolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  const handleCancel = () => {
    if (savingRef.current) {
      showMessage(t.canceling);
      canceling.current = true;
      return;
    }
    checkSavedFn(() => {
      toolChanged(wizToolId, false);
      onOpen && onOpen(false);
    });
  };

  const handleCopy = () => {
    const config: string[] = [];
    dataRef.current
      .filter((_v, i) => i > 0)
      .forEach((row) => {
        const rLimit = row[ColName.Limits] as ICell;
        const rRef = row[ColName.Ref] as ICell;
        const rDesc = row[ColName.Desc] as ICell;
        const rConf = rLimit.value + '\t' + rRef.value + '\t' + rDesc.value;
        config.push(rConf);
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
    else showMessage(tt.noData.replace('{0}', t.projectResourceConfigure));
  };

  const loadPastedSegments = (newData: ICell[][]) => {
    const duration = media?.attributes.duration || 0;
    const psgIndexes = items.map((r) => r?.type === 'passage');
    const segBoundaries = newData
      .filter((_r, i) => i > 0 && psgIndexes[i - 1])
      .map((s) => (s[ColName.Limits] as ICell).value); //should be like "0.0-34.9"
    let regs = segBoundaries
      .map((b: string) => {
        const boundaries = b.split('-');
        if (
          boundaries.length > 1 &&
          !isNaN(parseFloat(boundaries[0] ?? '0')) &&
          !isNaN(parseFloat(boundaries[1] ?? '0'))
        )
          return {
            start: parseFloat(boundaries[0] ?? '0'),
            end: parseFloat(boundaries[1] ?? '0'),
          };
        return { start: 0, end: 0 };
      })
      .filter(
        (r) =>
          r.end > 0 &&
          (duration === 0 || r.end < duration + 1) &&
          r.start < r.end
      );
    if (media?.attributes.duration) {
      regs = regs.filter((r) => r.start <= media.attributes.duration);
    }
    const errors = segBoundaries.length - regs.length;
    let updated = 0;
    regs.forEach((r, i) => {
      if (media?.attributes.duration && r.end > media?.attributes.duration) {
        r.end = media?.attributes.duration;
        updated++;
      }
      if (i > 0 && r.start !== (regs[i - 1] as Segs).end) {
        r.start = (regs[i - 1] as Segs).end;
        updated++;
      }
    });
    setNumSegments(regs.length);
    setPastedSegments(JSON.stringify({ regions: JSON.stringify(regs) }));
    return { errors, updated };
  };
  const handleParsePaste = (clipBoard: string) => {
    const rawData = cleanClipboard(clipBoard);
    if (rawData.length === 0) {
      showMessage(tt.noData.replace('{0}', t.clipboard));
      return [];
    }
    const rawWidth = (rawData[0] as string[]).length;
    if (![2, 3].includes(rawWidth)) {
      showMessage(t.pasteFormat);
      return [];
    }
    let isCol0Ref = false;
    if (rawWidth === 2) {
      const col0 = (rawData[0] as string[])[0] as string;
      for (const row of data) {
        if ((row[ColName.Ref] as ICell).value.trim() === col0) {
          isCol0Ref = true;
          break;
        }
      }
    }
    const refMap = new Map<string, string[]>();
    rawData.forEach((row) => {
      refMap.set(isCol0Ref ? (row[0] as string) : (row[1] as string), row);
    });
    let changed = false;
    const newData = data.map((row, i) => {
      if (i === 0) return row;
      const rowRef = row[ColName.Ref] as ICell;
      const ref = rowRef.value.trim();
      const raw = refMap.get(ref);
      if (!raw) return row;
      changed = true;
      if (rawWidth === 3) return rowCells(raw);
      const limits = row[ColName.Limits] as ICell;
      if (isCol0Ref) return rowCells([limits.value].concat(raw));
      const desc = row[ColName.Desc] as ICell;
      return rowCells(raw.concat([desc.value]));
    });
    if (!changed) {
      showMessage(t.pasteNoChange);
      return [];
    }
    const ret = loadPastedSegments(newData);
    if (ret.errors || ret.updated) {
      showMessage(
        t.pasteError
          .replace('{0}', ret.errors.toString())
          .replace('{1}', ret.updated.toString())
      );
    }

    return [];
  };

  const handleCellsChanged = (changes: Array<ICellChange>) => {
    const newData = dataRef.current.map((r) => r);
    changes.forEach((c) => {
      const cell = (newData[c.row] as ICell[])[c.col] as ICell;
      cell.value = c.value;
    });
    setData(newData);
  };

  const handleSegment = (segments: string, init: boolean) => {
    if (dataRef.current.length === 0) return;
    const regions = parseRegions(segments).regions.sort(
      (i, j) => i.start - j.start
    );

    setNumSegments(regions.length);

    // console.log('______');
    // regions.forEach((r) => console.log(prettySegment(r)));
    segmentsRef.current = segments;

    let change = false;
    const newData = new Array<ICell[]>();
    newData.push(dataRef.current[0] as ICell[]);
    const dlen = dataRef.current.length;
    const ilen = infoRef.current.length;
    let ix = 0;
    const regs = new Map<number, IRegion>();
    const secI = new Map<number, number>();
    regions.forEach((r) => {
      const v = prettySegment(r);
      const curInfo = infoRef.current[ix] as IInfo;
      while (ix < ilen && curInfo.passage === undefined) {
        secI.set(curInfo.secNum, ix + 1);
        ix += 1;
        newData.push(dataRef.current[ix] as ICell[]);
      }
      if (ix < ilen) {
        const [vStart, vEnd] = v.split('-').map((n) => parseFloat(n));
        const secNum = curInfo.secNum;
        if (regs.has(secNum)) {
          regs.set(secNum, {
            start: Math.min(
              vStart as number,
              regs.get(secNum)?.start as number
            ),
            end: Math.max(vEnd as number, regs.get(secNum)?.end as number),
          });
        } else {
          regs.set(secNum, { start: vStart as number, end: vEnd as number });
        }
      }
      const dx = ix + 1; // account for header
      if (dx < dlen) {
        const row = (dataRef.current[dx] as ICell[]).map((v) => v);
        const limits = row[ColName.Limits] as ICell;
        if (limits.value !== v) {
          limits.value = v;
          change = true;
        }
        newData.push(row);
      } else {
        showMessage(t.unusedSegment);
        newData.push(rowCells([v, '', '']));
        change = true;
      }
      ix += 1;
    });
    secI.forEach((v, k) => {
      if (regs.has(k)) {
        const limits = (newData[v] as ICell[])[ColName.Limits] as ICell;
        limits.value = prettySegment(regs.get(k) as IRegion);
      }
    });
    for (let i = newData.length; i < dataRef.current.length; i += 1) {
      const row = (dataRef.current[i] as ICell[]).map((r) => r);
      const limits = row[ColName.Limits] as ICell;
      if (limits.value !== '') {
        limits.value = '';
        change = true;
      }
      newData.push(row);
    }
    if (change) {
      setData(newData);
      setPastedSegments('');
      if (!init && !isChanged(wizToolId)) toolChanged(wizToolId);
    }
  };

  const handleSuffix = (e: ChangeEvent<HTMLInputElement>) => {
    setSuffix(e.target.value);
  };

  const handleValueRenderer = (cell: ICell) => cell.value;

  return (
    <Box>
      <PassageDetailPlayer
        width={width}
        allowSegment={NamedRegions.ProjectResource}
        onSegment={handleSegment}
        suggestedSegments={pastedSegments}
      />
      <StyledPaper id="proj-res-sheet" style={heightStyle}>
        <StyledTable id="proj-res-sheet">
          <Stack direction="row" spacing={1} data-testid="proj-res-sheet">
            <DataSheet
              data={data}
              valueRenderer={handleValueRenderer}
              onCellsChanged={handleCellsChanged}
              parsePaste={handleParsePaste}
            />
            <LightTooltip title={t.suffixTip}>
              <TextField
                label={t.suffix}
                variant="outlined"
                value={suffix}
                onChange={handleSuffix}
              />
            </LightTooltip>
          </Stack>
        </StyledTable>
      </StyledPaper>
      <ActionRow>
        <AltButton
          id="copy-configure"
          onClick={handleCopy}
          disabled={numSegments === 0}
        >
          {ts.clipboardCopy}
        </AltButton>
        <GrowingSpacer />
        <PriButton
          id="res-create"
          onClick={handleCreate}
          disabled={numSegments === 0 || savingRef.current}
        >
          {t.createResources}
        </PriButton>
        <AltButton id="res-create-cancel" onClick={handleCancel}>
          {ts.cancel}
        </AltButton>
      </ActionRow>
    </Box>
  );
};

export default ProjectResourceConfigure;
