import { ComponentType } from 'react';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { ToolSlug, toolHasMarkdownSettings, useTools } from '../../crud';
import { TranscribeStepSettings } from './TranscribeStepSettings';
import { ParatextStepSettings } from './ParatextStepSettings';
import { PhraseBackTranslateStepSettings } from './PhraseBackTranslateStepSettings';
import { DiscussStepSettings } from './DiscussStepSettings';
import { RecordStepSettings } from './RecordStepSettings';
import { IStepRow } from './stepRow';

type SettingsRow = Pick<IStepRow, 'id' | 'tool' | 'settings'>;

interface IProps {
  org: string;
  row: SettingsRow | undefined;
  onOpen: (open: boolean) => void;
  onChange: (toolSettings: string) => void;
}

interface SettingsBodyArgs {
  org: string;
  row: SettingsRow;
  onChange: (toolSettings: string) => void;
  onClose: () => void;
}

function TranscribeBody({ org, row, onChange }: SettingsBodyArgs) {
  // Only rendered while its dialog is open (MUI does not mount closed dialogs).
  return (
    <TranscribeStepSettings
      org={org}
      isOpen
      toolSettings={row.settings}
      onChange={onChange}
    />
  );
}

function ParatextBody({ row, onChange }: SettingsBodyArgs) {
  return (
    <ParatextStepSettings toolSettings={row.settings} onChange={onChange} />
  );
}

function RecordBody({ row, onChange, onClose }: SettingsBodyArgs) {
  return (
    <RecordStepSettings
      toolSettings={row.settings}
      onChange={onChange}
      onClose={onClose}
    />
  );
}

function PhraseBackTranslateBody({ org, row, onChange }: SettingsBodyArgs) {
  return (
    <PhraseBackTranslateStepSettings
      toolSettings={row.settings}
      onChange={onChange}
      stepId={row.id}
      organizationId={org}
    />
  );
}

function MarkdownBody({ row, onChange, onClose }: SettingsBodyArgs) {
  return (
    <DiscussStepSettings
      toolSettings={row.settings}
      onChange={onChange}
      onClose={onClose}
    />
  );
}

type SettingsBody = ComponentType<SettingsBodyArgs>;

const settingsBodies: Partial<Record<string, SettingsBody>> = {
  [ToolSlug.Transcribe]: TranscribeBody,
  [ToolSlug.Paratext]: ParatextBody,
  [ToolSlug.Record]: RecordBody,
  [ToolSlug.PhraseBackTranslate]: PhraseBackTranslateBody,
};

/** Markdown-settings tools (Discuss and friends) share one body. */
const settingsBodyFor = (tool: string): SettingsBody | undefined =>
  settingsBodies[tool] ??
  (toolHasMarkdownSettings(tool) ? MarkdownBody : undefined);

/** Nested Edit Workflow settings dialog for the step's tool, if it has settings. */
export function StepSettingsDialogs({ org, row, onOpen, onChange }: IProps) {
  const { localizedTool } = useTools();
  if (!row) return null;
  const Body = settingsBodyFor(row.tool);
  if (!Body) return null;

  return (
    <BigDialog
      key={row.tool}
      title={localizedTool(row.tool)}
      isOpen
      onOpen={onOpen}
      bp={BigDialogBp.sm}
    >
      <Body
        org={org}
        row={row}
        onChange={onChange}
        onClose={() => onOpen(false)}
      />
    </BigDialog>
  );
}
