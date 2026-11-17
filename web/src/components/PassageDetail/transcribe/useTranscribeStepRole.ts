import { useMemo } from 'react';
import { ToolSlug } from '../../../crud/toolSlug';
import { useStepTool } from '../../../crud/useStepTool';
import { useArtifactType } from '../../../crud/useArtifactType';
import {
  ArtifactTypeSlug,
  artifactStampsStepLanguage,
} from '../../../crud/artifactTypeSlug';
import { parseMediaLanguageField } from '../carefulSpeech/matchesGuidedOutputRow';
import { isLangSet } from '../../../utils/langTag';
import { JSONParse } from '../../../utils/jsonParse';

export type TranscribeRole = 'transcriber' | 'editor' | 'view';

export interface TranscribeWorkflowStep {
  id: string;
  sequencenum: number;
  tool: string;
  settings: string;
}

type OrgWorkflowStepLike = {
  id: string;
  attributes?: { sequencenum?: number; tool?: string };
};

/**
 * Step settings, artifact id, checking layout, and the role for this
 * transcribe step. One owner for desktop PassageDetailTranscribe and mobile.
 */
export function useTranscribeStepRole({
  currentstep,
  orgWorkflowSteps,
  hasPermission,
  artifactTypeId: artifactTypeIdProp,
}: {
  currentstep: string;
  orgWorkflowSteps: OrgWorkflowStepLike[] | undefined;
  hasPermission: boolean;
  /** When set (desktop grids), wins over parsing the step settings. */
  artifactTypeId?: string | null;
}) {
  const { settings: workflowStepSettingsRaw } = useStepTool(currentstep);
  const { slugFromId } = useArtifactType();

  const stepSettings = useMemo(() => {
    if (!workflowStepSettingsRaw || workflowStepSettingsRaw === '') return '{}';
    return typeof workflowStepSettingsRaw === 'string'
      ? workflowStepSettingsRaw
      : JSON.stringify(workflowStepSettingsRaw);
  }, [workflowStepSettingsRaw]);

  const artifactTypeIdFromSettings = useMemo(() => {
    try {
      const parsed = JSON.parse(stepSettings || '{}') as {
        artifactTypeId?: string;
      };
      return parsed.artifactTypeId ?? null;
    } catch {
      return null;
    }
  }, [stepSettings]);

  const artifactTypeId =
    artifactTypeIdProp !== undefined
      ? artifactTypeIdProp
      : artifactTypeIdFromSettings;

  const parsedSteps = useMemo(() => {
    if (!orgWorkflowSteps) return [] as TranscribeWorkflowStep[];
    return orgWorkflowSteps
      .slice()
      .sort(
        (a, b) =>
          (a.attributes?.sequencenum ?? 0) - (b.attributes?.sequencenum ?? 0)
      )
      .map((s, ix) => {
        const toolData = JSONParse(s?.attributes?.tool) as {
          tool?: string;
          settings?: string | object;
        };
        return {
          id: s.id,
          sequencenum: ix,
          tool: toolData.tool ?? '',
          settings:
            typeof toolData.settings === 'string'
              ? toolData.settings || '{}'
              : JSON.stringify(toolData.settings ?? {}),
        } satisfies TranscribeWorkflowStep;
      });
  }, [orgWorkflowSteps]);

  const vernacularSteps = useMemo(
    () =>
      parsedSteps.filter(
        (s) =>
          s.tool === ToolSlug.Transcribe &&
          !JSON.parse(s.settings).artifactTypeId
      ),
    [parsedSteps]
  );

  const hasChecking = useMemo(
    () =>
      vernacularSteps.length > 1 &&
      vernacularSteps[1].sequencenum === vernacularSteps[0].sequencenum + 1,
    [vernacularSteps]
  );

  const nextStep = useMemo(() => {
    if (!currentstep || !parsedSteps.length) return null;
    let found = false;
    for (const s of parsedSteps) {
      if (s.id === currentstep) {
        found = true;
        continue;
      }
      if (!found) continue;
      return s.id;
    }
    return null;
  }, [currentstep, parsedSteps]);

  const prevStep = useMemo(() => {
    if (!currentstep || !parsedSteps.length) return null;
    let found = '';
    for (const s of parsedSteps) {
      if (s.id === currentstep) break;
      found = s.id;
    }
    return found;
  }, [currentstep, parsedSteps]);

  const curRole = useMemo((): TranscribeRole | undefined => {
    if (!currentstep) return undefined;
    if (!hasPermission) return 'view';
    if (!hasChecking) return 'transcriber';
    if (artifactTypeId) return 'transcriber';
    if (vernacularSteps[0]?.id === currentstep) return 'transcriber';
    return 'editor';
  }, [
    currentstep,
    vernacularSteps,
    artifactTypeId,
    hasChecking,
    hasPermission,
  ]);

  const stepLanguageBcp47 = useMemo(() => {
    if (!artifactTypeId) return undefined;
    if (
      !artifactStampsStepLanguage(
        slugFromId(artifactTypeId) as ArtifactTypeSlug
      )
    )
      return undefined;
    let language: unknown;
    try {
      language = (JSON.parse(stepSettings) as { language?: unknown }).language;
    } catch {
      language = undefined;
    }
    const { bcp47 } = parseMediaLanguageField(language);
    return isLangSet(bcp47) ? bcp47 : undefined;
  }, [artifactTypeId, slugFromId, stepSettings]);

  return {
    stepSettings,
    artifactTypeId,
    parsedSteps,
    vernacularSteps,
    hasChecking,
    nextStep,
    prevStep,
    curRole,
    stepLanguageBcp47,
    slugFromId,
  };
}
