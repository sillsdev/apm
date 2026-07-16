import { RecordKeyMap } from '@orbit/records';
import { getTool, getToolSettings, remoteIdGuid, ToolSlug } from '../../crud';
import { parseStepLanguageField } from '../../crud/transcribeStepAsrSettings';
import { OrgWorkflowStepD } from '../../model';

export function isDuplicatePhraseBtLanguage(
  steps: OrgWorkflowStepD[],
  opts: {
    stepId?: string;
    artifactTypeId: string;
    languageBcp47: string;
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
