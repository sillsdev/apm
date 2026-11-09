import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { ToolSlug, toolHasMarkdownSettings, useTools } from '../../crud';
import { TranscribeStepSettings } from './TranscribeStepSettings';
import { ParatextStepSettings } from './ParatextStepSettings';
import { PhraseBackTranslateStepSettings } from './PhraseBackTranslateStepSettings';
import { DiscussStepSettings } from './DiscussStepSettings';
import { RecordStepSettings } from './RecordStepSettings';

interface SettingsRow {
  id: string;
  tool: string;
  settings: string;
}

interface IProps {
  org: string;
  row: SettingsRow | undefined;
  onOpen: (open: boolean) => void;
  onChange: (toolSettings: string) => void;
}

/** Nested Edit Workflow settings dialogs — one BigDialog per tool that has settings. */
export function StepSettingsDialogs({ org, row, onOpen, onChange }: IProps) {
  const { localizedTool } = useTools();
  if (!row) return null;

  const title = localizedTool(row.tool);
  const close = () => onOpen(false);

  return (
    <>
      <BigDialog
        title={title}
        isOpen={row.tool === ToolSlug.Transcribe}
        onOpen={onOpen}
        bp={BigDialogBp.sm}
      >
        <TranscribeStepSettings
          org={org}
          isOpen={row.tool === ToolSlug.Transcribe}
          toolSettings={row.settings}
          onChange={onChange}
        />
      </BigDialog>
      <BigDialog
        title={title}
        isOpen={row.tool === ToolSlug.Paratext}
        onOpen={onOpen}
        bp={BigDialogBp.sm}
      >
        <ParatextStepSettings toolSettings={row.settings} onChange={onChange} />
      </BigDialog>
      <BigDialog
        title={title}
        isOpen={toolHasMarkdownSettings(row.tool)}
        onOpen={onOpen}
        bp={BigDialogBp.sm}
      >
        <DiscussStepSettings
          toolSettings={row.settings}
          onChange={onChange}
          onClose={close}
        />
      </BigDialog>
      <BigDialog
        title={title}
        isOpen={row.tool === ToolSlug.Record}
        onOpen={onOpen}
        bp={BigDialogBp.sm}
      >
        <RecordStepSettings
          toolSettings={row.settings}
          onChange={onChange}
          onClose={close}
        />
      </BigDialog>
      <BigDialog
        title={title}
        isOpen={row.tool === ToolSlug.PhraseBackTranslate}
        onOpen={onOpen}
        bp={BigDialogBp.sm}
      >
        <PhraseBackTranslateStepSettings
          toolSettings={row.settings}
          onChange={onChange}
          stepId={row.id}
          organizationId={org}
        />
      </BigDialog>
    </>
  );
}
