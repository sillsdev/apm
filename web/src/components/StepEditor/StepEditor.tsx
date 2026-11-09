import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { IStepEditorStrings, IWorkflowStepsStrings } from '../../model';
import { Box } from '@mui/material';
import { arrayMoveImmutable as arrayMove } from 'array-move';
import { useGlobal } from '../../context/useGlobal';
import { StepItem } from '.';
import { useOrgWorkflowSteps } from '../../crud/useOrgWorkflowSteps';
import { Button, CheckedChoice as ShowAll } from '../../control';
import { shallowEqual, useSelector } from 'react-redux';
import { toCamel } from '../../utils';
import {
  getTool,
  ToolSlug,
  useTools,
  useArtifactType,
  VernacularTag,
  getToolSettings,
  remoteIdGuid,
  toolHasSettingsDialog,
} from '../../crud';
import { parseStepLanguageField } from '../../crud/transcribeStepAsrSettings';
import { useSnackBar } from '../../hoc/SnackBar';
import { UnsavedContext } from '../../context/UnsavedContext';
import { stepEditorSelector, workflowStepsSelector } from '../../selector';
import { RecordKeyMap } from '@orbit/records';
import { VertListDnd } from '../../hoc/VertListDnd';
import { resolveReviewTranscribeName } from './resolveReviewTranscribeName';
import { IStepRow, rowSignature } from './stepRow';
import { saveOrgWorkflowSteps } from './saveOrgWorkflowSteps';
import { StepSettingsDialogs } from './StepSettingsDialogs';

export type { IStepRow } from './stepRow';

interface SortEndProps {
  oldIndex: number;
  newIndex: number;
}

interface IProps {
  process?: string;
  org: string;
}

