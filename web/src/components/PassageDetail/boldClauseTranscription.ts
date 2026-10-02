import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { ToolSlug } from '../../crud/toolSlug';

export const boldClauseTranscriptionArtifacts = [
  ArtifactTypeSlug.CarefulSpeech,
  ArtifactTypeSlug.PhraseBackTranslation,
] as const;

export type BoldClauseTranscriptionArtifactSlug =
  (typeof boldClauseTranscriptionArtifacts)[number];

export interface BoldClauseTranscriptionConfig {
  stringsLayout: 'carefulTranscription' | 'lwcTranscription';
  upstreamTool: ToolSlug;
  idPrefix: string;
  toolId: string;
  defaultArtifactSlug: ArtifactTypeSlug;
}

export function isBoldClauseTranscriptionStep(
  tool: string,
  isBoldWorkflow: boolean,
  artifactSlug: string | null
): boolean {
  return (
    isBoldWorkflow &&
    tool === ToolSlug.Transcribe &&
    artifactSlug !== null &&
    boldClauseTranscriptionArtifacts.includes(
      artifactSlug as BoldClauseTranscriptionArtifactSlug
    )
  );
}

/** @deprecated Use isBoldClauseTranscriptionStep */
export function isBoldLwcTranscriptionStep(
  tool: string,
  isBoldWorkflow: boolean,
  artifactSlug: string | null
): boolean {
  return (
    isBoldClauseTranscriptionStep(tool, isBoldWorkflow, artifactSlug) &&
    artifactSlug === ArtifactTypeSlug.PhraseBackTranslation
  );
}

export function upstreamToolForRecordingArtifact(
  artifactSlug: string
): ToolSlug | undefined {
  if (artifactSlug === ArtifactTypeSlug.CarefulSpeech) {
    return ToolSlug.CarefulSpeech;
  }
  if (artifactSlug === ArtifactTypeSlug.PhraseBackTranslation) {
    return ToolSlug.PhraseBackTranslate;
  }
  return undefined;
}

export function configForRecordingArtifact(
  artifactSlug: string | null
): BoldClauseTranscriptionConfig | undefined {
  if (artifactSlug === ArtifactTypeSlug.CarefulSpeech) {
    return {
      stringsLayout: 'carefulTranscription',
      upstreamTool: ToolSlug.CarefulSpeech,
      idPrefix: 'careful-transcription',
      toolId: 'CarefulTranscriptionTool',
      defaultArtifactSlug: ArtifactTypeSlug.CarefulSpeech,
    };
  }
  if (artifactSlug === ArtifactTypeSlug.PhraseBackTranslation) {
    return {
      stringsLayout: 'lwcTranscription',
      upstreamTool: ToolSlug.PhraseBackTranslate,
      idPrefix: 'lwc-transcription',
      toolId: 'LwcTranscriptionTool',
      defaultArtifactSlug: ArtifactTypeSlug.PhraseBackTranslation,
    };
  }
  return undefined;
}
