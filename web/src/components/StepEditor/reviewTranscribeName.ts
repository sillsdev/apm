import { ToolSlug } from '../../crud/toolSlug';

/**
 * A second Transcribe step whose name is exactly the Transcribe label is the
 * review step, when another Transcribe step still has no settings.
 */
export function reviewTranscribeName(
  name: string,
  transcribeLabel: string,
  reviewLabel: string,
  steps: { tool: string; settings: string }[],
  index?: number
): string {
  if (name !== transcribeLabel) return name;
  const anotherUnset = steps.some((step, i) => {
    if (i === index || step.tool !== ToolSlug.Transcribe) return false;
    if (!step.settings) return true;
    return !JSON.parse(step.settings);
  });
  return anotherUnset ? reviewLabel : name;
}
