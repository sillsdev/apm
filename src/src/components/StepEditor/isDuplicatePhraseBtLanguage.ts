import { RecordKeyMap } from '@orbit/records';
import { getTool, getToolSettings } from '../../crud/useStepTool';
import { remoteIdGuid } from '../../crud/remoteId';
import { ToolSlug } from '../../crud/toolSlug';
import { related } from '../../crud/related';
import { parseStepLanguageField } from '../../crud/transcribeStepAsrSettings';
import { OrgWorkflowStepD } from '../../model';

export function isDuplicatePhraseBtLanguage(
  steps: OrgWorkflowStepD[],
  opts: {
    stepId?: string;
    artifactTypeId: string;
    languageBcp47: string;
    /** When set, only compare against Phrase BT steps for this team. */
    organizationId?: string;
    keyMap?: RecordKeyMap;
  }
): boolean {
  if (!opts.languageBcp47 || opts.languageBcp47 === 'und') return false;
  const targetArt = opts.keyMap
    ? (remoteIdGuid('artifacttype', opts.artifactTypeId, opts.keyMap) ??
      opts.artifactTypeId)
    : opts.artifactTypeId;
  return steps.some((step) => {
    if (opts.stepId && step.id === opts.stepId) return false;
    if (
      opts.organizationId &&
      related(step, 'organization') !== opts.organizationId
    ) {
      return false;
    }
    if (getTool(step.attributes?.tool) !== ToolSlug.PhraseBackTranslate) {
      return false;
    }
    let settings: Record<string, unknown> = {};
    try {
      settings = JSON.parse(
        getToolSettings(step.attributes?.tool) || '{}'
      ) as Record<string, unknown>;
    } catch {
      return false;
    }
    const artId = String(settings.artifactTypeId ?? '');
    const artGuid = opts.keyMap
      ? (remoteIdGuid('artifacttype', artId, opts.keyMap) ?? artId)
      : artId;
    if (artGuid !== targetArt) return false;
    return (
      parseStepLanguageField(settings.language).bcp47 === opts.languageBcp47
    );
  });
}
