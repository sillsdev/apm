import { getTool, getToolSettings } from '../../crud/useStepTool';
import { ToolSlug } from '../../crud/toolSlug';
import { related } from '../../crud/related';
import {
  parseStepLanguageField,
  SlugFromIdFn,
} from '../../crud/transcribeStepAsrSettings';
import { OrgWorkflowStepD } from '../../model';

export function isDuplicatePhraseBtLanguage(
  steps: OrgWorkflowStepD[],
  opts: {
    stepId?: string;
    /** The step's artifact type as a slug (or a legacy id). */
    artifactTypeId: string;
    languageBcp47: string;
    /** When set, only compare against Phrase BT steps for this team. */
    organizationId?: string;
    /**
     * Normalizes both the target and each step's stored artifactTypeId to a
     * slug, so steps that still hold a legacy id compare equal to slug data.
     */
    slugFromId: SlugFromIdFn;
  }
): boolean {
  if (!opts.languageBcp47 || opts.languageBcp47 === 'und') return false;
  const targetSlug = opts.slugFromId(opts.artifactTypeId);
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
    const artSlug = opts.slugFromId(String(settings.artifactTypeId ?? ''));
    if (artSlug !== targetSlug) return false;
    return (
      parseStepLanguageField(settings.language).bcp47 === opts.languageBcp47
    );
  });
}
