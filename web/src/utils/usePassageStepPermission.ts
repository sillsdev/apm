import { SectionD } from '../model';
import type { SharedResourceD } from '../model/sharedResource';
import { isLinkedNote } from '../crud/isLinkedNote';
import { useStepPermissions } from './useStepPermission';

/** Step assignment plus not a linked note (view-only on the link). */
export function usePassageStepPermission(
  currentstep: string,
  section: SectionD,
  passage: { id?: string } | undefined | null,
  sharedResource: SharedResourceD | undefined | null
): boolean {
  const { canDoSectionStep } = useStepPermissions();
  return (
    canDoSectionStep(currentstep, section) &&
    !isLinkedNote(passage, sharedResource)
  );
}
