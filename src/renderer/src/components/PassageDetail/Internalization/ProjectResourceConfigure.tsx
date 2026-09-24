import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useContext,
  ChangeEvent,
  ReactNode,
} from 'react';
import { useGlobal } from '../../../context/useGlobal';
import {
  Section,
  IPassageDetailArtifactsStrings,
  ITranscriptionTabStrings,
  ISharedStrings,
  MediaFileD,
  SectionResource,
  BookName,
  IState,
} from '../../../model';
import {
  Box,
  Paper,
  PaperProps,
  Stack,
  Table,
  TableBody,
  TextField,
  styled,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import DataSheet from 'react-datasheet';
import 'react-datasheet/lib/react-datasheet.css';
import { PassageDetailPlayer } from '../PassageDetailPlayer';
import { parseRegions, IRegion } from '../../../crud/useWavesurferRegions';
import { prettySegment } from '../../../utils/prettySegment';
import { cleanClipboard } from '../../../utils/cleanClipboard';
import { NamedRegions, updateSegments } from '../../../utils/namedSegments';
import { findRecord } from '../../../crud/tryFindRecord';
import { related } from '../../../crud/related';
import { useOrganizedBy } from '../../../crud/useOrganizedBy';
import { sectionLabel, passageLabel } from './internalizeLabels';
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
import { Button, ActionRow, LightTooltip, rowSx } from '../../../control';
import { RecordIdentity, RecordTransformBuilder } from '@orbit/records';
import { useOrbitData } from '../../../hoc/useOrbitData';
import { removeUnselectedProjectResourceAssignments } from './projectResourceAssignments';

const wizToolId = 'ProjResWizard';

const StyledPaper = styled(Paper)<PaperProps>(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  marginBottom: theme.spacing(1),
  '& .MuiPaper-rounded': {
    borderRadius: '8px',
  },
  // Fill the dialog's flex column. The paper itself does NOT scroll; only the
  // inner table region does, so the suffix field below stays visible and the
  // action buttons stay pinned to the dialog bottom regardless of content size.
  flex: '1 1 auto',
  minHeight: 0,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

interface ISheetRendererProps {
  className: string;
  children: ReactNode;
}

// react-datasheet's sheetRenderer: renders the grid as a real MUI Table so it
// picks up the theme's `variant="striped"` (even rows tinted with
// action.hover) instead of duplicating that striping CSS here. The sheet spans
// the full dialog width (MUI Table defaults to width:100%); the Description
// column (no fixed width) absorbs the extra space.
const ProjectResourceTable = ({ className, children }: ISheetRendererProps) => (
  <Table
    className={className}
    variant="striped"
    sx={{
      // react-datasheet's default cell font is cramped; use the theme body size
      // so the rows read as balanced.
      fontSize: (theme) => theme.typography.body1.fontSize,
      // react-datasheet's own `.data-grid-container .data-grid .cell` rule (3
      // classes) beats any `& .cell` override here and forces height:17px /
      // padding:0. The inner `.value-viewer` span has no competing padding
      // rule, so padding it is what actually gives each row its height.
      '& .value-viewer': {
        py: 1.25,
        px: 1.5,
      },
      // While editing, react-datasheet swaps the value-viewer span for an
      // `<input class="data-editor">` that has no padding, so typed text jams
      // against the cell's left border. Give it the same horizontal padding as
      // the viewer so text stays aligned when entering/leaving edit mode.
      // The library's own `.cell > input` rule (3 classes + child selector)
      // forces `text-align:right`, which beats a single-class override — so the
      // input renders right-aligned mid-edit and only snaps left once the
      // value-viewer takes over on blur. `!important` is required to win.
      '& .data-editor': {
        px: 1.5,
        boxSizing: 'border-box',
        textAlign: 'left !important',
      },
      // react-datasheet tints read-only cells with their own grey background;
      // clear it on the body rows so each row's stripe shows uniformly (the
      // header row, the first tr, keeps the library default).
      '& > tbody > tr:not(:first-of-type) > .cell.read-only': {
        backgroundColor: 'transparent',
      },
      // react-datasheet dims read-only cells to grey text via its own
      // `.data-grid .cell.read-only` rule (higher specificity than ours); every
      // cell in this display-only sheet is read-only, so override with
      // !important to keep the text normal black.
      '& .cell.read-only': {
        color: (theme) => `${theme.palette.text.primary} !important`,
      },
      // Header row: slightly darker grey. Every cell here is read-only, so the
      // grey needs !important to beat the library's own cell background.
      '& .cTitle': {
        fontWeight: 'bold',
        backgroundColor: (theme) => `${theme.palette.grey[300]} !important`,
      },
      // Black rule dividing the header from the first body row. Uses the same
      // `> tbody > tr > td.cell` specificity as the column dividers below so it
      // beats react-datasheet's own light cell border under border-collapse.
      '& > tbody > tr:first-of-type > td.cell': {
        borderBottom: (theme) => `1px solid ${theme.palette.common.black}`,
      },
      // Black vertical dividers between columns (right edge of every cell except
      // the last column, on every row).
      '& > tbody > tr > td.cell:not(:last-of-type)': {
        borderRight: (theme) => `1px solid ${theme.palette.common.black}`,
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
    }}
  >
    <TableBody>{children}</TableBody>
  </Table>
);

interface ICell {
  value: any;
  /**
   * When set, the cell shows a localized label derived from this row's
   * passage/section at render time (see `handleValueRenderer`) instead of
   * `value`. Kept as the source (not a pre-rendered string) so the label
   * follows a runtime language change; `value` keeps the original reference
   * string used to build the saved resource topic.
   */
  info?: IInfo;
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
  /** Passages/sections the selection dialog offered; scopes cleanup. */
  candidateItems?: RecordIdentity[];
  /** Artifact type id of a derived resource copy (`resource` slug). */
  resourceTypeId?: string | null;
  onOpen?: (open: boolean) => void;
  bookData?: BookName[];
}

export const ProjectResourceConfigure = (props: IProps) => {
  const { width, media, items, candidateItems, resourceTypeId, onOpen } = props;
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const sectionResources = useOrbitData<SectionResource[]>('sectionresource');
  const [memory] = useGlobal('memory');
  const [, setComplete] = useGlobal('progress');
  const [data, setDatax] = useState<ICell[][]>([]);
  const [suffix, setSuffix] = useState('');
  const [numSegments, setNumSegments] = useState(0);
  const [pastedSegments, setPastedSegments] = useState('');
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
  const { getOrganizedBy } = useOrganizedBy();
  const organizedBy = getOrganizedBy(true);
  const reduxBookData = useSelector((state: IState) => state.books.bookData);
  // Match useFullReference's book-data resolution so the display label uses the
  // same source as the (unchanged) stored reference.
  const labelBookData = props.bookData ?? reduxBookData;
  const {
    toolChanged,
    toolsChanged,
    isChanged,
    saveRequested,
    startSave,
    saveCompleted,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const savingRef = useRef(false);
  const projectResourceSave = useProjectResourceSave();
  const projectSegmentSave = useProjectSegmentSave();
  const { showMessage } = useSnackBar();

  // Only the Description column is editable. Segment limits come from the audio
  // player (not typed here) and the Reference is a derived label, so both stay
  // read-only; the header row is fully read-only.
  // Description has no fixed width so it stretches to fill the full-width sheet.
  const widths = [150, 200, undefined];
  const cClass = ['lim', 'ref', 'des'];

  enum ColName {
    Limits,
    Ref,
    Desc,
  }
  const rowCells = (row: string[], first = false) =>
    row.map(
      (v, i) =>
        ({
          value: v,
          width: widths[i],
          readOnly: first || i !== ColName.Desc,
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
        // `value` keeps the original reference (feeds the saved topic, copy, and
        // paste-matching); `info` drives the localized row label rendered on
        // screen, recomputed per render so it tracks language changes.
        const cells = rowCells(['', fullReference(v), '']);
        cells[ColName.Ref].info = v;
        newData.push(cells);
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
          if (i?.section?.id === undefined) continue;
          ix += 1;
          let row = d[ix];
          while (row[ColName.Ref].value === '' && ix < d.length) {
            ix += 1;
            row = d[ix];
          }
          const limitValue = row[ColName.Limits].value;
          const refValue = row[ColName.Ref].value;
          const topic = `${
            media.attributes.topic ? media.attributes.topic + ' -' : ''
          }${
            row[ColName.Desc].value ? row[ColName.Desc].value : refValue
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
        await removeUnselectedProjectResourceAssignments({
          memory,
          sourceMedia: media,
          selectedItems: items,
          mediafiles,
          sectionResources,
          resourceTypeId,
          candidateItems,
        });
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

  // Real edits mark the tool dirty (see the Description and segment handlers) so
  // a browser/app close mid-edit fires the beforeunload "unsaved changes" warning
  // (AppHead reads the global `changed` flag). The dialog's own close is
  // confirm-gated by the parent; clear the flag on unmount so a normal
  // discard/save close doesn't leak it into the rest of the app.
  useEffect(() => {
    return () => toolChanged(wizToolId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = () => {
    const config: string[] = [];
    dataRef.current
      .filter((v, i) => i > 0)
      .forEach((row) => {
        config.push(
          `${row[ColName.Limits].value}\t${row[ColName.Ref].value}\t${
            row[ColName.Desc].value
          }`
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
    else showMessage(tt.noData.replace('{0}', t.projectResourceConfigure));
  };

  const loadPastedSegments = (newData: ICell[][]) => {
    const duration = media?.attributes.duration || 0;
    const psgIndexes = items.map((r) => r?.type === 'passage');
    const segBoundaries = newData
      .filter((r, i) => i > 0 && psgIndexes[i - 1])
      .map((s) => s[ColName.Limits].value); //should be like "0.0-34.9"
    let regs = segBoundaries
      .map((b: string) => {
        const boundaries = b.split('-');
        if (
          boundaries.length > 1 &&
          !isNaN(parseFloat(boundaries[0])) &&
          !isNaN(parseFloat(boundaries[1]))
        )
          return {
            start: parseFloat(boundaries[0]),
            end: parseFloat(boundaries[1]),
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
      if (i > 0 && r.start !== regs[i - 1].end) {
        r.start = regs[i - 1].end;
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
    const rawWidth = rawData[0].length;
    if (![2, 3].includes(rawWidth)) {
      showMessage(t.pasteFormat);
      return [];
    }
    let isCol0Ref = false;
    if (rawWidth === 2) {
      const col0 = rawData[0][0];
      for (const row of data) {
        if (row[ColName.Ref].value.trim() === col0) {
          isCol0Ref = true;
          break;
        }
      }
    }
    const refMap = new Map<string, string[]>();
    rawData.forEach((row) => {
      refMap.set(isCol0Ref ? row[0] : row[1], row);
    });
    let changed = false;
    const newData = data.map((row, i) => {
      if (i === 0) return row;
      const ref = row[ColName.Ref].value.trim();
      const raw = refMap.get(ref);
      if (!raw) return row;
      changed = true;
      if (rawWidth === 3) return rowCells(raw);
      if (isCol0Ref) return rowCells([row[ColName.Limits].value].concat(raw));
      return rowCells(raw.concat([row[ColName.Desc].value]));
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
    if (changes.length === 0) return;
    const newData = dataRef.current.map((r) => r);
    changes.forEach((c) => {
      newData[c.row][c.col].value = c.value;
    });
    setData(newData);
    // Editing a Description marks the wizard dirty so a browser/app close warns
    // (same tracking the segment handler uses).
    if (!isChanged(wizToolId)) toolChanged(wizToolId);
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
    newData.push(dataRef.current[0]);
    const dlen = dataRef.current.length;
    const ilen = infoRef.current.length;
    let ix = 0;
    const regs = new Map<number, IRegion>();
    const secI = new Map<number, number>();
    regions.forEach((r) => {
      const v = prettySegment(r);
      while (ix < ilen && infoRef.current[ix].passage === undefined) {
        secI.set(infoRef.current[ix].secNum, ix + 1);
        ix += 1;
        newData.push(dataRef.current[ix]);
      }
      if (ix < ilen) {
        const [vStart, vEnd] = v.split('-').map((n) => parseFloat(n));
        const secNum = infoRef.current[ix].secNum;
        if (regs.has(secNum)) {
          regs.set(secNum, {
            start: Math.min(vStart, regs.get(secNum)?.start as number),
            end: Math.max(vEnd, regs.get(secNum)?.end as number),
          });
        } else {
          regs.set(secNum, { start: vStart, end: vEnd });
        }
      }
      const dx = ix + 1; // account for header
      if (dx < dlen) {
        const row = dataRef.current[dx].map((v) => v);
        if (row[ColName.Limits].value !== v) {
          row[ColName.Limits].value = v;
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
        newData[v][ColName.Limits].value = prettySegment(
          regs.get(k) as IRegion
        );
      }
    });
    for (let i = newData.length; i < dataRef.current.length; i += 1) {
      const row = dataRef.current[i].map((r) => r);
      if (row[ColName.Limits].value !== '') {
        row[ColName.Limits].value = '';
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

  // The Create button must promise what `writeResources` will actually save: a
  // row only becomes a resource when it has both a segment (Limits, set from
  // the player's regions) and a Reference, so count those rows rather than every
  // selected passage/section. Rows for unused segments (blank Reference) and
  // unsegmented items (blank Limits) are excluded, matching the save condition.
  const numResourcesToCreate = useMemo(
    () =>
      data.filter(
        (row, i) =>
          i > 0 &&
          Boolean(row[ColName.Limits].value) &&
          Boolean(row[ColName.Ref].value)
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  const handleSuffix = (e: ChangeEvent<HTMLInputElement>) => {
    setSuffix(e.target.value);
    // The suffix feeds the saved topic, so editing it marks the wizard dirty too
    // (so a browser/app close mid-edit warns).
    if (!isChanged(wizToolId)) toolChanged(wizToolId);
  };

  // Reference cells carry their row's `info`; derive the localized label here so
  // it recomputes on each render and follows a runtime language change. Fall
  // back to the stored reference text if the label can't be resolved, so a row
  // with missing info never shows a blank/"undefined" cell.
  const handleValueRenderer = (cell: ICell) => {
    if (!cell.info) return cell.value;
    const label = cell.info.passage
      ? passageLabel(cell.info.passage, labelBookData)
      : sectionLabel(cell.info.section, organizedBy);
    return label || cell.value;
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        // Fill the dialog's (flex-column) content area so the sheet grows and
        // the footer buttons stay pinned to the bottom. Relies on the BigDialog
        // passing a flex-column dialogContentSx for this wizard.
        flex: '1 1 auto',
        minHeight: 0,
      }}
    >
      <PassageDetailPlayer
        width={width}
        allowSegment={NamedRegions.ProjectResource}
        allowSegmentNav
        layoutMode="transport"
        onSegment={handleSegment}
        suggestedSegments={pastedSegments}
      />
      <StyledPaper id="proj-res-sheet" elevation={0}>
        {/* Only the table scrolls; it fills the region edge-to-edge (no padding
            frame) and carries a border so the scroll area is outlined. The
            suffix row below stays pinned/visible. */}
        <Box
          data-testid="proj-res-sheet"
          sx={{
            // `0 1 auto`: size to the table's content so the black outline hugs
            // it (empty paper space falls below the outline). When the table is
            // taller than the available space, flex-shrink caps the box and it
            // scrolls internally.
            flex: '0 1 auto',
            minHeight: 0,
            overflow: 'auto',
            border: 1,
            borderColor: 'common.black',
          }}
        >
          <DataSheet
            data={data}
            valueRenderer={handleValueRenderer}
            onCellsChanged={handleCellsChanged}
            parsePaste={handleParsePaste}
            sheetRenderer={ProjectResourceTable}
          />
        </Box>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          // `mt: 'auto'` soaks up the leftover paper space when the table is
          // short, so the suffix field and copy button hug the bottom instead
          // of leaving a gap above the dialog's action row.
          sx={{ flexShrink: 0, px: 0, py: 1.5, mt: 'auto' }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label={t.suffix}
              variant="outlined"
              size="small"
              sx={{ width: 240 }}
              value={suffix}
              onChange={handleSuffix}
            />
            <LightTooltip title={t.suffixTip}>
              {/* Focusable + labelled so keyboard/AT users can reach the tip. */}
              <InfoIcon
                color="info"
                fontSize="small"
                role="img"
                aria-label={t.suffixTip}
                tabIndex={0}
              />
            </LightTooltip>
          </Stack>
          <Button
            id="copy-configure"
            disabled={numSegments === 0}
            onClick={handleCopy}
          >
            {ts.clipboardCopy}
          </Button>
        </Stack>
      </StyledPaper>
      {/* Fixed footer: keeps the action buttons pinned to the dialog bottom
          while the sheet above scrolls. Wrapping ActionRow in a non-growing
          Box neutralizes its flexGrow:1 inside this flex column. */}
      <Box sx={{ flexShrink: 0 }}>
        <ActionRow>
          <Box sx={{ ...rowSx, ml: 'auto' }}>
            <Button
              id="res-create"
              color="primary"
              disabled={numResourcesToCreate === 0 || savingRef.current}
              onClick={handleCreate}
            >
              {t.createXResources.replace(
                '{0}',
                numResourcesToCreate.toString()
              )}
            </Button>
          </Box>
        </ActionRow>
      </Box>
    </Box>
  );
};

export default ProjectResourceConfigure;
