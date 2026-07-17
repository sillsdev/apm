import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IStepEditorStrings,
  OrgWorkflowStep,
  IWorkflowStepsStrings,
  OrgWorkflowStepD,
} from '../../model';
import { Button, Box } from '@mui/material';
import { arrayMoveImmutable as arrayMove } from 'array-move';
import { useGlobal } from '../../context/useGlobal';
import { StepItem } from '.';
import { useOrgWorkflowSteps } from '../../crud/useOrgWorkflowSteps';
import { CheckedChoice as ShowAll } from '../../control';
import { shallowEqual, useSelector } from 'react-redux';
import { toCamel } from '../../utils';
import {
  getTool,
  ToolSlug,
  defaultWorkflow,
  useTools,
  useArtifactType,
  VernacularTag,
  getToolSettings,
  remoteIdGuid,
} from '../../crud';
import { parseStepLanguageField } from '../../crud/transcribeStepAsrSettings';
import { AddRecord, ReplaceRelatedRecord } from '../../model/baseModel';
import { useSnackBar } from '../../hoc/SnackBar';
import { UnsavedContext } from '../../context/UnsavedContext';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { TranscribeStepSettings } from './TranscribeStepSettings';
import { ParatextStepSettings } from './ParatextStepSettings';
import { PhraseBackTranslateStepSettings } from './PhraseBackTranslateStepSettings';
import { stepEditorSelector, workflowStepsSelector } from '../../selector';
import { RecordKeyMap } from '@orbit/records';
import { VertListDnd } from '../../hoc/VertListDnd';
import { DiscussStepSettings } from './DiscussStepSettings';
import { RecordStepSettings } from './RecordStepSettings';