export const StepEditor = ({ process, org }: IProps) => {
  const [sortKey, setSortKey] = useState(0);
  const [rows, setRows] = useState<IStepRow[]>([]);
  const [stepsLoaded, setStepsLoaded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const se: IStepEditorStrings = useSelector(stepEditorSelector, shallowEqual);
  const st: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const {
    isChanged,
    toolChanged,
    toolsChanged,
    saveRequested,
    saveCompleted,
    clearRequested,
    clearCompleted,
  } = useContext(UnsavedContext).state;
  const { GetOrgWorkflowSteps, localizedWorkStep } = useOrgWorkflowSteps();
  const { showMessage } = useSnackBar();
  const saving = useRef(false);
  const toolId = 'stepEditor';
  const { localizedTool } = useTools();
  const { localizedArtifactTypeFromId, slugFromId } = useArtifactType();
  const [toolSettingsRow, setToolSettingsRow] = useState(-1);
  const toolRef = useRef<number | undefined>(undefined);
  // Signature of each existing step as it was last loaded/saved, keyed by id.
  // Used to skip writing steps that were not actually changed (including
  // sequence changes from rearranging).
  const baselineRef = useRef<Map<string, string>>(new Map());
  const focusIndex = useRef<number>(0);
  const scrollNewStepIntoViewRef = useRef(false);
  const listEndAnchorRef = useRef<HTMLDivElement | null>(null);
  // Edit Workflow DialogContent scroll — nested settings dialogs (and list
  // remounts) can clear it; remember across open/change/close.
  const workflowScrollTopRef = useRef(0);
  const restoreWorkflowScrollRef = useRef(false);

  const workflowScrollParent = () => {
    const el = listEndAnchorRef.current;
    if (!el) return null;
    let p: HTMLElement | null = el.parentElement;
    while (p) {
      const oy = getComputedStyle(p).overflowY;
      if (oy === 'auto' || oy === 'scroll') return p;
      p = p.parentElement;
    }
    return null;
  };

  const rememberWorkflowScroll = () => {
    const sp = workflowScrollParent();
    if (sp) workflowScrollTopRef.current = sp.scrollTop;
  };

  let mxSeq = 0;
  let visible = 0;
  let hidden = 0;
  rows.forEach((r) => {
    mxSeq = Math.max(r.seq, mxSeq);
    if (r.seq >= 0) visible += 1;
    else hidden += 1;
  });
  const hiddenMessage = se.stepsHidden.replace('{0}', hidden.toString());
  const settingsRow = toolSettingsRow > -1 ? rows[toolSettingsRow] : undefined;

  const getOrgNames = (exceptId?: string) => {
    return rows.filter((r) => r.id !== exceptId).map((r) => r.name);
  };

  const mangleName = (
    name: string,
    orgNames: string[],
    index?: number,
    mangleTranscribe: boolean = true
  ) => {
    if (mangleTranscribe) {
      name = resolveReviewTranscribeName({
        name,
        transcribeLabel: localizedTool(ToolSlug.Transcribe),
        reviewLabel: st.review,
        steps: rows,
        index,
      });
    }
    const baseName = name;
    let count = 1;
    let i = orgNames.indexOf(name);
    while (i >= 0 && i !== index) {
      count += 1;
      name = `${baseName} ${count}`;
      i = orgNames.indexOf(name);
    }
    return name;
  };

  const handleSortEnd = ({ oldIndex, newIndex }: SortEndProps) => {
    if (oldIndex === newIndex) return;
    setToolSettingsRow(-1);
    const filteredRows = rows.filter((r) => r.seq < 0);
    const unFilteredRows = rows
      .filter((r) => r.seq >= 0)
      .map((r, i) => ({ ...r, seq: i }));
    const bias = showAll ? filteredRows.length : 0;
    const newRows = filteredRows.concat(
      arrayMove(unFilteredRows, oldIndex - bias, newIndex - bias).map(
        (r, i) => ({ ...r, seq: i })
      )
    );
    setRows(newRows);
    toolChanged(toolId, true);
  };

  const handleNameChange = (name: string, pos: number, index: number) => {
    focusIndex.current = index;
    setRows(rows.map((r, i) => (i === index ? { ...r, name, pos } : r)));
    if (!isChanged(toolId)) toolChanged(toolId, true);
  };

  const setToolSettingsOpen = (open: boolean) => {
    if (!open) {
      setToolSettingsRow(-1);
      restoreWorkflowScrollRef.current = true;
    }
    if (toolRef.current !== undefined) {
      focusIndex.current = toolRef.current;
      const edited = rows[toolRef.current];
      const settings = edited.settings ? JSON.parse(edited.settings) : {};
      const artId =
        remoteIdGuid(
          'artifacttype',
          settings?.artifactTypeId,
          memory?.keyMap as RecordKeyMap
        ) ?? settings?.artifactTypeId;
      const artSlug = slugFromId(artId);
      const artShortName = artId
        ? ` ${
            Object.hasOwn(se, artSlug)
              ? se.getString(artSlug)
              : localizedArtifactTypeFromId(artId)
          }`
        : '';
      const lang = settings?.language
        ? ` ${parseStepLanguageField(settings.language).languageName}`
        : '';
      let name = localizedTool(edited.tool) + lang + artShortName;
      name = mangleName(name, getOrgNames(), toolRef.current);
      setRows(
        rows.map((r, i) =>
          i === toolRef.current
            ? {
                ...r,
                name,
              }
            : r
        )
      );
      toolRef.current = undefined;
    }
  };

  const handleSettingsChange = (settings: string) => {
    // Vernacular, Q&A and Retell ASR lives in the team default, so only this
    // step's settings change.
    rememberWorkflowScroll();
    setRows((prev) =>
      prev.map((r, i) => (i === toolSettingsRow ? { ...r, settings } : r))
    );
    restoreWorkflowScrollRef.current = true;
    toolChanged(toolId, true);
  };

  const handleToolChange = (tool: string, index: number) => {
    rememberWorkflowScroll();
    focusIndex.current = index;
    if (toolHasSettingsDialog(tool)) toolRef.current = index;
    setToolSettingsRow(index); //bring up Settings editor
    let name = rows[index].name;
    if (name.includes(se.nextStep))
      name = mangleName(localizedTool(tool), getOrgNames());
    setRows(
      rows.map((r, i) =>
        i === index
          ? {
              ...r,
              tool,
              settings: '',
              name,
            }
          : r
      )
    );
    toolChanged(toolId, true);
  };

  const handleSettings = (index: number) => {
    rememberWorkflowScroll();
    setToolSettingsRow(index);
  };

  const handleHide = (index: number) => {
    if (visible === 1) {
      showMessage(se.lastStep);
      return;
    }
    setRows((rows) =>
      rows.map((r, i) => (i === index ? { ...r, seq: -1 } : r))
    );
    showMessage(se.oneHidden);
    toolChanged(toolId, true);
  };

  const handleVisible = (index: number) => {
    setRows((rows) =>
      rows
        .map((r, i) => (i === index ? { ...r, seq: mxSeq + 1 } : r))
        .sort((i, j) => i.seq - j.seq)
    );
    showMessage(se.oneVisible);
    toolChanged(toolId, true);
  };

  const handleShow = () => {
    setShowAll(!showAll);
  };

  const handleAdd = () => {
    focusIndex.current = rows.length;
    scrollNewStepIntoViewRef.current = true;
    const name = mangleName(se.nextStep, getOrgNames());
    const tool = ToolSlug.Discuss;
    setRows([
      ...rows,
      {
        id: '',
        name,
        pos: 0,
        tool,
        settings: '',
        seq: mxSeq + 1,
        rIdx: rows.length,
      },
    ]);
    showMessage(se.stepAdded);
    toolChanged(toolId, true);
  };

  const saveRecs = async () => {
    if (saving.current) return;
    saving.current = true;
    showMessage(se.saving);
    try {
      const count = await saveOrgWorkflowSteps({
        rows,
        org,
        process,
        memory,
        user,
        baseline: baselineRef.current,
        mangleName,
        getOrgNames,
      });
      showMessage(se.changes.replace('{0}', count.toString()));
    } finally {
      saving.current = false;
    }
  };

  useEffect(() => {
    if (saveRequested(toolId)) saveRecs().then(() => saveCompleted(toolId));
    else if (clearRequested(toolId)) clearCompleted(toolId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolsChanged]);

  useEffect(() => {
    let cancelled = false;
    setStepsLoaded(false);
    GetOrgWorkflowSteps({ process: 'ANY', org, showAll: true }).then(
      (orgSteps) => {
        if (cancelled) return;
        const newRows = Array<IStepRow>();
        orgSteps.forEach((s) => {
          const tool = getTool(s.attributes?.tool);
          const settings = getToolSettings(s.attributes?.tool);
          newRows.push({
            id: s.id,
            seq: s.attributes?.sequencenum,
            name: localizedWorkStep(s.attributes?.name),
            pos: 0,
            tool: toCamel(tool),
            settings: settings,
            rIdx: newRows.length,
          });
        });
        const sorted = newRows.sort((i, j) => i.seq - j.seq);
        baselineRef.current = new Map(
          sorted.filter((r) => r.id).map((r) => [r.id, rowSignature(r)])
        );
        setRows(sorted);
        setStepsLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  // Remount VertListDnd only when visible membership/order changes. Remounting
  // on every rows write (Phrase Back Translate language, discuss markdown, …)
  // collapses dialog content briefly and resets Edit Workflow scroll.
  const listStructureKey = useMemo(
    () =>
      rows
        .filter((r) => r.seq >= 0 || showAll)
        .map((r) => `${r.id || `n${r.rIdx}`}:${r.seq}`)
        .join('|'),
    [rows, showAll]
  );

  useEffect(() => {
    setSortKey((sortKey) => sortKey + 1);
  }, [listStructureKey]);

  // After nested settings close / settings writes, MUI focus restore can clear
  // DialogContent scroll after layout — restore on the following frames.
  useEffect(() => {
    if (!restoreWorkflowScrollRef.current) return;
    restoreWorkflowScrollRef.current = false;
    const top = workflowScrollTopRef.current;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const sp = workflowScrollParent();
        if (sp) sp.scrollTop = top;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [rows, toolSettingsRow]);

  useLayoutEffect(() => {
    if (!scrollNewStepIntoViewRef.current) return;
    const el = listEndAnchorRef.current;
    if (!el) return;
    scrollNewStepIntoViewRef.current = false;
    const scrollParent = workflowScrollParent();
    if (scrollParent) {
      const pad = 8;
      const spRect = scrollParent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      if (elRect.bottom > spRect.bottom - pad) {
        scrollParent.scrollTop += elRect.bottom - spRect.bottom + pad;
      } else if (elRect.top < spRect.top + pad) {
        scrollParent.scrollTop += elRect.top - spRect.top - pad;
      }
    } else {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [sortKey]);

  const prettySettings = (tool: string, settings: string) => {
    let json: { artifactTypeId?: string } | undefined;
    if (settings) {
      try {
        json = JSON.parse(settings);
      } catch {
        // Malformed server/Orbit settings must not crash render.
        json = undefined;
      }
    }
    const toolName = localizedTool(tool);
    switch (tool as ToolSlug) {
      case ToolSlug.Record:
      case ToolSlug.Transcribe:
      case ToolSlug.Paratext:
        if (json) {
          const artifactTypeId = json.artifactTypeId;
          return se.settingsFor
            .replace('{0}', toolName)
            .replace(
              '{1}',
              localizedArtifactTypeFromId(
                artifactTypeId
                  ? (remoteIdGuid(
                      'artifacttype',
                      artifactTypeId,
                      memory?.keyMap as RecordKeyMap
                    ) ?? artifactTypeId)
                  : null
              )
            );
        }
        return se.settingsFor
          .replace('{0}', toolName)
          .replace('{1}', localizedArtifactTypeFromId(VernacularTag));
      default:
        return '';
    }
  };

  return (
    <div>
      <Box
        sx={(theme) => ({
          display: 'flex',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: theme.palette.background.paper,
          pb: 1,
          borderBottom: `1px solid ${theme.palette.divider}`,
        })}
      >
        <Button
          id="wk-step-add"
          onClick={handleAdd}
          variant="contained"
          disabled={!stepsLoaded}
        >
          {se.add}
        </Button>
        <div title={hiddenMessage}>
          <ShowAll
            label={se.showAll}
            value={showAll}
            onChange={handleShow}
            disabled={hidden === 0}
          />
        </div>
      </Box>
      <VertListDnd key={`sort-${sortKey}`} onDrop={handleSortEnd} dragHandle>
        {rows
          .map((r, i) => ({ ...r, rIdx: i }))
          .filter((r) => r.seq >= 0 || showAll)
          .map((r) => (
            <StepItem
              key={`si-${r.rIdx}`}
              index={r.rIdx}
              value={r}
              isFocused={focusIndex.current === r.rIdx}
              onNameChange={handleNameChange}
              onToolChange={handleToolChange}
              onDelete={handleHide}
              onRestore={handleVisible}
              onSettings={
                toolHasSettingsDialog(r.tool) ? handleSettings : undefined
              }
              settingsTitle={prettySettings(r.tool, r.settings)}
            />
          ))}
      </VertListDnd>
      <Box
        ref={listEndAnchorRef}
        id="wk-step-list-end-anchor"
        aria-hidden
        sx={{ height: 1, width: '100%', flexShrink: 0 }}
      />
      <StepSettingsDialogs
        org={org}
        row={settingsRow}
        onOpen={setToolSettingsOpen}
        onChange={handleSettingsChange}
      />
    </div>
  );
};
