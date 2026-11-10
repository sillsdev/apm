import { ToolSlug } from '../../crud/toolSlug';

export interface ResolveReviewTranscribeNameArgs {
  name: string;
  transcribeLabel: string;
  reviewLabel: string;
  steps: { tool: string; settings: string }[];
  index?: number;
}

function hasSettings(settings: string): boolean {
  if (!settings) return false;
  try {
    return Boolean(JSON.parse(settings));
  } catch {
    // Malformed server/Orbit data: treat as present so we do not auto-rename.
    return true;
  }
}

/**
 * A second Transcribe step whose name is exactly the Transcribe label is the
 * review step, when another Transcribe step still has no settings.
 */
export function resolveReviewTranscribeName({
  name,
  transcribeLabel,
  reviewLabel,
  steps,
  index,
}: ResolveReviewTranscribeNameArgs): string {
  if (name !== transcribeLabel) return name;
  const anotherUnset = steps.some((step, i) => {
    if (i === index || step.tool !== ToolSlug.Transcribe) return false;
    return !hasSettings(step.settings);
  });
  return anotherUnset ? reviewLabel : name;
}