export interface IStepRow {
  id: string;
  seq: number;
  name: string;
  pos: number;
  tool: string;
  settings: string;
  prettySettings: string;
  rIdx: number;
}

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
  const settingsTools = [
    ToolSlug.Transcribe,
    ToolSlug.Paratext,
    ToolSlug.Discuss,
    ToolSlug.Record,
    ToolSlug.PhraseBackTranslate,
  ];
  const mxSeq = useMemo(() => {
    let max = 0;
    rows.forEach((r) => {
      max = Math.max(r.seq, max);
    });
    return max;
  }, [rows]);

  const visible = useMemo(() => {
    return rows.filter((r) => r.seq >= 0).length;
  }, [rows]);

  const hidden = useMemo(() => {
    return rows.filter((r) => r.seq < 0).length;
  }, [rows]);

  const hiddenMessage = useMemo(
    () => se.stepsHidden.replace('{0}', hidden.toString()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hidden]
  );

  const getOrgNames = (exceptId?: string) => {
    return rows.filter((r) => r.id !== exceptId).map((r) => r.name);
  };

  // Captures the persisted fields of a row so two rows can be compared for
  // real changes. Both sides go through the same transforms (localized name,
  // camel tool, stringified tool/settings), so unchanged steps match exactly.
  const rowSignature = (row: IStepRow) =>
    JSON.stringify({
      name: row.name,
      seq: row.seq,
      tool: row.tool,
      settings: row.settings,
    });

  const mangleName = (
    name: string,
    orgNames: string[],
    index?: number,
    mangleTranscribe: boolean = true
  ) => {
    if (mangleTranscribe) {
      const hasTranscribe =
        name === st.transcribe &&
        rows.some((r, i) => {
          const settings = r.settings ? JSON.parse(r.settings) : undefined;
          if (!settings) return r.tool === ToolSlug.Transcribe && i !== index;
          return false;
        });
      name = hasTranscribe ? st.review : name;
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
    if (!open) setToolSettingsRow(-1);
    if (toolRef.current !== undefined) {
      focusIndex.current = toolRef.current;
      const settings = (rows[toolRef.current as number] as IStepRow).settings
        ? JSON.parse((rows[toolRef.current as number] as IStepRow).settings)
        : {};
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
      let name =
        localizedTool((rows[toolRef.current as number] as IStepRow).tool) +
        lang +
        artShortName;
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
    setRows(
      rows.map((r, i) =>
        i === toolSettingsRow
          ? { ...r, settings, prettySettings: prettySettings(r.tool, settings) }
          : r
      )
    );
    toolChanged(toolId, true);
  };

  const handleToolChange = (tool: string, index: number) => {
    focusIndex.current = index;
    if (settingsTools.includes(tool as ToolSlug)) toolRef.current = index;
    setToolSettingsRow(index); //bring up Settings editor
    let name = (rows[index] as IStepRow).name;
    if (name.includes(se.nextStep))
      name = mangleName(localizedTool(tool), getOrgNames());
    setRows(
      rows.map((r, i) =>
        i === index
          ? {
              ...r,
              tool,
              settings: '',
              prettySettings: prettySettings(tool, ''),
              name,
            }
          : r
      )
    );
    toolChanged(toolId, true);
  };

  const handleSettings = (index: number) => {
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

  const handleVisible = async (index: number) => {
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

  const handleAdd = async () => {
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
        prettySettings: prettySettings(tool, ''),
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
    const orgNames = new Set<string>();
    let count = 0;
    for (let ix = 0; ix < rows.length; ix += 1) {
      const row = rows[ix] as IStepRow;
      const id = row.id;
      const tool = JSON.stringify({
        tool: row.tool,
        settings: row.settings,
      });
      if (id) {
        const baseline = baselineRef.current.get(id);
        if (baseline !== undefined && baseline === rowSignature(row)) {
          // Step is unchanged (name, sequence, tool and settings all match
          // what was loaded) — skip the write.
          continue;
        }
        const recId = { type: 'orgworkflowstep', id };
        const rec = memory.cache.query((q) => q.findRecord(recId)) as
          | OrgWorkflowStep
          | undefined;

        if (rec) {
          let name = rec.attributes?.name;
          if (name !== row.name) {
            name = mangleName(
              row.name,
              getOrgNames(id).concat(Array.from(orgNames)),
              ix,
              false
            );
            orgNames.add(name);
          }
          if (
            name !== rec.attributes?.name ||
            row.seq !== rec.attributes?.sequencenum ||
            tool !== rec.attributes?.tool
          ) {
            await memory.update((t) =>
              t.updateRecord({
                ...rec,
                attributes: {
                  ...rec.attributes,
                  name,
                  sequencenum: row.seq,
                  tool: tool,
                },
              })
            );
            count += 1;
          }
        }
      } else {
        const name = mangleName(
          row.name,
          getOrgNames().concat(Array.from(orgNames)),
          ix,
          false
        );
        const rec = {
          type: 'orgworkflowstep',
          attributes: {
            sequencenum: row.seq,
            name,
            process: process || defaultWorkflow,
            tool: tool,
            permissions: '{}',
          },
        } as OrgWorkflowStep;
        if (org) {
          await memory.update((t) => [
            ...AddRecord(t, rec, user, memory),
            ...ReplaceRelatedRecord(
              t,
              rec as OrgWorkflowStepD,
              'organization',
              'organization',
              org
            ),
          ]);
        }
        count += 1;
      }
    }
    rows.forEach((row) => {
      if (row.id) baselineRef.current.set(row.id, rowSignature(row));
    });
    showMessage(se.changes.replace('{0}', count.toString()));
    saving.current = false;
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
            prettySettings: prettySettings(tool, settings),
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

  useEffect(() => {
    setSortKey((sortKey) => sortKey + 1);
  }, [rows, showAll]);

  useLayoutEffect(() => {
    if (!scrollNewStepIntoViewRef.current) return;
    const el = listEndAnchorRef.current;
    if (!el) return;
    scrollNewStepIntoViewRef.current = false;
    const scrollParent = (() => {
      let p: HTMLElement | null = el.parentElement;
      while (p) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === 'auto' || oy === 'scroll') return p;
        p = p.parentElement;
      }
      return null;
    })();
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
    const json = settings ? JSON.parse(settings) : undefined;
    switch (tool as ToolSlug) {
      case ToolSlug.Record:
      case ToolSlug.Transcribe:
      case ToolSlug.Paratext:
      case ToolSlug.PhraseBackTranslate:
        if (json)
          return se.settingsFor
            .replace('{0}', st.getString(tool as keyof typeof se))
            .replace(
              '{1}',
              localizedArtifactTypeFromId(
                remoteIdGuid(
                  'artifacttype',
                  json.artifactTypeId,
                  memory?.keyMap as RecordKeyMap
                ) ?? json.artifactTypeId
              )
            );
        return se.settingsFor
          .replace('{0}', st.getString(tool as keyof typeof se))
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
          zIndex: 1,
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
                settingsTools.includes(r.tool as ToolSlug)
                  ? handleSettings
                  : undefined
              }
              settingsTitle={r.prettySettings}
            />
          ))}
      </VertListDnd>
      <Box
        ref={listEndAnchorRef}
        id="wk-step-list-end-anchor"
        aria-hidden
        sx={{ height: 1, width: '100%', flexShrink: 0 }}
      />
      {toolSettingsRow > -1 && (
        <BigDialog
          title={localizedTool((rows[toolSettingsRow] as IStepRow).tool)}
          isOpen={
            (rows[toolSettingsRow] as IStepRow).tool === ToolSlug.Transcribe
          }
          onOpen={setToolSettingsOpen}
          bp={BigDialogBp.sm}
        >
          <TranscribeStepSettings
            org={org}
            isOpen={
              (rows[toolSettingsRow] as IStepRow).tool === ToolSlug.Transcribe
            }
            toolSettings={(rows[toolSettingsRow] as IStepRow).settings}
            onChange={handleSettingsChange}
          />
        </BigDialog>
      )}
      {toolSettingsRow > -1 && (
        <BigDialog
          title={localizedTool((rows[toolSettingsRow] as IStepRow).tool)}
          isOpen={
            (rows[toolSettingsRow] as IStepRow).tool === ToolSlug.Paratext
          }
          onOpen={setToolSettingsOpen}
          bp={BigDialogBp.sm}
        >
          <ParatextStepSettings
            toolSettings={(rows[toolSettingsRow] as IStepRow).settings}
            onChange={handleSettingsChange}
          />
        </BigDialog>
      )}
      {toolSettingsRow > -1 && (
        <BigDialog
          title={localizedTool((rows[toolSettingsRow] as IStepRow).tool)}
          isOpen={(rows[toolSettingsRow] as IStepRow).tool === ToolSlug.Discuss}
          onOpen={setToolSettingsOpen}
          bp={BigDialogBp.sm}
        >
          <DiscussStepSettings
            toolSettings={(rows[toolSettingsRow] as IStepRow).settings}
            onChange={handleSettingsChange}
            onClose={() => setToolSettingsOpen(false)}
          />
        </BigDialog>
      )}
      {toolSettingsRow > -1 && (
        <BigDialog
          title={localizedTool((rows[toolSettingsRow] as IStepRow).tool)}
          isOpen={(rows[toolSettingsRow] as IStepRow).tool === ToolSlug.Record}
          onOpen={setToolSettingsOpen}
          bp={BigDialogBp.sm}
        >
          <RecordStepSettings
            toolSettings={(rows[toolSettingsRow] as IStepRow).settings}
            onChange={handleSettingsChange}
            onClose={() => setToolSettingsOpen(false)}
          />
        </BigDialog>
      )}
      {toolSettingsRow > -1 && (
        <BigDialog
          title={localizedTool((rows[toolSettingsRow] as IStepRow).tool)}
          isOpen={
            (rows[toolSettingsRow] as IStepRow).tool ===
            ToolSlug.PhraseBackTranslate
          }
          onOpen={setToolSettingsOpen}
          bp={BigDialogBp.sm}
        >
          <PhraseBackTranslateStepSettings
            toolSettings={(rows[toolSettingsRow] as IStepRow).settings}
            onChange={handleSettingsChange}
            stepId={(rows[toolSettingsRow] as IStepRow).id}
            organizationId={org}
          />
        </BigDialog>
      )}
    </div>
  );
};
